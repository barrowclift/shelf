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

    connect() {
        log.debug("Connecting to Mongo...");
        let mongoServerUrl = "mongodb://" + this.propertyManager.mongoHost + ":" + this.propertyManager.mongoPort + "/" + this.propertyManager.mongoDbName;
        return new Promise((resolve, reject) => {
            mongodb.MongoClient.connect(
                mongoServerUrl,
                {
                    useNewUrlParser: true,
                    useUnifiedTopology: true
                }
            ).then((connection) => {
                log.info("Connection to Mongo server at " + this.propertyManager.mongoHost + ":" + this.propertyManager.mongoPort + " established");
                this.connection = connection;
                this.mongo = connection.db(this.propertyManager.mongoDbName);
                resolve();
            }).catch((error) => {
                reject(Error(error));
            });
        });
    }

    close() {
        log.debug("Closing Mongo connection...");
        return new Promise((resolve, reject) => {
            if (this.connection) {
                this.connection.close();
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
            if (collection && query != null) {
                collection.find(query).toArray(function(error, documents) {
                    if (error) {
                        reject(Error(error));
                    } else if (!documents || documents.length == 0) {
                        log.debug("Found no results for query='" + JSON.stringify(query) + "', collectionName=" + collectionName);
                        resolve(null);
                    } else {
                        if (!query) {

                        }
                        log.debug("Found 1+ documents for query='" + JSON.stringify(query) + "', collectionName=" + collectionName);
                        resolve(documents);
                    }
                });
            } else {
                reject(Error("Invalid find arguments, query=" + JSON.stringify(query)) + ", collectionName=" + collectionName);
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
                        log.debug("Found no existing document, query=" + JSON.stringify(query) + ", collectionName=" + collectionName);
                    } else {
                        log.debug("Found one document, _id=" + document._id + ", collectionName=" + collectionName);
                    }
                    resolve(document);
                }).catch(function(error) {
                    reject(Error(error));
                });
            } else {
                reject(Error("Invalid findOne arguments, query=" + JSON.stringify(query)) + ", collectionName=" + collectionName);
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
                            log.debug("Upserted one document, _id=" + document._id + ", collectionName=" + collectionName);
                            resolve();
                        }
                    });
                } else {
                    reject(Error("Invalid document, missing required '_id' field"));
                }
            } else {
                reject(Error("Invalid updateOne arguments, document=" + document + ", collectionName=" + collectionName));
            }
        });
    }

    /**
     * Like Mongo's insertOne, but wrapping up tiresome boilerplate for
     * increased safety and ease of use. This method has insert behavior ONLY,
     * will result in error if existing document has the same _id
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
                            log.debug("Inserted one document, _id=" + document._id + ", collectionName=" + collectionName);
                            resolve();
                        }
                    })
                } else {
                    reject(Error("Invalid document, missing required '_id' field"));
                }
            } else {
                reject(Error("Invalid updateOne arguments, document=" + document + ", collectionName=" + collectionName));
            }
        });
    }

    /**
     * Like Mongo's deleteOne, but wrapping up tiresome boilerplate for
     * increased safety and ease of use. This method has delete ONE behavior
     * ONLY, will result in error if no document exists with the provided _id
     */
    deleteById(collectionName, id) {
        let collection = this.mongo.collection(collectionName);
        return new Promise(function(resolve, reject) {
            if (collection && id) {
                collection.deleteOne({_id:id},
                                     function(error) {
                    if (error) {
                        reject(Error(error));
                    } else {
                        log.debug("Deleted document, _id=" + id + ", collectionName=" + collectionName);
                        resolve();
                    }
                });
            } else {
                reject(Error("Invalid deleteById arguments, _id=" + id + ", collectionName=" + collectionName));
            }
        });
    }

    /**
     * Like Mongo's drop, but wrapping up tiresome boilerplate for increased
     * safety and ease of use. This method will drop empty or full
     * collections, and will consider it a success if no collection exists
     * with the provided name.
     */
    dropCollection(collectionName) {
        let collection = this.mongo.collection(collectionName);
        return new Promise(function(resolve, reject) {
            if (collection) {
                collection.drop(function(error) {
                    if (error) {
                        if (error.code == 26) {
                            resolve("Collection doesn't exist, collectionName=" + collectionName);
                        } else {
                            reject(Error(error));
                        }
                    } else {
                        resolve("Dropped collectionName=" + collectionName);
                    }
                });
            } else {
                reject(Error("Cannot drop collection, collectionName=" + collectionName));
            }
        });
    }
}

module.exports = MongoClient;