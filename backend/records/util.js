"use strict";

// DEPENDENCIES
// ------------
// External

// Local
import Logger from "../common/Logger.js";


// CONSTANTS
// ---------
const CLASS_NAME = "records.util";


// GLOBALS
// -------
let log = new Logger(CLASS_NAME);


/**
 * To be used in conjunction with changesDetected(), will merge over all fields
 * that are "updatable" from the newRecord to the existingRecord.
 */
let merge = function(fromRecord, intoRecord) {
    intoRecord.inWishlist = fromRecord.inWishlist;
    intoRecord.rating = fromRecord.rating;
    return intoRecord;
};

/**
 * We only consider a subset of the record fields for the purposes of
 * determining whether or not a recording "changed".
 *
 * For example, the Discogs record ID cannot change once shelf has accepted
 * it, for protection of our own internal models.
 */
let changesDetected = function(newRecord, existingRecord) {
    return newRecord.inWishlist != existingRecord.inWishlist
        || newRecord.rating != existingRecord.rating;
};

export default {
    merge,
    changesDetected
}
