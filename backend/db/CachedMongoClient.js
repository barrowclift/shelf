"use strict";

// DEPENDENCIES
// ------------
// External
let sharp = require("sharp");

// Local
let Logger = require("../common/Logger");
let MongoClient = require("./MongoClient");
let paths = require("../common/paths");


// CONSTANTS
// ---------
const CLASS_NAME = "CachedMongoClient";
const DEFAULT_RECORDS_COLLECTION_NAME = "records";
const DEFAULT_BOARD_GAMES_COLLECTION_NAME = "boardGames";
const DEFAULT_BOOKS_COLLECTION_NAME = "books";


// GLOBALS
// -------
let log = new Logger(CLASS_NAME);


/**
 * This should be the primary interface to MongoDB in Shelf.
 *
 * An in-memory cache wrapper that sits on top of Shelf's MongoClient. This is
 * so any given vistor hitting a page won't directly be hitting MongoDB.
 * Instead, they'll read from the in-memory cache here.
 *
 * Additionally, this wrapper provides a lot of "quality of life" improvements
 * by taking the low-level APIs of MongoClient and making them nicer to use
 * (for example, instead of `upsertOne("records", document)`, you can call
 * `upsertRecord(document)`).
 */
class CachedMongoClient {

    /**
     * @param {PropertyManager} propertyManager
     */
    constructor(propertyManager) {
        this.propertyManager = propertyManager;
        this.mongoClient = new MongoClient(propertyManager);

        this.recordCollectionCache = new Map();
        this.recordWishlistCache = new Map();

        this.boardGameCollectionCache = new Map();
        this.boardGameWishlistCache = new Map();

        this.bookCollectionCache = new Map();
        this.bookWishlistCache = new Map();

        log.debug("Initialized");
    }

    /**
     * ==============
     * PUBLIC METHODS
     * ==============
     */

    async connect() {
        await this.mongoClient.connect();
        await this.refreshCache();
    }

    close() {
        return this.mongoClient.close();
    }

    getBookCollection() {
        if (this.bookCollectionCache) {
            return Array.from(this.bookCollectionCache.values());
        } else {
            return [];
        }
    }

    getBookCollectionIds() {
        if (this.bookCollectionCache) {
            return Array.from(this.bookCollectionCache.keys());
        } else {
            return[];
        }
    }

    getBookCollectionMap() {
        return this.bookCollectionCache;
    }

    getBookWishlist() {
        if (this.bookWishlistCache) {
            return Array.from(this.bookWishlistCache.values());
        } else {
            return[];
        }
    }

    getBookWishlistIds() {
        if (this.bookWishlistCache) {
            return Array.from(this.bookWishlistCache.keys());
        } else {
            return [];
        }
    }

    getBookWishlistMap() {
        return this.bookWishlistCache;
    }

    getCollectionBookById(bookId) {
        let book = null;
        if (this.bookCollectionCache.has(bookId)) {
            book = this.bookCollectionCache.get(bookId);
        }
        return book;
    }

    getWishlistBookById(bookId) {
        let book = null;
        if (this.bookWishlistCache.has(bookId)) {
            book = this.bookWishlistCache.get(bookId);
        }
        return book;
    }

    getBookById(bookId) {
        let book = null;
        if (this.bookCollectionCache.has(bookId)) {
            book = this.bookCollectionCache.get(bookId);
        } else if (this.bookWishlistCache.has(bookId)) {
            book = this.bookWishlistCache.get(bookId);
        }
        return book;
    }

    removeCollectionBookById(bookId) {
        this.bookCollectionCache.delete(bookId);
        return this.mongoClient.deleteById(this.propertyManager.booksCollectionName, bookId);
    }

    removeWishlistBookById(bookId) {
        this.bookCollectionCache.delete(bookId);
        return this.mongoClient.deleteById(this.propertyManager.booksCollectionName, bookId);
    }

    findBooks(query) {
        return this.mongoClient.find(this.propertyManager.booksCollectionName, query);
    }

    findBook(query) {
        return this.mongoClient.findOne(this.propertyManager.booksCollectionName, query);
    }

    async upsertBook(upsertedBook) {
        await this.mongoClient.upsertOne(this.propertyManager.booksCollectionName, upsertedBook);

        /**
         * If the board game already exists in the cache, update it.
         */
        if (this.bookWishlistCache.has(upsertedBook._id)) {
            this.bookWishlistCache.set(upsertedBook._id, upsertedBook);
        } else if (this.bookCollectionCache.has(upsertedBook._id)) {
            this.bookCollectionCache.set(upsertedBook._id, upsertedBook);
        } else {
            if (upsertedBook.inWishlist) {
                this.bookWishlistCache.set(upsertedBook._id, upsertedBook);
            } else {
                this.bookCollectionCache.set(upsertedBook._id, upsertedBook);
            }
        }
    }

    dropBooks() {
        return this.mongoClient.dropCollection(this.propertyManager.booksCollectionName);
    }

    getBoardGameCollection() {
        if (this.boardGameCollectionCache) {
            return Array.from(this.boardGameCollectionCache.values());
        } else {
            return [];
        }
    }

    getBoardGameCollectionIds() {
        if (this.boardGameCollectionCache) {
            return Array.from(this.boardGameCollectionCache.keys());
        } else {
            return[];
        }
    }

    getBoardGameCollectionMap() {
        return this.boardGameCollectionCache;
    }

    getBoardGameWishlist() {
        if (this.boardGameWishlistCache) {
            return Array.from(this.boardGameWishlistCache.values());
        } else {
            return[];
        }
    }

    getBoardGameWishlistIds() {
        if (this.boardGameWishlistCache) {
            return Array.from(this.boardGameWishlistCache.keys());
        } else {
            return [];
        }
    }

    getBoardGameWishlistMap() {
        return this.boardGameWishlistCache;
    }

    getCollectionBoardGameById(boardGameId) {
        let boardGame = null;
        if (this.boardGameCollectionCache.has(boardGameId)) {
            boardGame = this.boardGameCollectionCache.get(boardGameId);
        }
        return boardGame;
    }

    getWishlistBoardGameById(boardGameId) {
        let boardGame = null;
        if (this.boardGameWishlistCache.has(boardGameId)) {
            boardGame = this.boardGameWishlistCache.get(boardGameId);
        }
        return boardGame;
    }

    getBoardGameById(boardGameId) {
        let boardGame = null;
        if (this.boardGameCollectionCache.has(boardGameId)) {
            boardGame = this.boardGameCollectionCache.get(boardGameId);
        } else if (this.boardGameWishlistCache.has(boardGameId)) {
            boardGame = this.boardGameWishlistCache.get(boardGameId);
        }
        return boardGame;
    }

    removeCollectionBoardGameById(boardGameId) {
        this.boardGameCollectionCache.delete(boardGameId);
        return this.mongoClient.deleteById(this.propertyManager.boardGamesCollectionName, boardGameId);
    }

    removeWishlistBoardGameById(boardGameId) {
        this.boardGameCollectionCache.delete(boardGameId);
        return this.mongoClient.deleteById(this.propertyManager.boardGamesCollectionName, boardGameId);
    }

    findBoardGames(query) {
        return this.mongoClient.find(this.propertyManager.boardGamesCollectionName, query);
    }

    findBoardGame(query) {
        return this.mongoClient.findOne(this.propertyManager.boardGamesCollectionName, query);
    }

    async upsertBoardGame(upsertedBoardGame) {
        await this.mongoClient.upsertOne(this.propertyManager.boardGamesCollectionName, upsertedBoardGame);

        /**
         * If the board game already exists in the cache, update it.
         */
        if (this.boardGameWishlistCache.has(upsertedBoardGame._id)) {
            this.boardGameWishlistCache.set(upsertedBoardGame._id, upsertedBoardGame);
        } else if (this.boardGameCollectionCache.has(upsertedBoardGame._id)) {
            this.boardGameCollectionCache.set(upsertedBoardGame._id, upsertedBoardGame);
        } else {
            if (upsertedBoardGame.inWishlist) {
                this.boardGameWishlistCache.set(upsertedBoardGame._id, upsertedBoardGame);
            } else {
                this.boardGameCollectionCache.set(upsertedBoardGame._id, upsertedBoardGame);
            }
        }
    }

    dropBoardGames() {
        return this.mongoClient.dropCollection(this.propertyManager.boardGamesCollectionName);
    }

    getRecordCollection() {
        if (this.recordCollectionCache) {
            return Array.from(this.recordCollectionCache.values());
        } else {
            return [];
        }
    }

    getRecordCollectionIds() {
        if (this.recordCollectionCache) {
            return Array.from(this.recordCollectionCache.keys());
        } else {
            return [];
        }
    }

    getRecordCollectionMap() {
        return this.recordCollectionCache;
    }

    getRecordWishlist() {
        if (this.recordWishlistCache) {
            return Array.from(this.recordWishlistCache.values());
        } else {
            return [];
        }
    }

    getRecordWishlistIds() {
        if (this.recordWishlistCache) {
            return Array.from(this.recordWishlistCache.keys());
        } else {
            return [];
        }
    }

    getRecordWishlistMap() {
        return this.recordWishlistCache;
    }

    getCollectionRecordById(recordId) {
        let record = null;
        if (this.recordCollectionCache.has(recordId)) {
            record = this.recordCollectionCache.get(recordId);
        }
        return record;
    }

    getWishlistRecordById(recordId) {
        let record = null;
        if (this.recordWishlistCache.has(recordId)) {
            record = this.recordWishlistCache.get(recordId);
        }
        return record;
    }

    getRecordById(recordId) {
        let record = null;
        if (this.recordCollectionCache.has(recordId)) {
            record = this.recordCollectionCache.get(recordId);
        } else if (this.recordWishlistCache.has(recordId)) {
            record = this.recordWishlistCache.get(recordId);
        }
        return record;
    }

    removeCollectionRecordById(recordId) {
        this.recordCollectionCache.delete(recordId);
        return this.mongoClient.deleteById(this.propertyManager.recordsCollectionName, recordId);
    }

    removeWishlistRecordById(recordId) {
        this.recordWishlistCache.delete(recordId);
        return this.mongoClient.deleteById(this.propertyManager.recordsCollectionName, recordId);
    }

    findRecords(query) {
        return this.mongoClient.find(this.propertyManager.recordsCollectionName, query);
    }

    findRecord(query) {
        return this.mongoClient.findOne(this.propertyManager.recordsCollectionName, query);
    }

    async upsertRecord(upsertedRecord) {
        await this.mongoClient.upsertOne(this.propertyManager.recordsCollectionName, upsertedRecord);

        /**
         * If the record already exists in the cache, update it.
         */
        if (this.recordWishlistCache.has(upsertedRecord._id)) {
            this.recordWishlistCache.set(upsertedRecord._id, upsertedRecord);
        } else if (this.recordCollectionCache.has(upsertedRecord._id)) {
            this.recordCollectionCache.set(upsertedRecord._id, upsertedRecord);
        } else {
            if (upsertedRecord.inWishlist) {
                this.recordWishlistCache.set(upsertedRecord._id, upsertedRecord);
            } else {
                this.recordCollectionCache.set(upsertedRecord._id, upsertedRecord);
            }
        }
    }

    dropRecords() {
        return this.mongoClient.dropCollection(this.propertyManager.recordsCollectionName);
    }

    async refreshCache() {
        this.recordCollectionCache.clear();
        this.recordWishlistCache.clear();

        this.boardGameCollectionCache.clear();
        this.boardGameWishlistCache.clear();

        this.bookCollectionCache.clear();
        this.bookWishlistCache.clear();

        let recordsCache = await this.mongoClient.find(this.propertyManager.recordsCollectionName, {});
        if (recordsCache) {
            for (let record of recordsCache) {
                if (record.inWishlist) {
                    this.recordWishlistCache.set(record._id, record);
                } else {
                    this.recordCollectionCache.set(record._id, record);
                }
            }
        }
        let boardGamesCache = await this.mongoClient.find(this.propertyManager.boardGamesCollectionName, {});
        if (boardGamesCache) {
            for (let boardGame of boardGamesCache) {
                if (this.propertyManager.experimentalBoardGameBoxRendering && !("primaryColor" in boardGame)) {
                    try {
                        const image = sharp(`${paths.FRONTEND_STATIC_DIRECTORY_PATH}${boardGame.coverArtFilePath}`);
                        const stats = await image.stats();
                        const primaryColor = stats.dominant;

                        const metadata = await image.metadata();
                        const ratio = metadata.width / metadata.height;
                        
                        if (boardGame.primaryColor !== primaryColor || boardGame.ratio !== ratio) {
                            boardGame.primaryColor = primaryColor;
                            boardGame.ratio = ratio;
                            try {
                                await this.upsertBoardGame(boardGame);
                            } catch (error) {
                                log.error("MongoClient.upsertBoardGame", error);
                            }
                        }
                    } catch (error) {
                        log.error("sharp.stats", error);
                    }
                }

                if (boardGame.inWishlist) {
                    this.boardGameWishlistCache.set(boardGame._id, boardGame);
                } else {
                    this.boardGameCollectionCache.set(boardGame._id, boardGame);
                }
            }
        }
        let booksCache = await this.mongoClient.find(this.propertyManager.booksCollectionName, {});
        if (booksCache) {
            for (let book of booksCache) {
                if (book.inWishlist) {
                    this.bookWishlistCache.set(book._id, book);
                } else {
                    this.bookCollectionCache.set(book._id, book);
                }
            }
        }
    }

}

module.exports = CachedMongoClient;