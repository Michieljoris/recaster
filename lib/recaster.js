/*global module:false process:false require:false */
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:8 maxlen:150 devel:true newcap:false*/

var zlib, less, stylus, jade, marked, Compiler, transformEs6, sjs, tsc, UglifyJS,
    minifyHtml, csso, cleanCSS, denodify;

var zipper;
var passes;

//utilities
var VOW = require('dougs_vow'),
extend = require('extend'),
fs = require('fs-extra'),
Path = require('path')
// util = require('util')
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
        jade: 'jade',
        less: 'less',
        stylus: 'stylus',
        sjs: 'sweetjs',
        coffee: 'coffeescript',
        tsc: 'typescript',
        md: 'markdown',
        mdown: 'markdown',
        markdown: 'markdown',
        js: 'identity',
        css: 'identity',
        html: 'identity'
    },
    transpilerTwo: {
        js: 'regenerators', //generators only sofar to use es6 features
        css: 'identity',
        html: 'identity'
    },
    transpilerThree: {
        js: 'denodify', //generators only sofar to use es6 features
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
                'regenerators','denodify'],
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
transform.identity = function(data) {
    return VOW.kept(data);
};

transform.cleanCss = function(data) {
    return VOW.kept({recast: new cleanCSS().minify(data.recast, options.cleanCss),
                     minified: true,
                     type: 'css'});
};
transform.cleanCss.to = 'css';
transform.cleanCss.action = 'cleanCSS';

transform.htmlMinifier = function(data) {
    return VOW.kept({recast: minifyHtml.minify (data.recast,
                                                options.htmlMinifier),
                     minified: true,
                     type: 'html'});
};
transform.htmlMinifier.to = 'html';
transform.htmlMinifier.action = 'htmlMinifier';

transform.uglifyJs2 = function(data) {
    // debug('\n------------in uglify', data);
    var recast = UglifyJS.minify (data.recast,
                                  extend({fromString: true},
                                         options.uglifyJs2));
    
    return VOW.kept({ recast: recast.code,
                      srcMap: recast.map,
                      minified: true,
                      type: 'js'});
};
transform.uglifyJs2.to = 'js';
transform.uglifyJs2.action = 'uglifyJs2';

transform.less = function(data) {
    var vow = VOW.make();
    less.render(data.recast, function (err, css) {
        if (err) vow.breek({ recastError: err });
        else vow.keep({ recast: css, type: 'css'});
    });
    return vow.promise;
};
transform.less.to = 'css';
transform.less.action = 'less';

transform.csso = function(data) {
    return VOW.kept({ recast: csso.justDoIt(data.recast),
                      minified: true,
                      type: 'css'});
};
transform.csso.to = 'css';
transform.csso.action = 'csso';

transform.stylus = function(data) {
    var vow = VOW.make();
    stylus.render(data.recast, function(err, css){
        if (err) vow.breek({ recastError: err });
        else vow.keep({recast: css, type: 'css'});
    });
    return vow.promise;
};
transform.stylus.to = 'css';
transform.stylus.action = 'stylus';

transform.jade = function(data) {
    // // Compile a function
    var fn = jade.compile(data.recast, {});

    // Render the function
    var locals = {};
    var html = fn(locals);
    return VOW.kept({ recast: html, type: 'html'});
};
transform.jade.to = 'html';
transform.jade.action = 'jade';

transform.coffeescript = function(data) {
    var vow = VOW.make();
    // var cc = new Compiler(process.cwd() + '/../node_modules/coffee-script/bin/coffee');
    var cc = new Compiler();
    cc.compile(data.recast, function (status, output) {
        if (status === 0) vow.keep({recast: output, type: 'js'});
        else {
            console.log(output);
            vow.breek({ recastError: 'Error transpiling coffeescript: ' + status });
        }
    });
    return vow.promise;
};
transform.coffeescript.to = 'js';
transform.coffeescript.action = 'coffeescript';

transform.markdown = function(data) {
    marked.setOptions(options.markdown);
    return VOW.kept({recast: marked(data.recast), type: 'html'});
};
transform.markdown.to = 'html';
transform.markdown.action = 'markdown';

transform.regenerators = function(data) {
    // //include the followiing require with the source
    // //require('./regen-runtime');
    // var es5Source = transformEs6(data.recast);
    // return VOW.kept(es5Source);
    //or:
    var es5SourceWithRuntime = transformEs6(data.recast, { includeRuntime: true });
    return VOW.kept({recast: es5SourceWithRuntime, type: 'js'});
    };
transform.regenerators.to = 'js'; 
transform.regenerators.action = 'regen'; 

transform.denodify = function(data) {
    console.log(data);
    return VOW.kept({ recast: denodify.wrap('moduleid', data.recast), type: 'js' });
};
transform.denodify.to = 'js';
transform.denodify.action = 'denodify';

transform.typescript = function(data) {
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
    return VOW.kept({
        recast: stdout.fileCollection['/xxx.js'].lines.join(''),
        type: 'js'});
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
transform.typescript.action = 'typescript';

transform.sweetjs = function(data) {
    var js = sjs.compile(data.recast);
    data.type = 'js';
    return VOW.kept({recast: js.code, type: 'js'});
    // or require directly in other modules on node:
    // require('sweet.js');
    // example = require('./example.sjs');
    // console.log(example.one);
};
transform.sweetjs.to = 'js';
transform.sweetjs.action = 'sweetjs';


transform.zip = function(data, encoding) {
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
                else vow.keep({recast: result, type: data.type, encoding: encoding});
            });
    } 
    return vow.promise;
};

//----------------Internals--------------------------------------------------------
var options;
var debug;
// var log = [];

// function Typeof(v) {
//     var type = {}.toString.call(v);
//     return type.slice(8, type.length-1);
// }

function readData(path, data, type) {
    var vow = VOW.make();
    if (data) vow.keep({ recast: data, type: type });
    else {
        type = Path.extname(path).slice(1);
        // if (!type) vow.breek('Extension missing: ' + path);
        // else
        fs.readFile(decodeURI(path), function(err, data) {
            if (err) vow.breek({ path: path, missing: true, recastError: 'Error reading file ' + path + ':' + err});
            else vow.keep({ recast: data, type: type});
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
    // var vow = VOW.make();
    return readData(args.srcPath, args.srcData, args.type)
        .when(function(data) {
            args.srcData = data.recast;
            args.type = data.type;
            // oldType = args.type = data.type;
            if (!data.type || !extToFunction[data.type])
            {
                // vow.break({ recast: args.srcData, type: data.type });
                return VOW.broken({ recast: args.srcData, type: data.type });
            }
            else {
                data.recast = data.recast.toString();
                var f = extToFunction[data.type];
                // debug('data=' ,data);
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
        });
    // return vow.promise;
}

// function recastold(args) {
//     var vow = VOW.make();
//     if (!options) init(defaultOptions);
    
//     var encoding = args.encoding || undefined;
//     // console.log('encoing', encoding);
//     // var destPath = args.destPath;
//     minify(args)
//         .when(function(data) {
//             //data has uglify srcMap property now..
            
//             //encoding is decided on original mimetype and set in
//             //options.zip, this should always succeed since zipping is
//             //optional. Original data gets returned if zipping fails
//             if (encoding) return transform.zip(data, encoding);
//             else return VOW.kept(data); 
//         })
//     // .when(
//     //     function(data) {
//     //         return writeData(destPath, data);
//     //     })
//         .when(
//             function(data) {
//                 if (encoding) debug('Zipped' + args.srcPath);
//                 else debug('Not zipped: ' + args.srcPath);
//                 vow.keep(data);
//             }
//             ,function(err) {
//                 vow.breek(err);
//             });
//     return vow.promise;
// }

// //promises to try to transpile the data to html, css or js and then
// //minify it, if this fails the original data is returned. Only
// //breaks the promise if it can't source the data.
// function minify(args) {
//     var vow = VOW.make();
//     transpile(args)
//         .when(function(data) {
//             //we only minify if the data was transpilable to css, js or html:
//             //the minifier has to return the unminified data if not succeeding to minify.
//             //so the promise should always be fullfilled by the minifier!!!!
//             //TODO don't minify xxxxxx.min.(js|cssl)
//             if (args.srcPath) {
//                 var l = args.srcPath.length;
//                 if (args.srcPath.slice(l - 6) === 'min.js' ||
//                     args.srcPath.slice(l-7) === 'min.css') {
//                     return VOW.kept(data);
//                 }
//             }
//             // args.source
//             // debug('about to minify', data, transform[options.minifier[data.type]]);
//             return transform[options.minifier[data.type]](data);
//         })
//         .when(
//             function(data) {
//                 if (data.minified) debug('Minified' + args.srcPath);
//                 else debug('Not minified: ' + args.srcPath);
//                 // console.log('minified');
//                 //pass on the minified js, html or css (not minified if there was an error)
//                 vow.keep(data);
//             }
//             ,function(err) {
//                 debug('Couldn\'t minify because we did not receive js, html or css: ' + args.srcPath);
//                 if (err.recast !== undefined) 
//                     //we can still pass on the source data if we have it:
//                     vow.keep(err);
//                 else vow.breek(err);
//             });
//     return vow.promise;
// }

// //promises to transpile the data to html, css or js. If data can be
// //sourced but not transpiled to html, css or js promise is broken but
// //the source data returned in the broken promise
// function transpile(args) {
//     var vow = VOW.make();
//     var oldType;
//     readData(args.srcPath, args.srcData, args.type)
//         .when(function(data) {
//             args.srcData = data.recast;
//             oldType = args.type = data.type;
//             if (!args.type || !options.transpilerOne[args.type])
//             {
//                 return VOW.broken({ recast: args.srcData, type: args.type });
//             }
//             else {
//                 data.recast = data.recast.toString();
//                 var f = options.transpilerOne[args.type];
//                 return transform[f](data); //pass 1   
//             }
//         })
//         .when( function(data) {
//             return transform[options.transpilerTwo[data.type]](data); //pass 2
//         })
//         .when(
//             function(data) {
//                 //we have a js, html or css args.type file
//                 if (oldType === data.type) debug('Not transpiled: ' + args.srcPath);
//                 else debug('Transpiled' + args.srcPath); 
//                 debug(data);
//                 vow.keep({recast: data.recast, type: data.type });}
//             ,function(err) {
//                 if (err.recast) 
//                     debug(err.type + ' is not transpilable. Returning source');
//                 else debug('Something went wrong in transpile for ' + args.srcPath, err);
//                 //data was not read even or a transpiler broke the vow:
//                 //or we've got the data, however it was not transpilable
//                 if (!err.missing && !err.recast)
//                     err = { recastError: 'Failed to transpile ' + args.srcPath  + ': ' + err};
//                 vow.breek(err);
//             });
//     return vow.promise;
// }


function isRecastable(ext) {
    if (optionsMap.transpilerOne[ext] ||
        optionsMap.transpilerTwo[ext] ||
        optionsMap.transpilerThree[ext] ||
        optionsMap.minifier[ext]) return true;
    return false;
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
    // options.minifier = options.transpilerFour;
    // console.log(options.minifier)
    
    // Object.keys(optionsMap.transpilerTwo).forEach(function(type) {
    //     options.transpilerTwo[type] =
    //         options.transpile.indexOf(optionsMap.transpilerTwo[type]) !== -1 ?
    //         optionsMap.transpilerTwo[type] : 'identity';
    // });
    // Object.keys(optionsMap.transpilerThree).forEach(function(type) {
    //     options.transpilerThree[type] =
    //         options.transpile.indexOf(optionsMap.transpilerThree[type]) !== -1 ?
    //         optionsMap.transpilerThree[type] : 'identity';
    // });
    Object.keys(optionsMap.minifier).forEach(function(o) {
        options.minifier[o] = options.minify.indexOf(o) !== -1 ?
            optionsMap.minifier[o] : 'identity';
    });
    conditionalRequire(options);
    // passes = [options.transpilerOne, options.transpilerTwo, options.transpilerThree, options.minifier];
    
    connectTransformers();
    console.log('Ext to Function:', extToFunction);
    //setting up optionsMap for isUnrecastable..
    delete optionsMap.transpilerOne.js;
    delete optionsMap.transpilerOne.css;
    delete optionsMap.transpilerOne.html;
    if (options.transpilerTwo.js === 'identity') delete optionsMap.transpilerTwo.js;
    if (options.transpilerTwo.css === 'identity') delete optionsMap.transpilerTwo.css;
    if (options.transpilerTwo.html === 'identity') delete optionsMap.transpilerTwo.html;
    if (options.minifier.js === 'identity') delete optionsMap.minifier.js;
    if (options.minifier.css === 'identity') delete optionsMap.minifier.css;
    if (options.minifier.html === 'identity') delete optionsMap.minifier.html;
    
    debug = options.verbose ? out : function() {};
    // debug(options);
    // debug(optionsMap);
    module.exports.zipperMethods = Object.keys(zipper || {});
}

var extToFunction = {};
function composeFunction(flist) {
    if (flist.length === 0) return function() {};
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

module.exports = {
    // zipperMethods: Object.keys(zipper)
    
    recast: recast
    ,isRecastable: isRecastable
    ,init: init
};

// ----------------------Tests-------------------------------
function debug() {
    console.log.apply(console, arguments);
}
function test(file) {
    var encoding = false; //'gzip';
    // var encoding = 'gzip';
    recast({ srcPath: '../test/' + file, encoding: encoding }).when(
        function(result) {
            if (result.err) debug("Error:", result.err);
            else if (!result.recast) {
                debug('--------------' + file + ' --------------');
                debug(result.data);
            }
            else {
                if (encoding === 'gzip') 
                    zlib.gunzip(result.recast, function(err, ttype) {
                        debug('--------------' + file + ' --------------');
                        if (err) debug(err);
                        else debug('Unzipped:\n', ttype.toString());
                    });
                else if (encoding === 'deflate') 
                    zlib.inflate(result.recast, function(err, ttype) {
                        debug('--------------' + file + ' --------------');
                        if (err) debug(err);
                        else debug('Inflated:\n', ttype.toString());
                    });
                else {
                    debug('Result:------------------------------\n');
                    debug(result.recast);   
                }
            }
        }
        ,function(err) { console.log(err); }
    );
}

var someOptions = {
    transpile: ['jade','less', 'stylus', 'sweetjs', 'typescript', 'coffeescript', 'markdown'
                // , 'regenerators',
                ,'denodify'
               ]
    // ,minify: ['js', 'css', 'html']
    ,minify: []
    ,zip: true
    ,verbose: true
};

init(someOptions, debug);

console.log(options);
// console.log('denodify: ',denodify);
console.log(extToFunction);
// test('test-denodify.denodify');
// test('test-regen.js', process.cwd() + '/../testout');



// test('test.sjs');;
// test('test.tsc');
test('test.js');
// test('test.coffee');
// test('test.stylus');
// test('test.less');
// test('test.jade');
// test('test.md');
// test('test.html');

// console.log(options);

