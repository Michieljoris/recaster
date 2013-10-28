/*global exports:false process:false __dirname:false  require:false */
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:8 maxlen:150 devel:true newcap:false*/

var zlib = require('zlib'),
    fs = require('fs-extra'),
    Path = require('path'),
    //Transpile:
    //to css
    less = require('less'), // http://lesscss.org/#usage
    stylus = require('stylus'), // http://learnboost.github.io/stylus/docs/js.html
    //to html
    jade = require('jade'), //http://jade-lang.com/api/
    marked = require('marked'), //https://npmjs.org/package/marked
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

    VOW = require('dougs_vow'),
    extend = require('extend') 
    // util = require('util')
;


// var log = [];
function debug() {
    if (options.verbose) console.log.apply(console, arguments);
    // log.push(arguments);
}


function Typeof(v) {
    var type = {}.toString.call(v);
    return type.slice(8, type.length-1);
}

//mapping extension to function name
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
    transpile: ['jade', 'less', 'stylus', 'sweetjs', 'typescript', 'coffeescript', 'markdown', 'js'],
    minify: ['js', 'css', 'html'],
    compress: true,
    
    markdown: { gfm: true,
                tables: true,
                breaks: false,
                pedantic: false,
                sanitize: true,
                smartLists: true,
                langPrefix: 'language-',
                highlight: function(code, lang) {
                    if (lang === 'js') {
                        return highlighter.javascript(code);
                    }
                    return code;
                }
              },
                
    //location to save result to:
    // out: 'path/to/dir',

    verbose: true
};
var options;

function buildOptions(someOptions) {
    options = extend({
        transpilerOne : {
            js: 'identity',
            css: 'identity',
            html: 'identity'
        }
        ,transpilerTwo : {
            js: 'identity',
            css: 'identity',
            html: 'identity'
        }
        ,minifier : {
            js: 'identity',
            css: 'identity',
            html: 'identity'
        }
    }, someOptions);
    options.minifier = {};
    Object.keys(optionsMap.transpilerOne).forEach(function(o) {
        if (options.transpile.indexOf(optionsMap.transpilerOne[o]) !== -1)
            options.transpilerOne[o] = optionsMap.transpilerOne[o];
    });
    Object.keys(optionsMap.transpilerTwo).forEach(function(o) {
        if (options.transpile.indexOf(o) !== -1)
            options.transpilerTwo[o] = optionsMap.transpilerTwo[o];
    });
    Object.keys(optionsMap.minifier).forEach(function(o) {
        if (options.minify.indexOf(o) !== -1)
            options.minifier[o] = optionsMap.minifier[o];
    });
}

buildOptions(defaultOptions);

var zipper = {
    gzip: zlib.createGzip
    , deflate: zlib.createDeflate
};

function readData(path) {
    var vow = VOW.make();
    var ext = Path.extname(path).slice(1);
    if (!ext) vow.breek('Extension missing: ' + path);
    else fs.readFile(decodeURI(path), function(err, data) {
        if (err) vow.breek(err);
        else {
            vow.keep({type: ext, data: data});
        }
    });
    return vow.promise;
}

var transform = {};
transform.identity = function(data) {
    return VOW.kept(data);
}

transform.cleanCss = function(data) {
    return VOW.kept(cleanCSS.process(data.data, options.cleanCss));
};

transform.htmlMinifier = function(data) {
    return VOW.kept(minifyHtml.minify(
        data.data,
        extend({ removeComments: true }, options.htmlMinifier))); 
};

transform.uglifyJs2 = function(data) {
    return VOW.kept(UglifyJS.minify(
        data.data,
        extend({fromString: true}, options.uglifyJs2)));
};

transform.less = function(data) {
    var vow = VOW.make();
    less.render(data.data, function (err, css) {
        if (err) vow.breek(err);
        else vow.keep(css);
    });
    return vow.promise;
};

transform.csso = function(data) {
    return VOW.kept(csso.justDoIt(data.data));
};

transform.stylus = function(data) {
    var vow = VOW.make();
    stylus.render(data.data, function(err, css){
        if (err) vow.breek(err);
        vow.keep(css);
    });
    return vow.promise;
};

transform.jade = function(data) {
    // // Compile a function
    var fn = jade.compile(data.data, {});

    // Render the function
    var locals = {};
    var html = fn(locals);
    return VOW.kept(html);
};

transform.coffeescript = function(data) {
    var vow = VOW.make();
    var cc = new Compiler(process.cwd() + '/../node_modules/coffee-script/bin/coffee');
    cc.compile(data.data, function (status, output) {
        if (status === 0) vow.keep(output);
        else vow.breek('Error transpiling coffeescript: ' + status);
    });
    return vow.promise;
}

transform.markdown = function(data) {
    marked.setOptions(options.markdown);
    return VOW.keep(marked(data.data));
};

transform.generators = function(data) {
    // //include the followiing require with the source
    // //require('./regen-runtime');
    // var es5Source = transformEs6(data.data);
    // return VOW.kept(es5Source);
    //or:
    var es5SourceWithRuntime = transformEs6(data.data, { includeRuntime: true });
    return VOW.kept(es5SourceWithRuntime);
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
    // button.innerText = "Say Hello";\
    // button.onclick = function() {\
    //     alert(greeter.greet());\
    // };\
    // document.body.appendChild(button);\
    // ';

    tsc.resolve(__dirname + '/xxx.ts', data.data, compiler);
    compiler.typeCheck();
    var stdout = new tsc.EmitterIOHost();
    compiler.emit(stdout);
    // console.log(stdout.fileCollection['/home/michieljoris/mysrc/javascript/bb-server/lib/xxx.js'].lines.join(''));
    return VOW.kept(stdout.fileCollection['/home/michieljoris/mysrc/javascript/bb-server/lib/xxx.js'].lines.join(''));
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
    //         'button.innerText = "Say Hello";',
    //         'button.onclick = function () {',
    //         '    alert(greeter.greet());',
    //         '};',
    //         'document.body.appendChild(button);' ],
    //      currentLine: '' } }
};

transform.sweetjs = function(data) {
    var js = sjs.compile(data.data);
    return VOW.kept(js);
    // or require directly in other modules on node:
    // require('sweet.js');
    // example = require('./example.sjs');
    // console.log(example.one);
};

function zip(data) {
    var vow = VOW.make();
    return vow.promise;
}

//Takes a file and optionally writes it to dest,
//otherwise returns the result.
function pack(src, dest) {
    var vow = VOW.make();
    readData(src)
        .when(function(data) {
            var type = data.ext;
            if (!type) return VOW.broken('Can\'t package this file: ' + src);
            else return transform[options.transpilerOne[type]](data); //pass 1
        })
        .when( function(data) {
            return transform[options.transpilerTwo[data.type]](data); //pass 2
        })
        .when(function(data) {
            return transform[options.minifier[data.type](data)];
        })
        .when(function(data) {
            if (options.compress) return zip(data);
            else return VOW.kept(data);
        })
        .when(
            function(data) {
                return writeData(data, dest);
            })
        .when(
            function(data) {
                vow.keep(data.data);}
            ,function(err) {
                vow.breek(err);   
            });
    return vow.promise;
}

exports.module = {
    zipperMethods: Object.keys(zipper)
    ,pack: pack
    ,init: function(someOptions) {
        someOptions = extend(true, extend(true, {}, defaultOptions), someOptions);
        buildOptions(someOptions);   
    }
};

//Test:
exports.module.init();
console.log(options);
// pack('hello.coffee');


// var gz = zipper.gzip;
// // console.log(gzip);

// function gzip(filename,  transform, method, success, error) {
//     fs.readFile(decodeURI(Path.resolve(process.cwd(), filename)), function (err, data) {
//         if (err) {
//             console.log("ERROR");
//             return;
//         }
//         data = transform(data.toString());
//         console.log(data);
//         // console.log(method, zipper[method]());
//         // zipper[method]()(data, function(err, result) {
//       gz(data, function(err, result) {
//             if (err) {
//                 console.log('ERROR', err);
//                 return;
//             }
//             else success(result);
//         });
//     });
// }


// gzip('./example.sjs', function(d) { return d;}, 'gzip',
//      function(data){ console.log('DATA:', data.length);
//                      zlib.gunzip(data
//                    },
//     function(err) { console.log('error', err); });


// gzip(identityPath, transform, 'gzip',og(err)
//             return
//     function(data) {
//         console.log(data);
//         // fs.writeFile(path, data, function(err) {
//         //     if (err) sendError(req, res, err);
//         //     else send();
//         // });
//     })


