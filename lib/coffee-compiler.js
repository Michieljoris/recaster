var spawn = require('child_process').spawn, fs = require('fs');

var Compiler = function (coffee, fileEncoding) {
	if (!(this instanceof Compiler))
		return new Compiler(coffee);
	this.coffee = coffee == null ? 'coffee' : coffee;
	this.fileEncoding = fileEncoding == null ? 'utf-8' : fileEncoding;
};

Compiler.prototype.compile = function () {
	var
		args = ['-c', '-p', '-s'],
		config = arguments.length === 3 ? arguments[1] : {},
		callback = arguments[arguments.length - 1],
		that = this;

	var doCompile = function (input) {var out, child = spawn(that.coffee, args);
		child.stdout.setEncoding('utf-8');
		child.stdout.on('data', function (data) {
			out = data;
		});
		child.stderr.on('data', function (data) {
			out = data.toString();
                    
		});
		child.on('exit', function (status) {
			if (config.writeFile) {
				fs.writeFile(config.writeFile, out, that.fileEncoding, function (err) {
					if (err) throw err;
					callback(status, out);
				});
			} else {
				callback(status, out);
			}
		});
		child.stdin.write(input);
		child.stdin.end();
	};

	if (config.bare)
		args.push('-b');

	if (config.asFileName) {
		fs.readFile(arguments[0], this.fileEncoding, function (err, data) {
			if (err) throw err;
			doCompile(data);
		});
	} else {
		doCompile(arguments[0]);
	}

};

module.exports = Compiler;
