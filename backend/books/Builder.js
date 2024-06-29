"user strict";

// DEPENDENCIES
// ------------
// External

// Local
import overrides from "../resources/overrides.json" with { type: "json" };
import util from "../common/util.js";


// CONSTANTS
// ---------
const ID_FLAG = "book";

const DEFAULT_AUTHOR = "Unknown"; // book.authors.author
const DEFAULT_COVER_ART_FILE_PATH = "/images/books/UNTITLED/missing-artwork.png";
const DEFAULT_COVER_ART_URL = "https://goodreads.com"; // book.[|small_|large_]image_url
const DEFAULT_GOODREADS_AUTHOR_ID = 0; // book.authors.author.id
const DEFAULT_GOODREADS_BOOK_ID = 0; // id["_"]
const DEFAULT_GOODREADS_URL = "https://goodreads.com"; // book.link
const DEFAULT_IN_WISHLIST = false;
const DEFAULT_ISBN = "0000000000"; // book.isbn
const DEFAULT_ISBN13 = "0000000000000"; // book.isbn13
const DEFAULT_NUMBER_OF_PAGES = 0; // book.num_pages
const DEFAULT_PUBLICATION_DAY = 0; // book.publication_day
const DEFAULT_PUBLICATION_MONTH = 0; // book.publication_month
const DEFAULT_PUBLICATION_YEAR = 0; // book.publication_year
const DEFAULT_PUBLISHER = "Unknown"; // book.publisher
const DEFAULT_RATING = -1; // review.rating
const DEFAULT_TITLE = "Untitled"; // book.title


/**
 * Builder to assist converting Goodreads' book object into Shelf's own, internal
 * book object. Besides ignoring fields Shelf doesn't care about and choosing
 * saner names and flat organization, there are some nice transformations and data
 * manipulations that are handled by this builder as well (for example, mapping "noisy"
 * titles or incorrect artist names to the desired overrides, when appropriate).
 *
 * Example Shelf book:
 *
 *     {
 *         "_id" : "book53797071",
 *         "addedOn" : 1562437390088,
 *         "author" : "Walter Isaacson",
 *         "coverArtFilePath" : "/images/books/book53797071/book-cover-art.jpg",
 *         "coverArtUrl" : "https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1511288482i/11084145._SX98_.jpg",
 *         "goodreadsAuthorId" : "7111",
 *         "goodreadsUrl" : "https://www.goodreads.com/book/show/11084145-steve-jobs",
 *         "inWishlist" : false,
 *         "isbn" : "1451648537",
 *         "isbn13" : "9781451648539",
 *         "numberOfPages" : "656",
 *         "publicationDate" : 1319428800000,
 *         "publisher" : "Simon & Schuster",
 *         "rating" : -1,
 *         "shortenedTitle" : "Steve Jobs",
 *         "sortAuthor" : "WALTER ISAACSON",
 *         "sortTitle" : "STEVE JOBS",
 *         "title" : "Steve Jobs"
 *     }
 *
 */
export default class Builder {

    /**
     * Sets all "settable" fields for the pending new book to it's default
     * values.
     */
    constructor() {
        this._id = DEFAULT_GOODREADS_BOOK_ID;
        this.author = DEFAULT_AUTHOR;
        this.coverArtFilePath = DEFAULT_COVER_ART_FILE_PATH;
        this.coverArtUrl = DEFAULT_COVER_ART_URL;
        this.goodreadsAuthorId = DEFAULT_GOODREADS_AUTHOR_ID;
        this.goodreadsUrl = DEFAULT_GOODREADS_URL;
        this.inWishlist = DEFAULT_IN_WISHLIST;
        this.isbn = DEFAULT_ISBN;
        this.isbn13 = DEFAULT_ISBN13;
        this.numberOfPages = DEFAULT_NUMBER_OF_PAGES;
        this.publicationDay = DEFAULT_PUBLICATION_DAY;
        this.publicationMonth = DEFAULT_PUBLICATION_MONTH;
        this.publicationYear = DEFAULT_PUBLICATION_YEAR;
        this.publisher = DEFAULT_PUBLISHER;
        this.rating = DEFAULT_RATING;
        this.sortAuthor = util.getSortText(DEFAULT_AUTHOR);
        this.sortTitle = util.getSortText(DEFAULT_TITLE);
        this.shortenedTitle = util.getMainPart(DEFAULT_TITLE);
        this.title = DEFAULT_TITLE;
    }

    /**
     * ==============
     * PUBLIC METHODS
     * ==============
     */

    /**
     * Builds and returns the Shelf book. Book attributes not set in the
     * builder by the caller prior to this call will use their default values.
     *
     * @return book Shelf book appropriate for wider Shelf use. Can be written
     *              to Mongo as-is.
     */
    build() {
        let now = Date.now();

        let publicationDate = now;
        if (this.publicationYear != 0
         && this.publicationMonth != 0
         && this.publicationDay != 0) {
            publicationDate = new Date(this.publicationYear, this.publicationMonth-1, this.publicationDay).getTime();
        }

        return {
            _id : this._id,
            addedOn : now,
            author : this.author,
            coverArtFilePath : this.coverArtFilePath,
            coverArtUrl : this.coverArtUrl,
            goodreadsAuthorId : this.goodreadsAuthorId,
            goodreadsUrl : this.goodreadsUrl,
            inWishlist : this.inWishlist,
            isbn : this.isbn,
            isbn13 : this.isbn13,
            numberOfPages : this.numberOfPages,
            publicationDate : publicationDate,
            publisher : this.publisher,
            rating : this.rating,
            shortenedTitle : this.shortenedTitle,
            sortAuthor : this.sortAuthor,
            sortTitle : this.sortTitle,
            title : this.title
        };
    }

    setId(id) {
        this._id = ID_FLAG + id;
    }
    setAuthor(author) {
        if (overrides.books.replacements.authors[author]) {
            this.author = overrides.books.replacements.authors[author];
        } else {
            this.author = author;
        }
        this.author = util.getMainPart(this.author);
        this.sortAuthor = util.getSortText(this.author);
    }
    setCoverArtFilePath(coverArtFilePath) {
        this.coverArtFilePath = coverArtFilePath;
    }
    setCoverArtUrl(coverArtUrl) {
        if (coverArtUrl.indexOf("i.gr-assets.com") != -1) {
            /**
             * For https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1511288482l/11084145._Sxxxx_.jpg
             * style images from Goodreads, replace the `xxxx`
             * following the `._S` with `Y475`` for the "large"
             * image they insist on hiding from us.
             */
            let startOfReplacementIndex = coverArtUrl.lastIndexOf("._S") + 3; // 3 = length of "._S"
            if (startOfReplacementIndex > 0) {
                coverArtUrl = coverArtUrl.substr(0, startOfReplacementIndex) + "Y475_.jpg";
            }
        } else if (coverArtUrl.indexOf("images.gr-assets.com") != -1) {
            /**
             * For https://images.gr-assets.com/books/1511288482m/11084145.jpg
             * style images from Goodreads, replace the "m" or "s" with "l" to
             * get the large image.
             */
            let lastSlashIndex = coverArtUrl.lastIndexOf("/");
            let sizeCharacterIndex = lastSlashIndex - 1;
            if (sizeCharacterIndex > 0) {
                coverArtUrl = coverArtUrl.substr(0, sizeCharacterIndex) + "l" + coverArtUrl.substr(sizeCharacterIndex + 1);
            }
        }
        this.coverArtUrl = coverArtUrl;
    }
    setGoodreadsAuthorId(goodreadsAuthorId) {
        this.goodreadsAuthorId = goodreadsAuthorId;
    }
    setGoodreadsUrl(goodreadsUrl) {
        this.goodreadsUrl = goodreadsUrl;
    }
    setInWishlist(inWishlist) {
        this.inWishlist = inWishlist;
    }
    setIsbn(isbn) {
        this.isbn = isbn;
    }
    setIsbn13(isbn13) {
        this.isbn13 = isbn13;
    }
    setNumberOfPages(numberOfPages) {
        this.numberOfPages = numberOfPages;
    }
    setPublicationDay(publicationDay) {
        this.publicationDay = publicationDay;
    }
    setPublicationMonth(publicationMonth) {
        this.publicationMonth = publicationMonth;
    }
    setPublicationYear(publicationYear) {
        this.publicationYear = publicationYear;
    }
    setPublisher(publisher) {
        this.publisher = publisher;
    }
    setRating(rating) {
        this.rating = rating;
    }
    setTitle(title) {
        title = title.replace(/®/g, '');

        /**
         * There are sometimes cases where the "true" title of a book isn't the
         * title used in common parlance. Here's where we apply user preferences
         * for those cases over the "true" title.
         */
        if (overrides.books.replacements.titles[title]) {
            this.title = overrides.books.replacements.titles[title];
        } else {
            this.title = title;
        }

        this.shortenedTitle = util.getMainPart(this.title);
        this.sortTitle = util.getSortText(this.shortenedTitle);
    }

}
