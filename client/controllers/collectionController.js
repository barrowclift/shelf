const SEARCH_OPTIONS = {
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

    var socket = io.connect("http://localhost:10800");
    socket.on("connect", function() {
        logger.logInfo(CLASS_NAME, "Client has connected to the server");
    });
    socket.on("disconnect", function() {
        logger.logInfo(CLASS_NAME, "The client has disconnected");
    });

    // Request the server send the client the "records" cache
    socket.emit("recordCollection");
    // Listen for the server response to the "records" cache request
    socket.on("recordCollection", function(data) {
		// If data's an array, assume they're sending us ALL records
		if (data.constructor === Array) {
			console.log(data);
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
    socket.emit("getPollingStatus");
    // Listen for the server to tell us the poller has finished so we know to hide the spinner
    socket.on("pollingStatus", function(pollingStatus) {
    	logger.logInfo(CLASS_NAME, "The client sent collection polling status, refreshing frontend spinner if necessary");
    	var priorValue = $scope.hideLoadingSpinner;
    	$scope.hideLoadingSpinner = pollingStatus.records.collectionDone;
    	if (priorValue != $scope.hideLoadingSpinner) {
    		$scope.$apply();
    	}
    });

	$scope.artistNameAndYearOfRelease = function(recordA, recordB) {
		if ($scope.searchBox) {
			return 0;
		}

        if (recordA.value.sortArtist == recordB.value.sortArtist) {
			if (recordA.value.yearOfOriginalPressing < recordB.value.yearOfOriginalPressing) {
				return 1;
			} else if (recordA.value.yearOfOriginalPressing > recordB.value.yearOfOriginalPressing) {
				return -1;	
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
		var fuse = new Fuse(records, SEARCH_OPTIONS);
		return fuse.search(searchString);
	};
});
