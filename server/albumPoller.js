"use strict";

var fs = require("fs");
var io = require("socket.io-client");
var request = require("request");

var mongoConnection = require("./mongoConnection");
var exitHandler = require("./exitHandler");
var config = require("./config.json");

var cache = require("../client/shared/cache");
var logger = require("../client/shared/logger");
var overrides = require("../client/shared/overrides.json");
var mediaTypes = require("../client/shared/mediaTypes");
var socketCodes = require("../client/shared/socketCodes");

var Fuse = require("../client/lib/fuse.min.js"); // For fuzzy searching
var Discogs = require('disconnect').Client; // "disconnect" is the Discogs API 2.0 Library

const CLASS_NAME = "albumPoller";
const ALL_RECORDS_FOLDER_ID = 0; // The default folder ID in Discogs
const RELATIVE_PATH = "./client";
const ALBUM_ART_CACHE = "/images/records/";
const DISCOGS_ALBUM_ART_FILE_NAME = "discogs-album-art.jpg";
const ITUNES_ALBUM_ART_FILE_NAME = "itunes-album-art.jpg";
const USER_AGENT = "Shelf/0.1 +https://github.com/barrowclift/shelf"
const MAX_ITUNES_ALBUM_ART_SIZE = 512;
const MAX_RECORDS_PER_PAGE = 20;
const MAX_DISCOGS_REQUESTS_PER_MINUTE = 5;
const DISCOGS_RATE_LIMIT_WAIT_TIME = 90000;
const DEFAULT_DISCOGS_COLLECTOR_SETTINGS = {
    refreshTimeInMinutes : 30
};
const FUZZY_SEARCH_OPTIONS = {
    shouldSort: true,
    threshold: 0.6,
    location: 0,
    distance: 100,
    maxPatternLength: 32,
    minMatchCharLength: 1,
    keys: [
        "artistName"
    ]
};

var discogs = new Discogs({ userToken: config.discogsUserToken });
var client = null;
var socket = null;
var discogsRequestsInCurrentMinute = 0;
var pageTracker = {
    currentPage: 1,
    isLastPage: false,
    recordsAlreadySaved: 0,
    recordsSavedThisPage: 0,
    totalRecordsSaved: 0
};

var sub_downloadImage = function(requestData, filepath, filename, callback) {
    logger.logInfo(CLASS_NAME, "Downloading " + requestData.url + "...");
    var subDownloadImageCallback = function(error, response, body) {
        if (error) {
            logger.logError(CLASS_NAME, "subDownloadImageCallback", error);
            callback(error);
        } else {
            if (!fs.existsSync(filepath)){
                fs.mkdirSync(filepath);
            }
            if ("text/html" === response.headers["content-type"]) {
                logger.logError(CLASS_NAME, "subDownloadImageCallback", "Unexpected server response");
            } else {
                logger.logInfo(CLASS_NAME, "Downloaded content-type=" + response.headers["content-type"] + ", content-length=" + response.headers["content-length"] + " to " + filepath + filename);
                request(requestData).pipe(fs.createWriteStream(filepath+filename)).on("close", callback);
            }
        }
    };
    request.head(requestData, subDownloadImageCallback);
};

var downloadImage = function(isDiscogs, uri, filepath, filename, callback) {
    var requestData = {
        url: uri,
        headers: {
            "User-Agent": USER_AGENT
        }
    };

    if (isDiscogs) {
        discogsRequestsInCurrentMinute += 1;
    }
    if (isDiscogs && discogsRequestsInCurrentMinute >= MAX_DISCOGS_REQUESTS_PER_MINUTE) {
        logger.logWarning(CLASS_NAME, "downloadImage", "Discogs rate limit met, sleeping for a minute before trying " + uri + " again...");
        setTimeout(function() {
            logger.logInfo(CLASS_NAME, "Sleep complete, trying " + uri + " again...");
            discogsRequestsInCurrentMinute = 0;
            sub_downloadImage(requestData, filepath, filename, callback);
        }, randomWaitTime());
    } else {
        sub_downloadImage(requestData, filepath, filename, callback);
    }
};

var sanitizeTitleForiTunesApi = function(title) {
    var sanitizedTitle = title.replace(/ /g, "+");
    return sanitizedTitle;
};

var createiTunesAlbumUrl = function(title) {
    return encodeURI("https://itunes.apple.com/search?entity=album&country=US&limit=5&lang=en_us&explicit=Yes&media=music&attribute=albumTerm&term="+sanitizeTitleForiTunesApi(title));
};

var randomWaitTime = function() {
    return Math.floor(Math.random() * ((DISCOGS_RATE_LIMIT_WAIT_TIME + 25000) - DISCOGS_RATE_LIMIT_WAIT_TIME + 1) + DISCOGS_RATE_LIMIT_WAIT_TIME);
};

var sub_getDiscogsLink = function(requestData, callback) {
    logger.logInfo(CLASS_NAME, "GET " + requestData.url + " for true Discogs link");
    var subGetDiscogsLinkCallback = function(error, response, body) {
        if (error) {
            var stream = request(requestData);
            var body = "";
            stream.on("data", function(chunk) {
                body += chunk;
            });
            stream.on("end", function() {
                logger.logError(CLASS_NAME, "subGetDiscogsLinkCallback", error + ": " + body);
            });
            callback(null, error);
        } else {
            var stream = request(requestData);
            var body = "";
            stream.on("data", function(chunk) {
                body += chunk;
            });
            stream.on("end", function() {
                body = JSON.parse(body);
                if (body.message === "You are making requests too quickly.") {
                    logger.logWarning(CLASS_NAME, "subGetDiscogsLinkCallback", "Discogs tells us the rate limit has been met, sleeping for a minute before trying " + requestData.url + " again...");
                    discogsRequestsInCurrentMinute = MAX_DISCOGS_REQUESTS_PER_MINUTE;
                    setTimeout(function() {
                        logger.logInfo(CLASS_NAME, "Sleep complete, trying " + requestData.url + " again.");
                        discogsRequestsInCurrentMinute = 0;
                        sub_getDiscogsLink(requestData, callback);
                    }, randomWaitTime());
                } else {
                    callback(body.uri);
                }
            });
        }
    };
    request.head(requestData, subGetDiscogsLinkCallback);
};

var getDiscogsLink = function(link, callback) {
    var requestData = {
        url: link,
        headers: {
            "User-Agent": USER_AGENT
        }
    };

    discogsRequestsInCurrentMinute += 1;
    if (discogsRequestsInCurrentMinute >= MAX_DISCOGS_REQUESTS_PER_MINUTE) {
        logger.logWarning(CLASS_NAME, "getDiscogsLink", "Discogs rate limit met, sleeping for a minute before trying " + requestData.url + " again...");
        setTimeout(function() {
            logger.logInfo(CLASS_NAME, "Sleep complete, trying " + requestData.url + " again.");
            discogsRequestsInCurrentMinute = 0;
            sub_getDiscogsLink(requestData, callback);
        }, randomWaitTime());
    } else {
        sub_getDiscogsLink(requestData, callback);
    }
};

var getiTunesAlbum = function(title, artist, callback) {
    if (overrides.records.searchAssistance.titles[title]) {
        title = overrides.records.searchAssistance.titles[title];
    }
    var requestData = {
        url: createiTunesAlbumUrl(title),
        headers: {
            "User-Agent": USER_AGENT
        }
    };

    logger.logInfo(CLASS_NAME, "GET " + requestData.url + " from iTunes for \"" + title + "\"...");

    // Attempt 5 times before giving up, if receive 403
    var getiTunesAlbumCallback = function(error, response, body) {
        if (error) {
            logger.logError(CLASS_NAME, "getiTunesAlbumCallback", error);
            callback(null, null, error);
        } else {
            var stream = request(requestData);
            var body = "";
            stream.on("data", function(chunk) {
                body += chunk;
            });
            stream.on("end", function() {
                try {
                    if (body != null) {
                        body = body.trim();
                    }
                    body = JSON.parse(body);
                    if (body.resultCount == 0) {
                        logger.logWarning(CLASS_NAME, "getiTunesAlbumCallback", "No results from iTunes for \"" + title + "\"");
                        callback(null, null, "No results from iTunes");
                    } else {
                        /**
                         * We *may* get back a couple or more artists that match the provided album name.
                         * In some cases, we may even get a single, false positive match. For these cases,
                         * we should apply a fuzzy matching on the artist name to ensure that if there's
                         * multiple matches we select the best match, and if there's just a single match
                         * that it's not a false positive.
                         */
                        var fuse = new Fuse(body.results, FUZZY_SEARCH_OPTIONS);
                        var results = fuse.search(artist);

                        if (results.length == 0) {
                            logger.logWarning(CLASS_NAME, "getiTunesAlbumCallback", "Got results back from iTunes, but they were all false positives");
                            callback(null, null, "No true matches from iTunes");
                        } else {
                            var largeAlbumArtUrl = results[0].artworkUrl100;
                            largeAlbumArtUrl = largeAlbumArtUrl.replace("100x100", MAX_ITUNES_ALBUM_ART_SIZE+'x'+MAX_ITUNES_ALBUM_ART_SIZE);
                            var yearOfOriginalRelease = new Date(results[0].releaseDate).getUTCFullYear();
                            callback(largeAlbumArtUrl, yearOfOriginalRelease); 
                        }
                    }
                } catch (exception) {
                    logger.logError(CLASS_NAME, "getiTunesAlbumCallback", "Unable to parse iTunes response for \"" + title + "\", exception=" + exception + ", response=" + response, + ", error="+error);
                    callback(null, null, error);
                }
            });
        }
    };
    request.head(requestData, getiTunesAlbumCallback);
}

var getSortableText = function(text) {
    var sortText = text.toUpperCase();
    if (sortText.indexOf("THE ") == 0) {
        sortText = sortText.substring("THE ".length, sortText.length);
    }
    return sortText;
}

// Good god Javascript, why
var sub_pollDiscogsPage = function(client, isWishlist, parentCallback) {
    var pollDiscogsPageCallback = function(error, data) {
        if (error) {
            logger.logError(CLASS_NAME, "pollDiscogs", error);
        } else {
            var numberOfPages = data.pagination.pages;
            pageTracker.currentPage = data.pagination.page;
            // pageTracker.isLastPage = pageTracker.currentPage >= numberOfPages;
            pageTracker.isLastPage = true;
            var processedRecords = 0;
            var recordsInPage = data[listKey].length;
            
            for (var i = 0; i < recordsInPage; i++) {
                var isLastItemOfPage = i >= recordsInPage - 1;

                var record = cache.newDefaultRecordDocument();
                record.discogsId = data[listKey][i].id;
                if (isWishlist) {
                    record.discogsFolder = -1;
                } else {
                    record.discogsFolder = data[listKey][i].folder_id;
                }
                record.discogsUrl = data[listKey][i].basic_information.resource_url;
                record.id = "record" + record.discogsId;
                record.title = data[listKey][i].basic_information.title;
                if (overrides.records.replacements.titles[record.title]) {
                    record.title = overrides.records.replacements.titles[record.title];
                }
                record.sortTitle = getSortableText(record.title);
                record.artist = data[listKey][i].basic_information.artists[0].name;
                if (overrides.records.replacements.artists[record.artist]) {
                    record.artist = overrides.records.replacements.artists[record.artist];
                }
                record.sortArtist = getSortableText(record.artist);
                record.yearOfPressing = data[listKey][i].basic_information.year;
                record.yearOfOriginalRelease = data[listKey][i].basic_information.year; // May be changed with iTunes data, if available
                if (isWishlist) {
                    record.discogsAlbumArtUrl = data[listKey][i].basic_information.thumb;
                } else {
                    record.discogsAlbumArtUrl = data[listKey][i].basic_information.cover_image;
                }
                record.discogsAddedOn = new Date(data[listKey][i].date_added).getTime();
                record.isWishlist = isWishlist;
                record.addedOn = Date.now();

                var potentialAlbumArtFilePath = ALBUM_ART_CACHE + record.id + '/';
                (function(recordToSave, potentialAlbumArtFilePath2, isLastItemOfPage2, isLastPage2, discogsRoutingLink) {
                    var query = {
                        id: recordToSave.id
                    };
                    mongoConnection.search(mediaTypes.RECORDS, query, function(data) {
                        if (!data || data.length == 0) {
                            logger.logInfo(CLASS_NAME, "Found new record, \"" + recordToSave.title + "\"");
                            // Download Discogs Album Art
                            downloadImage(true, recordToSave.discogsAlbumArtUrl, RELATIVE_PATH+potentialAlbumArtFilePath2, DISCOGS_ALBUM_ART_FILE_NAME, function(error) {
                                if (!error) {
                                    recordToSave.discogsAlbumArtFilePath = potentialAlbumArtFilePath2 + DISCOGS_ALBUM_ART_FILE_NAME;    
                                }

                                getDiscogsLink(discogsRoutingLink, function(discogsLink, error) {
                                    if (!error && discogsLink) {
                                        recordToSave.discogsUrl = discogsLink;
                                    }
                                    getiTunesAlbum(recordToSave.title, recordToSave.artist, function(largeAlbumArtUrl, yearOfOriginalRelease, error) {
                                        if (yearOfOriginalRelease) {
                                            recordToSave.yearOfOriginalRelease = yearOfOriginalRelease;
                                        }
                                        
                                        if (largeAlbumArtUrl) {
                                            recordToSave.iTunesAlbumArtUrl = largeAlbumArtUrl;
                                            // Download iTunes Album Art
                                            downloadImage(false, recordToSave.iTunesAlbumArtUrl, RELATIVE_PATH+potentialAlbumArtFilePath2, ITUNES_ALBUM_ART_FILE_NAME, function(error) {
                                                if (!error) {
                                                    recordToSave.iTunesAlbumArtFilePath = potentialAlbumArtFilePath2 + ITUNES_ALBUM_ART_FILE_NAME;
                                                }
                                                // Saving completed Record JSON to MongoDB
                                                logger.logInfo(CLASS_NAME, "Saving \"" + recordToSave.title + "\" to mongoDB");
                                                mongoConnection.upsert(mediaTypes.RECORDS, recordToSave, function(error) {
                                                    processedRecords += 1;
                                                    logger.logInfo(CLASS_NAME, processedRecords + " records processed for this page...");
                                                    var isFinalItemOfPage = processedRecords >= recordsInPage;
                                                    if (!error) {
                                                        pageTracker.recordsSavedThisPage += 1;
                                                        pageTracker.totalRecordsSaved += 1;
                                                        logger.logInfo(CLASS_NAME, "Saved \"" + recordToSave.title + "\"");
                                                        if (socket) {
                                                            socket.emit(socketCodes.ADD_TO_CACHE, { mediaType:mediaTypes.RECORDS, data:recordToSave });
                                                        }
                                                    }
                                                    if (socket && isLastPage2 && isFinalItemOfPage) {
                                                        socket.emit(socketCodes.UPDATE_POLLER_STATUS, { mediaType:mediaTypes.RECORDS, isWishlist:isWishlist });
                                                    }
                                                    if (isLastPage2 && isFinalItemOfPage) {
                                                        parentCallback(pageTracker);
                                                    }
                                                });
                                            });
                                        } else {
                                            // Saving completed Record JSON to MongoDB
                                            logger.logInfo(CLASS_NAME, "Saving \"" + recordToSave.title + "\" to mongoDB");
                                            mongoConnection.upsert(mediaTypes.RECORDS, recordToSave, function(error) {
                                                processedRecords += 1;
                                                logger.logInfo(CLASS_NAME, processedRecords + " records processed for this page...");
                                                var isFinalItemOfPage = processedRecords >= recordsInPage;
                                                if (!error) {
                                                    pageTracker.recordsSavedThisPage += 1;
                                                    pageTracker.totalRecordsSaved += 1;
                                                    logger.logInfo(CLASS_NAME, "Saved \"" + recordToSave.title + "\"");
                                                    if (socket) {
                                                        socket.emit(socketCodes.ADD_TO_CACHE, { mediaType:mediaTypes.RECORDS, data:recordToSave });
                                                    }
                                                }
                                                if (socket && isLastPage2 && isFinalItemOfPage) {
                                                    socket.emit(socketCodes.UPDATE_POLLER_STATUS, { mediaType:mediaTypes.RECORDS, isWishlist:isWishlist });
                                                }
                                                if (isLastPage2 && isFinalItemOfPage) {
                                                    parentCallback(pageTracker);
                                                }
                                            });
                                        }
                                    });
                                });
                            });
                        } else {
                            pageTracker.recordsAlreadySaved += 1;
                        }
                    });
                })(record, potentialAlbumArtFilePath, isLastItemOfPage, pageTracker.isLastPage, data[listKey][i].basic_information.resource_url);
            }
        }
    };

    if (isWishlist) {
        var listKey = "wants";
        client.getReleases(config.discogsUserId, {page: pageTracker.currentPage, per_page: MAX_RECORDS_PER_PAGE}, pollDiscogsPageCallback);
    } else {
        var listKey = "releases";
        client.getReleases(config.discogsUserId, ALL_RECORDS_FOLDER_ID, {page: pageTracker.currentPage, per_page: MAX_RECORDS_PER_PAGE}, pollDiscogsPageCallback);
    }
}

var pollDiscogsPage = function(client, isWishlist, parentCallback) {
    if (isWishlist) {
        logger.logInfo(CLASS_NAME, "Polling Discogs user wishlist, page " + pageTracker.currentPage);
    } else {
        logger.logInfo(CLASS_NAME, "Polling Discogs user collection, page " + pageTracker.currentPage);
    }

    discogsRequestsInCurrentMinute += 1;
    if (discogsRequestsInCurrentMinute >= MAX_DISCOGS_REQUESTS_PER_MINUTE) {
        logger.logWarning(CLASS_NAME, "pollDiscogsPage", "Discogs rate limit met, sleeping for a minute before continuing...");
        setTimeout(function() {
            logger.logInfo(CLASS_NAME, "Sleep complete, continuing...");
            discogsRequestsInCurrentMinute = 0;
            sub_pollDiscogsPage(client, isWishlist, parentCallback);
        }, randomWaitTime());
    } else {
        sub_pollDiscogsPage(client, isWishlist, parentCallback);
    }
}

var pollDiscogsClient = function(client, isWishlist, rootCallback) {
    var pollDiscogsClientCallback = function() {
        if (pageTracker.isLastPage) {
            if (pageTracker.recordsAlreadySaved > 0) {
                logger.logInfo(CLASS_NAME, pageTracker.recordsAlreadySaved + " records polled were already saved from a previous poll and were skipped, " + pageTracker.recordsSavedThisPage + " new were found");
            } else {
                logger.logInfo(CLASS_NAME, "Found " + pageTracker.recordsSavedThisPage + " records on discogs page " + pageTracker.currentPage + ", all new");
            }
            if (rootCallback) {
                rootCallback();
            }
        } else {
            pageTracker.recordsSavedThisPage = 0;
            pollDiscogsPage(client, isWishlist, pollDiscogsClientCallback);
        }
    }
    pollDiscogsPage(client, isWishlist, pollDiscogsClientCallback);
}

var pollDiscogs = function() {
    // Polling the collection the user ALREADY HAS
	client = discogs.user().collection();
    var isWishlist = false;
    pollDiscogsClient(client, isWishlist, function() {
        logger.logInfo(CLASS_NAME, "Collection complete, beginning to poll user wishlist...");
        pageTracker = {
            currentPage: 1,
            isLastPage: false,
            recordsAlreadySaved: 0,
            recordsSavedThisPage: 0,
            totalRecordsSaved: 0
        };
        // Once the collection's done, move on to the wishlist
        // Polling the user's wishlist, records they DON'T HAVE
        client = discogs.user().wantlist();
        isWishlist = true;
        pollDiscogsClient(client, isWishlist);
    });
}

var pollerMain = function() {
    var optionalCharacter = "";
    if (DEFAULT_DISCOGS_COLLECTOR_SETTINGS.refreshTimeInMinutes > 1) {
        optionalCharacter = 's';
    }
    logger.logInfo(CLASS_NAME, "Successfully connected to MongoDB, will update Discogs data every " + DEFAULT_DISCOGS_COLLECTOR_SETTINGS.refreshTimeInMinutes + " minute" + optionalCharacter);
	
    socket = io.connect("http://localhost:10800", {reconnect: true});
    var socketOpened = function() {
        logger.logInfo(CLASS_NAME, "Client socket connection opened");
        pollDiscogs();
    }
    socket.on("connect", socketOpened);

	setInterval(function() {
	    pollDiscogs();
	}, DEFAULT_DISCOGS_COLLECTOR_SETTINGS.refreshTimeInMinutes * 60 * 1000);
};
mongoConnection.open(mongoConnection.DEFAULT_MONGO_CONFIG, pollerMain);

exitHandler.init(function() {
    setTimeout(function() {
        stop();
    }, 300);
});
