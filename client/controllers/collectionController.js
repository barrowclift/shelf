const FUZZY_SEARCH_OPTIONS = {
    shouldSort: true,
    includeScore: false,
    tokenize: true,
    matchAllTokens: true,
    threshold: 0.1,
    location: 0,
    distance: 100,
    maxPatternLength: 32,
    minMatchCharLength: 1,
    keys: [
        "artist",
        "title"
    ]
}

angular
.module("shelf", ["ngAnimate"])
.controller("collectionController", function($scope) {
    const CLASS_NAME = "collectionController";

    $scope.hideLoadingSpinner = true;
    $scope.type = "collection";
    $scope.recordCount = 0;

    var removeRecordFromList = function(recordToRemove) {
        var indexToRemove = null;
        for (var i = 0; i < $scope.records.length; i++) {
            if ($scope.records[i].id === recordToRemove.id) {
                indexToRemove = i;
                break;
            }
        }
        if (indexToRemove) {
            $scope.records.splice(indexToRemove, 1);
            $scope.$apply();
        }
    }

    var socket = io.connect("http://localhost:10800");
    socket.on("connect", function() {
        logger.logInfo(CLASS_NAME, "Client has connected to the server");
    });
    socket.on("disconnect", function() {
        logger.logInfo(CLASS_NAME, "The client has disconnected");
    });

    // Request the server send the client the "records" cache
    socket.emit(socketCodes.RECORD_COLLECTION);
    // Listen for the server response to the "records" cache request
    socket.on(socketCodes.RECORD_COLLECTION, function(data) {
        // If data's an array, assume they're sending us ALL records
        if (Array === data.constructor) {
            logger.logInfo(CLASS_NAME, "The client sent array of records for collection, refreshing entire record frontend");
            $scope.records = data;
            $scope.recordCount = data.length;
        // Else, assume they're sending us just one new record
        } else {
            logger.logInfo(CLASS_NAME, "The client sent a new record for collection, adding to records array for displaying in frontend");
            $scope.records.push(data);
            $scope.recordCount += 1;
        }
        $scope.$apply();
    });
    socket.emit(socketCodes.UPDATE_POLLER_STATUS);
    // Listen for the server to tell us the poller has finished so we know to hide the spinner
    socket.on(socketCodes.UPDATE_POLLER_STATUS, function(pollingStatus) {
        var priorValue = $scope.hideLoadingSpinner;
        $scope.hideLoadingSpinner = pollingStatus.records.collectionDone;
        var status = "ON";
        if ($scope.hideLoadingSpinner) {
            status = "OFF";
        }
        logger.logInfo(CLASS_NAME, "The client said to turn the spinner " + status + ", refreshing frontend spinner if necessary");
        if (priorValue != $scope.hideLoadingSpinner) {
            $scope.$apply();
        }
    });

    // Listen for server requests to remove a particular item from the records list
    socket.on(socketCodes.REMOVE_RECORD_COLLECTION_ITEM, function(itemToRemove) {
        removeRecordFromList(itemToRemove);
    });

    // List for server requests to update a particular item in the records list (this may include removals)
    socket.on(socketCodes.UPDATE_RECORD_COLLECTION_ITEM, function(itemToUpdate) {
        if (itemToUpdate.isWishlist) {
            removeRecordFromList(itemToRemove);
        } else {
            for (var i = 0; i < $scope.records.length; i++) {
                if ($scope.records[i].id === itemToUpdate.id) {
                    $scope.records[i] = itemToUpdate;
                    $scope.$apply();
                    break;
                }
            }
        }
    });

    $scope.artistNameAndYearOfRelease = function(recordA, recordB) {
        if ($scope.searchBox) {
            return 0;
        }

        if (recordA.value.sortArtist === recordB.value.sortArtist) {
            if (recordA.value.yearOfOriginalRelease < recordB.value.yearOfOriginalRelease) {
                return -1;
            } else if (recordA.value.yearOfOriginalRelease > recordB.value.yearOfOriginalRelease) {
                return 1;   
            } else {
                return 0;
            }
        } else {
            return recordA.value.sortArtist.localeCompare(recordB.value.sortArtist);
        }
    };
})
.filter("searchFor", function() {
    return function(records, searchString) {
        if (!searchString) {
            return records;
        }

        // If fuse doesn't work out, https://ciphertrick.com/2015/02/07/live-search-using-custom-filter-in-angular-js/
        var fuse = new Fuse(records, FUZZY_SEARCH_OPTIONS);
        return fuse.search(searchString);
    };
});
