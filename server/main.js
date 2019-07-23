"use strict";

// DEPENDENCIES
// ------------
// External
let path = require("path");
// Local
let BoardGameFetcher = require("./boardGames/Fetcher");
let BookFetcher = require("./books/Fetcher");
let CachedMongoClient = require("./db/CachedMongoClient");
let Logger = require("./common/Logger");
let paths = require("./common/paths");
let Properties = require("./common/ShelfProperties");
let RecordFetcher = require("./records/Fetcher");
let Server = require("./Server");
let ShelfProperties = require("./common/ShelfProperties");
let util = require("./common/util");


// CONSTANTS
// ---------
const CLASS_NAME = "main";


// GLOBALS
// -------
let shelfProperties = null;
let mongoClient = null;
let recordFetcher = null;
let boardGameFetcher = null;
let bookFetcher = null;
let server = null;

const log = new Logger(CLASS_NAME);
let propertiesFileName = path.join(paths.SERVER_RESOURCES_DIRECTORY_PATH, "shelf.properties");


// STARTUP
// -------
log.info("Starting up...");

async function startup() {
    // 1. Load properties
    shelfProperties = new ShelfProperties();
    await shelfProperties.load(propertiesFileName);

    // 2. Connect to MongoDB
    mongoClient = new CachedMongoClient(shelfProperties);
    await mongoClient.connect();

    // 3. Build client site
    server = new Server(shelfProperties, mongoClient);
    // 4. Start client server
    server.start();

    // 5. Start content fetch loops
    if (shelfProperties.recordShelfEnabled) {
        recordFetcher = new RecordFetcher(shelfProperties, mongoClient);
        recordFetcher.start();
    }
    if (shelfProperties.boardGameShelfEnabled) {
        boardGameFetcher = new BoardGameFetcher(shelfProperties, mongoClient);
        boardGameFetcher.start();
    }
    if (shelfProperties.bookShelfEnabled) {
        bookFetcher = new BookFetcher(shelfProperties, mongoClient, server.getExpressApp());
        bookFetcher.start();
    }
}

try {
    startup();
} catch (error) {
    log.error("startup", error);
}


// SHUTDOWN
// --------
["SIGHUP",
 "SIGINT",
 "SIGQUIT",
 "SIGIL",
 "SIGTRAP",
 "SIGABRT",
 "SIGBUS",
 "SIGFPE",
 "SIGUSR1",
 "SIGSEGV",
 "SIGUSR2",
 "SIGTERM"
].forEach(function(signal) {
    // Catching & handling all terminating signals
    process.on(signal, function() {
        log.info("Received signal=" + signal);
        shutdown();

        // Force a shutdown anyway if still alive after ten seconds
        setTimeout(function() {
            log.warn("Shutdown still not complete, forcing shutdown... NOW");
            process.exit(1);
        }, 10000);
    });
})
async function shutdown() {
    log.info("Shutting down...");
    await server.stop();
    if (recordFetcher) {
        await recordFetcher.stop();
    }
    if (boardGameFetcher) {
        await boardGameFetcher.stop();
    }
    if (bookFetcher) {
        await bookFetcher.stop();
    }
    await mongoClient.close();
    log.info("Completed shutdown");
    process.exit(0);
}