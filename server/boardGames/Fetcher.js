"use strict";

// DEPENDENCIES
// ------------
// External
let BoardGameGeek = require("bgg"); // "bgg" is the BoardGameGeek API 2 Library
let htmlEntityCoder = require("he");
let path = require("path");
let socketIo = require("socket.io-client");
// Local
let BoardGameBuilder = require("./Builder");
let boardGameUtil = require("./util");
let Logger = require("../common/Logger");
let overrides = require("../resources/overrides");
let paths = require("../common/paths");
let socketCodes = require("../common/socketCodes");
let util = require("../common/util");


// CONSTANTS
// ---------
const CLASS_NAME = "boardGames.Fetcher";

const MAX_NUMBER_OF_AWAITING_ACCESS_CHECKS = 5;
const BOARD_GAME_GEEK_AWAITING_ACCESS_WAIT_TIME_IN_SECONDS = 3;

const SERVER_BOARD_GAME_COVER_ART_DIRECTORY_PATH = "/images/board-games/";
const BOARD_GAME_COVER_ART_FILE_NAME = "board-game-cover-art.jpg";


// GLOBALS
// -------
let log = new Logger(CLASS_NAME);


/**
 * Shelf's Board Game Fetcher, build for and powered by BoardGameGeek.
 *
 * Used to fetch board games from boardgamegeek.com, transform to suit Shelf's
 * needs, and keep the Shelf's local cache in sync with any changes.
 */
class Fetcher {

    /**
     * Initializes the fetcher, but does not automatically kick off the
     * fetches. To do so, start() must be called.
     *
     * @param {ShelfProperties} shelfProperties
     * @param {CachedMongoClient} mongoClient
     */
    constructor(shelfProperties, mongoClient) {
        this.shelfProperties = shelfProperties;
        this.mongoClient = mongoClient;

        this.isStopping = false;
        this.currentlyFetching = false;
        this.refreshIntervalId = null;

        // BoardGameGeek setup
        this.userAgent = shelfProperties.boardGameGeekUserId + " " + shelfProperties.userAgentBase;
        this.boardGameGeekClient = BoardGameGeek();

        // Connect to server for sending change callbacks
        this.socket = socketIo.connect(shelfProperties.privateUrl, { reconnect:true });
        this.socket.on("connect", function() {
            log.info("Socket connection to server initialized");
        });

        log.debug("Initialized");
    }

    /**
     * ==============
     * PUBLIC METHODS
     * ==============
     */

    async start() {
        log.info("Starting...");

        const THIS = this; // For referencing root-instance "this" in promise context

        // Initial startup (always run fetch as soon as possible on start() call!)
        await this._fetch();
        // For initial startup ONLY, notify the client server when the fetch has completed
        if (this.socket) {
            this.socket.emit(socketCodes.INITIAL_BOARD_GAME_COLLECTION_IN_PROGRESS, false);
        }

        this.refreshIntervalId = setInterval(async function() {
            if (THIS.isStopping) {
                log.info("Preventing sync, shutting down");
            } else if (THIS.currentlyFetching) {
                log.info("Skipping refresh, still processing previous one");
            } else {
                await THIS._fetch();
            }
        }, this.shelfProperties.refreshFrequencyInMillis);
    }

    stop() {
        log.info("Stopping...");
        this.isStopping = true;
        clearInterval(this.refreshIntervalId);
        log.info("Stopped");
    }

    /**
     * ===============
     * PRIVATE METHODS
     * ===============
     */

    /**
     * Fetches all BoardGameGeek collection and wishlist board games, and
     * updates or deletes any existing ones in Shelf.
     */
    async _fetch() {
        this.currentlyFetching = true;

        log.debug("Fetching board games in collection...");
        try {
            await this._processBoardGameCollection();
        } catch (error) {
            log.error("_processBoardGameCollection", error);
        }

        log.debug("Fetching board games in wishlist...");
        try {
            await this._processBoardGameWishlist();
        } catch (error) {
            log.error("_processBoardGameWishlist", error);
        }

        this.currentlyFetching = false;
        log.debug("Completed fetching board games");
    }

    /**
     * Fetches the BoardGameGeek collection and processes all board games in
     * their response. At time of writing, BoardGameGeek does not paginate the
     * response.
     */
    async _processBoardGameCollection() {
        // 1. Make a note of all board game IDs in the board game collection prior so we can know if any were removed
        let previouslyFoundBoardGameIds = [];
        for (let boardGameId of this.mongoClient.getBoardGameCollectionIds()) {
            previouslyFoundBoardGameIds.push(boardGameId);
        }
        let currentBoardGameIds = new Set();

        // 2. Refetch all board games in collection (adding & updating)
        let context = {
            knownCount: 0,
            newCount: 0,
            updatedCount: 0,
            awaitingAccessCount: 0,
            isWishlist: false
        };
        do {
            let results = await this._getBoardGameCollection();
            if ("errors" in results) {
                log.error("processBoardGameCollection", results.errors.error.message);
            } else if ("message" in results && results["message"].includes("Please try again later for access")) {
                // If we receive a "message" field back, we need to wait briefly and try again
                log.debug("BoardGameGeek is processing the request, checking for completion in a few seconds...");
                context.awaitingAccessCount++;
                await util.sleepForSeconds(BOARD_GAME_GEEK_AWAITING_ACCESS_WAIT_TIME_IN_SECONDS);
            } else if (results.items.totalitems > 0) {
                context.awaitingAccessCount = 0;
                let boardGames = results.items.item;
                if (Array.isArray(boardGames)) {
                    for (let boardGame of boardGames) {
                        /**
                         * We're not filtering by the "boardgame" subtype in the client query because
                         * that apparently strips out the stats node (which contains the "rating" field,
                         * which we need). So, we'll perform the filtering manually here.
                         */
                        if (boardGame.subtype != "boardgame") {
                            continue;
                        }
                        /**
                         * Same thing: If we filtered by specific collection types in the client query,
                         * the rating field gets dropped. So, we need to filter manually here.
                         */
                        if (boardGame.status.own == 0) {
                            continue;
                        }

                        currentBoardGameIds.add("boardgame" + boardGame.objectid);
                        if (!this.isStopping) {
                            try {
                                await this._processBggBoardGame(boardGame, context);
                            } catch (error) {
                                log.error("_processBggBoardGame", error);
                            }
                        }
                    }
                } else {
                    if (boardGames.subtype == "boardgame"
                     && boardGames.status.own > 0) {
                        currentBoardGameIds.add("boardgame" + boardGames.objectid);
                        if (!this.isStopping) {
                            try {
                                await this._processBggBoardGame(boardGames, context);
                            } catch (error) {
                                log.error("_processBggBoardGame", error);
                            }
                        }
                    }
                }

                /**
                 * No "pages" for BGG's API. Once we have the initial
                 * request's response and processed it, we're done.
                 */
                break;
            }
        } while(context.awaitingAccessCount < MAX_NUMBER_OF_AWAITING_ACCESS_CHECKS);

        if (context.awaitingAccessCount >= MAX_NUMBER_OF_AWAITING_ACCESS_CHECKS) {
            log.warn("BoardGameGeek still doesn't have the request response ready, will check again next fetch time");
        } else {
            if (util.pageContextReportsChanges(context)) {
                log.info("Change detected, fetch stats:");
                log.info(context);
            } else {
                log.debug("No changes");
            }

            // 3. Remove any board games that vanished from collection in this reprocess
            for (let previouslyFoundBoardGameId of previouslyFoundBoardGameIds) {
                if (!currentBoardGameIds.has(previouslyFoundBoardGameId)) {
                    let boardGameToDelete = this.mongoClient.getCollectionBoardGameById(previouslyFoundBoardGameId);
                    if (boardGameToDelete) {
                        log.info("Removing board game from collection, title=" + boardGameToDelete.title + ", id=" + boardGameToDelete._id);

                        // 1. Delete the board game from MongoDB
                        try {
                            await this.mongoClient.removeCollectionBoardGameById(previouslyFoundBoardGameId);
                        } catch (error) {
                            log.error("MongoClient.removeCollectionBoardGameById", error);
                        }

                        // 2. Notify the client of the deleted board game
                        if (this.socket) {
                            this.socket.emit(socketCodes.REMOVED_BOARD_GAME_FROM_COLLECTION, boardGameToDelete);
                        }
                    }
                }
            }
        }
    }

    async _getBoardGameCollection() {
        const THIS = this; // for referencing root-instance "this" in promise context
        log.debug("Fetching BoardGameGeek collection");

        let query = {
            "username": this.shelfProperties.boardGameGeekUserId,
            "stats": 1
        };

        let data = null;
        try {
            data = await this.boardGameGeekClient("collection", query);
            log.debug("Got board games from BoardGameGeek collection");
        } catch (error) {
            log.error("boardGameGeekClient(\"collection\", query)", error);
        }
        return data;
    }

    /**
     * Fetches the BoardGameGeek wishlist and processes all board games in
     * their response. At time of writing, BoardGameGeek does not paginate the
     * response.
     */
    async _processBoardGameWishlist() {
        // 1. Make a note of all board game IDs in the board game wishlist prior so we can know if any were removed
        let previouslyFoundBoardGameIds = [];
        for (let boardGameId of this.mongoClient.getBoardGameWishlistIds()) {
            previouslyFoundBoardGameIds.push(boardGameId);
        }
        let currentBoardGameIds = new Set();

        // 2. Refetch all board games in wishlist (adding & updating)
        let context = {
            knownCount: 0,
            newCount: 0,
            updatedCount: 0,
            awaitingAccessCount: 0,
            isWishlist: true
        };
        do {
            let results = await this._getBoardGameWishlist();
            if ("errors" in results) {
                log.error("_processBoardGameWishlist", results.errors.error.message);
            } else if ("message" in results && results["message"].includes("Please try again later for access")) {
                // If we receive a "message" field back, we need to wait briefly and try again
                log.debug("BoardGameGeek is processing the request, checking for completion in a few seconds...");
                context.awaitingAccessCount++;
                await util.sleepForSeconds(BOARD_GAME_GEEK_AWAITING_ACCESS_WAIT_TIME_IN_SECONDS);
            } else if (results.items.totalitems > 0) {
                context.awaitingAccessCount = 0;
                let boardGames = results.items.item;
                if (Array.isArray(boardGames)) {
                    for (let boardGame of boardGames) {
                        /**
                         * We're not filtering by the "boardgame" subtype in the client query because
                         * that apparently strips out the stats node (which contains the "rating" field,
                         * which we need). So, we'll perform the filtering manually here.
                         */
                        if (boardGame.subtype != "boardgame") {
                            continue;
                        }
                        /**
                         * Same thing: If we filtered by specific collection types in the client query,
                         * the rating field gets dropped. So, we need to filter manually here.
                         */
                        if (boardGame.status.own > 0) {
                            continue;
                        }

                        currentBoardGameIds.add("boardgame" + boardGame.objectid);
                        if (!this.isStopping) {
                            await this._processBggBoardGame(boardGame, context);
                        }
                    }
                } else {
                    if (boardGames.subtype == "boardgame"
                     && boardGames.status.own == 0) {
                        currentBoardGameIds.add("boardgame" + boardGames.objectid);
                        if (!this.isStopping) {
                            await this._processBggBoardGame(boardGames, context);
                        }
                    }
                }

                /**
                 * No "pages" for BGG's API. Once we have the initial
                 * request's response and processed it, we're done.
                 */
                break;
            }
        } while(context.awaitingAccessCount < MAX_NUMBER_OF_AWAITING_ACCESS_CHECKS);

        if (context.awaitingAccessCount >= MAX_NUMBER_OF_AWAITING_ACCESS_CHECKS) {
            log.warn("BoardGameGeek still doesn't have the request response ready, will check again next recollection");
        } else {
            if (util.pageContextReportsChanges(context)) {
                log.info("Change detected, fetch stats:");
                log.info(context);
            } else {
                log.debug("No changes");
            }

            // 3. Remove any board games that vanished from wishlist in this reprocess
            for (let previouslyFoundBoardGameId of previouslyFoundBoardGameIds) {
                if (!currentBoardGameIds.has(previouslyFoundBoardGameId)) {
                    let boardGameToDelete = this.mongoClient.getWishlistBoardGameById(previouslyFoundBoardGameId);
                    if (boardGameToDelete) {
                        log.info("Removing board game from wishlist, title=" + boardGameToDelete.title + ", id=" + boardGameToDelete._id);

                        // 1. Delete the board game from MongoDB
                        try {
                            await this.mongoClient.removeWishlistBoardGameById(previouslyFoundBoardGameId);
                        } catch (error) {
                            log.error("MongoClient.removeWishlistBoardGameById", error);
                        }

                        // 2. Notify the client of the deleted board game
                        if (this.socket) {
                            this.socket.emit(socketCodes.REMOVED_BOARD_GAME_FROM_WISHLIST, boardGameToDelete);
                        }
                    }
                }
            }
        }
    }

    async _getBoardGameWishlist() {
        const THIS = this; // for referencing root-instance "this" in promise context
        log.debug("Fetching BoardGameGeek wishlist");

        let query = {
            "username": this.shelfProperties.boardGameGeekUserId,
            "subtype": "boardgame",
            "wishlist": 1,
            "stats": 1
        };

        let data = null;
        try {
            data = await this.boardGameGeekClient("collection", query);
            log.debug("Got board games from BoardGameGeek wishlist");
        } catch (error) {
            log.error("boardGameGeekClient(\"collection\", query)", error);
        }
        return data;
    }

    /**
     * Unlike fetching the items themselves, the board games are mostly
     * generic and both wishlist and collection board games can be processed
     * the same (with some minor edge cases)
     */
    async _processBggBoardGame(bggBoardGame, context) {
        const THIS = this; // for referencing root-instance "this" in promise context
        log.debug("Processing BoardGameGeek board game...");

        /**
         * BUILDING BOARD GAME
         * -------------------
         */
        let boardGameBuilder = new BoardGameBuilder();

        // Required & expected fields
        boardGameBuilder.setId(bggBoardGame.objectid);
        boardGameBuilder.setCoverArtUrl(bggBoardGame.image);
        let decodedTitle = htmlEntityCoder.decode(bggBoardGame.name["$t"]);
        boardGameBuilder.setTitle(decodedTitle);
        boardGameBuilder.setYearPublished(bggBoardGame.yearpublished);

        if ("stats" in bggBoardGame
         && "rating" in bggBoardGame.stats
         && "value" in bggBoardGame.stats.rating) {
            boardGameBuilder.setRating(bggBoardGame.stats.rating.value);
        }

        // Custom fields
        boardGameBuilder.setInWishlist(context.isWishlist);

        let boardGame = boardGameBuilder.build();

        // Searching to see if we've already processed this board game before
        const QUERY = {
            _id: boardGame._id
        };
        let existingBoardGame = await THIS.mongoClient.findBoardGame(QUERY);
        if (existingBoardGame) {
            let changesDetected = boardGameUtil.changesDetected(boardGame, existingBoardGame);
            if (changesDetected) {
                context.updatedCount++;
                log.info("Changes detected for board game, title=" + boardGame.title + ", id=" + boardGame._id);

                // Merge and save the updated board game to MongoDB
                let updatedBoardGame = boardGameUtil.merge(boardGame, existingBoardGame);
                try {
                    await THIS.mongoClient.upsertBoardGame(updatedBoardGame);
                } catch (error) {
                    log.error("MongoClient.upsertBoardGame", error);
                }

                // Notify the client of the update
                if (THIS.socket) {
                    if (boardGame.inWishlist) {
                        THIS.socket.emit(socketCodes.UPDATED_BOARD_GAME_IN_WISHLIST, boardGame);
                    } else {
                        THIS.socket.emit(socketCodes.UPDATED_BOARD_GAME_IN_COLLECTION, boardGame);
                    }
                }
            } else {
                log.debug("Board game already processed and contains no changes, skipping title=" + boardGame.title);
                context.knownCount++;
            }
        } else {
            // New board game! (or at the very least, one Shelf's not processed before)
            context.newCount++;
            log.info("Got new board game, title=" + boardGame.title + ", id=" + boardGame._id);

            /**
             * 1. Fetch the BoardGameGeek cover art
             *
             * Typically amazing quality and very reliable, good enough as the
             * sole source for game cover art.
             */
            const CUSTOM_HEADERS = {};
            const RESPECT_RATE_LIMITS_METHOD = null;
            try {
                await util.downloadImage(boardGame.covertArtUrl,
                                         THIS.userAgent,
                                         CUSTOM_HEADERS,
                                         path.join(paths.CLIENT_BOARD_GAME_CACHE_DIRECTORY_PATH, boardGame._id),
                                         BOARD_GAME_COVER_ART_FILE_NAME,
                                         THIS.shelfProperties,
                                         RESPECT_RATE_LIMITS_METHOD);
                boardGame.coverArtFilePath = path.join(SERVER_BOARD_GAME_COVER_ART_DIRECTORY_PATH, boardGame._id, BOARD_GAME_COVER_ART_FILE_NAME);
            } catch(error) {
                log.error("util.downloadImage", error);
            }

            // 2. Save the completed board game to MongoDB
            try {
                log.info("Saving board game to Mongo, title=" + boardGame.title + ", id=" + boardGame._id);
                await THIS.mongoClient.upsertBoardGame(boardGame);
            } catch(error) {
                log.error("MongoClient.upsertBoardGame", error);
            }

            // 3. Notify the client of the new board game
            if (THIS.socket) {
                if (boardGame.inWishlist) {
                    THIS.socket.emit(socketCodes.ADDED_BOARD_GAME_TO_WISHLIST, boardGame);
                } else {
                    THIS.socket.emit(socketCodes.ADDED_BOARD_GAME_TO_COLLECTION, boardGame);
                }
            }
        }
    }

}

module.exports = Fetcher;