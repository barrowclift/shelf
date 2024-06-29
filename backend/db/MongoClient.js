"use strict";

// DEPENDENCIES
// ------------
// External
import mongodb from "mongodb";
// Local
import Logger from "../common/Logger.js";


// CONSTANTS
// ---------
const CLASS_NAME = "MongoClient";

const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = 27017;
const DEFAULT_DB_NAME = "shelfDb";


// GLOBALS
// -------
let log = new Logger(CLASS_NAME);


/**
 * This was originally a "wrapper" to the old v3 `mongodb` client primarily to
 * sidestep the absolutely nightmare that was callback handling and instead
 * wrap everything in Promises so callers could simply `await` the necessary
 * calls.
 *
 * However, modern `mongodb` client versions (thankfully!) migrated natively
 * to Promises, so the vast majority of the value this wrapper class provided
 * is now moot.
 *
 * I'm keeping it around mostly for legacy reasons (it's more work to fully
 * remove than to remove the now unnecessary Promise wrapping). If this was
 * being written from scratch today with the modern `mongodb` package, I
 * wouldn't have made this class at all.
 */
export default class MongoClient {

    /**
     * @param {PropertyManager} propertyManager
     */
    constructor(propertyManager) {
        this.propertyManager = propertyManager;
        this.mongo = null;

        log.debug("Initialized");
    }

    /**
     * ==============
     * PUBLIC METHODS
     * ==============
     */

    async connect() {
        let mongoServerUrl = "mongodb://" + this.propertyManager.mongoHost + ":" + this.propertyManager.mongoPort + "/" + this.propertyManager.mongoDbName;
        log.info("Connecting to Mongo at " + mongoServerUrl);
        this.connection = new mongodb.MongoClient(mongoServerUrl);
        await this.connection.connect();
        this.mongo = this.connection.db(this.propertyManager.mongoDbName);
    }

    async close() {
        log.debug("Closing Mongo connection...");
        await this.connection.close();
        log.info("Closed Mongo connection");
    }

    /**
     * Like Mongo's find, but wrapping up tiresome boilerplate for increased
     * safety and ease of use. Returned document array will be "null" as well
     * when no documents exist, as that's also far easier to check for and
     * handle than an empty array.
     */
    find(collectionName, query) {
        let collection = this.mongo.collection(collectionName);
        if (collection == null || query == null) {
            throw "Invalid find arguments, query='" + JSON.stringify(query) + "', collectionName=" + collectionName;
        }

        return collection.find(query).toArray();
    }

    /**
     * Like Mongo's findOne, but wrapping up tiresome boilerplate for
     * increased safety and ease of use.
     */
    findOne(collectionName, query) {
        let collection = this.mongo.collection(collectionName);
        if (collection == null || query == null) {
            throw "Invalid findOne arguments, query='" + JSON.stringify(query) + "', collectionName=" + collectionName;
        }

        return collection.findOne(query);
    }

    /**
     * Like Mongo's updateOne, but wrapping up tiresome boilerplate for
     * increased safety and ease of use. This method has "upsert" behavior
     * built in and always enabled.
     */
    upsertOne(collectionName, document) {
        let collection = this.mongo.collection(collectionName);
        if (collection == null || document == null) {
            throw "Invalid upsertOne arguments, document='" + document + "', collectionName=" + collectionName;
        }
        if (!("_id" in document)) {
            throw "Invalid document, missing required '_id' field";
        }
        return collection.updateOne(
            { _id: document._id },
            { $set: document },
            { upsert: true}
        );
    }

    /**
     * Like Mongo's insertOne, but wrapping up tiresome boilerplate for
     * increased safety and ease of use. This method has insert behavior ONLY,
     * will result in error if existing document has the same _id
     */
    insertOne(collectionName, document) {
        let collection = this.mongo.collection(collectionName);
        if (collection == null || document == null) {
            throw "Invalid insertOne arguments, document='" + document + "', collectionName=" + collectionName;
        }
        if (!("_id" in document)) {
            throw "Invalid document, missing required '_id' field";
        }
        return collection.insertOne(document);
    }

    /**
     * Like Mongo's deleteOne, but wrapping up tiresome boilerplate for
     * increased safety and ease of use. This method has delete ONE behavior
     * ONLY, will result in error if no document exists with the provided _id
     */
    deleteById(collectionName, id) {
        let collection = this.mongo.collection(collectionName);
        if (collection == null || id == null) {
            "Invalid deleteById arguments, _id=" + id + ", collectionName=" + collectionName;
        }
        return collection.deleteOne({ _id: id });
    }

    /**
     * Like Mongo's drop, but wrapping up tiresome boilerplate for increased
     * safety and ease of use. This method will drop empty or full
     * collections.
     */
    dropCollection(collectionName) {
        let collection = this.mongo.collection(collectionName);
        if (collection == null) {
            "Cannot drop 'null' collection";
        }
        return collection.drop();
    }
}
