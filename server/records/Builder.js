"use strict";

// DEPENDENCIES
// ------------
// External

// Local
let overrides = require("../resources/overrides");
let util = require("../common/util");


// CONSTANTS
// ---------
const ID_FLAG = "record";

const DEFAULT_ARTIST = "Unknown"; // release.basic_information.artists[0].name
const DEFAULT_DISCOGS_ADDED_ON = 0; // date_added
const DEFAULT_DISCOGS_ALBUM_ART_FILE_PATH = "/images/records/UNTITLED/missing-artwork.png";
const DEFAULT_DISCOGS_ALBUM_ART_URL = "https://www.discogs.com"; // releases.basic_information.cover_image
const DEFAULT_DISCOGS_FOLDER_ID = 0; // releases.folter_id, 0 is all
const DEFAULT_DISCOGS_ID = 0; // releases.id
const DEFAULT_DISCOGS_URL = "https://www.discogs.com"; // releases.basic_information.resource_url
const DEFAULT_ID = ID_FLAG + "DEFAULT"; // "record" + releases.id
const DEFAULT_IN_WISHLIST = false;
const DEFAULT_ITUNES_ALBUM_ART_URL = "https://itunes.apple.com";
const DEFAULT_ITUNES_ART_FILE_PATH = "/images/records/UNTITLED/missing-artwork.png";
const DEFAULT_RATING = -1; // release.rating
const DEFAULT_TITLE = "Untitled"; // release.basic_information.title
const DEFAULT_YEAR_OF_PRESSING = 0; // release.basic_information.year


/**
 * Builder to assist converting Discog's record object into Shelf's own,
 * internal record object. Besides ignoring fields Shelf doesn't care about and
 * choosing saner names and flat organization, there are some nice
 * transformations and data manipulations that are handled by this builder as
 * well (for example, mapping "noisy" titles or incorrect artist names to the
 * desired overrides, when appropriate).
 *
 * Example Shelf record:
 *
 *     {
 *         "_id" : "record12484079",
 *         "addedOn" : 1562437382458,
 *         "artist" : "George Clanton",
 *         "discogsAddedOn" : 1555464610000,
 *         "discogsAlbumArtFilePath" : "/images/records/record12484079/discogs-album-art.jpg",
 *         "discogsAlbumArtUrl" : "https://img.discogs.com/j2Ul8KfS6Xqo4dYOhCCjQjZ6mNo=/fit-in/150x150/filters:strip_icc():format(jpeg):mode_rgb():quality(40)/discogs-images/R-12484079-1536190570-4340.jpeg.jpg",
 *         "discogsFolderId" : 1,
 *         "discogsId" : 12484079,
 *         "discogsUrl" : "https://www.discogs.com/George-Clanton-Slide/release/12484079",
 *         "iTunesAlbumArtFilePath" : "/images/records/record12484079/itunes-album-art.jpg",
 *         "iTunesAlbumArtUrl" : "https://itunes.apple.com",
 *         "inWishlist" : false,
 *         "rating" : 0,
 *         "sortArtist" : "GEORGE CLANTON",
 *         "sortTitle" : "SLIDE",
 *         "title" : "Slide",
 *         "updatedOn" : 1562437382458,
 *         "yearOfOriginalRelease" : 2018,
 *         "yearOfPressing" : 2018
 *     }
 */
class Builder {

    /**
     * Sets all "settable" fields for the pending new record to it's default
     * values.
     */
    constructor() {
        this._id = DEFAULT_ID;
        this.artist = DEFAULT_ARTIST;
        this.discogsAddedOn = DEFAULT_DISCOGS_ADDED_ON;
        this.discogsAlbumArtFilePath = DEFAULT_DISCOGS_ALBUM_ART_FILE_PATH;
        this.discogsAlbumArtUrl = DEFAULT_DISCOGS_ALBUM_ART_URL;
        this.discogsFolderId = DEFAULT_DISCOGS_FOLDER_ID;
        this.discogsId = DEFAULT_DISCOGS_ID;
        this.discogsUrl = DEFAULT_DISCOGS_URL;
        this.inWishlist = DEFAULT_IN_WISHLIST;
        this.iTunesAlbumArtFilePath = DEFAULT_ITUNES_ART_FILE_PATH;
        this.iTunesAlbumArtUrl = DEFAULT_ITUNES_ALBUM_ART_URL;
        this.rating = DEFAULT_RATING;
        this.sortArtist = util.getSortText(DEFAULT_ARTIST);
        this.sortTitle = util.getSortText(DEFAULT_TITLE);
        this.title = DEFAULT_TITLE;
        this.yearOfOriginalRelease = DEFAULT_YEAR_OF_PRESSING;
        this.yearOfPressing = DEFAULT_YEAR_OF_PRESSING;
    }

    /**
     * ==============
     * PUBLIC METHODS
     * ==============
     */

    /**
     * Builds and returns the Shelf record. Record attributes not set in the
     * builder by the caller prior to this call will use their default values.
     *
     * @return record Shelf record appropriate for wider Shelf use. Can be
     *                written to Mongo as-is.
     */
    build() {
        let now = Date.now();
        return {
            _id : this._id,
            addedOn : now,
            artist : this.artist,
            discogsAddedOn : this.discogsAddedOn,
            discogsAlbumArtFilePath : this.discogsAlbumArtFilePath,
            discogsAlbumArtUrl : this.discogsAlbumArtUrl,
            discogsFolderId : this.discogsFolderId,
            discogsId : this.discogsId,
            discogsUrl : this.discogsUrl,
            inWishlist : this.inWishlist,
            iTunesAlbumArtFilePath : this.iTunesAlbumArtFilePath,
            iTunesAlbumArtUrl : this.iTunesAlbumArtUrl,
            rating : this.rating,
            sortArtist : this.sortArtist,
            sortTitle : this.sortTitle,
            title : this.title,
            updatedOn : now,
            yearOfOriginalRelease : this.yearOfOriginalRelease,
            yearOfPressing : this.yearOfPressing,
        };
    }

    setId(id) {
        this._id = ID_FLAG + id;
    }
    setArtist(artist) {
        /**
         * Some of the artists Discogs has may be incorrect. In case of
         * situations like that, the desired, correct name can be used instead
         * by mapping the "bad" artist to the desired replacement in the
         * overrides file.
         */
        if (overrides.records.replacements.artists[artist]) {
            this.artist = overrides.records.replacements.artists[artist];
        } else {
            this.artist = artist;
        }

        this.sortArtist = util.getSortText(this.artist);
    }
    setDiscogsAddedOn(discogsAddedOn) {
        this.discogsAddedOn = new Date(discogsAddedOn).getTime();
    }
    setDiscogsAlbumArtFilePath(discogsAlbumArtFilePath) {
        this.discogsAlbumArtFilePath = discogsAlbumArtFilePath;
    }
    setDiscogsAlbumArtUrl(discogsAlbumArtUrl) {
        this.discogsAlbumArtUrl = discogsAlbumArtUrl;
    }
    setDiscogsFolderId(discogsFolderId) {
        this.discogsFolderId = discogsFolderId;
    }
    setDiscogsId(discogsId) {
        this.discogsId = discogsId;
    }
    setDiscogsUrl(discogsUrl) {
        this.discogsUrl = discogsUrl;
    }
    setInWishlist(inWishlist) {
        this.inWishlist = inWishlist;
    }
    setITunesAlbumArtFilePath(iTunesAlbumArtFilePath) {
        this.iTunesAlbumArtFilePath = iTunesAlbumArtFilePath;
    }
    setITunesAlbumArtUrl(iTunesAlbumArtUrl) {
        this.iTunesAlbumArtUrl = iTunesAlbumArtUrl;
    }
    setRating(rating) {
        this.rating = rating;
    }
    setTitle(title) {
        /**
         * There are sometimes cases where the "true" title of a record isn't the
         * title used in common parlance (e.g. "The White Album"). Here's where
         * we apply user preferences for those cases over the "true" title.
         */
        if (overrides.records.replacements.titles[title]) {
            this.title = overrides.records.replacements.titles[title];
        } else {
            this.title = title;
        }

        this.sortTitle = util.getSortText(this.title);
    }
    setYearOfPressing(yearOfPressing) {
        this.yearOfPressing = yearOfPressing;
        /**
         * Discogs does not appear to expose or own any data reflecting the
         * year of ORIGINAL RELEASE for a particular recording, only the year
         * a particular pressing was issued. This year is a relatively safe
         * default to us, and we'll try getting this data at a later time from
         * iTunes, if available.
         */
        this.yearOfOriginalRelease = yearOfPressing;
    }

}

module.exports = Builder;