global.LOG_INFO  = 0;
global.LOG_DEBUG  = 1;
global.LOG_WARNING  = 2;
global.LOG_ERROR  = 3;

var ansi = require('./ansi');
var output = console.log;
var useColor = true;

/* do it */
var log = function(str,lvl) {
	var color = "";
	if(useColor) {
		if(lvl == undefined)
			lvl = LOG_INFO;
		switch(lvl) {
		case LOG_INFO:
			color = ansi.normal;
			break;
		case LOG_DEBUG:
			color = ansi.fg.darkgray;
			break;
		case LOG_WARNING:
			color = ansi.fg.lightmagenta;
			break;
		case LOG_ERROR:
			color = ansi.fg.lightred;
			break;
		}
	}
	output(color+str);
};

/* static class shit */
log.__defineSetter__("output",function(opt) {
	if(typeof opt == "function") 
		output = opt;
	else
		throw "invalid output stream";
});
log.__defineGetter__("output",function() {
	return output;
});
log.__defineSetter__("useColor",function(bool) {
	if(typeof bool == "boolean") 
		useColor = bool;
	else
		throw "invalid color toggle";
});
log.__defineGetter__("useColor",function() {
	return useColor;
});

/* export! */
module.exports = log;
