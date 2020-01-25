"use strict";

// DEPENDENCIES
// ------------
// External
let path = require("path");
let properties = require("properties");
// Local
let paths = require("../common/paths");


// CONSTANTS
// ---------
const DEFAULT_LOG_LEVEL = "INFO";


// GLOBALS
// -------
let propertiesFileName = path.join(paths.BACKEND_RESOURCES_DIRECTORY_PATH, "shelf.properties");


class Logger {

    /**
     * Initializes a new Logger instance for a particular class
     * @param  {String} className
     */
    constructor(className) {
        const THIS = this; // For referencing root-level "this" in promise context
        this.className = className;

        // Setting log level from setting in properties
        this.logLevel = DEFAULT_LOG_LEVEL;
        new Promise(function(resolve, reject) {
            properties.parse(propertiesFileName,
                             { path: true },
                             function(error, theProperties) {
                if (error) {
                    reject(Error(error));
                } else {
                    resolve(theProperties);
                }
            });
        }).then(function(result) {
            if ("log.level" in result) {
                THIS.logLevel = result["log.level"].toUpperCase();
            }
        }).catch(function(error) {
            console.log(error);
        });
    }

    debug(message) {
        if ("DEBUG" == this.logLevel) {
            let debugLog = new Date().toISOString() + " [" + this.className + "] DEBUG";
            this._log(debugLog, message);
        }
    }
    info(message) {
        if ("DEBUG" == this.logLevel
         || "INFO" == this.logLevel) {
            let infoLog = new Date().toISOString() + " [" + this.className + "] INFO";
            this._log(infoLog, message);
        }
    }
    warning(method, message) {
        if ("DEBUG" == this.logLevel
         || "INFO" == this.logLevel
         || "WARN" == this.logLevel) {
            let warningLog = new Date().toISOString() + " [" + this.className + "] WARN " + method + "()";
            this._log(warningLog, message);
        }
    }
    /**
     * Functionally the same as Logger@warning()
     */
    warn(method, message) {
        this.warning(method, message);
    }
    error(method, message) {
        let errorLog = new Date().toISOString() + " [" + this.className + "] ERROR " + method + "()";
        this._log(errorLog, message);
    }

    _log(logHeader, message) {
        if (message instanceof Object) {
            console.log(logHeader + ":");
            console.log(message);
        } else {
            console.log(logHeader + " - " + message);
        }
    }
}

module.exports = Logger;