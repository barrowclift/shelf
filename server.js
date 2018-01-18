"use strict";

var express = require("express");
var bodyParser = require("body-parser");
var http = require("http");
var socketIo = require("socket.io");
var cache = require("./client/shared/cache");
var logger = require("./client/shared/logger");
var mongoConnection = require("./mongoConnection");

// Default settings
const DEFAULT_SERVER_SETTINGS = {
    port: 10800,
    root: "/client",
    cacheRefreshTimeInMinutes: 1
};
const CLASS_NAME = "server";

var pollingStatus = {
    records: {
        wishlistDone: true,
        collectionDone: true
    }
}

// MongoDB Connection and cache refresher
var getDataFromMongo = function(mediaType, time, callback) {
    var query = {
        addedOn: {
            $gte: time
        }
    }
    mongoConnection.search(mediaType, query, callback);
}
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
            if (time == 0) {
                pollingStatus.records.wishlistDone = false;
                pollingStatus.records.collectionDone = false;
            }
        }
    }
    getDataFromMongo(mediaType, time, loadCallback);
}
var broadcastChanges = function(mediaType, data) {
    logger.logInfo(CLASS_NAME, "Broadcasting cache changes to client");
    io.emit(mediaType, data);
};
var cacheRefresher = function() {
    var optionalCharacter = "";
    if (DEFAULT_SERVER_SETTINGS.cacheRefreshTimeInMinutes > 1) {
        optionalCharacter = 's';
    }
    logger.logInfo(CLASS_NAME, "Successfully connected to MongoDB, will refresh cache for client every " + DEFAULT_SERVER_SETTINGS.cacheRefreshTimeInMinutes + " minute" + optionalCharacter);
	
    // Load ALL database items into cache on startup, if there are any existing database items.
    // From then on, just let the poller update the client as necessary
    var time = 0;
    refreshCacheForClient("records", time, broadcastChanges);

	// setInterval(function() {
	//     refreshCacheForClient("records", new Date().getTime() - (DEFAULT_SERVER_SETTINGS.cacheRefreshTimeInMinutes * 60 * 1000), broadcastChanges);
	// }, DEFAULT_SERVER_SETTINGS.cacheRefreshTimeInMinutes * 60 * 1000);
};
mongoConnection.open(mongoConnection.DEFAULT_MONGO_CONFIG, cacheRefresher);

// Server
var app = express();
app.use(bodyParser.json());
app.use(express.static(__dirname + DEFAULT_SERVER_SETTINGS.root));

var server = http.createServer(app);
var io = socketIo(server);

server.listen(DEFAULT_SERVER_SETTINGS.port);

var socketOpened = function(socket) {
    logger.logInfo(CLASS_NAME, "Client socket connection opened");

    // Refresh clients (otherwise they'll have old, zombie data hanging around as we continue to add to it, leading to duplicates)
    // socket.emit("recordCollection", []);
    // socket.emit("recordWishlist", []);

    // Send cached record collection
    socket.on("recordCollection",
        function() {
            socket.emit("recordCollection", cache.getCacheCollectionFor("records"));
            logger.logInfo(CLASS_NAME, "Sent cached \"records\" collection to the client");
        },
        function() {
            logger.logError(CLASS_NAME, "socketOpened", "Failed to send cached \"records\" collection to the client");
        }
    );

    // Send cached record wishlist
    socket.on("recordWishlist",
        function() {
            socket.emit("recordWishlist", cache.getCacheWishlistFor("records"));
            logger.logInfo(CLASS_NAME, "Sent cached \"records\" wishlist to the client");
        },
        function() {
            logger.logError(CLASS_NAME, "socketOpened", "Failed to send cached \"records\" wishlist to the client");
        }
    );

    // Add a specific item to the cache and notify frontend
    socket.on("addToCache", function(record) {
        logger.logInfo(CLASS_NAME, "Received socket request to add a new item \"" + record.title + "\" to the cache");
        
        var forceAddToCache = true;
        cache.cacheData("records", record, forceAddToCache);

        if (record.isWishlist) {
            broadcastChanges("recordWishlist", record);
        } else {
            broadcastChanges("recordCollection", record);
        } 
    });

    socket.on("getPollingStatus", function() {
        logger.logInfo(CLASS_NAME, "Received socket request for polling status");
        socket.emit("pollingStatus", pollingStatus);
        logger.logInfo(CLASS_NAME, "Sent polling statuses to the client");
    });

    // Poller is finished
    socket.on("pollingStatus", function(isWishlist) {
        if (isWishlist) {
            pollingStatus.records.wishlistDone = true;
            logger.logInfo(CLASS_NAME, "Received socket notification that polling is complete for the records wishlist");
        } else {
            pollingStatus.records.collectionDone = true;
            logger.logInfo(CLASS_NAME, "Received socket notification that polling is complete for the records collection");
        }
        broadcastChanges("pollingStatus", pollingStatus);
    });
}
io.sockets.on("connection", socketOpened);
