"use strict";

var mongoConnection = require("./mongoConnection");

var cleanDbAndClose = function() {
    mongoConnection.cleanDb();

    setTimeout(function() {
        mongoConnection.close();
        process.exit();
    }, 300);
};
mongoConnection.open(mongoConnection.DEFAULT_MONGO_CONFIG, cleanDbAndClose);
