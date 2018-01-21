(function(exports) {
    exports.newDefaultRecordDocument = function() {
        return {
            discogsId: 0, // releases.id
            discogsFolder: 0, // releases.folder_id, 0 is ALL
            discogsUrl: "https://www.discogs.com", // releases.basic_information.resource_url
            id: "recordDEFAULT", // "record" + releases.id
            title: "Untitled", // release.basic_information.title
            artist: "Unknown", // release.basic_information.artists[0].name
            sortArtist: "UNKNOWN", 
            sortTitle: "UNTITLED",
            yearOfPressing: 0, // release.basic_information.year
            yearOfOriginalRelease: 0,
            discogsAlbumArtUrl: "https://www.discogs.com", // releases.basic_information.cover_image
            discogsAlbumArtFilePath: "/images/records/UNTITLED/missing-artwork.png",
            iTunesAlbumArtUrl: "https://itunes.apple.com",
            iTunesAlbumArtFilePath: "/images/records/UNTITLED/missing-artwork.png",
            discogsAddedOn: 0, // date_added,
            isWishlist: false,
            addedOn: 0,
            updatedOn: 0
        }
    };

    var cache = {
        records: {
            collection: [],
            wishlist: [],
            mostRecentItemAddedOn: 0
        }
    };

    var sortRecords = function(recordA, recordB) {
        if (recordA.sortArtist == recordB.sortArtist) {
            if (recordA.yearOfOriginalPressing < recordB.yearOfOriginalPressing) {
                return 1;
            } else if (recordA.yearOfOriginalPressing > recordB.yearOfOriginalPressing) {
                return -1;  
            } else {
                return 0;
            }
        } else {
            return recordA.sortArtist.localeCompare(recordB.sortArtist);
        }
    }

    var sortCacheFor = function(mediaType) {
        var sortFunction = null;
        if (mediaType == "records") {
            sortFunction = sortRecords;
        }
        cache[mediaType].collection.sort(sortFunction);
        cache[mediaType].wishlist.sort(sortFunction);
    };

    exports.getCacheCollectionFor = function(mediaType) {
        return cache[mediaType].collection;
    };

    exports.getCacheWishlistFor = function(mediaType) {
        return cache[mediaType].wishlist;
    }

    exports.getCacheFor = function(mediaType) {
        return cache[mediaType]
    };

    exports.getAllCache = function() {
        return cache;
    };

    exports.emptyCacheFor = function(mediaType) {
        exports.getCacheFor(mediaType).collection.length = 0;
        exports.getCacheFor(mediaType).wishlist.length = 0;
        exports.getCacheFor(mediaType).mostRecentItemAddedOn = 0;
    };

    exports.emptyAllCache = function() {
        exports.getAllCache() = {
            reocrds: {
                collection: [],
                wishlist: [],
                mostRecentItemAddedOn: 0
            }
        }
    };

    exports.initializeCache = function(mediaType, itemsToCache) {
        var cache = exports.getCacheFor(mediaType);

        var mostRecentItemAddedOn = 0;
        for (var i = 0; i < itemsToCache.length; i++) {
            if (itemsToCache[i].isWishlist) {
                cache.wishlist.push(itemsToCache[i])
            } else {
                cache.collection.push(itemsToCache[i]);
            }
            var itemAddedTime = new Date(itemsToCache[i].addedOn).getTime();
            if (itemAddedTime > mostRecentItemAddedOn) {
                mostRecentItemAddedOn = itemAddedTime;
            }
        }

        cache.modeRecentItemAddedOn = mostRecentItemAddedOn;
    }

    exports.cacheData = function(mediaType, itemToCache, forceCache) {
        var didCacheNewItem = false;
        var cache = exports.getCacheFor(mediaType);

        var lastUpdateTime = new Date(cache.mostRecentItemAddedOn).getTime();
        var itemAddedTime = new Date(itemToCache.addedOn).getTime();

        // If this is a new item, then cache it. Otherwise, skip.
        if (itemAddedTime > lastUpdateTime || forceCache) {
            if (itemToCache.isWishlist) {
                cache.wishlist.push(itemToCache);
            } else {
                cache.collection.push(itemToCache);
            }
            cache.mostRecentItemAddedOn = itemToCache.addedOn;
            didCacheNewItem = true;
            
            sortCacheFor("records");
        }

        return didCacheNewItem;
    };

    exports.removeData = function(mediaType, itemToRemove) {
        var didRemoveCacheItem = false;
        var cache = exports.getCacheFor(mediaType);

        if (itemToRemove.isWishlist) {
            var indexToRemove = null;
            for (var i = 0; i < cache.wishlist.length; i++) {
                if (cache.wishlist[i].id === itemToRemove.id) {
                    indexToRemove = i;
                    break;
                }
            }
            if (indexToRemove) {
                didRemoveCacheItem = true;
                cache.wishlist.splice(indexToRemove, 1);
            }
        } else {
            var indexToRemove = null;
            for (var i = 0; i < cache.collection.length; i++) {
                if (cache.collection[i].id === itemToRemove.id) {
                    indexToRemove = i;
                    break;
                }
            }
            if (indexToRemove) {
                didRemoveCacheItem = true;
                cache.collection.splice(indexToRemove, 1);
            }
        }

        return didRemoveCacheItem;
    }

    exports.updateData = function(mediaType, itemToUpdate) {
        var didUpdateCacheItem = false;
        var cache = exports.getCacheFor(mediaType);

        if (itemToUpdate.isWishlist) {
            for (var i = 0; i < cache.wishlist.length; i++) {
                if (cache.wishlist[i].id === itemToUpdate.id) {
                    itemToUpdate.updatedOn = Date.now();
                    cache.wishlist[i] = itemToUpdate;
                    break;
                }
            }
        } else {
            for (var i = 0; i < cache.collection.length; i++) {
                if (cache.collection[i].id === itemToUpdate.id) {
                    itemToUpdate.updatedOn = Date.now();
                    cache.collection[i] = itemToUpdate;
                    break;
                }
            }
        }

        return didUpdateCacheItem;
    }
})(typeof exports === 'undefined' ? this['cache'] = {} : exports);
