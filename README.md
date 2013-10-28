recaster
----------

Transform files in various formats to the formats a browser can
understand: html, js and css, and then minify and compress it for
transmission to the client.

	 npm install recaster
	 var recast = require('recaster').init({
		transpile: ['jade', 'less', 'stylus', 'sweetjs', 'typescript', 
					'coffeescript', 'markdown', 'javascript'],
		minify: ['js', 'css', 'html'],
		compress: true,
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
js formats. If 'javascript' is added to transpile, at the moment es6
generators get transpiled to working es5 script.

The function returns a promise of the recast source code, and if out is
passed as a parameter the recast source code gets written to it when the
promise is fullfilled.

The source is easily expanded and/or modified to include more
transpilers or to change the libraries that do the work.

TODO:

* pass source maps from transpilers to minifiers
* add default options for all transformers
* add more transformers (clojurescript, sass, ?)
* use streaming when possible?
* use more standard Q instead of Crockford's vow.js
