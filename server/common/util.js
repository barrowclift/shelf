"use strict";

// DEPENDENCIES
// ------------
// External
let filesystem = require("fs").promises;
let path = require("path");
let request = require("request-promise");
let sharp = require('sharp');
// Local
let Logger = require("../common/Logger");


// GLOBALS
// -------
let log = new Logger("util");


exports.sleepForSeconds = function(seconds) {
    log.debug("Sleeping for " + seconds + " seconds...");
    return new Promise(function(resolve, reject) {
        _sleepForSeconds(
            seconds
        ).then(function() {
            log.debug("Done sleeping!");
            resolve();
        });
    });
};
function _sleepForSeconds(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

/**
 * Forcing request-promise to return both the image AND the headers (in case
 * an image is not returned as expected)
 */
exports.includeHeaders = function(body, response, resolveWithFullResponse) {
    return {
        headers: response.headers,
        data: body
    };
};

/**
 * Returns the "sortable" version of the provided text. Currently, this just
 * strips the preceeding "The ", if present.
 */
exports.getSortText = function(text) {
    let sortText = text.toUpperCase();
    if (sortText.indexOf("THE ") == 0) {
        sortText = sortText.substring("THE ".length, sortText.length);
    }
    return sortText;
}

exports.downloadImage = async function(url,
                                       userAgent,
                                       headers,
                                       destinationDirectoryPath,
                                       destinationFilename,
                                       propertyManager,
                                       rateLimiter) {
    let data = {
        method: "GET",
        encoding: "binary",
        url: url,
        timeout: propertyManager.connectionTimeoutInMillis,
        transform: exports.includeHeaders
    };
    if (headers
     && headers instanceof Object
     && !Array.isArray(headers)) {
        data.headers = headers;
    } else {
        data.headers = {};
    }
    data.headers["User-Agent"] = userAgent;

    // Sending the request
    log.info("Downloading image from " + url + "...");
    let response = await request.get(data);
    if (rateLimiter instanceof Function) {
        await rateLimiter(response.headers, url);
    }

    if ("content-type" in response.headers
     && response.headers["content-type"].includes("text/html")) {
        throw "Unexpected server response, got HTML document instead of image";
    }

    // Does directory exist?
    let directoryExists = false;
    try {
        directoryExists = await filesystem.stat(destinationDirectoryPath);
    } catch (error) {
        // Directory does not exist
        if (error.code === "ENOENT") {
            directoryExists = false;
        } else {
            directoryExists = true;
        }
    }
    // Attempt creating the directory if it doesn't exist
    if (!directoryExists) {
        try {
            await filesystem.mkdir(destinationDirectoryPath);
            directoryExists = true;
        } catch (error) {
            log.error("filesystem.mkdir", error);
        }
    }

    // Only attempt saving the image if the directory exists
    let filepath = null;
    if (directoryExists) {
        let filepath = path.join(destinationDirectoryPath, destinationFilename);

        let artOptions = {
            fit: sharp.fit.inside,
            withoutEnlargement: false
        };

        let imageBuffer = Buffer.from(response.data, "binary" );
        try {
            await sharp(imageBuffer).resize(propertyManager.maxArtSize, propertyManager.maxArtSize, artOptions).toFile(filepath);
            log.info("Downloaded image, destination=" + filepath + ", content-type=" + response.headers["content-type"] + ", content-length=" + response.headers["content-length"]);
        } catch (error) {
            log.error("sharp.resize.toFile", error);
            filepath = null;
        }
    }

    return filepath;
};

exports.getMainPart = function(title) {
    // e.g. "僕のヒーローアカデミア 3 [Boku No Hero Academia 3] (My Hero Academia, #3)"
    if (title.indexOf("[") > 0
     && title.indexOf("]") > 0
     && title.indexOf("(") > 0
     && title.indexOf(")") > 0
     && title.indexOf("#") > 0) {
        title = title.substring(title.indexOf("(") + 1, title.indexOf(")"));
    }
    // e.g. "Bitwise: A Life in Code"
    if (title.indexOf(":") > 0) {
        title = title.substring(0, title.indexOf(":")).trim();
    }
    // e.g. "Star Wars / The Empire Strikes Back"
    if (title.indexOf("/") > 0) {
        title = title.substring(0, title.indexOf("/")).trim();
    }
    // e.g. The Practice of Programming - Some Sometitle (With Subtitle)
    if (title.indexOf("-") > 0) {
        if (title.indexOf("(") == -1 || title.indexOf("(") >= title.indexOf("-")) {
            title = title.substring(0, title.indexOf("-")).trim();
        }
    }
    // e.g. "The Practice of Programming (Addison-Wesley Professional Computing Series)"
    if (title.indexOf("(") > 0) {
        if (title.indexOf("-") == -1 || title.indexOf("-") >= title.indexOf("(")) {
            title = title.substring(0, title.indexOf("(")).trim();
        }
    }
    return title;
}

exports.pageContextReportsChanges = function(pageContext) {
    return pageContext.newCount > 0
        || pageContext.updatedCount > 0;
};

exports.minutesToMillis = function(minutes) {
    return minutes * 60000;
};
exports.secondsToMillis = function(minutes) {
    return minutes * 1000;
};
