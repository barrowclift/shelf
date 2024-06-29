"use strict";

// DEPENDENCIES
// ------------
// External
import Goodreads from "goodreads-api-node";
import path from "path";
import socketIo from "socket.io-client";
// Local
import BookBuilder from "./Builder.js";
import bookUtil from "./util.js";
import Logger from "../common/Logger.js";
import overrides from "../resources/overrides.json" with { type: "json" };
import paths from "../common/paths.js";
import socketCodes from "../common/socketCodes.js";
import util from "../common/util.js";


// CONSTANTS
// ---------
const CLASS_NAME = "books.Fetcher";

const FIRST_PAGE = 1; // Discogs pages start at 1, even for the API

// https://openlibrary.org/dev/docs/api/covers
const OPEN_LIBRARY_RATE_LIMIT = 20;
const OPEN_LIBRARY_RATE_LIMIT_REFRESH_TIME_IN_SECONDS = 60;

const OAUTH_CALLBACK_PATH = "/auth/goodreads/callback";
const CHECK_OAUTH_ACCESS_SLEEP_TIME_IN_MILLIS = util.secondsToMillis(1);

const FRONTEND_BOOK_COVER_ART_DIRECTORY_PATH = "/images/books/";
const BOOK_COVER_ART_FILE_NAME = "book-cover-art.jpg";


// GLOBALS
// -------
let log = new Logger(CLASS_NAME);
let remainingOpenLibraryCalls = OPEN_LIBRARY_RATE_LIMIT;


/**
 * Shelf's Book Fetcher, build for and powered by Goodreads.
 *
 * Used to fetch records from goodreads.com, transform to suit Shelf's needs,
 * and keep Shelf's local cache in sync with any changes.
 */
export default class Fetcher {

    /**
     * Initializes the fetcher, but does not automatically kick off the
     * fetches. To do so, start() must be called.
     *
     * @param {PropertyManager} propertyManager
     * @param {CachedMongoClient} mongoClient
     * @param {Express} frontendApp
     */
    constructor(propertyManager, mongoClient, frontendApp) {
        this.propertyManager = propertyManager;
        this.mongoClient = mongoClient;

        this.isStopping = false;
        this.currentlyFetching = false;
        this.refreshIntervalId = null;
        this.checkOauthIntervalId = null;

        // Goodreads setup
        this.userAgent = propertyManager.goodreadsUserId + " " + propertyManager.userAgentBase;
        this.goodreadsOauthGrantedAndNotYetStarted = false;
        // Initialize the Goodreads Client
        let goodreadsCredentials = {
            key: propertyManager.goodreadsKey,
            secret: propertyManager.goodreadsToken
        };
        this.goodreadsClient = Goodreads(goodreadsCredentials);
        this.goodreadsClient.initOAuth(propertyManager.publicUrl + OAUTH_CALLBACK_PATH);

        // Add in OAuth handlers to the express frontendApp
        frontendApp.get("/auth/goodreads", async (request, response) => {
            try {
                let url = await this.goodreadsClient.getRequestToken();
                response.redirect(url);
            } catch (error) {
                log.error("goodreadsClient.getRequestToken", error);
            }
        });
        frontendApp.get("/auth/goodreads/callback", async (request, response) => {
            try {
                await this.goodreadsClient.getAccessToken();
                this.backendSocket.emit(socketCodes.GOODREADS_OAUTH_GRANTED, true);
                this.goodreadsOauthGrantedAndNotYetStarted = true;
            } catch (error) {
                this.backendSocket.emit(socketCodes.GOODREADS_OAUTH_GRANTED, false);
            }
            response.redirect("/book");
        });

        // Connect to backend server for communicating changes
        this.backendSocket = socketIo.connect(propertyManager.backendUrl, { reconnect: true });
        this.backendSocket.on("connect", function() {
            log.info("Socket connection to backend server initialized");
        });

        log.debug("Initialized");
    }

    /**
     * ==============
     * PUBLIC METHODS
     * ==============
     */

    async start() {
        // this.checkOauthIntervalId = setInterval(async () => {
        //     if (this.goodreadsOauthGrantedAndNotYetStarted) {
        //         this.goodreadsOauthGrantedAndNotYetStarted = false;

        //         log.info("Starting...");

        //         // Initial startup (always run fetch as soon as possible on start() call!)
        //         await this._fetch();
        //         // For initial startup ONLY, notify the backend server when the fetch has completed
        //         if (this.backendSocket) {
        //             this.backendSocket.emit(socketCodes.INITIAL_BOOK_COLLECTION_IN_PROGRESS, false);
        //         }

        //         this.refreshIntervalId = setInterval(async () => {
        //             if (this.isStopped) {
        //                 log.info("Preventing refresh, shutting down");
        //             } else if (this.currentlyFetching) {
        //                 log.info("Skipping refresh, still processing previous one");
        //             } else {
        //                 await this._fetch();
        //             }
        //         }, this.propertyManager.refreshFrequencyInMillis);
        //     }
        // }, CHECK_OAUTH_ACCESS_SLEEP_TIME_IN_MILLIS);
    }

    stop() {
        log.info("Stopping...");
        this.isStopping = true;
        clearInterval(this.checkOauthIntervalId);
        clearInterval(this.refreshIntervalId);
        if (this.backendSocket) {
            this.backendSocket.close();
        }
        log.info("Stopped");
    }

    /**
     * ===============
     * PRIVATE METHODS
     * ===============
     */

    /**
     * Fetches all Goodreads collection and wishlist books, and updates or
     * deletes any existing ones in Shelf.
     */
    async _fetch() {
        // Resetting OpenLibrary rate limit
        remainingOpenLibraryCalls = OPEN_LIBRARY_RATE_LIMIT;
        this.currentlyFetching = true;

        log.debug("Fetching books in collection...");
        try {
            await this._processGoodreadsCollection();
        } catch (error) {
            log.error("_processGoodreadsCollection", error);
        }

        log.debug("Fetching books in wishlist");
        try {
            await this._processGoodreadsWishlist();
        } catch (error) {
            log.error("_processGoodreadsWishlist", error);
        }

        this.currentlyFetching = false;
        log.debug("Completed fetching books");
    }

    /**
     * Fetches all Goodreads collection pages and processes each of those
     * pages' books.
     */
    async _processGoodreadsCollection() {
        // 1. Make a note of all book IDs in the book collection prior so we can know if any were removed
        let previouslyFoundBookIds = [];
        for (let bookId of this.mongoClient.getBookCollectionIds()) {
            previouslyFoundBookIds.push(bookId);
        }
        let currentBookIds = new Set();

        // 2. Refetch all books in collection (adding & updating)
        try {
            let context = {
                knownCount: 0,
                newCount: 0,
                updatedCount: 0,
                totalNumberOfPages: 0, // Total number of pages is unknown at first
                currentPage: FIRST_PAGE,
                isWishlist: false
            };
            do {
                let goodreadsPage = await this._getGoodreadsCollectionPage(context.currentPage);

                /**
                 * Goodreads returns "\n" when no books are found for a particular
                 * page. As far as I'm aware, no `numpages` field is included in
                 * the ownedBooks API, so we have to just continue until they stop
                 * returning results.
                 */
                if (goodreadsPage == null
                 || goodreadsPage.owned_books == "\n") {
                    break;
                }

                if ("owned_book" in goodreadsPage.owned_books) {
                    let ownedBooks = [];

                    // Goodreads tries being "smart" and only returns an array if theres > 1 item
                    if (Array.isArray(goodreadsPage.owned_books.owned_book)
                     && goodreadsPage.owned_books.owned_book.length > 0) {
                        ownedBooks = goodreadsPage.owned_books.owned_book;
                    // We received a single object for a single, owned book
                    } else {
                        ownedBooks.push(goodreadsPage.owned_books.owned_book);
                    }

                    for (let goodreadsBook of ownedBooks) {
                        currentBookIds.add("book" + goodreadsBook.id["_"]);
                        if (!this.isStopping) {
                            try {
                                await this._processGoodreadsBook(goodreadsBook, context);
                            } catch (error) {
                                log.error("_processGoodreadsBook", error);
                            }
                        }
                    }

                    context.currentPage++;
                } else {
                    // Unexpected response (might be error). Log and break
                    break;
                }
            } while(true);

            context.currentPage--;
            if (util.pageContextReportsChanges(context)) {
                log.info("Change detected, fetch stats:");
                log.info(context);
            } else {
                log.debug("No changes");
            }

            // 3. Remove any books that vanished from collection in this reprocess
            for (let previouslyFoundBookId of previouslyFoundBookIds) {
                if (!currentBookIds.has(previouslyFoundBookId)) {
                    let bookToDelete = this.mongoClient.getCollectionBookById(previouslyFoundBookId);
                    if (bookToDelete) {
                        log.info("Removing book from collection, title=" + bookToDelete.title + ", id=" + bookToDelete._id);

                        // 1. Delete the book from MongoDB
                        try {
                            await this.mongoClient.removeCollectionBookById(previouslyFoundBookId);
                        } catch (error) {
                            log.error("MongoClient.removeCollectionBookById", error);
                        }

                        // 2. Notify the backend server of the deleted book
                        if (this.backendSocket) {
                            this.backendSocket.emit(socketCodes.REMOVED_BOOK_FROM_COLLECTION, bookToDelete);
                        }
                    }
                }
            }
        } catch (error) {
            log.error("_processGoodreadsCollection", "An unrecoverable error occured while executing this fetch cycle, will try again next fetch.");
        }
    }

    async _getGoodreadsCollectionPage(pageNumber) {
        log.debug("Fetching Goodreads collection, page=" + pageNumber);

        let data = null;
        try {
            data = await this.goodreadsClient.getOwnedBooks(this.propertyManager.goodreadsUserId, pageNumber);
            log.debug("Got books from Goodreads collection, page=" + pageNumber);
        } catch (error) {
            if ("statusCode" in error) {
                log.error("_getGoodreadsCollectionPage", error.statusCode);
            } else {
                log.error("_getGoodreadsCollectionPage", error);
            }
            throw error;
        }
        return data;
    }

    /**
     * Fetches all Goodreads' wishlist pages and processes each of those
     * pages' books.
     */
    async _processGoodreadsWishlist() {
        // 1. Make a note of all book IDs in the book wishlist prior so we can know if any were removed
        let previouslyFoundBookIds = [];
        for (let bookId of this.mongoClient.getBookWishlistIds()) {
            previouslyFoundBookIds.push(bookId);
        }
        let currentBookIds = new Set();

        // 2. Refetch all books in wishlist (adding & updating)
        try {
            let context = {
                knownCount: 0,
                newCount: 0,
                updatedCount: 0,
                totalNumberOfPages: 0, // Total number of pages is unknown at first
                currentPage: FIRST_PAGE,
                isWishlist: true
            };
            do {
                let goodreadsPage = await this._getGoodreadsWishlistPage(context.currentPage);

                /**
                 * Goodreads returns "\n" when no books are found for a particular page.
                 * this shouldn't happen for Wishlists since Goodreads tells us the total
                 * number of pages in each response, but just in case a race condition occurred
                 *
                 * For example, this would happen if a user removed a wishlist book just before
                 * the final page call and it happened to be the only book in the page.
                 */
                if (goodreadsPage == null
                 || goodreadsPage.books == "\n"
                 || ("statusCode" in goodreadsPage && 200 != goodreadsPage.statusCode)) {
                    break;
                }
                context.totalNumberOfPages = goodreadsPage.books.numpages;

                if ("book" in goodreadsPage.books) {
                    let wishlistBooks = [];

                    // Goodreads tries being "smart" and only returns an array if theres > 1 item
                    if (Array.isArray(goodreadsPage.books.book)
                     && goodreadsPage.books.book.length > 0) {
                        wishlistBooks = goodreadsPage.books.book;
                    // We received a single object for a single, wishlist book
                    } else {
                        wishlistBooks.push(goodreadsPage.books.book);
                    }

                    for (let goodreadsBook of wishlistBooks) {
                        currentBookIds.add("book" + goodreadsBook.id["_"]);
                        if (!this.isStopping) {
                            try {
                                await this._processGoodreadsBook(goodreadsBook, context);
                            } catch (error) {
                                log.error("_processGoodreadsBook", error);
                            }
                        }
                    }

                    context.currentPage++;
                } else {
                    // Unexpected response (might be error). Log and break
                    break;
                }
            } while(context.currentPage <= context.totalNumberOfPages);

            context.currentPage--;
            if (util.pageContextReportsChanges(context)) {
                log.info("Change detected, fetch stats:");
                log.info(context);
            } else {
                log.debug("No changes");
            }

            // 3. Remove any books that vanished from wishlist in this reprocess
            for (let previouslyFoundBookId of previouslyFoundBookIds) {
                if (!currentBookIds.has(previouslyFoundBookId)) {
                    let bookToDelete = this.mongoClient.getWishlistBookById(previouslyFoundBookId);
                    if (bookToDelete) {
                        log.info("Removing book from wishlist, title=" + bookToDelete.title + ", id=" + bookToDelete._id);

                        // 1. Delete the book from MongoDB
                        try {
                            await this.mongoClient.removeWishlistBookById(previouslyFoundBookId);
                        } catch (error) {
                            log.error("MongoClient.removeWishlistBookById", error);
                        }

                        // 2. Notify the backend server of the deleted book
                        if (this.backendSocket) {
                            this.backendSocket.emit(socketCodes.REMOVED_BOOK_FROM_WISHLIST, bookToDelete);
                        }
                    }
                }
            }
        } catch (error) {
            log.error("_processGoodreadsWishlist", "An unrecoverable error occured while executing this fetch cycle, will try again next fetch.");
        }
    }

    async _getGoodreadsWishlistPage(pageNumber) {
        log.debug("Fetching Goodreads wishlist, page=" + pageNumber);

        let data = null;
        try {
            data = await this.goodreadsClient.getBooksOnUserShelf(this.propertyManager.goodreadsUserId, "to-read", pageNumber);
            log.debug("Got books from Goodreads wishlist, page=" + pageNumber);
        } catch (error) {
            if ("statusCode" in error) {
                log.error("_getGoodreadsWishlistPage", error.statusCode);
            } else {
                log.error("_getGoodreadsWishlistPage", error);
            }
            throw error;
        }
        return data;
    }

    /**
     * Unlike fetching the items themselves, the books are mostly generic and
     * both wishlist and collection books can be processed the same (with some
     * minor edge cases).
     */
    async _processGoodreadsBook(goodreadsBook, context) {
        log.debug("Processing Goodreads book...");

        /**
         * BUILDING BOOK
         * -------------
         */
        let bookBuilder = new BookBuilder();

        // Required & expected fields
        bookBuilder.setId(goodreadsBook.id["_"]);
        if (!context.isWishlist) {
            goodreadsBook = goodreadsBook.book;
        }
        bookBuilder.setTitle(goodreadsBook.title);
        bookBuilder.setIsbn(goodreadsBook.isbn);
        bookBuilder.setIsbn13(goodreadsBook.isbn13);
        bookBuilder.setGoodreadsUrl(goodreadsBook.link);
        bookBuilder.setNumberOfPages(goodreadsBook.num_pages);
        bookBuilder.setPublisher(goodreadsBook.publisher);
        bookBuilder.setPublicationDay(goodreadsBook.publication_day);
        bookBuilder.setPublicationMonth(goodreadsBook.publication_month);
        bookBuilder.setPublicationYear(goodreadsBook.publication_year);

        let coverArtUrl = "";
        if (goodreadsBook.large_image_url !== null && goodreadsBook.large_image_url !== "") {
            coverArtUrl = goodreadsBook.large_image_url;
        } else if (goodreadsBook.image_url !== null && goodreadsBook.image_url !== "") {
            coverArtUrl = goodreadsBook.image_url;
        } else if (goodreadsBook.small_image_url !== null && goodreadsBook.small_image_url !== "") {
            coverArtUrl = goodreadsBook.small_image_url;
        }
        if (coverArtUrl.indexOf("nophoto") != -1) {
            coverArtUrl = "https://covers.openlibrary.org/b/ISBN/" + goodreadsBook.isbn + "-L.jpg";
        }
        bookBuilder.setCoverArtUrl(coverArtUrl);

        // Optional fields
        if ("authors" in goodreadsBook
         && "author" in goodreadsBook.authors) {
            let author = goodreadsBook.authors.author;
            bookBuilder.setGoodreadsAuthorId(author.id);
            bookBuilder.setAuthor(author.name); // 'Brian Wilson'
        }
        if ("review" in goodreadsBook) {
            bookBuilder.setRating(goodreadsBook.review.rating);
        }

        // Custom fields
        bookBuilder.setInWishlist(context.isWishlist);

        let book = bookBuilder.build();

        // Searching to see if we've already processed this book before
        const QUERY = {
            _id: book._id
        };
        let existingBook = await this.mongoClient.findBook(QUERY);
        if (existingBook) {
            let changesDetected = bookUtil.changesDetected(book, existingBook);
            if (changesDetected) {
                context.updatedCount++;
                log.info("Changes detected for book, title=" + book.title + ", id=" + book._id);

                // Merge and save the updated book to MongoDB
                let updatedBook = bookUtil.merge(book, existingBook);
                try {
                    await this.mongoClient.upsertBook(updatedBook);
                } catch (error) {
                    log.error("MongoClient.upsertBook", error);
                }

                // Notify the backend server of the update
                if (this.backendSocket) {
                    if (book.inWishlist) {
                        this.backendSocket.emit(socketCodes.UPDATED_BOOK_IN_WISHLIST, book);
                    } else {
                        this.backendSocket.emit(socketCodes.UPDATED_BOOK_IN_COLLECTION, book);
                    }
                }
            } else {
                log.debug("Book already processed and contains no changes, skipping title=" + book.title);
                context.knownCount++;
            }
        } else {
            // New book! (or at the very least, one Shelf's not processed before)
            context.newCount++;
            log.info("Got new book, title=" + book.title + ", id=" + book._id);

            /**
             * 1. Fetch the Goodreads cover art
             *
             * Reasonable quality, but unreliable. Only a fraction of their
             * books actually expose the high-quality book cover images to the
             * API due to legal reasons. We can expect to get a template image
             * back instead in many cases.
             */
            const CUSTOM_HEADERS = {};
            try {
                await util.downloadImage(book.coverArtUrl,
                                         this.userAgent,
                                         CUSTOM_HEADERS,
                                         path.join(paths.FRONTEND_BOOK_CACHE_DIRECTORY_PATH, book._id),
                                         BOOK_COVER_ART_FILE_NAME,
                                         this.propertyManager,
                                         this._respectRateLimits);
                book.coverArtFilePath = path.join(FRONTEND_BOOK_COVER_ART_DIRECTORY_PATH, book._id, BOOK_COVER_ART_FILE_NAME);
            } catch(error) {
                log.error("util.downloadImage", error);
            }

            // 2. Save the completed book to MongoDB
            try {
                log.info("Saving book to Mongo, title=" + book.title + ", id=" + book._id);
                await this.mongoClient.upsertBook(book);
            } catch(error) {
                log.error("MongoClient.upsertBook", error);
            }

            // 3. Notify the backend server of the new book
            if (this.backendSocket) {
                if (book.inWishlist) {
                    this.backendSocket.emit(socketCodes.ADDED_BOOK_TO_WISHLIST, book);
                } else {
                    this.backendSocket.emit(socketCodes.ADDED_BOOK_TO_COLLECTION, book);
                }
            }
        }
    }

    async _respectRateLimits(responseHeaders, url) {
        if (url.indexOf("openlibrary") != -1) {
            if (remainingOpenLibraryCalls <= 1) {
                log.info("Rate limit met for Open Library, sleeping for the required " + OPEN_LIBRARY_RATE_LIMIT_REFRESH_TIME_IN_SECONDS + " seconds before resuming...");
                await util.sleepForMinutes(OPEN_LIBRARY_RATE_LIMIT_REFRESH_TIME_IN_SECONDS);
                remainingOpenLibraryCalls = OPEN_LIBRARY_RATE_LIMIT;
            }
        }
    }

}
