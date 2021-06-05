"use strict";

// DEPENDENCIES
// ------------
// External
let path = require("path");
let Properties = require("properties");
let socketIo = require("socket.io-client");
// Local
const SHELF_ROOT_DIRECTORY_PATH = path.join(__dirname, "..");
let CachedMongoClient = require(path.join(SHELF_ROOT_DIRECTORY_PATH, "backend/db/CachedMongoClient"));
let PropertyManager = require(path.join(SHELF_ROOT_DIRECTORY_PATH, "backend/common/PropertyManager"));
let socketCodes = require(path.join(SHELF_ROOT_DIRECTORY_PATH, "backend/common/socketCodes"));
let util = require(path.join(SHELF_ROOT_DIRECTORY_PATH, "backend/common/util"));


// CONSTANTS
// ---------
const PROPERTIES_FILE_NAME = path.join(SHELF_ROOT_DIRECTORY_PATH, "backend/resources/shelf.properties");


// GLOBALS
// -------
var propertyManager = null;


async function cleanDbAndClose() {
    var mongoClient = new CachedMongoClient(propertyManager);
    await mongoClient.connect();
    await mongoClient.dropRecords();
    await mongoClient.dropBoardGames();
    await mongoClient.dropBooks();
    await mongoClient.close();
}

async function sendClearCacheRequest() {
    // Connect to backend server for communicating changes
    let backendSocket = socketIo.connect(propertyManager.backendUrl, { reconnect: true });
    let messageSent = false;
    backendSocket.on("connect", function() {
        console.log("Socket connection to backend server initialized");
        backendSocket.emit(socketCodes.CLEAR_CACHE);
        messageSent = true;
    });
    while (!messageSent) {
        await util.sleepForSeconds(0.1);
    }
    backendSocket.close();
}

async function main() {
    propertyManager = new PropertyManager();
    await propertyManager.load(PROPERTIES_FILE_NAME);

    let command = process.argv[2]
    if ("clean" == command) {
        await cleanDbAndClose();
    } else if ("clear" == command) {
        await sendClearCacheRequest();
    } else {
        console.log("Unsupported command '" + command + "'")
    }
}

main();