recaster
----------

Transform files in various formats to the formats a browser can
understand: html, js and css, and then minify and compress it for
transmission to the client.

	 npm install recaster
	 var recast = require('recaster').init({
		transpile: ['jade', 'less', 'stylus', 'sweetjs', 'typescript', 
					'coffeescript', 'markdown', 'regenerators'],
		minify: ['js', 'css', 'html'],
		compress: true,
		markdown: 
		 { gfm: true,
		   tables: true,
		   breaks: false,
		   pedantic: false,
		   sanitize: true,
		   smartLists: true,
		   langPrefix: 'language-'},
		verbose: true }
     });

    recast({ srcPath: somePath, destPath: somePath2, 
	         srcData: 'bla', type: 'html', encoding: 'gzip'}).when(
		function(data) {
		   //data= { destData: 'xxx', type: 'html', encoding: 'gzip'}
		},
		function(error) {
		   //deal with error
		}
    });
	
The various formats are transpiled to the corresponding html, css and
js formats. If 'regenerators' is added to transpile, any es6 generators
in (transpiled) javascript get converted to working es5 script.

Options for the individual converters can be added as objects under
their own name. Markdown is included as an example above.

The function returns a promise of the recast source. See example
above for format of the returned data object.

If srcData and type is passed in, this data is being used instead of
reading a file from disk.

If reading the file from disk fails, the promise fails.

If a file is not transpilable (no type or there is no transform
function defined fot the particular type) the original data gets
returned, after possibly being zipped, keeping the promise.

if there's an error transpiling, the promise breaks.

If there's an error minifying, this step gets skipped. 

if there's an error compressing, the promise is broken, however still
returning the source data. The encoding property of the returned
object will be undefined.

If 'destPath' is passed as a parameter the recast source code gets
written to it when the promise is fullfilled, this feature is
temporarily disabled however.

The source is easily expanded and/or modified to include more
transpilers or to change the libraries that do the work.

You can use this module to transpile for node, however coffeescript
and sweetjs can be required directly. I imagine you can set this up for
the other transpilers as well.

TODO:

* pass source maps from transpilers to minifiers
* add default options for all transformers
* add more transformers (clojurescript, sass, lispyscript, sibilant,
   dart, parenscript, wisp )
* use streaming when possible?
* use more standard Q instead of Crockford's vow.js
* make a distiction between libs that run on node and that are
  dependant on some native executable
* incorporate image processing/optimizing? 
* write docs using doccoh
* add a commandline version
