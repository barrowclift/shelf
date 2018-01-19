"use strict";

var initExitHandler = function(callback) {
    process.on("SIGINT", function () {
        if (callback) {
            callback();
        }
        process.exit();
    });
};

module.exports = {
    init: initExitHandler
};