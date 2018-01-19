(function(exports) {
	/**
	 * For passing around record collection or wishlist arrays or single
	 * record objects between the poller, server, and client.
	 * 
	 * If the client receives an array, it will assume that's the new list in
	 * its entirety, and replace it's old list with the new one.
	 *
	 * If the client receives a single record object, it will assume it's just
	 * a new addition to it's existing records list, and sort it into that
	 * list.
	 */
	exports.RECORD_COLLECTION = "recordCollection";
	exports.RECORD_WISHLIST = "recordWishlist";

	/**
	 * Generically add any item to its respective cache (dictated by the
	 * provided mediaType) and notify the frontend about the new addition.
	 * Only accepts a single data item, not an array.
	 */
	exports.ADD_TO_CACHE = "addToCache";

	/**
	 * Generically update a particular poller by media type and sub type (for
	 * example, the "records" media type poller has a "collection" component
	 * and a "wishlist" component) and notify the frontend about the change.
	 */
	exports.UPDATE_POLLER_STATUS = "updatePollerStatus";
	/**
	 * A means for the client to request the current poller status be sent.
	 */
	// exports.GET_POLLER_STATUS = "getPollerStatus";

})(typeof exports === 'undefined' ? this['socketCodes'] = {} : exports);