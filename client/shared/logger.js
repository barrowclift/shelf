(function(exports) {
    exports.logInfo = function(filename, message) {
        console.log(new Date().toISOString() + " [" + filename + "] INFO - " + message);
    };
    exports.logError = function(filename, method, message) {
    	console.log(new Date().toISOString() + " [" + filename + "] ERROR " + method + "() - " + message);
    };
    exports.logWarning = function(filename, method, message) {
    	console.log(new Date().toISOString() + " [" + filename + "] WARN " + method + "() - " + message);
    }
})(typeof exports === 'undefined' ? this['logger'] = {} : exports);
