"use strict"

var path = require("path")
const SHELF_DIRECTORY_PATH = path.join(__dirname, "..")


// DEPENDENCIES
// ------------
// External
const Properties = require("properties");
// Local
const ShelfProperties = require(path.join(SHELF_DIRECTORY_PATH, "server/common/ShelfProperties"));
const CachedMongoClient = require(path.join(SHELF_DIRECTORY_PATH, "server/db/CachedMongoClient"));
const util = require(path.join(SHELF_DIRECTORY_PATH, "server/common/util"));


// CONSTANTS
// ---------
const PROPERTIES_FILE_NAME = path.join(SHELF_DIRECTORY_PATH, "server/resources/shelf.properties");


// GLOBALS
// -------
var shelfProperties = null;


async function cleanDbAndClose() {
    var mongoClient = new CachedMongoClient(shelfProperties);
    await mongoClient.connect();
    await mongoClient.dropRecords();
    await mongoClient.dropBoardGames();
    await mongoClient.dropBooks();
    await mongoClient.close();
}

async function main() {
    shelfProperties = new ShelfProperties();
    await shelfProperties.load(PROPERTIES_FILE_NAME);

    await cleanDbAndClose();
}

main();