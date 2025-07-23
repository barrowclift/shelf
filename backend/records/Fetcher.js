"use strict";

// DEPENDENCIES
// ------------
// External
import pkg from "disconnect";
const { Client: Discogs } = pkg; // "disconnect" is the Discogs API 2.0 Library
import Fuse from "fuse.js"; // For fuzzy searching
import path from "path";
import fetch from "node-fetch";
import socketIo from "socket.io-client";
import timeoutSignal from "timeout-signal";
// Local
import Logger from "../common/Logger.js";
import overrides from "../resources/overrides.json" with { type: "json" };
import paths from "../common/paths.js";
import RecordBuilder from "./Builder.js";
import recordUtil from "./util.js";
import socketCodes from "../common/socketCodes.js";
import util from "../common/util.js";


// CONSTANTS
// ---------
const CLASS_NAME = "records.Fetcher";

const ALL_RECORDS_FOLDER_ID = 0; // The default folder ID in Discogs
const FIRST_PAGE = 1; // Discogs pages start at 1, even for the API
const DISCOGS_RATE_LIMIT_REFRESH_TIME_IN_SECONDS = 70;

// https://affiliate.itunes.apple.com/resources/documentation/itunes-enterprise-partner-feed/
const ITUNES_RATE_LIMIT = 20;
const ITUNES_RATE_LIMIT_REFRESH_TIME_IN_SECONDS = 60;

const FRONTEND_ALBUM_ART_DIRECTORY_PATH = "/images/records/";
const DISCOGS_ALBUM_ART_FILE_NAME = "discogs-album-art.jpg";
const ITUNES_ALBUM_ART_FILE_NAME = "itunes-album-art.jpg";

const COLLECTION_RECORDS_FIELD_NAME = "releases";
const WISHLIST_RECORDS_FIELD_NAME = "wants";


// GLOBALS
// -------
let log = new Logger(CLASS_NAME);


/**
 * Shelf's Record Fetcher, build for and powered by Discogs.
 *
 * Used to fetch records from discogs.com, transform to suit Shelf's needs,
 * and keep Shelf's local cache in sync with any changes.
 */
export default class Fetcher {

    /**
     * Initializes the fetcher, but does not automatically kick off the
     * fetches. To do so, start() must be called.
     *
     * @param {ShelfProperites} propertyManager
     * @param {CachedMongoClient} mongoClient
     */
    constructor(propertyManager, mongoClient) {
        this.propertyManager = propertyManager;
        this.mongoClient = mongoClient;

        this.isStopping = false;
        this.currentlyFetching = false;
        this.refreshIntervalId = null;

        // Discogs setup
        this.userAgent = propertyManager.discogsUserId + " " + propertyManager.userAgentBase;
        this.discogsAuthorization = "Discogs token=" + propertyManager.discogsUserToken;
        this.discogsClient = new Discogs(this.userAgent, { userToken: propertyManager.discogsUserToken });
        this.discogsUserId = propertyManager.discogsUserId;
        this.remainingItunesCalls = ITUNES_RATE_LIMIT;

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
        log.info("Starting...");

        // Initial startup (always run fetch as soon as possible on start() call!)
        await this._fetch();
        // For initial startup ONLY, notify the backend server when the fetch has completed
        if (this.backendSocket) {
            this.backendSocket.emit(socketCodes.INITIAL_RECORD_COLLECTION_IN_PROGRESS, false);
        }

        this.refreshIntervalId = setInterval(async () => {
            if (this.isStopping) {
                log.info("Preventing refresh, shutting down");
            } else if (this.currentlyFetching) {
                log.info("Skipping refresh, still processing previous one");
            } else {
                await this._fetch();
            }
        }, this.propertyManager.refreshFrequencyInMillis);
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
     * Fetches all Discogs collection and wishlist records, and updates or
     * deletes any existing ones in Shelf.
     */
    async _fetch() {
        // Reset iTunes rate limit
        this.remainingItunesCalls = ITUNES_RATE_LIMIT;
        this.currentlyFetching = true;

        log.debug("Fetching records in collection...");
        try {
            await this._processDiscogsCollection();
        } catch (error) {
            log.error("_processDiscogsCollection", error);
        }

        log.debug("Fetching records in wishlist...");
        try {
            await this._processDiscogsWishlist();
        } catch (error) {
            log.error("_processDiscogsWishlist", error);
        }

        this.currentlyFetching = false;
        log.debug("Completed fetching record");
    }

    /**
     * Fetches all Discogs collection pages and processes each of those pages'
     * records.
     */
    async _processDiscogsCollection() {
        // 1. Make a note of all record IDs in the record collection prior so we can know if any were removed
        let previouslyFoundRecordIds = [];
        for (let recordId of this.mongoClient.getRecordCollectionIds()) {
            previouslyFoundRecordIds.push(recordId);
        }
        let currentRecordIds = new Set();

        // 2. Refetch all records in collection (adding & updating)
        try {
            let context = {
                knownCount: 0,
                newCount: 0,
                updatedCount: 0,
                totalNumberOfPages: 0, // Total number of pages is unknown at first
                currentPage: FIRST_PAGE,
                recordsFieldName: COLLECTION_RECORDS_FIELD_NAME
            };
            do {
                let discogsPage = await this._getDiscogsCollectionPage(context.currentPage);
                if (discogsPage == null) {
                    log.error("_processDiscogsCollection", "Received null response from Discogs client")
                    break;
                } else {
                    context.totalNumberOfPages = discogsPage.pagination.pages;

                    let discogsRecords = discogsPage[context.recordsFieldName];
                    for (let discogsRecord of discogsRecords) {
                        currentRecordIds.add("record" + discogsRecord.id);
                        if (!this.isStopping) {
                            try {
                                await this._processDiscogsRecord(discogsRecord, context);
                            } catch (error) {
                                log.error("_processDiscogsRecord", error);
                            }
                        }
                    }

                    context.currentPage++;
                }
            } while(context.currentPage <= context.totalNumberOfPages);

            context.currentPage--;
            if (util.pageContextReportsChanges(context)) {
                log.info("Change detected, fetch stats:");
                log.info(context);
            } else {
                log.debug("No changes");
            }

            // 3. Remove any records that vanished from this reprocess
            for (let previouslyFoundRecordingId of previouslyFoundRecordIds) {
                if (!currentRecordIds.has(previouslyFoundRecordingId)) {
                    let recordToDelete = this.mongoClient.getCollectionRecordById(previouslyFoundRecordingId);
                    if (recordToDelete) {
                        log.info("Removing record from collection, title=" + recordToDelete.title + ", id=" + recordToDelete._id);

                        // 1. Delete the record from MongoDB
                        try {
                            await this.mongoClient.removeCollectionRecordById(previouslyFoundRecordingId);
                        } catch (error) {
                            log.error("MongoClient.removeCollectionRecordById", error);
                        }

                        // 2. Notify the backend server of the deleted record
                        if (this.backendSocket) {
                            this.backendSocket.emit(socketCodes.REMOVED_RECORD_FROM_COLLECTION, recordToDelete);
                        }
                    }
                }
            }
        } catch (error) {
            log.error("_processDiscogsCollection", "An unrecoverable error occured while executing this fetch cycle, will try again next fetch.");
        }
    }

    async _getDiscogsCollectionPage(pageNumber) {
        log.debug("Fetching discogs collection, page=" + pageNumber);

        let discogsSettings = {
            page: pageNumber
        };

        let data = null;
        try {
            let collection = this.discogsClient.user().collection();
            data = await collection.getReleases(this.discogsUserId,
                                                ALL_RECORDS_FOLDER_ID,
                                                discogsSettings);
            log.debug("Got records from discogs collection, page=" + pageNumber);
        } catch (error) {
            log.error("discogsClient.user().collection().getReleases", error);
            throw error;
        }
        return data;
    }

    /**
     * Fetches all Discogs wishlist pages and processes each of those pages'
     * records.
     */
    async _processDiscogsWishlist() {
        // 1. Make a note of all record IDs in the record wishlist prior so we can know if any were removed
        let previouslyFoundRecordIds = [];
        for (let recordId of this.mongoClient.getRecordWishlistIds()) {
            previouslyFoundRecordIds.push(recordId);
        }
        let currentRecordIds = new Set();

        // 2. Refetch all records in wishlist (adding & updating)
        try {
            let context = {
                knownCount: 0,
                newCount: 0,
                updatedCount: 0,
                totalNumberOfPages: 0, // Total number of pages is unknown at first
                currentPage: FIRST_PAGE,
                recordsFieldName: WISHLIST_RECORDS_FIELD_NAME
            };
            do {
                let discogsPage = await this._getDiscogsWishlistPage(context.currentPage);
                if (discogsPage == null) {
                    log.error("_processDiscogsWishlist", "Received null response from Discogs client")
                    break;
                } else {
                    context.totalNumberOfPages = discogsPage.pagination.pages;

                    let discogsRecords = discogsPage[context.recordsFieldName];
                    for (let discogsRecord of discogsRecords) {
                        currentRecordIds.add("record" + discogsRecord.id);
                        if (!this.isStopping) {
                            await this._processDiscogsRecord(discogsRecord, context);
                        }
                    }

                    context.currentPage++;
                }
            } while(context.currentPage <= context.totalNumberOfPages);

            context.currentPage--;
            if (util.pageContextReportsChanges(context)) {
                log.info("Change detected, fetch stats:");
                log.info(context);
            } else {
                log.debug("No changes");
            }

            // 3. Remove any records that vanished from this reprocess
            for (let previouslyFoundRecordingId of previouslyFoundRecordIds) {
                if (!currentRecordIds.has(previouslyFoundRecordingId)) {
                    let recordToDelete = this.mongoClient.getWishlistRecordById(previouslyFoundRecordingId);
                    if (recordToDelete) {
                        log.info("Removing record from wishlist, title=" + recordToDelete.title + ", id=" + recordToDelete._id);

                        // 1. Delete the record from MongoDB
                        try {
                            await this.mongoClient.removeWishlistRecordById(previouslyFoundRecordingId);
                        } catch (error) {
                            log.error("MongoClient.removeWishlistRecordById", error);
                        }

                        // 2. Notify the backend server of the deleted record
                        if (this.backendSocket) {
                            this.backendSocket.emit(socketCodes.REMOVED_RECORD_FROM_WISHLIST, recordToDelete);
                        }
                    }
                }
            }
        } catch (error) {
            log.error("_processDiscogsWishlist", "An unrecoverable error occured while executing this fetch cycle, will try again next fetch.");
        }
    }

    async _getDiscogsWishlistPage(pageNumber) {
        log.debug("Fetching discogs wishlist, page=" + pageNumber);

        let discogsSettings = {
            page: pageNumber
        };

        let data = null;
        try {
            let wishlist = this.discogsClient.user().wantlist();
            data = await wishlist.getReleases(this.discogsUserId,
                                              discogsSettings);
            log.debug("Got records from discogs wishlist, page=" + pageNumber);
        } catch (error) {
            log.error("discogsClient.user().wantlist().getReleases()", error);
            throw error;
        }
        return data;
    }

    /**
     * Unlike fetching the items themselves, the records are mostly generic
     * and both wishlist and collection records can be processed the same
     * (with some minor edge cases)
     */
    async _processDiscogsRecord(discogsRecord, context) {
        log.debug("Processing Discogs record...");

        /**
         * BUILDING RECORD
         * ---------------
         */
        let recordBuilder = new RecordBuilder();

        // Required & expected fields
        recordBuilder.setDiscogsId(discogsRecord.id);
        recordBuilder.setId(discogsRecord.id);
        recordBuilder.setDiscogsUrl(discogsRecord.basic_information.resource_url);
        recordBuilder.setTitle(discogsRecord.basic_information.title);
        recordBuilder.setYearOfPressing(discogsRecord.basic_information.year);
        recordBuilder.setDiscogsAddedOn(discogsRecord.date_added);
        recordBuilder.setArtist(discogsRecord.basic_information.artists[0].name);
        // Don't process any record returned by Discogs without an Artist
        if (!("name" in discogsRecord.basic_information.artists[0])) {
            log.debug("Record found missing artist, skipping title=" + record.title);
            return;
        }

        // There is not an associated folder if getting wishlist items
        if ("folder_id" in discogsRecord) {
            recordBuilder.setDiscogsFolderId(discogsRecord.folder_id);
        }
        if ("cover_image" in discogsRecord.basic_information) {
            recordBuilder.setDiscogsAlbumArtUrl(discogsRecord.basic_information.cover_image);
        } else if ("thumb" in discogsRecord.basic_information) {
            recordBuilder.setDiscogsAlbumArtUrl(discogsRecord.basic_information.thumb);
        }
        // If there's no rating, the rating field is returned as "0"
        if ("rating" in discogsRecord && discogsRecord.rating != 0) {
            recordBuilder.setRating(discogsRecord.rating);
        }

        // Custom fields
        recordBuilder.setInWishlist(context.recordsFieldName === WISHLIST_RECORDS_FIELD_NAME);

        let record = recordBuilder.build();

        // Searching to see if we've already processed this record before
        const QUERY = {
            title: record.title,
            artist: record.artist
        };
        let existingRecord = await this.mongoClient.findRecord(QUERY);
        if (existingRecord) {
            if (record._id != existingRecord._id) {
                log.debug("Different pressing of record already processed, skipping title=" + record.title);
                context.knownCount++;
            } else if (recordUtil.changesDetected(record, existingRecord)) {
                log.info("Changes detected for record, title=" + record.title + ", id=" + record._id);
                context.updatedCount++;

                // Merge and save the updated record to MongoDB
                let updatedRecord = recordUtil.merge(record, existingRecord);
                try {
                    await this.mongoClient.upsertRecord(updatedRecord);
                } catch (error) {
                    log.error("MongoClient.upsertRecord", error);
                }

                // Notify the backend server of the update
                if (this.backendSocket) {
                    if (record.inWishlist) {
                        this.backendSocket.emit(socketCodes.UPDATED_RECORD_IN_WISHLIST, updatedRecord);
                    } else {
                        this.backendSocket.emit(socketCodes.UPDATED_RECORD_IN_COLLECTION, updatedRecord);
                    }
                }
            } else {
                log.debug("Record already processed and contains no changes, skipping title=" + record.title);
                context.knownCount++;
            }
        } else {
            // New record! (or at the very least, one Shelf's not processed before)
            context.newCount++;
            log.info("Got new record, title=" + record.title + ", id=" + record._id);

            /**
             * 1. Fetch the Discogs album art
             *
             * Terrible quality, but better than nothing should the iTunes API
             * search not yield any results (their API is very clunky, this
             * happens occasionally).
             */
            let customHeaders = {
                Authorization: this.discogsAuthorization
            };
            try {
                await util.downloadImage(record.discogsAlbumArtUrl,
                                         this.userAgent,
                                         customHeaders,
                                         path.join(paths.FRONTEND_RECORD_CACHE_DIRECTORY_PATH, record._id),
                                         DISCOGS_ALBUM_ART_FILE_NAME,
                                         this.propertyManager,
                                         this._respectRateLimits);
                record.discogsAlbumArtFilePath = path.join(FRONTEND_ALBUM_ART_DIRECTORY_PATH, record._id, DISCOGS_ALBUM_ART_FILE_NAME);
            } catch(error) {
                log.error("util.downloadImage", error);
            }

            // 2. Transform the Discogs resource URL to a true discogs page link for the record
            try {
                let resourceUrl = discogsRecord.basic_information.resource_url;
                let discogsRecordUrl = await this._getDiscogsRecordUrlFromResourceUrl(resourceUrl);
                record.discogsUrl = discogsRecordUrl;
            } catch(error) {
                log.error("_getDiscogsRecordUrlFromResourceUrl", error);
            }

            // 3. Fetch the iTunes album art and year of original release (but need to get the iTunes record url first)
            try {
                let [largeAlbumArtUrl, yearOfOriginalRelease] = await this._getiTunesAlbumArtAndYearOfOriginalRelease(record.title, record.artist);
                // If not set, couldn't find the record in iTunes (but not an error per-say)
                if (largeAlbumArtUrl || yearOfOriginalRelease) {
                    /**
                     * iTunes is *usually* correct. But in some cases,
                     * for whatever reason, the year they return is
                     * incorrect (see Arcade Fire's discography, at
                     * the moment they're stating it's all 2017.) As a
                     * safety procaution, we consider year of original
                     * releases only valid if they are older than or
                     * equal to the year of the pressing in question
                     * (makes sense, can't have an original release
                     * years AFTER a pressing release!)
                     */
                    if (yearOfOriginalRelease && yearOfOriginalRelease < record.yearOfPressing) {
                        record.yearOfOriginalRelease = yearOfOriginalRelease;
                    }
                    if (largeAlbumArtUrl) {
                        const CUSTOM_HEADERS = {};
                        let destinationDirectoryPath = path.join(paths.FRONTEND_RECORD_CACHE_DIRECTORY_PATH, record._id);
                        try {
                            await util.downloadImage(largeAlbumArtUrl,
                                                     this.userAgent,
                                                     CUSTOM_HEADERS,
                                                     destinationDirectoryPath,
                                                     ITUNES_ALBUM_ART_FILE_NAME,
                                                     this.propertyManager,
                                                     this._respectRateLimits);
                            record.iTunesAlbumArtFilePath = path.join(FRONTEND_ALBUM_ART_DIRECTORY_PATH, record._id, ITUNES_ALBUM_ART_FILE_NAME);
                        } catch(error) {
                            log.error("util.downloadImage", error);
                        }
                    }
                }
            } catch(error) {
                log.error("_getiTunesAlbumArtAndYearOfOriginalRelease", error);
            }

            // 4. Save the completed record to MongoDB
            try {
                log.info("Saving record to Mongo, title=" + record.title + ", id=" + record._id);
                await this.mongoClient.upsertRecord(record);
            } catch(error) {
                log.error("MongoClient.upsertRecord", error);
            }

            // 5. Notify the backend server of the new record
            if (this.backendSocket) {
                if (record.inWishlist) {
                    this.backendSocket.emit(socketCodes.ADDED_RECORD_TO_WISHLIST, record);
                } else {
                    this.backendSocket.emit(socketCodes.ADDED_RECORD_TO_COLLECTION, record);
                }
            }
        }
    }

    async _getDiscogsRecordUrlFromResourceUrl(resourceUrl) {
        // Building the request
        let options = {
            method: "GET",
            signal: timeoutSignal(this.propertyManager.requestTimeoutInMillis),
            headers: {
                "User-Agent": this.userAgent,
                "Authorization": this.discogsAuthorization,
                "Content-Type": "application/json"
            }
        };

        // Sending the request
        log.debug("Getting discogs record link using resourceUrl=" + resourceUrl + "...");
        let response = await fetch(resourceUrl, options);
        await this._respectRateLimits(response.headers);

        if (!response.headers.get("content-type")) {
            throw "Unknown server response type received, Content-Type not specified";
        } else if (!response.headers.get("content-type").includes("application/json")) {
            throw "Unexpected server response, got Content-Type=" + response.headers.get("content-type") + " instead of \"application/json\"";
        } else {
            const responseJson = await response.json();
            log.debug("Got discogsRecordUrl=" + responseJson.uri);
            return responseJson.uri;
        }
    }

    async _getiTunesAlbumArtAndYearOfOriginalRelease(title, artist) {
        // Building the request
        if (overrides.records.searchAssistance.titles[title]) {
            title = overrides.records.searchAssistance.titles[title];
        }
        if (overrides.records.searchAssistance.artists[artist]) {
            artist = overrides.records.searchAssistance.artists[artist];
        }

        const url = this._createiTunesSearchUrl(title + " " + artist);
        let options = {
            method: "GET",
            signal: timeoutSignal(this.propertyManager.requestTimeoutInMillis),
            headers: {
                "User-Agent": this.userAgent,
                "Content-Type": "application/json"
            }
        };

        // Sending the request
        log.debug("Searching iTunes for title=" + title + ", url=" + url + "...");
        this.remainingItunesCalls--;
        let response = await fetch(url, options);
        await this._respectRateLimits(response.headers);

        if (!response.headers.get("content-type")) {
            throw "Unknown server response type received, Content-Type not specified";
        } else if (!response.headers.get("content-type").includes("text/javascript")) {
            throw "Unexpected server response, got Content-Type=" + response.headers.get("content-type") + " instead of \"text/javascript\"";
        } else {
            let largeAlbumArtUrl = null;
            let yearOfOriginalRelease = null;

            let records = await response.json();
            if (records.resultCount == 0) {
                log.warn("_getiTunesAlbumArtAndYearOfOriginalRelease", "No results from iTunes for title=" + title);
            } else {
                /**
                 * We *may* get back a couple or more artists that
                 * match the provided album name. In some cases, we
                 * may even get a single, false positive match. For
                 * these cases, we should apply a fuzzy matching on
                 * the artist name to ensure that if there's multiple
                 * matches we select the best (hopefully correct)
                 * match, and if there's just a single match that it's
                 * not a false positive.
                 */
                let fuzzySearchOptions = {
                    shouldSort: true,
                    threshold: 0.8,
                    location: 0,
                    distance: 100,
                    maxPatternLength: 32,
                    minMatchCharLength: 1,
                    keys: [
                        "artistName"
                    ]
                };
                let fuse = new Fuse(records.results, fuzzySearchOptions);
                let results = fuse.search(artist);

                fuzzySearchOptions.keys = ["item.collectionName"];
                fuse = new Fuse(results, fuzzySearchOptions);
                results = fuse.search(title);

                /**
                 * No search matches = []
                 * Single search match = { item: { ... } }
                 * More than one search match = [ { item : { ... } }, { item : { ... } }, ... ]
                 */
                if (results.constructor === Array && results.length === 0) {
                    log.warn("_getiTunesAlbumArtAndYearOfOriginalRelease", "Got results back from iTunes for title=" + title + ", but they were all deemed false positives by Fuse.js:");
                    log.warn("_getiTunesAlbumArtAndYearOfOriginalRelease", records);
                } else {
                    const result = results.constructor === Array ? results[0].item.item : results.item.item;
                    largeAlbumArtUrl = result.artworkUrl100;
                    largeAlbumArtUrl = largeAlbumArtUrl.replace("100x100", this.propertyManager.maxArtSize + "x" + this.propertyManager.maxArtSize);
                    yearOfOriginalRelease = new Date(result.releaseDate).getUTCFullYear();
                }
            }
            // Using ES6 array deconstructing to return two variables in the resolve
            return [largeAlbumArtUrl, yearOfOriginalRelease];
        }
    }

    /**
     * For the given responseHeaders JSON, will determine if fetch should
     * cease for a cool-off time for any and all rate limits to be respected
     * and refreshed. Currently, the two rate limits being respected are:
     *
     *   - iTunes (~20 calls per minute max)
     *   - Discogs (~70 calls per minute max)
     */
    async _respectRateLimits(responseHeaders, url) {
        if (responseHeaders) {
            /**
             * iTunes doesn't expose API rate limits in the header or
             * response body at all, but rest assured, they exist. In
             * fact, to quote Apple:
             *
             * > The iTunes Search API is currently limited to
             * > approximately 20 calls per minute (subject to change).
             *
             * Thus, we must keep a running count of the number of calls
             * made to iTunes and rest for 1 minute before continuing.
             */
            if (responseHeaders.get("x-apple-orig-url")) {
                if (this.remainingItunesCalls <= 1) {
                    log.warn("_respectRateLimits", "Rate limit met for iTunes, sleeping for the required " + ITUNES_RATE_LIMIT_REFRESH_TIME_IN_SECONDS + " seconds before resuming...");
                    await util.sleepForSeconds(ITUNES_RATE_LIMIT_REFRESH_TIME_IN_SECONDS);
                    this.remainingItunesCalls = ITUNES_RATE_LIMIT;
                }
            }

            /**
             * Discogs rate limits are exposed in headers, and change
             * depending on whether or not the user token is acceptable or
             * not.
             *
             * Because of the stricter iTunes rate limits, the Discogs
             * rate limits will almost surely not be an issue. But just in
             * case...
             */
            if (responseHeaders.get("x-discogs-ratelimit")) {
                if (responseHeaders.get("x-discogs-ratelimit") <= 1) {
                    log.warn("_respectRateLimits", "Rate limit met for Discogs, sleeping for the required " + DISCOGS_RATE_LIMIT_REFRESH_TIME_IN_SECONDS + " seconds before resuming...");
                    await util.sleepForSeconds(DISCOGS_RATE_LIMIT_REFRESH_TIME_IN_SECONDS);
                }
            }
        }
    }

    _createiTunesSearchUrl(text) {
        return encodeURI("https://itunes.apple.com/search?entity=album&limit=100&term=" + this._sanitizeTextForiTunesApi(text));
    }

    _sanitizeTextForiTunesApi(title) {
        let sanitizedTitle = title.replace(/ /g, "+");
        return sanitizedTitle;
    }

}
