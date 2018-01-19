(function(exports) {
	/**
	 * To be used as the key for sorting, organizing, and manipulating
	 * albums/LPs/records.
	 */
	exports.RECORDS = "records";

	// ADD ANY NEW MEDIA TYPES ABOVE TO THIS ARRAY!
	exports.SUPPORTED_TYPES = [exports.RECORDS];
	
})(typeof exports === 'undefined' ? this['mediaTypes'] = {} : exports);