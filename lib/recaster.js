/*global module:false process:false require:false */
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:8 maxlen:150 devel:true newcap:false*/

var zlib, less, stylus, jade, marked, Compiler, transformEs6, sjs, tsc, UglifyJS,
    minifyHtml, csso, cleanCSS, denodify, scriptInjector;

var zipper;
var passes;

//utilities
var VOW = require('dougs_vow'),
extend = require('extend'),
fs = require('fs-extra'),
Path = require('path'),
// util = require('util')
extToFunction = {}
    ;

//So the whole thing starts up quick with options turned off:
function conditionalRequire(options) {
    //Transpile:
    //to css
    if (options.transpilerOne.less) less = require('less'); // http://lesscss.org/#usage
    if (options.transpilerOne.stylus) stylus = require('stylus'); // http://learnboost.github.io/stylus/docs/js.html
    //to html
    if (options.transpilerOne.jade) jade = require('jade'); //http://jadelang.com/api/
    if (options.transpilerOne.markdown) marked = require('marked'); //://npmjs.org/package/marked
    // //to js
    if (options.transpilerOne.coffee)
        Compiler = require('./coffee-compiler'); //https://npmjs.org/package/coffeescript-compiler
    if (options.transpilerTwo.js) transformEs6 = require('regenerator'); //https://github.com/facebook/regenerator
    if (options.transpilerOne.sjs) sjs = require('sweet.js'); //http://sweetjs.org/
    if (options.transpilerOne.tsc) tsc = require('../node_modules/node-typescript/lib/compiler');//https://npmjs.org/package/node-typescript

    // //Minify
    // //js
    if (options.minifier.js) UglifyJS = require("uglify-js"); //https://github.com/mishoo/UglifyJS2
    // //html
    if (options.minifier.html) minifyHtml = require('html-minifier'); //http://perfectionkills.com/experimenting-with-html-minifier/
    // //css
    // if (options.minifier.css)  csso = require('csso');//http://bem.info/tools/csso/usage/
    if (options.minifier.css)  cleanCSS = require('clean-css'); //https://github.com/GoalSmashers/clean-css
    
    if (options.transpilerThree.js === 'denodify') denodify = require('denodify'); //https://github.com/facebook/regenerator
    
    //using modified versions that doesn't wrap script in iife
    if (options.transpilerTwo.html === 'inject') scriptInjector = require('./script-injector'); https://github.com/dlmanning/script-injector
    
    if (options.zip) {
        zlib = require('zlib');
        zipper = {
            gzip: zlib.gzip
            ,deflate: zlib.deflate
        };
        
    }

}


//mapping extension to transform function/informal name
var optionsMap = {
    transpilerOne: {
        //to js
        sjs: 'sweetjs',
        coffee: 'coffeescript',
        tsc: 'typescript',
        js: 'identity',
        //to html
        jade: 'jade',
        md: 'markdown',
        mdown: 'markdown',
        markdown: 'markdown',
        html: 'identity',
        //to css
        less: 'less',
        stylus: 'stylus',
        css: 'identity'
    },
    transpilerTwo: {
        js: 'regenerators', //generators only sofar to use es6 features
        css: 'identity',
        html: 'inject'
    },
    transpilerThree: {
        js: 'denodify', 
        css: 'identity',
        html: 'identity'
    },
    minifier: {
        js: 'uglifyJs2',
        css: 'cleanCss',
        // css: 'csso', //TODO: gives errors
        html: 'htmlMinifier'
    }
};

var defaultOptions = {
    //active transformers:
    transpile: ['jade', 'less', 'stylus', 'sweetjs', 'typescript', 'coffeescript', 'markdown',
                'regenerators','denodify', 'inject'],
    minify: ['js', 'css', 'html'],
    zip: true,
    
    //settings for transformers:
    markdown: { gfm: true,
                tables: true,
                breaks: false,
                pedantic: false,
                sanitize: true,
                smartLists: true,
                langPrefix: 'language-'
                // ,highlight: function(code, lang) {
                //     if (lang === 'js') {
                //         return highlighter.javascript(code);
                //     }
                //     return code;
                // }
              },
    htmlMinifier: {
        removeCommentsFromCDATA: true
        // ,collapseWhitespace: true
        ,removeComments: true 
    }
    //rest of transformers are using defaults..
};

//----------------------Transform functions--------------------------------
var transform = {};
transform.identity = function apply_cleanCSS(data) {
    return VOW.kept(data);
};

transform.cleanCss = function(data) {
    return VOW.kept(extend(data, {recast: new cleanCSS().minify(data.recast, options.cleanCss),
                     minified: true,
                     type: 'css'}));
};
transform.cleanCss.action = 'cleanCSS';

transform.htmlMinifier = function apply_minifyHtml(data) {
    return VOW.kept(extend(data, {recast: minifyHtml.minify (data.recast,
                                                options.htmlMinifier),
                     minified: true,
                     type: 'html'}));
};
transform.htmlMinifier.to = 'html';

transform.uglifyJs2 = function apply_uglifyJs2(data) {
    // debug('\n------------in uglify\n', abridge(data));
    
    // var recast = UglifyJS.minify (data.recast,
    //                               extend({fromString: true},
    //                                      options.uglifyJs2));
    var final_code = data.recast;;
    if (data.path.indexOf('min.js') !== data.path.length - 6) {
        debug('Minifying ' + data.path);
        var jsp = UglifyJS.parser;
        var pro = UglifyJS.uglify;

        var orig_code = data.recast;
        var ast = jsp.parse(orig_code); // parse code and get the initial AST
        ast = pro.ast_mangle(ast); // get a new AST with mangled names
        ast = pro.ast_squeeze(ast); // get an AST with compression optimizations
        final_code = pro.gen_code(ast); // compressed code here
    }
    return VOW.kept(extend(data, {
        recast: final_code,
        minified: true,
        type: 'js'}));
};
transform.uglifyJs2.to = 'js';

transform.less = function apply_less(data) {
    var vow = VOW.make();
    less.render(data.recast, function (err, css) {
        if (err) vow.breek({ recastError: err });
        else vow.keep(extend(data, { recast: css, type: 'css'}));
    });
    return vow.promise;
};
transform.less.to = 'css';

transform.csso = function apply_csso(data) {
    return VOW.kept(extend(data, { recast: csso.justDoIt(data.recast),
                      minified: true,
                      type: 'css'}));
};
transform.csso.to = 'css';

transform.stylus = function apply_stylus(data) {
    var vow = VOW.make();
    stylus.render(data.recast, function(err, css){
        if (err) vow.breek({ recastError: err });
        else vow.keep(extend(data, {recast: css, type: 'css'}));
    });
    return vow.promise;
};
transform.stylus.to = 'css';

transform.jade = function apply_jade(data) {
    // // Compile a function
    var fn = jade.compile(data.recast, {});

    // Render the function
    var locals = {};
    var html = fn(locals);
    return VOW.kept(extend(data, { recast: html, type: 'html'}));
};
transform.jade.to = 'html';

transform.coffeescript = function apply_coffeescript(data) {
    var vow = VOW.make();
    // var cc = new Compiler(process.cwd() + '/../node_modules/coffee-script/bin/coffee');
    var cc = new Compiler();
    cc.compile(data.recast, function (status, output) {
        if (status === 0) vow.keep(extend(data, {recast: output, type: 'js'}));
        else {
            // debug(output);
            vow.breek({ recastError: 'Error transpiling coffeescript: ' + status });
        }
    });
    return vow.promise;
};
transform.coffeescript.to = 'js';

transform.markdown = function apply_marked(data) {
    marked.setOptions(options.markdown);
    return VOW.kept(extend(data, {recast: marked(data.recast), type: 'html'}));
};
transform.markdown.to = 'html';

transform.regenerators = function apply_regen(data) {
    // //include the followiing require with the source
    // //require('./regen-runtime');
    // var es5Source = transformEs6(data.recast);
    // return VOW.kept(es5Source);
    //or:
    var es5SourceWithRuntime = transformEs6(data.recast, { includeRuntime: true });
    return VOW.kept(extend(data, {recast: es5SourceWithRuntime, type: 'js'}));
    };
transform.regenerators.to = 'js'; 

transform.typescript = function apply_typescript(data) {
    var compiler = tsc.compiler;

    tsc.initDefault();

    // var code = '\
    // class Greeter {\
    //     greeting: string;\
    //     constructor(message: string) {\
    //         this.greeting = message;\
    //     }\
    //     greet() {\
    //         return "Hello, " + this.greeting;\
    //     }\
    // }\
    // var greeter = new Greeter("world");\
    // var button = document.createElement("button");\
    // button.innerTtype = "Say Hello";\
    // button.onclick = function() {\
    //     alert(greeter.greet());\
    // };\
    // document.body.appendChild(button);\
    // ';

    tsc.resolve( '/xxx.ts', data.recast, compiler);
    compiler.typeCheck();
    var stdout = new tsc.EmitterIOHost();
    compiler.emit(stdout);
    // console.log(stdout.fileCollection['/home/michieljoris/mysrc/javascript/bb-server/lib/xxx.js'].lines.join(''));
    return VOW.kept(extend(data, {
        recast: stdout.fileCollection['/xxx.js'].lines.join(''),
        type: 'js'}));
    // Get the javascript output in stdout.fileCollection. To this example the javascript output is:

    // { '.../xxx.js':
    //    { lines:
    //       [ 'var Greeter = (function () {',
    //         '    function Greeter(message) {',
    //         '        this.greeting = message;',
    //         '    }',
    //         '    Greeter.prototype.greet = function () {',
    //         '        return "Hello, " + this.greeting;',
    //         '    };',
    //         '    return Greeter;',
    //         '})();',
    //         'var greeter = new Greeter("world");',
    //         'var button = document.createElement("button");',
    //         'button.innerTtype = "Say Hello";',
    //         'button.onclick = function () {',
    //         '    alert(greeter.greet());',
    //         '};',
    //         'document.body.appendChild(button);' ],
    //      currentLine: '' } }
};
transform.typescript.to = 'js';

transform.sweetjs = function apply_sweetjs(data) {
    var js = sjs.compile(data.recast);
    data.type = 'js';
    return VOW.kept(extend(data, {recast: js.code, type: 'js'}));
    // or require directly in other modules on node:
    // require('sweet.js');
    // example = require('./example.sjs');
    // console.log(example.one);
};
transform.sweetjs.to = 'js';

transform.zip = function apply_zip(data, encoding) {
    var vow = VOW.make();
    var zip = zipper[encoding];
    if (!zip) {
        debug('Warning: non existant zip method: ' + options.zip);
        vow.keep(data);   
    }
    else {
        zip(data.recast,
            function(err, result){ 
                if (err) { data.recastError = err;
                           debug('Failed to zip data!!');
                           vow.breek(data); }
                else vow.keep(extend(data,{recast: result, encoding: encoding}));
            });
    } 
    return vow.promise;
};

function abridge(data) {
    var sliced = {};
    Object.keys(data).forEach(function(k) {
        sliced[k] = (typeof data[k] === 'string') ? data[k].slice(0,80) : data[k];
    });
    return sliced;
}

transform.denodify = function apply_denodify(data) {
    debug('denodify', abridge(data));
    if (typeof data.isModule !== 'undefined')
        return VOW.kept(extend(data, {recast: denodify.wrap(data.isModule, data.recast)}));
    else return VOW.kept(data);
};
transform.denodify.to = 'js';

var stream = require('stream');
function streamify(text) {
    var s = new stream.Readable();
    s.push(text);
    s.push(null);
    return s;
}

transform.inject = function apply_inject(data) {
    var vow = VOW.make();
    debug('inject:', data);
    
    var path = data.path;
    if (path.indexOf('/') === 0) path = path.slice(1);
    console.log(path,options.inject);
    if (options.inject && options.inject[path] && 
        options.inject[path].length) {
        var scriptNames = options.inject[path];
        var scriptString = '';
        scriptNames.forEach(function(n) {
            var script = options.scripts[n];
            if (script) {
                if (typeof script === 'function')
                    script = "(" + script.toString() + ")();\n";
                // script = a.match(/function \(\) {(.*)}/);
                else script += "\n";
                scriptString += script;
            }
        });
        var buffer = '';
        var result = streamify(data.recast).pipe(scriptInjector(scriptString));
        result.on('data', function(data) {
            buffer += data;
        });
        result.on('error', function(err) {
            console.log('Error in injecting script');
            vow.breek(err); });

        result.on('end', function(data) {
            // console.log('end:\n'.red, buffer);
            vow.keep(extend(data, {recast: buffer}));
        });
    }
    else vow.keep(data);
    return vow.promise;
};
transform.inject.to = 'html';

//----------------Internals--------------------------------------------------------
var options;
var debug;
// var log = [];

// function Typeof(v) {
//     var type = {}.toString.call(v);
//     return type.slice(8, type.length-1);
// }

function readData(fullPath, data, type, path) {
    var vow = VOW.make();
    // var isModule = Path.extname(Path.basename(path, Path.extname(path))) === '.nm';
    // if (isModule) fullPath = Path.dirname + '/'  + Path.basename(path, Path.extname(path))
    if (data) vow.keep({ recast: data, type: type, isModule: data.isModule});
    else {
        type = Path.extname(fullPath).slice(1);
        // if (!type) vow.breek('Extension missing: ' + path);
        // else
        fs.readFile(decodeURI(fullPath), function(err, data) {
            if (err) vow.breek({ srcPath: path, missing: true, recastError: 'Error reading file ' + fullPath + ':' + err});
            else vow.keep({ recast: data, type: type, isModule: data.isModule });
        });
    }
    return vow.promise;
}

// function writeData(destPath, data) {
//     var vow = VOW.make();
//     if (destPath) {
//         destPath += '.' + data.encoding;
//         fs.outputFile(destPath, data.recast, function(err) {
//             if (err) vow.breek(err);
//             else vow.keep(data);
            
//         });
//     }
//     else vow.keep(data);
//     return vow.promise;
// }

function recast(args) {
     var encoding = args.encoding || undefined;
    // var vow = VOW.make();
    return readData(args.fullPath, args.srcData, args.type, args.path)
        .when(function(data) {
            data.isModule = args.isModule;
            args.srcData = data.recast;
            args.type = data.type;
            data.path = args.path;
            // oldType = args.type = data.type;
            if (!data.type || !extToFunction[data.type])
            {
                // vow.break({ recast: args.srcData, type: data.type });
                return VOW.kept({ recast: args.srcData, type: data.type });
                // return VOW.keep({ recast: args.srcData, type: data.type });
            }
            else {
                data.recast = data.recast.toString();
                var f = extToFunction[data.type];
                // debug('data=' ,data);
                // console.log(extToFunction['html'].toString());
                return f(data);
                // f(data).when(
                //     function(data) {
                //         debug('data=' ,data);
                //         data.recast = data.recast.toString();
                //         vow.keep(data);
                //     },
                //     function(err) {
                //         vow.breek(err);
                //     }
                // );
            }
        }).when(
            function(data) {
                
                if (encoding) return transform.zip(data, encoding);
                else return VOW.kept(data);
            }
        );
    // return vow.promise;
}

// function isRecastable(ext) {
//     return extToFunction[ext] ? true : false;
// }

function composeFunction(flist) {
    if (flist.length === 0) return function identity(data) { return VOW.kept(data); };
    else if (flist.length === 1) return flist[0];
    else if (flist.length === 2) return function(data) {
        return flist[0](data).when(
            flist[1]
        );
            
    };
    else if (flist.length === 3) return function(data) {
        return flist[0](data).when(
            flist[1]
        ).when(
            flist[2]
        );
            
    };
    else if (flist.length === 4) return function(data) {
        return flist[0](data).when(
            flist[1]
        ).when(
            flist[2]
        ).when(
            flist[3]
        );
    };
    return function() {
        return VOW.broken("Can't have more than four passes!!!. Shouldn't happen!!!");   
    };
    
    //needs debugging:
    return function(data) {
        function chain(p1, p2) {
            return p1.when(p2);
        }
        if (flist.length === 0) return VOW.kept(data); 
        var promise = flist[0](data);
        var i = 0;
        var max = flist.length -1; 
        while (i<max) promise = chain(promise, flist[i+1]);
        return promise;
    };
    
}

function connectTransformers() {
    function addPass(originalType, ext, pass)   {
        var func;
        var functionName = pass[ext];
        if (functionName !== 'identity') {
        // console.log('functionName', functionName);
            func = transform[functionName];
            extToFunction[originalType] = extToFunction[originalType] || [];
            extToFunction[originalType].push(func);
        }
        else func = { to: ext };
        return func.to;
    }
    var pass1 = options.transpilerOne;
    Object.keys(pass1).forEach(function(ext) {
        extToFunction[ext] =  [];
        var originalType = ext;
        ext = addPass(originalType, ext, pass1);
        ext = addPass(originalType, ext, options.transpilerTwo);
        ext = addPass(originalType, ext, options.transpilerThree);
        addPass(originalType, ext, options.minifier);
    });
    
    Object.keys(extToFunction).forEach(function(ext) {
        var flist = extToFunction[ext];
        extToFunction[ext] = composeFunction(flist);
    }); 
}


function init(someOptions, out) {
    someOptions.transpile = someOptions.transpile || [];
    someOptions.minify = someOptions.minify || [];
    someOptions = extend( extend({}, defaultOptions), someOptions);
    options = extend(someOptions, {
        transpilerOne : {}
        ,transpilerTwo : {}
        ,transpilerThree : {}
        // ,transpilerFour : {}
        ,minifier : {}
    });
    // optionsMap.transpilerFour = optionsMap.minifier;
    options.transpile.push('identity');
    
    Object.keys(optionsMap.transpilerOne).forEach(function(type) {
        if (options.transpile.indexOf(optionsMap.transpilerOne[type]) !== -1)
            options.transpilerOne[type] = optionsMap.transpilerOne[type];
    });
    var passes = ['transpilerTwo',
                  'transpilerThree'
                  // ,'transpilerFour'
                 ];
    // options.transpilerFour = options.minify;
    passes.forEach(function(pass) {
        Object.keys(optionsMap[pass]).forEach(function(type) {
            options[pass][type] =
                options.transpile.indexOf(optionsMap[pass][type]) !== -1 ?
                optionsMap[pass][type] : 'identity';
        });
    });
    Object.keys(optionsMap.minifier).forEach(function(o) {
        options.minifier[o] = options.minify.indexOf(o) !== -1 ?
            optionsMap.minifier[o] : 'identity';
    });
    conditionalRequire(options);
    
    connectTransformers();
    // console.log(options);
    // console.log(extToFunction);
    
    debug = options.verbose ? out : function() {};
    debug('Ext to Function:\n', extToFunction);
    debug(options);
    module.exports.zipperMethods = Object.keys(zipper || {});
}

module.exports = {
    // zipperMethods: Object.keys(zipper)
    
    recast: recast
    // ,isRecastable: isRecastable
    ,init: init
};

// ----------------------Tests-------------------------------
// function debug() {
//     console.log.apply(console, arguments);
// }
// function test(file) {
//     // var encoding = false; //'gzip';
//     var encoding = 'gzip';
//     recast({ srcPath: '../test/' + file, encoding: encoding }).when(
//         function(result) {
//             if (result.err) debug("Error:", result.err);
//             else if (!result.recast) {
//                 debug('--------------' + file + ' --------------');
//                 debug(result.data);
//             }
//             else {
//                 if (encoding === 'gzip') 
//                     zlib.gunzip(result.recast, function(err, ttype) {
//                         debug('--------------' + file + ' --------------');
//                         if (err) debug(err);
//                         else debug('Unzipped:\n', ttype.toString());
//                     });
//                 else if (encoding === 'deflate') 
//                     zlib.inflate(result.recast, function(err, ttype) {
//                         debug('--------------' + file + ' --------------');
//                         if (err) debug(err);
//                         else debug('Inflated:\n', ttype.toString());
//                     });
//                 else {
//                     debug('Result:------------------------------\n');
//                     debug(result.recast);   
//                 }
//             }
//         }
//         ,function(err) { console.log(err); }
//     );
// }

// var test = function() {
//     var someOptions = {
//         transpile: ['jade','less', 'stylus', 'sweetjs', 'typescript', 'coffeescript', 'markdown'
//                     // , 'regenerators',
//                     ,'denodify'
//                    ]
//         // ,minify: ['js', 'css', 'html']
//         ,minify: []
//         ,zip: true
//         ,verbose: true
//     };

//     init(someOptions, debug);

//     console.log(options);
//     // console.log('denodify: ',denodify);
//     console.log(extToFunction);
//     // test('test-denodify.denodify');
//     // test('test-regen.js', process.cwd() + '/../testout');



//     // test('test.sjs');;
//     // test('test.tsc');
//     test('test.js');
//     // test('test.coffee');
//     // test('test.stylus');
//     // test('test.less');
//     // test('test.jade');
//     // test('test.md');
//     // test('test.html');

//     // console.log(options);
// };

// // test();
// var u = require("uglify-js");
// console.log(u.parser, u.uglify);
