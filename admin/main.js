"use strict";

// DEPENDENCIES
// ------------
// External
import path from "path";
// Local
import BoardGameFetcher from "../backend/boardGames/Fetcher.js";
import CachedMongoClient from "../backend/db/CachedMongoClient.js";
import Logger from "../backend/common/Logger.js";
import paths from "../backend/common/paths.js";
import RecordFetcher from "../backend/records/Fetcher.js";
import Server from "../backend/Server.js";
import PropertyManager from "../backend/common/PropertyManager.js";


// CONSTANTS
// ---------
const CLASS_NAME = "main";


// GLOBALS
// -------
let propertyManager = null;
let mongoClient = null;
let recordFetcher = null;
let boardGameFetcher = null;
let bookFetcher = null;
let server = null;

const log = new Logger(CLASS_NAME);
let propertiesFileName = path.join(paths.BACKEND_RESOURCES_DIRECTORY_PATH, "shelf.properties");


// STARTUP
// -------
log.info("Starting up...");

async function startup() {
    // 1. Load properties
    propertyManager = new PropertyManager();
    await propertyManager.load(propertiesFileName);

    // 2. Connect to MongoDB
    mongoClient = new CachedMongoClient(propertyManager);
    await mongoClient.connect();

    // 3. Build client site
    server = new Server(propertyManager, mongoClient);
    // 4. Start client server
    server.start();

    // 5. Start content fetch loops
    if (propertyManager.recordShelfEnabled) {
        recordFetcher = new RecordFetcher(propertyManager, mongoClient);
        recordFetcher.start();
    }
    if (propertyManager.boardGameShelfEnabled) {
        boardGameFetcher = new BoardGameFetcher(propertyManager, mongoClient);
        boardGameFetcher.start();
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