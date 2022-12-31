"use strict";

// DEPENDENCIES
// ------------
// External
let nodePropertyLoader = require("properties");
// Local
let Logger = require("./Logger");
let util = require("./util");


// CONSTANTS
// ---------
const CLASS_NAME = "PropertyManager";

// Assorted, base properties
const DEFAULT_FRONTEND_PORT = 10800;
const DEFAULT_BACKEND_PORT = 10801;
const DEFAULT_CONNECTION_TIMEOUT_IN_SECONDS = 5;
const DEFAULT_NAME = "Anonymous";
const DEFAULT_MAX_ART_SIZE = 512;
const DEFAULT_REFRESH_FREQUENCY_IN_MINUTES = 1;
const DEFAULT_SITE_TITLE = "Shelf"
const DEFAULT_URL = "http://localhost";
const DEFAULT_TWITTER_HANDLE = "";
const DEFAULT_USER_AGENT_BASE = "Shelf/2.0 +https://github.com/barrowclift/shelf";

// Mongo
const DEFAULT_MONGO_DBNAME = "shelfDb";
const DEFAULT_MONGO_HOST = "0.0.0.0";
const DEFAULT_MONGO_PORT = 27017;

// Records
const DEFAULT_RECORD_SHELF_ENABLED = true;
const DEFAULT_DISCOGS_USER_ID = null;
const DEFAULT_DISCOGS_USER_TOKEN = null;

// Books
const DEFAULT_BOOK_SHELF_ENABLED = true;
const DEFAULT_GOODREADS_USER_ID = null;
const DEFAULT_GOODREADS_KEY = null;
const DEFAULT_GOODREADS_TOKEN = null;
const DEFAULT_EXPERIMENTAL_BOX_RENDERING = false;

// Board Games
const DEFAULT_BOARD_GAME_SHELF_ENABLED = true;
const DEFAULT_BOARD_GAME_GEEK_USER_ID = null;


// GLOBALS
// -------
let log = new Logger(CLASS_NAME);


/**
 * Working with properties is a pain. You have to check for existance, have
 * default values defined, etc. This detracts from what the code using those
 * values actually wants: a sane default if not present, no boilerplate hiding
 * the core of their own logic.
 *
 * Thus, any and ALL Shelf properties are pre-loaded and validated here, and
 * if not provided or present fall back to sane defaults. Thus, letting
 * calling code get back to what's *actually* important to them: their own
 * work.
 */
class PropertyManager {

    /**
     * Does not automatically load any properties file, but simply initializes
     * all Shelf properties to their default values. To load
     * `shelf.properties`, call load().
     */
    constructor() {
        // Assorted, base properties
        this.connectionTimeoutInMillis = DEFAULT_CONNECTION_TIMEOUT_IN_SECONDS;
        this.name = DEFAULT_NAME;
        this.maxArtSize = DEFAULT_MAX_ART_SIZE;
        this.refreshFrequencyInMillis = DEFAULT_REFRESH_FREQUENCY_IN_MINUTES;
        this.title = DEFAULT_SITE_TITLE;
        this.twitterHandle = DEFAULT_TWITTER_HANDLE;
        this.frontendUrl = DEFAULT_URL;
        this.frontendPort = DEFAULT_FRONTEND_PORT;
        this.backendUrl = DEFAULT_URL;
        this.backendPort = DEFAULT_BACKEND_PORT;
        this.publicUrl = DEFAULT_URL;
        this.userAgentBase = DEFAULT_USER_AGENT_BASE;

        // Mongo
        this.mongoHost = DEFAULT_MONGO_HOST;
        this.mongoDbName = DEFAULT_MONGO_DBNAME;
        this.mongoPort = DEFAULT_MONGO_PORT;

        // Records
        this.recordShelfEnabled = DEFAULT_RECORD_SHELF_ENABLED;
        this.discogsUserId = DEFAULT_DISCOGS_USER_ID;
        this.discogsUserToken = DEFAULT_DISCOGS_USER_TOKEN;

        // Books
        this.bookShelfEnabled = DEFAULT_BOOK_SHELF_ENABLED;
        this.goodreadsUserId = DEFAULT_GOODREADS_USER_ID;
        this.goodreadsKey = DEFAULT_GOODREADS_KEY;
        this.goodreadsToken = DEFAULT_GOODREADS_TOKEN;

        // Board Games
        this.boardGameShelfEnabled = DEFAULT_BOARD_GAME_SHELF_ENABLED;
        this.boardGameGeekUserId = DEFAULT_BOARD_GAME_GEEK_USER_ID;
        this.experimentalBoardGameBoxRendering = DEFAULT_EXPERIMENTAL_BOX_RENDERING;
    }

    /**
     * ==============
     * PUBLIC METHODS
     * ==============
     */

    async load(filename) {
        if (!filename) {
            throw "Property filename is null";
        }

        let properties = await this._load(filename);

        // Assorted, base properties

        if ("connection.timeout.in.seconds" in properties) {
            let connectionTimeoutInSeconds = properties["connection.timeout.in.seconds"];
            this.connectionTimeoutInMillis = util.secondsToMillis(connectionTimeoutInSeconds);
        }
        if ("max.art.size" in properties) {
            this.maxArtSize = properties["max.art.size"];
        }
        if ("name" in properties) {
            this.name = properties["name"];
        }
        if ("refresh.frequency.in.minutes" in properties) {
            let refreshFrequencyInMinutes = properties["refresh.frequency.in.minutes"];
            this.refreshFrequencyInMillis = util.minutesToMillis(refreshFrequencyInMinutes);
        }
        if ("site.title" in properties) {
            this.title = properties["site.title"];
        }
        if ("public.url" in properties) {
            this.publicUrl = properties["public.url"];
        }
        if ("frontend.url" in properties) {
            this.frontendUrl = properties["frontend.url"];
        }
        if ("frontend.port" in properties) {
            this.frontendPort = properties["frontend.port"];
        }
        if ("backend.url" in properties) {
            this.backendUrl = properties["backend.url"];
        }
        if ("backend.port" in properties) {
            this.backendPort = properties["backend.port"];
        }
        if ("twitter.handle" in properties) {
            this.twitterHandle = properties["twitter.handle"];
        }
        if ("user.agent.base" in properties) {
            this.userAgentBase = properties["user.agent.base"];
        }

        // Mongo

        if ("mongodb.host" in properties) {
            this.mongoHost = properties["mongodb.host"];
        }
        if ("mongodb.name" in properties) {
            this.mongoDbName = properties["mongodb.name"];
        }
        if ("mongodb.port" in properties) {
            this.mongoPort = properties["mongodb.port"];
        }
        if ("mongodb.collection.records.name" in properties) {
            this.recordsCollectionName = properties["mongodb.collection.records.name"];
        }
        if ("mongodb.collection.boardGames.name" in properties) {
            this.boardGamesCollectionName = properties["mongodb.collection.boardGames.name"];
        }
        if ("mongodb.collection.books.name" in properties) {
            this.booksCollectionName = properties["mongodb.collection.books.name"];
        }

        // Records

        if ("record.shelf.enabled" in properties) {
            this.recordShelfEnabled = properties["record.shelf.enabled"];
        }
        if ("discogs.user.id" in properties) {
            this.discogsUserId = properties["discogs.user.id"];
        }
        if ("discogs.user.token" in properties) {
            this.discogsUserToken = properties["discogs.user.token"];
        }

        // Books

        if ("book.shelf.enabled" in properties) {
            this.bookShelfEnabled = properties["book.shelf.enabled"];
        }
        if ("goodreads.user.id" in properties) {
            this.goodreadsUserId = properties["goodreads.user.id"];
        }
        if ("goodreads.user.key" in properties) {
            this.goodreadsKey = properties["goodreads.user.key"];
        }
        if ("goodreads.user.token" in properties) {
            this.goodreadsToken = properties["goodreads.user.token"];
        }

        // Board Games

        if ("boardgame.shelf.enabled" in properties) {
            this.boardGameShelfEnabled = properties["boardgame.shelf.enabled"];
        }
        if ("boardgamegeek.user.id" in properties) {
            this.boardGameGeekUserId = properties["boardgamegeek.user.id"];
        }
        if ("experimental.boardgame.box.rendering" in properties) {
            this.experimentalBoardGameBoxRendering = properties["experimental.boardgame.box.rendering"];
        }

        this.backendUrl = this.backendUrl + ":" + this.backendPort;
        this.frontendUrl = this.frontendUrl + ":" + this.frontendPort;
    }

    /**
     * ===============
     * PRIVATE METHODS
     * ===============
     */

    async _load(filename) {
        // The properties package does not currently support promises natively
        return new Promise((resolve, reject) => {
            nodePropertyLoader.parse(filename,
                                     { path: true },
                                     function(error, properties) {
                if (error) {
                    log.error("loadProperties", "An error occurred while loading properties");
                    reject(Error(error));
                } else {
                    log.info("Loaded properties");
                    resolve(properties);
                }
            });
        });
    }

}

module.exports = PropertyManager;