Shelf is a beautiful way to proudly display your record collection on the Internet.

1. [FAQ](#)
	* [Why use shelf?](#)
	* [Doesn't Discogs already do this?](#)
	* [Can I help?](#)
2. [Setup](#)
	* [Installation](#)
	* [How do I add my collection to Shelf?](#)
	* [Can I add new records into Shelf directly?](#)
3. [Roadmap](#)
	* [Do you plan to later support other media in Shelf?](#)
	* ["X doesn't look right in Firefox/Chrome/Opera, will you fix it?"](#)

# FAQ

## Why use shelf?

For music enthusiasts, browsing each other's collections is a delightful way to learn about the other's musical taste. There's nothing quite like swapping phones with someone and being able to bond over shared favorites and laugh together over secret guilty pleasures while we sift through each other's collections.

Since my record and digital music collections have only continued to deviate, I often wish I could share my record collection as well during those times. Ideally, this would be done with the physical collection itself, but more often than not these conversations are a surprise, and occur while away. The physical library is unreachable in these cases, and having a lovely, digital representation to look at instead is the next best thing.

## Doesn't Discogs already do this?

You're absolutely right, [Discogs](https://www.discogs.com) already has this functionality. There's one problem though: Discogs is hideous.

While Discogs is a *fantastic* data service and remains the de facto standard for tracking record collections, browsing the interface is as fun as scrolling through an Excel spreadsheet. It's cluttered with information most people couldn't care less about, leaving the music itself to be drowned out by the visual noise of pressing price, ratings, and other benign categories. It's an interface that puts all it's focus into function, leaving nothing to the form.

Not with Shelf. Since Discogs shoulders the burden of maintaining your collection's data, Shelf can instead focus on the collection itself, the "form" that Discogs chose to ignore. In this way, Shelf is __not__ a Discogs replacement, merely a supplement.

Discogs is for indexing and managing metadata about your particular pressings, Shelf is for displaying and sharing your collection with friends.

## Can I help?

Absolutely! Shelf is open source under the [MIT License](https://github.com/barrowclift/shelf/blob/master/LICENSE.md), and I'm happy to accept any poll requests that are in line with Shelf's goals.

# Setup

## Installation

See [INSTALL.md](#)

## How do I add my collection to Shelf?

Collectors already have a website to manage record collections, and that's [Discogs](https://www.discogs.com). Most record collectors already have Discog accounts all set up, and asking them to meticulously add their entire library to another service is a non-starter (especially since Shelf only needs a minor subset of the data already available in Discogs). Shelf only maintains a local MongoDB cache of some trimmed down Discogs and iTunes data, nothing created by the app itself.

## Can I add new records into Shelf directly?

When you want to add new records to Shelf, you add them to [Discogs](https://www.discogs.com) like you always have. Shelf will pick up that addition and display in within a few minutes. You cannot add records in Shelf itself, Shelf is and always will be a read-ony website powered by *other* data collection services.

# Architecture

Shelf is a webapp built with [Node.js](https://nodejs.org/en/), [MongoDB](https://www.mongodb.com), and [AngularJS](https://angularjs.org).

On the server side, Shelf as a service is managed via a suite of bash scripts for stopping/starting the various services that make up Shelf (for example, stopping/starting the [Discogs](https://www.discogs.com) album poller). To start all services, execute `./start.sh`, you can see the logs for each service in the newly created `logs` directory in the project's root directory.

`server.js` acts as the primary javascript file, and serves as the "glue" binding historic MongoDB data and newly found data from the various pollers to the client. This "glue" is by means of a cache sent via socket connections back and forth from the server and client. On startup, `server.js` will check to see if there's any existing data in MongoDB (historic data already polled by the various pollers), cache any available data in it, and pass that cache to any available clients, as necessary. From then on, `server.js` will more or less sit waiting for messages on the socket from one of the various pollers that new data has been found. Once this happens, the server will update the cache, and pass along the new objects to the client, again with a socket message.

I keep mentioning "various pollers", but currently there's only one: `albumPoller.js`. This poller hits Discogs for the provided user's collection and wishlist, and supplements that data with year of original release and album art from iTunes. This data is then saved by the poller to MongoDB, and additionally sent to `server.js` via a socket for saving to the server's cache and for the server to pass along to the client.

It might seem like a bit much for what's currently just a glorified baton pass of information from Discogs, but with this architecture all the various components (data store, collectors, cache, frontend) are all neatly separated and allow great flexibility for future changes. Not to mention, it will make adding pollers for more services a __lot__ easier down the road.

# Roadmap

## Do you plan to add support for other media collections in Shelf?

Almost certainly. Board games would be next, followed by books.

I have barely any physical movies or TV shows, so supporting CDs/DVDs/Blu-Rays in Shelf would unfortunately provide me practically no added value. If you want this functionality, feel free to write it yourself and I'll consider the pull request. However, be sure there's an easy way to disable the "Movies" and "TV Show" menus from appearing altogether for those that don't have those kinds of collections.

I have no plans to display digital collections. [Apple Music](https://www.apple.com/music/) and [Plex](https://www.plex.tv) do just fine.

## "X doesn't look right in Firefox/Chrome/Opera, will you fix it?"

I exclusively use Safari with hidden scroll bars, so I have no interest in going out of my way to support other browsers and configurations for this project. If you care, feel free to make a pull request with the necessary changes. However, changes that result in any Safari regressions will be rejected.
