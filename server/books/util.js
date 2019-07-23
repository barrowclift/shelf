"use strict";

// DEPENDENCIES
// ------------
// External

// Local
let Logger = require("../common/Logger");


// CONSTANTS
// ---------
const CLASS_NAME = "books.util";


// GLOBALS
// -------
let log = new Logger(CLASS_NAME);


/**
 * To be used in conjunction with changesDetected(), will merge over all fields
 * that are "updatable" from the newBook to the existingBook.
 */
exports.merge = function(fromBook, intoBook) {
    intoBook.inWishlist = fromBook.inWishlist;
    intoBook.rating = fromBook.rating;
    return intoBook;
};

/**
 * We only consider a subset of the book fields for the purposes of
 * determining whether or not a book "changed".
 *
 * For example, the Goodreads book ID cannot change once shelf has accepted
 * it, for protection of our own internal models.
 */
exports.changesDetected = function(newBook, existingBook) {
    var changesDetected = false;
    try {
        if (newBook.inWishlist != existingBook.inWishlist
         || newBook.rating != existingBook.rating) {
            changesDetected = true;
        }
    } catch(error) {
        changesDetected = true;
    }
    return changesDetected;
};