#!/bin/bash

source config.sh

MONGODB_COMMAND_RUNNING=$(ps -ef | grep "mongod --dbpath $MONGO_DB_DIRECTORY" | grep -v grep)
HAS_SERVICE_COMMAND=$(command -v service)
if [ -n "$HAS_SERVICE_COMMAND" ]; then
    HAS_MONGODB_SERVICE=$(ls /etc/init.d/mongod 2>/dev/null)
    if [ -n "$HAS_MONGODB_SERVICE" ]; then
        MONGODB_SERVICE_RUNNING=$(service mongod status | grep 'is running\|active (running)')
    fi
fi
SERVER_RUNNING=$(ps -ef | grep "node server/server.js" | grep -v grep)
ALBUM_POLLER_RUNNING=$(ps -ef | grep "node server/albumPoller.js" | grep -v grep)

# If all necessary ingredients aren't running, then there's nothing to stop
if [ -z "$SERVER_RUNNING" ] && [ -z "$ALBUM_POLLER_RUNNING" ] && { [ -z "$MONGODB_COMMAND_RUNNING" ] && [ -z "$MONGODB_SERVICE_RUNNING" ]; }; then
	echo -e "${RED}Shelf is not running${RESET}"
	exit 0
fi

echo "Stopping services:"

./stopMongoDb.sh
./stopServer.sh
./stopAlbumPoller.sh

echo -e "\n${RED}SHELF HAS BEEN STOPPED${RESET}"
