#!/bin/bash

source config.sh

# MONGODB_COMMAND=$(ps -ef | grep "mongod --dbpath $MONGO_DB_DIRECTORY" | grep -v grep)
MONGODB_COMMAND=$(ps -ef | grep "mongod" | grep -v grep)
if command -v service; then
	MONGODB_SERVICE=$(service mongod status | grep -F "is running")
fi
SERVER=$(ps -ef | grep "node server/server.js" | grep -v grep)
ALBUM_POLLER=$(ps -ef | grep "node server/albumPoller.js" | grep -v grep)

if [ -z "$SERVER" ] && [ -z "$ALBUM_POLLER" ] && { [ -z "$MONGODB_COMMAND" ] && [ -z "$MONGODB_SERVICE" ]; }; then
	echo -e "${RED}Shelf is not running${RESET}"
	exit 0
fi

echo "Stopping services:"

./stopMongoDb.sh
./stopServer.sh
./stopAlbumPoller.sh

echo -e "\n${RED}SHELF HAS BEEN STOPPED${RESET}"
