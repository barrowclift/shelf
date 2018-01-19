"use strict";

var bodyParser = require("body-parser");
var express = require("express");
var http = require("http");
var socketIo = require("socket.io");

var mongoConnection = require("./mongoConnection");

var cache = require("../client/shared/cache");
var logger = require("../client/shared/logger");
var mediaTypes = require("../client/shared/mediaTypes");
var socketCodes = require("../client/shared/socketCodes");

const CLASS_NAME = "server";
const DEFAULT_SERVER_SETTINGS = {
    port: 10800,
    clientRoot: "/../client"
};

var pollerStatuses = {};
var setPollerStatuses = function(mediaType, isComplete) {
    pollerStatuses[mediaType] = {};
    pollerStatuses[mediaType].wishlistDone = true;
    pollerStatuses[mediaType].collectionDone = true;
};
/**
 * Assume by default we already have the data until proven otherwise. This is
 * to prevent the loading spinner on the client side from always glitching in
 * on the start, better to have it show up just slightly slower than
 * everything else instead.
 */
for (var i = 0; i < mediaTypes.SUPPORTED_TYPES.length; i++) {
    setPollerStatuses(mediaTypes.SUPPORTED_TYPES[i], true);
}

// STARTUP CACHE INITIALIZATION (FOR SENDING TO CLIENTS)
// ############################################################

var getDataFromMongo = function(mediaType, time, callback) {
    var query = {
        addedOn: {
            $gte: time
        }
    }
    mongoConnection.search(mediaType, query, callback);
};
/**
 * If we ever need/want the server to periodically update the cache itself
 * based on the contents of MongoDB, we'd do so by providing the time argument
 * (in millis) for the timestamp we're polling for. That way, only items added
 * after that timestamp will be considered new and added to the cache.
 *
 * However, since the pollers themselves are updating this cache by notifying
 * the server themselves, this functionality is currently not used.
 */
var refreshCacheForClient = function(mediaType, time, callback) {
    var loadCallback = function(data) {
        if (data && data.length > 0) {
            var didCacheNewData = false;
            if (time == 0) {
                cache.initializeCache(mediaType, data);
                didCacheNewData = true;
            } else {
                for (var i = 0; i < data.length; i++) {
                    var didCacheItem = cache.cacheData(mediaType, data[i]);
                    if (didCacheItem) {
                        didCacheNewData = true;
                    }
                }
            }
            
            if (didCacheNewData && callback) {
                callback(mediaType, data);
            }   
        } else {
            logger.logWarning(CLASS_NAME, "refreshCacheForClient.afterLoad", "No data in MongoDB to load");
            /**
             * If time is 0, we are starting up the server for the first time.
             * If there's no data at this point, that means we're polling anew
             * (no data in Mongo = all data polled is "new"), so set polling
             * status to incomplete.
             */
            if (time == 0) {
                for (var i = 0; i < mediaTypes.SUPPORTED_TYPES.length; i++) {
                    setPollerStatuses(mediaTypes.SUPPORTED_TYPES[i], false);
                }
            }
        }
    }
    getDataFromMongo(mediaType, time, loadCallback);
};
var broadcastDataToClient = function(mediaType, data) {
    logger.logInfo(CLASS_NAME, "Broadcasting cache changes to client");
    io.emit(mediaType, data);
};
var cacheRefresher = function() {
    logger.logInfo(CLASS_NAME, "Successfully connected to MongoDB, refreshing cache with any existing MongoDB data.");

    /**
     * Load ALL records database items into cache on startup, if there are any
     * existing database items (time = 0 means anything newer than the dawn of
     * time). From then on, let the pollers themselves notify the server of
     * any changes.
     */
    var time = 0;
    for (var i = 0; i < mediaTypes.SUPPORTED_TYPES.length; i++) {
        refreshCacheForClient(mediaTypes.SUPPORTED_TYPES[i], time, broadcastDataToClient);
    }

    // setInterval(function() {
    //     refreshCacheForClient(mediaTypes.RECORDS, new Date().getTime() - (DEFAULT_SERVER_SETTINGS.cacheRefreshTimeInMinutes * 60 * 1000), broadcastChanges);
    // }, DEFAULT_SERVER_SETTINGS.cacheRefreshTimeInMinutes * 60 * 1000);
};
mongoConnection.open(mongoConnection.DEFAULT_MONGO_CONFIG, cacheRefresher);

// SERVER STARTUP
// ############################################################

var app = express();
app.use(bodyParser.json());
console.log(__dirname + DEFAULT_SERVER_SETTINGS.clientRoot);
app.use(express.static(__dirname + DEFAULT_SERVER_SETTINGS.clientRoot));

var server = http.createServer(app);
var io = socketIo(server);

server.listen(DEFAULT_SERVER_SETTINGS.port);

var socketOpened = function(socket) {
    logger.logInfo(CLASS_NAME, "Client socket connection opened");

    // GENERIC SOCKET IO
    // ####################################################

    // Add a specific item to its respective cache and notify the frontend of the new addition
    socket.on(socketCodes.ADD_TO_CACHE,
        function(mediaWrapper) {
            var mediaType = mediaWrapper.mediaType;
            var data = mediaWrapper.data;

            logger.logInfo(CLASS_NAME, "Received socket request to add a new item \"" + data.title + "\" to the \"" + mediaType + "\" cache");
            
            var forceAddToCache = true;
            cache.cacheData(mediaType, data, forceAddToCache);

            if (mediaTypes.RECORDS === mediaType) {
                if (data.isWishlist) {
                    broadcastDataToClient(socketCodes.RECORD_WISHLIST, data);
                } else {
                    broadcastDataToClient(socketCodes.RECORD_COLLECTION, data);
                }
            } // TODO when more media types are added, expand on that conditional here
        },
        function() {
            logger.logError(CLASS_NAME, "socketOpened." + socketCodes.ADD_TO_CACHE, "Failed to send the new \"" + mediaType + "\" item \"" + data.title + "\" to the client");
        }
    );

    // Update a specific poller's status and notify the frontend of the change
    socket.on(socketCodes.UPDATE_POLLER_STATUS,
        function(mediaWrapper) {
            var mediaType = null;
            var isWishlist = null;
            if (mediaWrapper) {
                mediaType = mediaWrapper.mediaType;
                isWishlist = mediaWrapper.isWishlist;
            }

            if (mediaTypes.RECORDS === mediaType) {
                if (isWishlist) {
                    pollerStatuses[mediaType].wishlistDone = true;
                    logger.logInfo(CLASS_NAME, "Received socket notification that polling is complete for the \"" + mediaType + "\" wishlist");
                } else {
                    pollerStatuses[mediaType].collectionDone = true;
                    logger.logInfo(CLASS_NAME, "Received socket notification that polling is complete for the \"" + mediaType + "\" collection");
                }
            } // TODO when more media types are added, expand on that conditional here
            
            broadcastDataToClient(socketCodes.UPDATE_POLLER_STATUS, pollerStatuses);
        },
        function() {
            logger.logError(CLASS_NAME, "socketOpened." + socketCodes.UPDATE_POLLER_STATUS, "Failed to send poller status updates for \"" + mediaType + "\" to the client");
        }
    );

    // socket.on(socketCodes.GET_POLLER_STATUS,
    //     function() {
    //         logger.logInfo(CLASS_NAME, "Received socket request for polling status");
    //         socket.emit("pollerStatuses", pollerStatuses);

    //         logger.logInfo(CLASS_NAME, "Sent polling statuses to the client");
    //     }
    // );

    // RECORDS SOCKET IO
    // ####################################################

    // TODO: Later, these calls should really be made to be generic (accept a
    // container object with the media type and the data list, whether it be
    // the wishlist, collection, whatever), and from there do whatever is needed
    // with them.
    // 
    // TL;DR: Make generic "syncCollection" and "syncWishlist" calls and have the
    // media type specified in the request data itself.

    // Received request from client to send cached record collection back to it
    socket.on(socketCodes.RECORD_COLLECTION,
        function() {
            broadcastDataToClient(socketCodes.RECORD_COLLECTION, cache.getCacheCollectionFor(mediaTypes.RECORDS));
            logger.logInfo(CLASS_NAME, "Sent cached \"" + mediaTypes.RECORDS + "\" collection to the client");
        },
        function() {
            logger.logError(CLASS_NAME, "socketOpened." + socketCodes.RECORD_COLLECTION, "Failed to send cached \"" + mediaTypes.RECORDS + "\" collection to the client");
        }
    );

    // Send cached record wishlist
    socket.on(socketCodes.RECORD_WISHLIST,
        function() {
            broadcastDataToClient(socketCodes.RECORD_WISHLIST, cache.getCacheWishlistFor(mediaTypes.RECORDS));
            logger.logInfo(CLASS_NAME, "Sent cached \"" + mediaTypes.RECORDS + "\" wishlist to the client");
        },
        function() {
            logger.logError(CLASS_NAME, "socketOpened." + socketCodes.RECORD_WISHLIST, "Failed to send cached \"" + mediaTypes.RECORDS + "\" wishlist to the client");
        }
    );
};
io.sockets.on("connection", socketOpened);
