/*global module:false process:false require:false */
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
    extend = require('extend'),
    fs = require('fs-extra'),
    Path = require('path')
// util = require('util')
    ;


//mapping extension to transform function/informal name
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
        // css: 'csso', //TODO: gives errors
        html: 'htmlMinifier'
    }
};

var defaultOptions = {
    //active transformers:
    transpile: ['jade', 'less', 'stylus', 'sweetjs', 'typescript', 'coffeescript', 'markdown', 'regenerators'],
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
    },
    //rest of transformers are using defaults..
    
    verbose: true
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

transform.htmlMinifier = function(data) {
    return VOW.kept({recast: minifyHtml.minify (data.recast,
                                                options.htmlMinifier),
                     minified: true,
                     type: 'html'});
};

transform.uglifyJs2 = function(data) {
    var recast = UglifyJS.minify (data.recast,
                                  extend({fromString: true},
                                         options.uglifyJs2));
    return VOW.kept({ recast: recast.code,
                      srcMap: recast.map,
                      minified: true,
                      type: 'js'});
};

transform.less = function(data) {
    var vow = VOW.make();
    less.render(data.recast, function (err, css) {
        if (err) vow.breek({ recastError: err });
        else vow.keep({ recast: css, type: 'css'});
    });
    return vow.promise;
};

transform.csso = function(data) {
    return VOW.kept({ recast: csso.justDoIt(data.recast),
                      minified: true,
                      type: 'css'});
};

transform.stylus = function(data) {
    var vow = VOW.make();
    stylus.render(data.recast, function(err, css){
        if (err) vow.breek({ recastError: err });
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
        else vow.breek({ recastError: 'Error transpiling coffeescript: ' + status });
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
    var vow = VOW.make();
    if (!options) init(defaultOptions);
    
    var encoding = args.encoding || undefined;
    // console.log('encoing', encoding);
    // var destPath = args.destPath;
    minify(args)
        .when(function(data) {
            //data has uglify srcMap property now..
            
            //encoding is decided on original mimetype and set in
            //options.zip, this should always succeed since zipping is
            //optional. Original data gets returned if zipping fails
            if (encoding) return transform.zip(data, encoding);
            else return VOW.kept(data); 
        })
    // .when(
    //     function(data) {
    //         return writeData(destPath, data);
    //     })
        .when(
            function(data) {
                if (encoding) debug('zipped');
                else debug('Not zipped');
                vow.keep(data);
            }
            ,function(err) {
                vow.breek(err);
            });
    return vow.promise;
}

//promises to try to transpile the data to html, css or js and then
//minify it, if this fails the original data is returned. Only
//breaks the promise if it can't source the data.
function minify(args) {
    var vow = VOW.make();
    transpile(args)
        .when(function(data) {
            //we only minify if the data was transpilable to css, js or html:
            //the minifier has to return the unminified data if not succeeding to minify.
            //so the promise should always be fullfilled by the minifier!!!!
            //TODO don't minify xxxxxx.min.(js|cssl)
            if (args.srcPath) {
                var l = args.srcPath.length;
                if (args.srcPath.slice(l - 6) === 'min.js' ||
                    args.srcPath.slice(l-7) === 'min.css') {
                    return VOW.kept(data);
                }
            }
            // args.source
            return transform[options.minifier[data.type]](data);
        })
        .when(
            function(data) {
                if (data.minified) debug('Minified');
                else debug('Not minified');
                // console.log('minified');
                //pass on the minified js, html or css (not minified if there was an error)
                vow.keep(data);
            }
            ,function(err) {
                debug('Couldn\'t minify because we did not receive js, html or css: ' + args.srcPath);
                if (err.recast !== undefined) 
                    //we can still pass on the source data if we have it:
                    vow.keep(err);
                else vow.breek(err);
            });
    return vow.promise;
}

//promises to transpile the data to html, css or js. If data can be
//sourced but not transpiled to html, css or js promise is broken but
//the source data returned in the broken promise
function transpile(args) {
    var vow = VOW.make();
    var oldType;
    readData(args.srcPath, args.srcData, args.type)
        .when(function(data) {
            args.srcData = data.recast;
            oldType = args.type = data.type;
            if (!args.type || !options.transpilerOne[args.type])
                return VOW.broken({ recast: args.srcData, type: args.type });
            else {
                data.recast = data.recast.toString();
                return transform[options.transpilerOne[args.type]](data); //pass 1   
            }
        })
        .when( function(data) {
            return transform[options.transpilerTwo[data.type]](data); //pass 2
        })
        .when(
            function(data) {
                //we have a js, html or css args.type file
                if (oldType === data.type) debug('Not transpiled');
                else debug('Transpiled'); 
                vow.keep({recast: data.recast, type: data.type });}
            ,function(err) {
                if (err.recast) 
                    debug(err.type + ' is not transpilable. Returning source');
                else debug('Something went wrong in transpile', err);
                //data was not read even or a transpiler broke the vow:
                //or we've got the data, however it was not transpilable
                if (!err.missing && !err.recast)
                    err = { recastError: 'Failed to transpile ' + args.srcPath  + ': ' + err};
                vow.breek(err);
            });
    return vow.promise;
}

function init(someOptions) {
    someOptions.transpile = someOptions.transpile || [];
    someOptions.minify = someOptions.minify || [];
    someOptions = extend( extend({}, defaultOptions), someOptions);
    options = extend({
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

module.exports = {
    zipperMethods: Object.keys(zipper)
    ,recast: recast
    ,init: init
};

//----------------------Tests-------------------------------
// function test(file) {
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
//                 else debug(result.recast);
//             }
//         }
//         ,function(err) { console.log(err); }
//     );
// }

// var someOptions = {
//     transpile: ['jade','less', 'stylus', 'sweetjs', 'typescript', 'coffeescript', 'markdown'
//                 , 'regenerators'
//                ]
//     ,minify: ['js', 'css', 'html']
//     ,zip: true
// };

// exports.module.init(someOptions);
// test('test-regen.js', process.cwd() + '/../testout');
// test(someOptions, 'test.stylus');
// test(someOptions, 'test.jade');
// test(someOptions, 'test.sjs');
// test(someOptions, 'test.coffee');
// test(someOptions, 'test.tsc');
// test(someOptions, 'test.md');
// test(someOptions, 'test.html');
// test(someOptions, 'test-regen.js');

// debug(options);

