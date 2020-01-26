"use strict";

// DEPENDENCIES
// ------------
// External
let express = require("express");
let path = require("path");
let socketIo = require("socket.io");
let compression = require("compression");
let filesystem = require("fs");
let cp = require("ncp");
let { Liquid } = require("liquidjs");
// Local
let Logger = require("./common/Logger");
let paths = require("./common/paths");
let socketCodes = require("./common/socketCodes");
let util = require("./common/util");


// CONSTANTS
// ---------
const CLASS_NAME = "Server";


// GLOBALS
// -------
let log = new Logger(CLASS_NAME);


class Server {

    /**
     * Initializes all necessary information to kick off Shelf's server, but
     * does not automatically start. To do so, start() must be called.
     *
     * @param {PropertyManager} propertyManager
     * @param {CachedMongoClient} mongoClient
     */
    constructor(propertyManager, mongoClient) {
        const THIS = this; // For referencing root-instance "this" in promise context

        this.propertyManager = propertyManager;
        this.mongoClient = mongoClient;

        this.refreshIntervalId = null;

        this.lastRefreshTime = Date.now();
        this.initialRecordFetchInProgress = true;
        this.initialBoardGameFetchInProgress = true;
        this.initialBookFetchInProgress = true;

        this.goodreadsOauthGranted = false;

        /**
         * We don't just want to pass in our entire propertyManager object to the
         * frontend, we just want to map the propertyManager we know are required
         * by the Liquid engine to render the page.
         */
        let baseLiquidVariables = {
            "siteTitle": propertyManager.title,
            "siteUrl": propertyManager.publicUrl,
            /**
             * Used as the link in the "About" page. If not provided in
             * shelf.properties, no hyperlink is set on your name.
             */
            "twitterHandle": propertyManager.twitterHandle,
            "name": propertyManager.name,
            "boardGameShelfEnabled": propertyManager.boardGameShelfEnabled,
            "bookShelfEnabled": propertyManager.bookShelfEnabled,
            "recordShelfEnabled": propertyManager.recordShelfEnabled
        };
        let recordCollectionLiquidVariables = JSON.parse(JSON.stringify(baseLiquidVariables));
        recordCollectionLiquidVariables["type"] = "Record";
        recordCollectionLiquidVariables["menu"] = "records";
        recordCollectionLiquidVariables["submenu"] = "collection";
        recordCollectionLiquidVariables["collectionPath"] = "/record/collection";
        recordCollectionLiquidVariables["wishlistPath"] = "/record/wishlist";
        recordCollectionLiquidVariables["initialFetchInProgress"] = socketCodes.INITIAL_RECORD_COLLECTION_IN_PROGRESS;
        recordCollectionLiquidVariables["getAllItems"] = socketCodes.RECORD_COLLECTION;
        recordCollectionLiquidVariables["addItem"] = socketCodes.ADDED_RECORD_TO_COLLECTION;
        recordCollectionLiquidVariables["updateItem"] = socketCodes.UPDATED_RECORD_IN_COLLECTION;
        recordCollectionLiquidVariables["removeItem"] = socketCodes.REMOVED_RECORD_FROM_COLLECTION;
        let recordWishlistLiquidVariables = JSON.parse(JSON.stringify(recordCollectionLiquidVariables));
        recordWishlistLiquidVariables["submenu"] = "wishlist";
        recordWishlistLiquidVariables["getAllItems"] = socketCodes.RECORD_WISHLIST;
        recordWishlistLiquidVariables["addItem"] = socketCodes.ADDED_RECORD_TO_WISHLIST;
        recordWishlistLiquidVariables["updateItem"] = socketCodes.UPDATED_RECORD_IN_WISHLIST;
        recordWishlistLiquidVariables["removeItem"] = socketCodes.REMOVED_RECORD_FROM_WISHLIST;
        let boardGameCollectionLiquidVariables = JSON.parse(JSON.stringify(baseLiquidVariables));
        boardGameCollectionLiquidVariables["type"] = "Game";
        boardGameCollectionLiquidVariables["menu"] = "board-games";
        boardGameCollectionLiquidVariables["submenu"] = "collection";
        boardGameCollectionLiquidVariables["collectionPath"] = "/game/collection";
        boardGameCollectionLiquidVariables["wishlistPath"] = "/game/wishlist";
        boardGameCollectionLiquidVariables["initialFetchInProgress"] = socketCodes.INITIAL_BOARD_GAME_COLLECTION_IN_PROGRESS;
        boardGameCollectionLiquidVariables["getAllItems"] = socketCodes.BOARD_GAME_COLLECTION;
        boardGameCollectionLiquidVariables["addItem"] = socketCodes.ADDED_BOARD_GAME_TO_COLLECTION;
        boardGameCollectionLiquidVariables["updateItem"] = socketCodes.UPDATED_BOARD_GAME_IN_COLLECTION;
        boardGameCollectionLiquidVariables["removeItem"] = socketCodes.REMOVED_BOARD_GAME_FROM_COLLECTION;
        let boardGameWishlistLiquidVariables = JSON.parse(JSON.stringify(boardGameCollectionLiquidVariables));
        boardGameWishlistLiquidVariables["submenu"] = "wishlist";
        boardGameWishlistLiquidVariables["getAllItems"] = socketCodes.BOARD_GAME_WISHLIST;
        boardGameWishlistLiquidVariables["addItem"] = socketCodes.ADDED_BOARD_GAME_TO_WISHLIST;
        boardGameWishlistLiquidVariables["updateItem"] = socketCodes.UPDATED_BOARD_GAME_IN_WISHLIST;
        boardGameWishlistLiquidVariables["removeItem"] = socketCodes.REMOVED_BOARD_GAME_FROM_WISHLIST;
        let bookCollectionLiquidVariables = JSON.parse(JSON.stringify(baseLiquidVariables));
        bookCollectionLiquidVariables["type"] = "Book";
        bookCollectionLiquidVariables["menu"] = "books";
        bookCollectionLiquidVariables["submenu"] = "collection";
        bookCollectionLiquidVariables["collectionPath"] = "/book/collection";
        bookCollectionLiquidVariables["wishlistPath"] = "/book/wishlist";
        bookCollectionLiquidVariables["initialFetchInProgress"] = socketCodes.INITIAL_BOOK_COLLECTION_IN_PROGRESS;
        bookCollectionLiquidVariables["getAllItems"] = socketCodes.BOOK_COLLECTION;
        bookCollectionLiquidVariables["addItem"] = socketCodes.ADDED_BOOK_TO_COLLECTION;
        bookCollectionLiquidVariables["updateItem"] = socketCodes.UPDATED_BOOK_IN_COLLECTION;
        bookCollectionLiquidVariables["removeItem"] = socketCodes.REMOVED_BOOK_FROM_COLLECTION;
        let bookWishlistLiquidVariables = JSON.parse(JSON.stringify(bookCollectionLiquidVariables));
        bookWishlistLiquidVariables["submenu"] = "wishlist";
        bookWishlistLiquidVariables["getAllItems"] = socketCodes.BOOK_WISHLIST;
        bookWishlistLiquidVariables["addItem"] = socketCodes.ADDED_BOOK_TO_WISHLIST;
        bookWishlistLiquidVariables["updateItem"] = socketCodes.UPDATED_BOOK_IN_WISHLIST;
        bookWishlistLiquidVariables["removeItem"] = socketCodes.REMOVED_BOOK_FROM_WISHLIST;
        let bookOauthLiquidVariables = JSON.parse(JSON.stringify(bookCollectionLiquidVariables));
        bookOauthLiquidVariables["submenu"] = "authentication";
        bookOauthLiquidVariables["initializeAuthPath"] = "/auth/goodreads";

        this.frontendApp = express();
        this.frontendApp.use(express.static(paths.FRONTEND_STATIC_DIRECTORY_PATH));
        const ENGINE = new Liquid({
            root: paths.FRONTEND_LIQUID_DIRECTORY_PATH,
            extname: ".liquid",
            cache: false // Setting to "true" screws with the images, keep `false`
        });
        this.frontendApp.engine("liquid", ENGINE.express()); // Register liquid engine
        this.frontendApp.use(compression());
        this.frontendApp.set("view engine", "liquid"); // Set that engine as the default
        this.frontendApp.set("views", [paths.FRONTEND_INCLUDES_DIRECTORY_PATH,
                               paths.FRONTEND_LAYOUTS_DIRECTORY_PATH]);
        if (propertyManager.recordShelfEnabled) {
            this.frontendApp.get("/", function(request, response) {
                response.render("records", recordCollectionLiquidVariables);
            });
        } else if (propertyManager.boardGameShelfEnabled) {
            this.frontendApp.get("/", function(request, response) {
                response.render("boardGames", boardGameCollectionLiquidVariables);
            });
        } else if (propertyManager.bookShelfEnabled) {
            this.frontendApp.get("/", function(request, response) {
                if (THIS.goodreadsOauthGranted) {
                    response.render("books", bookCollectionLiquidVariables);
                } else {
                    response.render("authentication", bookOauthLiquidVariables);
                }
            });
        } else {
            this.frontendApp.get("/", function(request, response) {
                response.render("about", baseLiquidVariables);
            });
        }

        if (propertyManager.recordShelfEnabled) {
            this.frontendApp.get("/record", function(request, response) {
                response.render("records", recordCollectionLiquidVariables);
            });
            this.frontendApp.get("/record/collection", function(request, response) {
                response.render("records", recordCollectionLiquidVariables);
            });
            this.frontendApp.get("/record/wishlist", function(request, response) {
                response.render("records", recordWishlistLiquidVariables);
            });
        }
        if (propertyManager.boardGameShelfEnabled) {
            this.frontendApp.get("/game", function(request, response) {
                response.render("boardGames", boardGameCollectionLiquidVariables);
            });
            this.frontendApp.get("/game/collection", function(request, response) {
                response.render("boardGames", boardGameCollectionLiquidVariables);
            });
            this.frontendApp.get("/game/wishlist", function(request, response) {
                response.render("boardGames", boardGameWishlistLiquidVariables);
            });
        }
        if (propertyManager.bookShelfEnabled) {
            this.frontendApp.get("/book", function(request, response) {
                if (THIS.goodreadsOauthGranted) {
                    response.render("books", bookCollectionLiquidVariables);
                } else {
                    response.render("authentication", bookOauthLiquidVariables);
                }
            });
            this.frontendApp.get("/book/collection", function(request, response) {
                if (THIS.goodreadsOauthGranted) {
                    response.render("books", bookCollectionLiquidVariables);
                } else {
                    response.render("authentication", bookOauthLiquidVariables);
                }
            });
            this.frontendApp.get("/book/wishlist", function(request, response) {
                if (THIS.goodreadsOauthGranted) {
                    response.render("books", bookWishlistLiquidVariables);
                } else {
                    response.render("authentication", bookOauthLiquidVariables);
                }
            });
        }
        this.frontendApp.get("/about", function(request, response) {
            response.render("about", baseLiquidVariables);
        });
        this.frontendApp.get("/acknowledgements", function(request, response) {
            response.render("acknowledgements", baseLiquidVariables);
        });

        this.backendApp = express();

        log.info("Initialized");
    }

    /**
     * ==============
     * PUBLIC METHODS
     * ==============
     */

    async start() {
        const THIS = this; // For referencing root-instance "this" in promise context

        // Frontend socket.io server for sending and receiving messages with the client (the website itself)
        this.frontendServer = await this.frontendApp.listen(this.propertyManager.frontendPort);
        log.info("Now serving frontend requests");

        this.frontendIo = socketIo(this.frontendServer);
        this.frontendIo.sockets.on("connection", function(socket) {
            log.debug("New client connected established with socket.io");

            // Records
            socket.on(socketCodes.INITIAL_RECORD_COLLECTION_IN_PROGRESS, function() {
                log.debug("Received frontend socket request to send initialRecordFetchInProgress=" + THIS.initialRecordFetchInProgress + " to client");
                socket.emit(socketCodes.INITIAL_RECORD_COLLECTION_IN_PROGRESS, THIS.initialRecordFetchInProgress);
            });
            socket.on(socketCodes.RECORD_COLLECTION, function() {
                log.debug("Received frontend socket request to send record collection");
                socket.emit(socketCodes.RECORD_COLLECTION, THIS.mongoClient.getRecordCollection());
            });
            socket.on(socketCodes.RECORD_WISHLIST, function() {
                log.debug("Received frontend socket request to send record wishlist");
                socket.emit(socketCodes.RECORD_WISHLIST, THIS.mongoClient.getRecordWishlist());
            });
            
            // Board Games
            socket.on(socketCodes.INITIAL_BOARD_GAME_COLLECTION_IN_PROGRESS, function() {
                log.debug("Received frontend socket request to send initialBoardGameFetchInProgress=" + THIS.initialBoardGameFetchInProgress + " to client");
                socket.emit(socketCodes.INITIAL_BOARD_GAME_COLLECTION_IN_PROGRESS, THIS.initialBoardGameFetchInProgress);
            });
            socket.on(socketCodes.BOARD_GAME_COLLECTION, function() {
                log.debug("Received frontend socket request to send board game collection");
                socket.emit(socketCodes.BOARD_GAME_COLLECTION, THIS.mongoClient.getBoardGameCollection());
            });
            socket.on(socketCodes.BOARD_GAME_WISHLIST, function() {
                log.debug("Received frontend socket request to send board game wishlist");
                socket.emit(socketCodes.BOARD_GAME_WISHLIST, THIS.mongoClient.getBoardGameWishlist());
            });
            
            // Books
            socket.on(socketCodes.INITIAL_BOOK_COLLECTION_IN_PROGRESS, function() {
                log.debug("Received frontend socket request to send initialBookFetchInProgress=" + THIS.initialBookFetchInProgress + " to client");
                socket.emit(socketCodes.INITIAL_BOOK_COLLECTION_IN_PROGRESS, THIS.initialBookFetchInProgress);
            });
            socket.on(socketCodes.BOOK_COLLECTION, function() {
                log.debug("Received frontend socket request to send book collection");
                socket.emit(socketCodes.BOOK_COLLECTION, THIS.mongoClient.getBookCollection());
            });
            socket.on(socketCodes.BOOK_WISHLIST, function() {
                log.debug("Received frontend socket request to send book wishlist");
                socket.emit(socketCodes.BOOK_WISHLIST, THIS.mongoClient.getBookWishlist());
            });
        });

        // Backend socket.io server for sending and receiving messages with backend components
        this.backendServer = await this.backendApp.listen(this.propertyManager.backendPort);
        log.debug("Now servering backend requests");

        this.backendIo = socketIo(this.backendServer);
        this.backendIo.sockets.on("connection", function(socket) {
            log.debug("Backend connection established with socket.io");

            // Records
            socket.on(socketCodes.INITIAL_RECORD_COLLECTION_IN_PROGRESS, function(inProgress) {
                log.info("Received backend socket notification to set initialRecordFetchInProgress=" + inProgress);
                THIS.initialRecordFetchInProgress = inProgress;
                THIS.frontendIo.emit(socketCodes.INITIAL_RECORD_COLLECTION_IN_PROGRESS, THIS.initialRecordFetchInProgress);
            });
            socket.on(socketCodes.ADDED_RECORD_TO_COLLECTION, function(newRecord) {
                log.debug("Received backend socket notification that a new record has been added to the collection, title=" + newRecord.title + ", id=" + newRecord._id);
                THIS.frontendIo.emit(socketCodes.ADDED_RECORD_TO_COLLECTION, newRecord);
            });
            socket.on(socketCodes.ADDED_RECORD_TO_WISHLIST, function(newRecord) {
                log.debug("Received backend socket notification that a new record has been added to the wishlist, title=" + newRecord.title + ", id=" + newRecord._id);
                THIS.frontendIo.emit(socketCodes.ADDED_RECORD_TO_WISHLIST, newRecord);
            });
            socket.on(socketCodes.REMOVED_RECORD_FROM_COLLECTION, function(deletedRecord) {
                log.debug("Received backend socket notification that a record has been removed from the collection, title=" + deletedRecord.title + ", id=" + deletedRecord._id);
                THIS.frontendIo.emit(socketCodes.REMOVED_RECORD_FROM_COLLECTION, deletedRecord);
            });
            socket.on(socketCodes.REMOVED_RECORD_FROM_WISHLIST, function(deletedRecord) {
                log.debug("Received backend socket notification that a record has been removed from the wishlist, title=" + deletedRecord.title + ", id=" + deletedRecord._id);
                THIS.frontendIo.emit(socketCodes.REMOVED_RECORD_FROM_WISHLIST, deletedRecord);
            });
            socket.on(socketCodes.UPDATED_RECORD_IN_COLLECTION, function(updatedRecord) {
                log.debug("Received backend socket notification that a record has been updated, title=" + updatedRecord.title + ", id=" + updatedRecord._id);
                THIS.frontendIo.emit(socketCodes.UPDATED_RECORD_IN_COLLECTION, updatedRecord);
            });
            socket.on(socketCodes.UPDATED_RECORD_IN_WISHLIST, function(updatedRecord) {
                log.debug("Received backend socket notification that a record has been updated, title=" + updatedRecord.title + ", id=" + updatedRecord._id);
                THIS.frontendIo.emit(socketCodes.UPDATED_RECORD_IN_WISHLIST, updatedRecord);
            });

            // Board Games
            socket.on(socketCodes.INITIAL_BOARD_GAME_COLLECTION_IN_PROGRESS, function(inProgress) {
                log.info("Received backend socket notification to set initialBoardGameFetchInProgress=" + inProgress);
                THIS.initialBoardGameFetchInProgress = inProgress;
                THIS.frontendIo.emit(socketCodes.INITIAL_BOARD_GAME_COLLECTION_IN_PROGRESS, THIS.initialBoardGameFetchInProgress);
            });
            socket.on(socketCodes.ADDED_BOARD_GAME_TO_COLLECTION, function(newBoardGame) {
                log.debug("Received backend socket notification that a new board game has been added to the collection, title=" + newBoardGame.title + ", id=" + newBoardGame._id);
                THIS.frontendIo.emit(socketCodes.ADDED_BOARD_GAME_TO_COLLECTION, newBoardGame);
            });
            socket.on(socketCodes.ADDED_BOARD_GAME_TO_WISHLIST, function(newBoardGame) {
                log.debug("Received backend socket notification that a new board game has been added to the wishlist, title=" + newBoardGame.title + ", id=" + newBoardGame._id);
                THIS.frontendIo.emit(socketCodes.ADDED_BOARD_GAME_TO_WISHLIST, newBoardGame);
            });
            socket.on(socketCodes.REMOVED_BOARD_GAME_FROM_COLLECTION, function(deletedBoardGame) {
                log.debug("Received backend socket notification that a board game has been removed from the collection, title=" + deletedBoardGame.title + ", id=" + deletedBoardGame._id);
                THIS.frontendIo.emit(socketCodes.REMOVED_BOARD_GAME_FROM_COLLECTION, deletedBoardGame);
            });
            socket.on(socketCodes.REMOVED_BOARD_GAME_FROM_WISHLIST, function(deletedBoardGame) {
                log.debug("Received backend socket notification that a board game has been removed from the wishlist, title=" + deletedBoardGame.title + ", id=" + deletedBoardGame._id);
                THIS.frontendIo.emit(socketCodes.REMOVED_BOARD_GAME_FROM_WISHLIST, deletedBoardGame);
            });
            socket.on(socketCodes.UPDATED_BOARD_GAME_IN_COLLECTION, function(updatedBoardGame) {
                log.debug("Received backend socket notification that a board game has been updated, title=" + updatedBoardGame.title + ", id=" + updatedBoardGame._id);
                THIS.frontendIo.emit(socketCodes.UPDATED_BOARD_GAME_IN_COLLECTION, updatedBoardGame);
            });
            socket.on(socketCodes.UPDATED_BOARD_GAME_IN_WISHLIST, function(updatedBoardGame) {
                log.debug("Received backend socket notification that a board game has been updated, title=" + updatedBoardGame.title + ", id=" + updatedBoardGame._id);
                THIS.frontendIo.emit(socketCodes.UPDATED_BOARD_GAME_IN_WISHLIST, updatedBoardGame);
            });

            // Books
            socket.on(socketCodes.GOODREADS_OAUTH_GRANTED, function(oauthGranted) {
                if (oauthGranted) {
                    log.info("Received backend socket notification that Goodreads oauth is granted! Will soon start book collector...");
                } else {
                    log.info("Received backend socket notification that Goodreads oauth is revolked, will not be able to collect books");
                }
                THIS.goodreadsOauthGranted = oauthGranted;
            });
            socket.on(socketCodes.INITIAL_BOOK_COLLECTION_IN_PROGRESS, function(inProgress) {
                log.info("Received backend socket notification to set initialBookFetchInProgress=" + inProgress);
                THIS.initialBookFetchInProgress = inProgress;
                THIS.frontendIo.emit(socketCodes.INITIAL_BOOK_COLLECTION_IN_PROGRESS, THIS.initialBookFetchInProgress);
            });
            socket.on(socketCodes.ADDED_BOOK_TO_COLLECTION, function(newBook) {
                log.debug("Received backend socket notification that a new book has been added to the collection, title=" + newBook.title + ", id=" + newBook._id);
                THIS.frontendIo.emit(socketCodes.ADDED_BOOK_TO_COLLECTION, newBook);
            });
            socket.on(socketCodes.ADDED_BOOK_TO_WISHLIST, function(newBook) {
                log.debug("Received backend socket notification that a new book has been added to the wishlist, title=" + newBook.title + ", id=" + newBook._id);
                THIS.frontendIo.emit(socketCodes.ADDED_BOOK_TO_WISHLIST, newBook);
            });
            socket.on(socketCodes.REMOVED_BOOK_FROM_COLLECTION, function(deletedBook) {
                log.debug("Received backend socket notification that a book has been removed from the collection, title=" + deletedBook.title + ", id=" + deletedBook._id);
                THIS.frontendIo.emit(socketCodes.REMOVED_BOOK_FROM_COLLECTION, deletedBook);
            });
            socket.on(socketCodes.REMOVED_BOOK_FROM_WISHLIST, function(deletedBook) {
                log.debug("Received backend socket notification that a book has been removed from the wishlist, title=" + deletedBook.title + ", id=" + deletedBook._id);
                THIS.frontendIo.emit(socketCodes.REMOVED_BOOK_FROM_WISHLIST, deletedBook);
            });
            socket.on(socketCodes.UPDATED_BOOK_IN_COLLECTION, function(updatedBook) {
                log.debug("Received backend socket notification that a book has been updated, title=" + updatedBook.title + ", id=" + updatedBook._id);
                THIS.frontendIo.emit(socketCodes.UPDATED_BOOK_IN_COLLECTION, updatedBook);
            });
            socket.on(socketCodes.UPDATED_BOOK_IN_WISHLIST, function(updatedBook) {
                log.debug("Received backend socket notification that a book has been updated, title=" + updatedBook.title + ", id=" + updatedBook._id);
                THIS.frontendIo.emit(socketCodes.UPDATED_BOOK_IN_WISHLIST, updatedBook);
            });

            // Admin
            socket.on(socketCodes.CLEAR_CACHE, function() {
                log.info("[ADMIN] Received backend request to clear cache");
                THIS.mongoClient.refreshCache();
            })
        });
    }

    stop() {
        log.info("Stopping...");
        this.isStopping = true;
        this.frontendIo.close();
        this.frontendServer.close();
        this.backendIo.close();
        this.backendServer.close();
        clearInterval(this.refreshIntervalId);
        log.info("Stopped");
    }

    getFrontendExpressApp() {
        return this.frontendApp;
    }

}

module.exports = Server;