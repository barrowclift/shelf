#!/bin/bash

source config.sh

MONGODB_COMMAND=$(ps -ef | grep "mongod --dbpath $MONGO_DB_DIRECTORY" | grep -v grep)
if command -v service; then
	MONGODB_SERVICE=$(service mongod status | grep -F "is running")
fi
SERVER=$(ps -ef | grep "node server/server.js" | grep -v grep)
ALBUM_POLLER=$(ps -ef | grep "node server/albumPoller.js" | grep -v grep)

if [ -n "$SERVER" ] && [ -n "$ALBUM_POLLER" ] && { [ -n "$MONGODB_COMMAND" ] || [ -n "$MONGODB_SERVICE" ]; }; then
	echo -e "${GREEN}Shelf already running${RESET}"
	exit 0
fi

./cleanLogs.sh

echo -e "\nStarting services:"

./startMongoDb.sh
./startServer.sh
./startAlbumPoller.sh

echo -e "\n${GREEN}SHELF IS NOW RUNNING${RESET}"