#!/bin/bash

source config.sh

MONGODB_NOHUP_RUNNING=$(ps -ef | grep "mongod --dbpath $MONGO_DB_DIRECTORY" | grep -v grep)
HAS_SERVICE_COMMAND=$(command -v service)
if [ -n "$HAS_SERVICE_COMMAND" ]; then
    HAS_MONGODB_INITD_SERVICE=$(ls /etc/init.d/mongod 2>/dev/null)
    HAS_MONGODB_SYSTEMCTL_SERVICE=$(ls /usr/lib/systemd/system/mongod.service 2>/dev/null)
    if [ -n "$HAS_MONGODB_INITD_SERVICE" ]; then
        MONGODB_SERVICE_RUNNING=$(service mongod status | grep 'is running\|active (running)')
    elif [ -n "$HAS_MONGODB_SYSTEMCTL_SERVICE" ]; then
        MONGODB_SERVICE_RUNNING=$(systemctl status mongod | grep 'is running\|active (running)')
    fi
fi
SERVER_RUNNING=$(ps -ef | grep "node ""${SERVER_SCRIPTS_DIRECTORY}""/server" | grep -v grep)
ALBUM_POLLER_RUNNING=$(ps -ef | grep "node ""${SERVER_SCRIPTS_DIRECTORY}""/albumPoller" | grep -v grep)

# If all necessary ingredients are running successfully, nothing to do
if [ -n "$SERVER_RUNNING" ] && [ -n "$ALBUM_POLLER_RUNNING" ] && { [ -n "$MONGODB_NOHUP_RUNNING" ] || [ -n "$MONGODB_SERVICE_RUNNING" ]; }; then
    echo -e "${GREEN}Shelf already running${RESET}"
    exit 0
fi

./cleanLogs.sh

echo -e "\nStarting services:"

./startMongoDb.sh
startMongoProcess=$!
wait $startMongoProcess

./startServer.sh
./startAlbumPoller.sh

echo -e "\n${GREEN}SHELF IS NOW RUNNING${RESET}"
