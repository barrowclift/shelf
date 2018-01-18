# Architecture

The correct way to achive this is with a serer that has a (minutely? hourly? daily?) process that polls Discogs for a given user and displays their collection and wishlist items for the client in a form nice, responsive webapp.

There's a few ways to do this. Will this (minutely? hourly? daily?) generate static HTML? Save to a local database that the client dynamically polls from? Or can there just be a client that polls discogs on startup and dynamically builds the frontend each time?

## Options

1. __Client-only__- The client will poll Discogs on load and dynamically build the frontend.
	* __Pros__: Quick and easily to build, can be served on Github for free. Virutally no administration required.
	* __Cons__: Potentially very slow, rebuilding that frontend every time and not caching those pages is extremely inefficient.
2. __Server/Client building static HTML__- The client will poll Discogs on a schedule and completely rebuild static HTML files every time.
	* __Pros__: Moderatly easy to build (no database to maintain).
	* __Cons__: A lot of wasted disk writes, regenerating the entire HTML statically every time is really inelegant. Requires being deployed to the droplet
3. __Server/Client dynamically serving HTML__- The client will poll Discogs on a schedule and maintain a lightweight MongoDB for the client to use on load.
	* __Pros__: Flexible, elegant.
	* __Cons__: A lot of work, needs to be deployed to the droplet.

Option 3 is by far the superior option.

## Approach

* shelf.barrowclift.me should mask redirect to the droplet url.
* Utilize node.js and MongoDB on the server, have a node server process that runs every hour polling all sources (to start, just MongoDB), and updates the database accordingly.
* Something needs to be done about album art, may need to poll a different service for art that doesn't suck

Additionally, everything should be based around media type (Records, Movies, TV Shows, Books, Games). We're going to be starting with Records. For each media type, there should be a collection and a wishlist tab.