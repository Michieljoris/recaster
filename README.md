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

    recast(fileName, out).when(
		function(data) {
		   //recast source is passed as data, eg to cache it in memory 
		   //and optionally written to out if passed in.
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

The function returns a promise of the recast source code, and if 'out'
is passed as a parameter the recast source code gets written to it
when the promise is fullfilled.

The source is easily expanded and/or modified to include more
transpilers or to change the libraries that do the work.

You can use this module to transpile for node, however coffeescript
and sweetjs can be required directly. I imagine you set this up for
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
