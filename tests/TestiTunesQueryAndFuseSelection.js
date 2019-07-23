let request = require("request-promise");
let Fuse = require("fuse.js"); // For fuzzy searching

function sanitizeTextForiTunesApi(title) {
    let sanitizedTitle = title.replace(/ /g, "+");
    return sanitizedTitle;
}

function createiTunesSearchUrl(text) {
    return encodeURI("https://itunes.apple.com/search?entity=album&limit=100&term=" + sanitizeTextForiTunesApi(text));
}

function includeHeaders(body, response, resolveWithFullResponse) {
    return {
        headers: response.headers,
        data: body
    };
};

async function main() {
    let data = {
        method: "GET",
        url: createiTunesSearchUrl("Jump!" + " " + "Van Dyke Parks"),
        timeout: 5000,
        headers: {
            "User-Agent": "Shelf v2 Testing, https://github.com/barrowclift/shelf",
            "Content-Type": "application/json"
        },
        transform: includeHeaders,
        json: true
    };
    console.log(data.url)
    let response = await request.get(data);
    if (!response.headers["content-type"].includes("text/javascript")) {
        throw "Unexpected server response, got Content-Type=" + response.headers["content-type"] + " instead of \"text/javascript\"";
    } else {
        let largeAlbumArtUrl = null;
        let yearOfOriginalRelease = null;

        let records = response.data;
        if (records.resultCount == 0) {
            console.log("No results from iTunes");
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
            let results = fuse.search("Jump!");

            fuzzySearchOptions.keys = ["collectionName"];
            fuse = new Fuse(results, fuzzySearchOptions);
            results = fuse.search("Van Dyke Parks");

            if (results.length == 0) {
                log.warn("Got results back from iTunes for title=" + title + ", but they were all deemed false positives by Fuse.js:");
                log.warn(records);
            } else {
                console.log(results[0])
            }
        }
        // Using ES6 array deconstructing to return two variables in the resolve
        return [largeAlbumArtUrl, yearOfOriginalRelease];
    }
}

main()