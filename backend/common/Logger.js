"use strict";

// DEPENDENCIES
// ------------
// External
import path from "path";
import properties from "properties";
// Local
import paths from "../common/paths.js";


// CONSTANTS
// ---------
const DEFAULT_LOG_LEVEL = "INFO";


// GLOBALS
// -------
let propertiesFileName = path.join(paths.BACKEND_RESOURCES_DIRECTORY_PATH, "shelf.properties");


export default class Logger {

    /**
     * Initializes a new Logger instance for a particular class
     * @param  {String} className
     */
    constructor(className) {
        this.className = className;

        // Setting log level from setting in properties
        this.logLevel = DEFAULT_LOG_LEVEL;
        new Promise((resolve, reject) => {
            properties.parse(propertiesFileName,
                             { path: true },
                             function(error, theProperties) {
                if (error) {
                    reject(Error(error));
                } else {
                    resolve(theProperties);
                }
            });
        }).then((result) => {
            if ("log.level" in result) {
                this.logLevel = result["log.level"].toUpperCase();
            }
        }).catch((error) => {
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
