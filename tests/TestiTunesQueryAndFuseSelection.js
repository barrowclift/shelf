let fetch = require("node-fetch");
let Fuse = require("fuse.js"); // For fuzzy searching
let Logger = require("../backend/common/Logger");

let log = new Logger("TestiTunesQueryAndFuseSelection");

function sanitizeTextForiTunesApi(title) {
    let sanitizedTitle = title.replace(/ /g, "+");
    return sanitizedTitle;
}

function createiTunesSearchUrl(text) {
    return encodeURI("https://itunes.apple.com/search?entity=album&limit=100&term=" + sanitizeTextForiTunesApi(text));
}

async function main() {
    const title = "Band On The Run";
    const artist = "Wings";
    const url = createiTunesSearchUrl(`${title} ${artist}`);
    let options = {
        method: "GET",
        timeout: 5000,
        headers: {
            "User-Agent": "Shelf v2 Testing, https://github.com/barrowclift/shelf",
            "Content-Type": "application/json"
        }
    };
    log.info(url);
    let response = await fetch(url, options);
    if (!response.headers.get("content-type").includes("text/javascript")) {
        throw "Unexpected server response, got Content-Type=" + response.headers["content-type"] + " instead of \"text/javascript\"";
    } else {
        let largeAlbumArtUrl = null;
        let yearOfOriginalRelease = null;

        let records = await response.json();
        if (records.resultCount == 0) {
            log.warn("main", "No results from iTunes");
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
            let results = fuse.search(title);

            fuzzySearchOptions.keys = ["item.collectionName"];
            fuse = new Fuse(results, fuzzySearchOptions);
            results = fuse.search(artist);

            if (results.constructor === Array && results.length === 0) {
                log.warn("main", "Got results back from iTunes for title=" + title + ", but they were all deemed false positives by Fuse.js:");
                log.warn("main", records);
            } else {
                log.info("Found match:");
                log.info(results);
            }
        }
        // Using ES6 array deconstructing to return two variables in the resolve
        return [largeAlbumArtUrl, yearOfOriginalRelease];
    }
}

main()