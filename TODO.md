# TODO

## v1.1

* Improve socket communication with action codes (so there's not separate calls for Get, Add, Remove, Update, etc., just one unified call for data manipulations/retrievals).
* Light refactoring of controllers, server, and albumPoller (particularly with the page poller when iterating through records)
* [Liquid templates](https://shopify.github.io/liquid/) a la [Jekyll](https://jekyllrb.com) to reduce markup clone (will become increasingly important as more pages and media types are added)
* Consolidated and simplified configuration files. Currently there's two (one for shell scripts, the other for Javascript). This configuration file should also be available for the client to leverage (for example, obtaining the collector's name for displaying in the About page).

## v2.0

* Board games support with https://boardgamegeek.com

## v3.0

Frontend refactor to be a true Angular app with v6.