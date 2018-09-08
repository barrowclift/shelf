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

# MongoDB may not be currently running. If that's the case, we want to briefly start
# it for the cleaning process, then immediately turn it off again
START_THEN_STOP=0
if [ -z "$MONGODB_NOHUP_RUNNING" ] && [ -z "$MONGODB_SERVICE_RUNNING" ]; then
    START_THEN_STOP=1
fi

function cleanMongoDb {
    if [ $START_THEN_STOP -eq 1 ]; then
        ./startMongoDb.sh
        starterProcess=$!
        wait $starterProcess
    fi

    node "$SERVER_SCRIPTS_DIRECTORY"/mongoCleaner.js > "$LOG_DIRECTORY"/clean-mongodb.log 2>&1 &
    cleanerProcess=$!
    wait $cleanerProcess

    echo -e "${GREEN}\"shelfDb\" cleaned${RESET}"

    if [ $START_THEN_STOP -eq 1 ]; then
        ./stopMongoDb.sh
    fi
}

if [[ $1 == 1 ]] # If 1 is provided, skip safety prompt and just do it.
then
    cleanMongoDb
else
    # Confirm if they really want to clean MongoDB's data store
    echo "You are about to drop all relevant collections in \"shelfDb\", this CANNOT be undone."
    read -p "Are you absolutely sure you want to proceed? (y/n): " -r
    if [[ $REPLY =~ ^[Yy]$ ]]
    then
        cleanMongoDb
    else
        echo -e "${RED}\"shelfDb\" cleaned${RESET}"
    fi
fi

