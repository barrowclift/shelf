"use strict";

// DEPENDENCIES
// ------------
// External

// Local
import Logger from "../common/Logger.js";


// CONSTANTS
// ---------
const CLASS_NAME = "boardGames.util";


// GLOBALS
// -------
let log = new Logger(CLASS_NAME);


/**
 * To be used in conjunction with changesDetected(), will merge over all fields
 * that are "updatable" from the newBoardGame to the existingBoardGame.
 */
let merge = function(fromBoardGame, intoBoardGame) {
    intoBoardGame.inWishlist = fromBoardGame.inWishlist;
    intoBoardGame.rating = fromBoardGame.rating;
    return intoBoardGame;
};

/**
 * We only consider a subset of the board game fields for the purposes of
 * determining whether or not a board game "changed".
 *
 * For example, the BoardGameGeek "thing" ID cannot change once shelf has
 * accepted it, for protection of our own internal models.
 */
let changesDetected = function(newBoardGame, existingBoardGame) {
    let changesDetected = false;
    try {
        if (newBoardGame.inWishlist != existingBoardGame.inWishlist
         || newBoardGame.rating != existingBoardGame.rating) {
            changesDetected = true;
        }
    } catch(error) {
        changesDetected = true;
    }
    return changesDetected;
};

export default {
    merge,
    changesDetected
}
