"use strict";

// DEPENDENCIES
// ------------
// External
let path = require("path");
// Local


// CONSTANTS
// ---------

exports.SHELF_DIRECTORY_PATH = path.join(__dirname, "../..");

exports.SERVER_DIRECTORY_PATH = path.join(exports.SHELF_DIRECTORY_PATH, "server");
	exports.SERVER_RECORDS_DIRECTORY_PATH = path.join(exports.SERVER_DIRECTORY_PATH, "records");
	exports.SERVER_BOOKS_DIRECTORY_PATH = path.join(exports.SERVER_DIRECTORY_PATH, "books");
	exports.SERVER_BOARD_GAMES_DIRECTORY_PATH = path.join(exports.SERVER_DIRECTORY_PATH, "boardGames");
	exports.SERVER_COMMON_DIRECTORY_PATH = path.join(exports.SERVER_DIRECTORY_PATH, "common");
	exports.SERVER_DB_DIRECTORY_PATH = path.join(exports.SERVER_DIRECTORY_PATH, "db");
	exports.SERVER_RESOURCES_DIRECTORY_PATH = path.join(exports.SERVER_DIRECTORY_PATH, "resources");

exports.CLIENT_DIRECTORY_PATH = path.join(exports.SHELF_DIRECTORY_PATH, "client");
    exports.CLIENT_STATIC_DIRECTORY_PATH = path.join(exports.CLIENT_DIRECTORY_PATH, "static");
        exports.CLIENT_IMAGES_DIRECTORY_PATH = path.join(exports.CLIENT_STATIC_DIRECTORY_PATH, "images");
            exports.CLIENT_RECORD_CACHE_DIRECTORY_PATH = path.join(exports.CLIENT_IMAGES_DIRECTORY_PATH, "records");
            exports.CLIENT_BOARD_GAME_CACHE_DIRECTORY_PATH = path.join(exports.CLIENT_IMAGES_DIRECTORY_PATH, "board-games");
            exports.CLIENT_BOOK_CACHE_DIRECTORY_PATH = path.join(exports.CLIENT_IMAGES_DIRECTORY_PATH, "books");
    exports.CLIENT_LIQUID_DIRECTORY_PATH = path.join(exports.CLIENT_DIRECTORY_PATH, "liquid");
        exports.CLIENT_INCLUDES_DIRECTORY_PATH = path.join(exports.CLIENT_LIQUID_DIRECTORY_PATH, "_includes");
        exports.CLIENT_LAYOUTS_DIRECTORY_PATH = path.join(exports.CLIENT_LIQUID_DIRECTORY_PATH, "_layouts");