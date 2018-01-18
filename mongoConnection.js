var mongodb = require("mongodb");
var exitHandler = require("./exitHandler");
var logger = require("./client/shared/logger");

const DEFAULT_MONGO_CONFIG = {
    host: "127.0.0.1",
    port: 27017,
    db: "shelfDb"
};
const CLASS_NAME = "mongoConnection";

var connection = null;
var plug = null;

var setConfig = function(config) {
    if (config.host) {
        config.host = config.host;
    }
    if (config.port) {
        config.port = config.port;
    }
};

var open = function(config, accessDb) {
    if (config) {
        setConfig(config);
    }

    var url = "mongodb://" + config.host + ':' + config.port + '/' + config.db;

    var mongoClient = mongodb.MongoClient;
    mongoClient.connect(url, function(error, connectionBuilder) {
        if (error) {
            logger.logError(CLASS_NAME, "open", "Failed to connect to MongoDB at " + config.host + ':' + config.port + ". Error: " + error);
            close();
        } else {
            logger.logInfo(CLASS_NAME, "Connected to MongoDB at " + config.host + ':' + config.port + '.');
            connection = connectionBuilder.db(DEFAULT_MONGO_CONFIG.db);

            exitHandler.init(function() {
                setTimeout(function() {
                    close();
                }, 300);
            });

            if (accessDb) {
                accessDb();
            }

            plug = connectionBuilder;
        }
    });
};

var close = function() {
    if (plug && connection) {
        plug.close();
        connection = null;
        logger.logInfo(CLASS_NAME, "MongoDB connection closed");
    } else {
        logger.logWarning(CLASS_NAME, "close", "MongoDB connection already closed");
    }
};

var find = function(tableName, query, callback) {
    if (connection) {
        var table = connection.collection(tableName);
        if (table) {
            table.find(query).toArray(function(error, result) {
                if (error) {
                    logger.logWarning(CLASS_NAME, "find", "Failed to find data: " + error);
                } else {
                    if (callback) {
                        callback(result);
                    }
                }
            });
        }
    } else {
        logger.logError(CLASS_NAME, "find", "Cannot find, MongoDB connection not open");
    }
};

var upsert = function(tableName, data, callback) {
    if (connection) {
        var table = connection.collection(tableName);
        if (table) {
            table.updateOne({_id:data.id}, {$set:data}, {upsert:true}, function(error, result) {
                if (error) {
                    logger.logError(CLASS_NAME, "upsert", "Failed to upsert data: " + error);
                }
                if (callback) {
                    callback(error);
                }
            });
        }
    } else {
        logger.logError(CLASS_NAME, "upsert", "Cannot upsert, MongoDB connection not open");
    }
};

var search = function(tableName, query, callback) {
    find(tableName, query, function(documents) {
        if (callback) {
            callback(documents);
        }
    });
};

var dropTable = function(tableName) {
    if (connection) {
        var table = connection.collection(tableName);
        if (table) {
            table.drop(function(error, result) {
                if (error) {
                    logger.logWarning(CLASS_NAME, "dropTable", "Failed to drop table \"" + tableName + "\": " + error);
                } else {
                    logger.logInfo(CLASS_NAME, "Dropped table \"" + tableName + "\"");
                }
            });
        }
    } else {
        logger.logError(CLASS_NAME, "dropTable", "Cannot drop \"" + table + "\", MongoDB connection not open");
    }
};

var cleanDb = function() {
    if (connection) {
        dropTable("records");
    } else {
        logger.logError(CLASS_NAME, "cleanDb", "Cannot drop all tables, MongoDB connection not open");
    }
};

module.exports = {
    DEFAULT_MONGO_CONFIG: DEFAULT_MONGO_CONFIG,
    open: open,
    close: close,
    cleanDb: cleanDb,
    search: search,
    upsert: upsert,
    dropTable: dropTable
};
