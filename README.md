<h1><img height="25" src="https://raw.githubusercontent.com/barrowclift/shelf/master/frontend/static/images/logo/logo.png" /> Shelf</h1>

### Beautifully display your library on the Internet

<picture>
  <source type="image/webp" srcset="https://cargo.barrowclift.me/projects/code/shelf/shelf-promo.webp">
  <img type="image/jpeg" alt="Promotional screenshots of Shelf, demonstrating both Light and Dark Mode" title="Promotional screenshots of Shelf, demonstrating both Light and Dark Mode" src="https://cargo.barrowclift.me/projects/code/shelf/shelf-promo.jpg">
</picture>

You can download the latest release [here](https://github.com/barrowclift/shelf/releases/latest)

1. [FAQ](#faq)
    * [Why use shelf?](#why-use-shelf)
    * [Doesn’t Discogs & BoardGameGeek already do this?](#doesnt-discogs--boardgamegeek-already-do-this)
    * [How does Shelf handle different issues of the same entity?](#how-does-shelf-handle-different-issues-of-the-same-entity)
    * [Can I help?](#can-i-help)
2. [Setup](#setup)
    * [Installation](#installation)
    * [v2 Migration](#v2-migration)
    * [v3 Migration](#v3-migration)
    * [How do I add my library to Shelf?](#how-do-i-add-my-library-to-shelf)
    * [How do I sync my Discogs account with Shelf to display my records?](#how-do-i-sync-my-discogs-account-with-shelf-to-display-my-records)
    * [How do I sync my BoardGameGeek account with Shelf to display my games?](#how-do-i-sync-my-boardgamegeek-account-with-shelf-to-display-my-games)
    * [Can I add new entities into Shelf directly?](#can-i-add-new-entities-into-shelf-directly)
    * [What if I only want to display a particular collection, like board games?](#what-if-i-only-want-to-display-a-particular-collection-like-board-games)
3. [Architecture](#architecture)
3. [Roadmap](#roadmap)
    * [Do you plan to later support other media in Shelf, like video games, books, and movies?](#do-you-plan-to-later-support-other-media-in-shelf-like-video-games-books-and-movies)
    * ["X doesn't look right in Firefox/Chrome/Opera, will you fix it?"](#x-doesnt-look-right-in-firefoxchromeopera-will-you-fix-it)

# FAQ

## Why use shelf?

Browsing a friend's library is a delightful way to gain insight into their taste and life experiences. There's nothing quite like bonding over shared favorites or laughing over guilty pleasures while sifting through someone else's library of music and board games. However, I often wished my library could be presented digitally to expand these experiences beyond their physical confines, allowing me to share and discuss with new friends on the go or even curious individuals on the internet.

## Doesn’t Discogs & BoardGameGeek already do this?

You're absolutely right, [Discogs](https://www.discogs.com) and [BoardGameGeek](https://boardgamegeek.com) already have this functionality. However these experiences are suboptimal in a few key areas: [Discogs](https://www.discogs.com) and [BoardGameGeek](https://boardgamegeek.com) are cumbersome to navigate, and tend too close towards [utilitarian and brutalist](https://en.wikipedia.org/wiki/Brutalist_architecture) in their design for my taste. Not to mention—by nature of these services being separate entities—your library becomes unnaturally siphoned across numerous platforms, which makes sharing your whole library cumbersome (better remember how to find your account if you're sharing on a device other than your own!)

Shelf addresses these shortcomings; since these services shoulder the burden of maintaining your library *data*, Shelf is free to instead focus on the *presentation*, the "form" that these services either chose not to or failed to address. In this way, Shelf is **not** a [Discogs](https://www.discogs.com) or [BoardGameGeek](https://boardgamegeek.com) replacement, rather it's an optional supplement.

## How does Shelf handle different issues of the same entity?

Each of Shelf's data sources already perfectly serve categorizing reissues, remasters, and other such editions, and is thus not Shelf's focus. Shelf is about the music and board games themselves, not the nitty gritty details about particular issues. Thus, Shelf consolidates "duplicates" into just a single abstraction of the thing itself. For example, if you have an original 1966 pressing of *Pet Sounds* by The Beach Boys as well as [Analogue Production's 2015 remaster](https://store.acousticsounds.com/d/95586/The_Beach_Boys-Pet_Sounds-200_Gram_Vinyl_Record), Shelf will instead just display one "Pet Sounds" record to represent you own *Pet Sounds*, since both pressings are "the same" album. The same applies for board games.

## Can I help?

Absolutely! Shelf is open source under the [MIT License](https://github.com/barrowclift/shelf/blob/master/LICENSE.md), and I'm happy to accept any pull requests that are in line with Shelf's goals.

# Setup

## Installation

See [INSTALL.md](https://github.com/barrowclift/shelf/blob/master/INSTALL.md).

## v2 Migration

Migrating from Shelf v1 is easy; all you need to do is stop your currently running instance and start up a new instance with Shelf v2.0 or newer. A new version of the `records` database will be created and populated alongside your original v1.0 version, so rollbacks are as simple as stopping the service and starting your old version back up again.

## v3 Migration

With [Goodreads' API deprecation](https://joealcorn.co.uk/blog/2020/goodreads-retiring-API), "Books" support first released in v2 is no longer supported and will remain so until a suitable Goodreads replacement is found.

Otherwise, migrating from v2 to v3 is easy; the few data model changes within are supplemental, so all you need to do to upgrade it stop your current instance, upgrade to the v3 release, then start back up again.

## How do I add my library to Shelf?

Since [Discogs](https://www.discogs.com) and [BoardGameGeek](https://boardgamegeek.com) are arguably the most popular services for their respective media, odds are you already have accounts and collections maintained in these services. Asking people to meticulously add their entire library to a whole new service alongside those existing ones is a non-starter (especially since Shelf only needs a minor subset of the data freely available in these services). Thus, Shelf instead stays in sync with your accounts in these services; anything you add or remove there will automatically be reflected in Shelf. Shelf only maintains a local [MongoDB](https://www.mongodb.com) cache of some trimmed-down data from these services, no data is actually entered into Shelf by the user themselves.

## How do I sync my Discogs account with Shelf to display my records?

You will need to make the following changes to Shelf's properties file at `backend/resources/shelf.properties`:

1. Set your Discogs username in `discogs.user.id`.
2. You'll need to generate a [Discogs](https://www.discogs.com) personal access token, which you can do at [the following link](https://www.discogs.com/settings/developers). Copy and paste that token in `discogs.user.token`.

Note that only records in your collection will be fetched for your Shelf collection. Records intended to show in your Shelf wishlist should instead be present only in your Discogs wishlist.

## How do I sync my BoardGameGeek account with Shelf to display my games?

You will need to make the following changes to Shelf's properties file at `backend/resources/shelf.properties`:

1. Set your [BoardGameGeek](https://boardgamegeek.com) username in `boardgamegeek.user.id`.

Note that only board games both in your collection and the "Own" checkbox checked will be fetched for your Shelf collection. Board games intended to show in your Shelf wishlist must also be in your collection but with the "Wishlist" checkbox checked.

## Can I add new entities into Shelf directly?

As mentioned [earlier](#how-do-i-add-my-library-to-shelf), if you want to add new items to Shelf, all you need to do is add them to your account for the respective service like you normally would. Shelf will pick up and reflect that change within a couple minutes. You cannot add or remove items in Shelf itself, Shelf is and will always remain a read-only website powered by other data services.

## What if I only want to display a particular collection, like board games?

By default, records and board games are all displayed in Shelf's menu. However, you can easily disable them via the following properties in `backend/resources/shelf.properties`:

```
boardgame.shelf.enabled=true
record.shelf.enabled=true
```

# Architecture

Shelf is a webapp built with [Node.js](https://nodejs.org/en/), [MongoDB](https://www.mongodb.com), and [Vue.js](https://vuejs.org). For the complete list of third-party libraries and tools used, please see Shelf's [Acknowledgements page](https://shelf.barrowclift.me/acknowledgements).

Shelf is run server-side from a single entry point, `admin/main.js`, which is started or stopped via `admin/start.sh` or `admin/stop.sh`, respectively. Records and board games are managed independently in their own, modular directories, so adding new external data sources or media types is a breeze.

Client-side, Shelf leverages [Liquid](https://shopify.github.io/liquid/) for its HTML templates.

# Roadmap

## Do you plan to later support other media in Shelf, like video games, books, and movies?

Additional _physical_ media types are likely to come sometime down the road. I'm open to pull requests and suggestions.

I have no plans for Shelf to display digital content. [Apple Music](https://www.apple.com/music/) and [Plex](https://www.plex.tv) do just fine.

## "X doesn't look right in Firefox/Chrome/Opera, will you fix it?"

Feel free to open an issue or make a pull request with the necessary changes, I'll be happy to review it! However, please note that any changes that result in Safari regressions will be rejected.