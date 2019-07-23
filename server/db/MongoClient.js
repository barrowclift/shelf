"use strict";

// DEPENDENCIES
// ------------
// External
let mongodb = require("mongodb");
// Local
let Logger = require("../common/Logger");


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
 * A relatively low-level MongoDB client. Used instead of the generic
 * `mongodb` client to abstract away establishing the initial connection and
 * bake in preferred error handling.
 */
class MongoClient {

    /**
     * @param {ShelfProperties} shelfProperties
     */
    constructor(shelfProperties) {
        this.shelfProperties = shelfProperties;
        this.mongo = null;

        log.debug("Initialized");
    }

    /**
     * ==============
     * PUBLIC METHODS
     * ==============
     */

    connect() {
        const THIS = this; // For referencing root-instance "this" in promises
        log.debug("Connecting to Mongo...");
        let mongoServerUrl = "mongodb://" + this.shelfProperties.mongoHost + ":" + this.shelfProperties.mongoPort + "/" + this.shelfProperties.mongoDbName;
        return new Promise(function(resolve, reject) {
            mongodb.MongoClient.connect(
                mongoServerUrl,{ useNewUrlParser: true }
            ).then(function(connection) {
                log.info("Connection to Mongo server at " + THIS.shelfProperties.mongoHost + ":" + THIS.shelfProperties.mongoPort + " established");
                THIS.connection = connection;
                THIS.mongo = connection.db(THIS.shelfProperties.mongoDbName);
                resolve();
            }).catch(function(error) {
                reject(Error(error));
            });
        });
    }

    close() {
        const THIS = this; // For referencing root-instance "this" in promises
        log.debug("Closing Mongo connection...");
        return new Promise(function(resolve, reject) {
            if (THIS.connection) {
                THIS.connection.close();
                log.info("Closed Mongo connection");
            } else {
                log.warn("Connection already closed");
            }
            resolve();
        });
    }

    /**
     * Like Mongo's find, but wrapping up tiresome boilerplate for increased
     * safety and ease of use. Returned document array will be "null" as well
     * when no documents exist, as that's also far easier to check for and
     * handle than an empty array.
     */
    find(collectionName, query) {
        let collection = this.mongo.collection(collectionName);
        return new Promise(function(resolve, reject) {
            if (collection && query) {
                collection.find(query).toArray(function(error, documents) {
                    if (error) {
                        reject(Error(error));
                    } else if (!documents || documents.length == 0) {
                        log.debug("Found no results for query='" + JSON.stringify(query) + "', collectionName=" + collectionName);
                        resolve(null);
                    } else {
                        log.debug("Successfully found 1+ documents for query='" + JSON.stringify(query) + "', collectionName=" + collectionName);
                        resolve(documents);
                    }
                });
            } else {
                reject(Error("Invalid find arguments, collection=" + collection + ", query=" + JSON.stringify(query)));
            }
        });
    }

    /**
     * Like Mongo's findOne, but wrapping up tiresome boilerplate for
     * increased safety and ease of use.
     */
    findOne(collectionName, query) {
        let collection = this.mongo.collection(collectionName);
        return new Promise(function(resolve, reject) {
            if (collection && query) {
                collection.findOne(
                    query
                ).then(function(document) {
                    if (document == null) {
                        log.debug("Found no existing document, collectionName=" + collectionName + ", query=" + JSON.stringify(query));
                    } else {
                        log.debug("Successfully found one document, collectionName=" + collectionName + ", _id=" + document._id);
                    }
                    resolve(document);
                }).catch(function(error) {
                    reject(Error(error));
                });
            } else {
                reject(Error("Invalid findOne arguments, collection=" + collection + ", query=" + JSON.stringify(query)));
            }
        });
    }

    /**
     * Like Mongo's updateOne, but wrapping up tiresome boilerplate for
     * increased safety and ease of use. This method has "upsert" behavior
     * built in and always enabled.
     */
    upsertOne(collectionName, document) {
        let collection = this.mongo.collection(collectionName);
        return new Promise(function(resolve, reject) {
            if (collection && document) {
                if ("_id" in document) {
                    collection.updateOne({ _id: document._id },
                                         { $set: document },
                                         { upsert: true},
                                         function(error) {
                        if (error) {
                            reject(Error(error));
                        } else {
                            log.debug("Successfully upserted one document, collection=" + collectionName + ", _id=" + document._id);
                            resolve();
                        }
                    });
                } else {
                    reject(Error("Invalid document, missing required '_id' field"));
                }
            } else {
                reject(Error("Invalid updateOne arguments, collection=" + collection + ", document=" + document));
            }
        });
    }

    /**
     * Like Mongo's insertOne, but wrapping up tiresome boilerplate for
     * increased safety and ease of use. This method has insert behavior ONLY,
     * will result in conflict if existing document has the same _id
     */
    insertOne(collectionName, document) {
        let collection = this.mongo.collection(collectionName);
        return new Promise(function(resolve, reject) {
            if (collection && document) {
                if ("_id" in document) {
                    collection.insertOne(document,
                                         function(error) {
                        if (error) {
                            reject(Error(error));
                        } else {
                            log.debug("Successfully inserted one document, collection=" + collectionName + ", _id=" + document._id);
                            resolve();
                        }
                    })
                } else {
                    reject(Error("Invalid document, missing required '_id' field"));
                }
            } else {
                reject(Error("Invalid updateOne arguments, collection=" + collection + ", document=" + document));
            }
        });
    }

    deleteById(collectionName, id) {
        let collection = this.mongo.collection(collectionName);
        return new Promise(function(resolve, reject) {
            if (collection && id) {
                collection.deleteOne({_id:id},
                                     function(error) {
                    if (error) {
                        reject(Error(error));
                    } else {
                        log.debug("Successfully deleted document, collection=" + collectionName + ", _id=" + id);
                        resolve();
                    }
                });
            }
        });
    }

    dropCollection(collectionName) {
        let collection = this.mongo.collection(collectionName);
        return new Promise(function(resolve, reject) {
            if (collection) {
                collection.drop(function(error) {
                    if (error) {
                        if (error.code == 26) {
                            resolve("Collection doesn't exist");
                        } else {
                            reject(Error(error));
                        }
                    } else {
                        resolve("Successfully dropped collection=" + collectionName);
                    }
                });
            } else {
                reject(Error("Cannot drop collection, collection=" + collection));
            }
        });
    }
}

module.exports = MongoClient;