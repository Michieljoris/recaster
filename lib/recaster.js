/*global exports:false process:false require:false */
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:8 maxlen:150 devel:true newcap:false*/

var zlib = require('zlib'),
    //Transpile:
    //to css
    less = require('less'), // http://lesscss.org/#usage
    stylus = require('stylus'), // http://learnboost.github.io/stylus/docs/js.html
    //to html
    jade = require('jade'), //http://jade-lang.com/api/
    marked = require('marked'), //://npmjs.org/package/marked
    //to js
    Compiler = require('coffeescript-compiler'), //https://npmjs.org/package/coffeescript-compiler
    transformEs6 = require('regenerator'), //https://github.com/facebook/regenerator
    sjs = require('sweet.js'), //http://sweetjs.org/
    tsc = require('../node_modules/node-typescript/lib/compiler'),//https://npmjs.org/package/node-typescript

    //Minify
    //js
    UglifyJS = require("uglify-js"), //https://github.com/mishoo/UglifyJS2
    //html
    minifyHtml = require('html-minifier'), //http://perfectionkills.com/experimenting-with-html-minifier/
    //css
    csso = require('csso'),//http://bem.info/tools/csso/usage/
    cleanCSS = require('clean-css'), //https://github.com/GoalSmashers/clean-css

    //utilities
    VOW = require('dougs_vow'),
    typeend = require('typeend'),
    fs = require('fs-typera'),
    Path = require('path')
// util = require('util')
    ;


//mapping typeension to transform function/informal name
var optionsMap = {
    transpilerOne: {
        jade: 'jade',
        less: 'less',
        stylus: 'stylus',
        sjs: 'sweetjs',
        coffee: 'coffeescript',
        tsc: 'typescript',
        'md': 'markdown',
        'mdown': 'markdown',
        'markdown': 'markdown',
        js: 'identity',
        css: 'identity',
        html: 'identity'
    },
    transpilerTwo: {
        js: 'regenerators', //generators only sofar to use es6 features
        css: 'identity',
        html: 'identity'
    },
    minifier: {
        js: 'uglifyJs2',
        css: 'cleanCss',
        // css: 'csso',
        html: 'htmlMinifier'
    }
};

var defaultOptions = {
    transpile: ['jade', 'less', 'stylus', 'sweetjs', 'typescript', 'coffeescript', 'markdown', 'regenerators'],
    minify: ['js', 'css', 'html'],
    zip: true,

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
    },

    verbose: true
};

//----------------------Transform functions--------------------------------
var transform = {};
transform.identity = function(data) {
    return VOW.kept(data);
};

transform.cleanCss = function(data) {
    return VOW.kept({recast: cleanCSS.process(data.recast, options.cleanCss), type: 'css'});
};

transform.htmlMinifier = function(data) {
    return VOW.kept({recast: minifyHtml.minify (data.recast,
                                                options.htmlMinifier),
                     type: 'html'});
};

transform.uglifyJs2 = function(data) {
    var recast = UglifyJS.minify (data.recast,
                                  typeend({fromString: true},
                                         options.uglifyJs2));
    return VOW.kept({ recast: recast.code,
                      srcMap: recast.map,
                      type: 'js'});
};

transform.less = function(data) {
    var vow = VOW.make();
    less.render(data.recast, function (err, css) {
        if (err) vow.breek(err);
        else vow.keep({ recast: css, type: 'css'});
    });
    return vow.promise;
};

transform.csso = function(data) {
    return VOW.kept({ recast: csso.justDoIt(data.recast), type: 'css'});
};

transform.stylus = function(data) {
    var vow = VOW.make();
    stylus.render(data.recast, function(err, css){
        if (err) vow.breek(err);
        else vow.keep({recast: css, type: 'css'});
    });
    return vow.promise;
};

transform.jade = function(data) {
    // // Compile a function
    var fn = jade.compile(data.recast, {});

    // Render the function
    var locals = {};
    var html = fn(locals);
    return VOW.kept({ recast: html, type: 'html'});
};

transform.coffeescript = function(data) {
    var vow = VOW.make();
    var cc = new Compiler(process.cwd() + '/../node_modules/coffee-script/bin/coffee');
    cc.compile(data.recast, function (status, output) {
        if (status === 0) vow.keep({recast: output, type: 'js'});
        else vow.breek('Error transpiling coffeescript: ' + status);
    });
    return vow.promise;
}

transform.markdown = function(data) {
    marked.setOptions(options.markdown);
    return VOW.kept({recast: marked(data.recast), type: 'html'});
};

transform.regenerators = function(data) {
    // //include the followiing require with the source
    // //require('./regen-runtime');
    // var es5Source = transformEs6(data.recast);
    // return VOW.kept(es5Source);
    //or:
    var es5SourceWithRuntime = transformEs6(data.recast, { includeRuntime: true });
    return VOW.kept({recast: es5SourceWithRuntime, type: 'js'});
    };

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

transform.sweetjs = function(data) {
    var js = sjs.compile(data.recast);
    data.type = 'js';
    return VOW.kept({recast: js, type: 'js'});
    // or require directly in other modules on node:
    // require('sweet.js');
    // example = require('./example.sjs');
    // console.log(example.one);
};

var zipper = {
    gzip: zlib.gzip
    , deflate: zlib.deflate
};

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
                if (err) vow.breek(err);
                else vow.keep({recast: result, type: data.type, zip: options.zip});
            });
    } 
    return vow.promise;
};

//----------------Internals--------------------------------------------------------
var options;

// var log = [];
function debug() {
    if (options.verbose) console.log.apply(console, arguments);
    // log.push(arguments);
}

// function Typeof(v) {
//     var type = {}.toString.call(v);
//     return type.slice(8, type.length-1);
// }

function readData(path, data, type) {
    var vow = VOW.make();
    if (data) vow.keep({ recast: data.toString(), type: type });
    else {
        type = Path.typename(path).slice(1);
        if (!type) vow.breek('Extension missing: ' + path);
        else fs.readFile(decodeURI(path), function(err, data) {
            if (err) vow.breek(err);
            else vow.keep({ recast: data.toString(), type: type});
        });
    }
    return vow.promise;
}


function writeData(destPath, data) {
    var vow = VOW.make();
    if (destPath) {
        destPath += '.' + data.encoding;
        fs.outputFile(destPath, data.recast, function(err) {
            if (err) vow.breek(err);
            else vow.keep(data);
            
        });
    }
    else vow.keep(data);
    return vow.promise;
}

function recast(args) {
    var vow = VOW.make();
    if (!options) init(defaultOptions);
    var encoding = args.encoding; //boolean
    var destPath = args.destPath;
    transpile(args)
        .when(function(data) {
            return transform[options.minifier[data.type]](data);
        })
        .when(function(data) {
            //data has uglify srcMap property now..
            if (encoding) return transform.zip(data, encoding);
            else return VOW.kept(data);
        })
        .when(
            function(data) {
                return writeData(destPath, data);
            })
        .when(
            function(data) {
                vow.keep(data);}
            ,function(err) {
                 vow.breek(err);
            });
    return vow.promise;
}

function transpile(args) {
    var vow = VOW.make();
    var srcData = args.srcData;
    var srcPath = args.srcPath;
    var type = args.type; //type
    readData(srcPath, srcData, type)
        .when(function(data) {
            srcData = data.recast;
            type = data.type;
            if (!type || !options.transpilerOne[type])
                return VOW.broken('Can\'t package this data: ' + srcPath || '');
            else return transform[options.transpilerOne[type]](data); //pass 1
        })
        .when( function(data) {
            return transform[options.transpilerTwo[data.type]](data); //pass 2
        })
        .when(
            function(data) {
                vow.keep({srcPath: srcPath, recast: data.recast, type: data.type });}
            ,function(err) {
                debug('Something went wrong in transpile', err);
                if (srcData) {
                    if (['js', 'css', 'html'].indexOf(type) !== -1)
                        vow.keep({srcPath: srcPath, recast: srcData, type: type, err: err});
                }
                else vow.breek(err);
            });
    return vow.promise;
}

function init(someOptions) {
    someOptions.transpile = someOptions.transpile || [];
    someOptions.minify = someOptions.minify || [];
    someOptions = typeend( typeend({}, defaultOptions), someOptions);
    options = typeend({
        transpilerOne : {}
        ,transpilerTwo : {}
        ,minifier : {}
    }, someOptions);
    options.transpile.push('identity');
    Object.keys(optionsMap.transpilerOne).forEach(function(type) {
        if (options.transpile.indexOf(optionsMap.transpilerOne[type]) !== -1)
            options.transpilerOne[type] = optionsMap.transpilerOne[type];
    });
    Object.keys(optionsMap.transpilerTwo).forEach(function(type) {
        options.transpilerTwo[type] =
            options.transpile.indexOf(optionsMap.transpilerTwo[type]) !== -1 ?
            optionsMap.transpilerTwo[type] : 'identity';
    });
    Object.keys(optionsMap.minifier).forEach(function(o) {
        options.minifier[o] = options.minify.indexOf(o) !== -1 ?
            optionsMap.minifier[o] : 'identity';
    });
}

exports.module = {
    zipperMethods: Object.keys(zipper)
    ,recast: recast
    ,init: init
}

//----------------------Tests-------------------------------
// function test(someOptions, file, dest) {
//     recast(someOptions, '../test/' + file, dest).when(
//         function(result) {
//             if (result.err) debug("Error:", result.err);
//             else if (!result.recast) {
//                 debug('--------------' + file + ' --------------');
//                 debug(result.data);
//             }
//             else {
//                 if (someOptions.zip === 'gzip') 
//                     zlib.gunzip(result.recast, function(err, ttype) {
//                         debug('--------------' + file + ' --------------');
//                         debug('Zipped:\n', ttype.toString());
//                     });
//                 else if (someOptions.zip === 'deflate') 
//                     zlib.inflate(result.recast, function(err, ttype) {
//                         debug('--------------' + file + ' --------------');
//                         debug('Zipped:\n', ttype.toString());
//                     });
//                 else debug(result.recast);
//             }
//         }
//     );
// }

// var someOptions = {
//     transpile: ['jade','less', 'stylus', 'sweetjs', 'typescript', 'coffeescript', 'markdown'
//                 , 'regenerators'
//                ]
//     ,minify: ['js', 'css', 'html']
//     ,zip: 'deflate'
// };

// exports.module.init(someOptions);
// test(someOptions, 'test.less', process.cwd() + '/../testout');
// test(someOptions, 'test.stylus');
// test(someOptions, 'test.jade');
// test(someOptions, 'test.sjs');
// test(someOptions, 'test.coffee');
// test(someOptions, 'test.tsc');
// test(someOptions, 'test.md');
// test(someOptions, 'test.html');
// test(someOptions, 'test-regen.js');

// debug(options);

