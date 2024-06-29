#!/bin/bash

export ADMIN_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
source "${ADMIN_DIR}"/init.sh

MONGODB_NOHUP_RUNNING=$(ps -ef | grep "mongod --dbpath ""$MONGO_DB" | grep -v grep)
HAS_SERVICE_COMMAND=$(command -v service)
HAS_BREW_COMMAND=$(command -v brew)
if [ -n "$HAS_SERVICE_COMMAND" ]; then
    HAS_MONGODB_INITD_SERVICE=$(ls /etc/init.d/mongod 2>/dev/null)
    HAS_MONGODB_SYSTEMCTL_SERVICE=$(ls /usr/lib/systemd/system/mongod.service 2>/dev/null)
    if [ -n "$HAS_MONGODB_INITD_SERVICE" ]; then
        MONGODB_SERVICE_RUNNING=$(service mongod status | grep 'is running\|active (running)')
    elif [ -n "$HAS_MONGODB_SYSTEMCTL_SERVICE" ]; then
        MONGODB_SERVICE_RUNNING=$(systemctl status mongod | grep 'is running\|active (running)')
    fi
elif [ -n "$HAS_BREW_COMMAND" ]; then
    HAS_MONGODB_TAPPED=$(brew services list | grep "mongodb-community" 2>/dev/null) 
    if [ -n "$HAS_MONGODB_TAPPED" ]; then
        MONGODB_SERVICE_RUNNING=$(brew services info mongodb-community | grep "PID" 2>/dev/null)
    else
        echo -e "${RED}You don't seem to have MongoDB available through brew or systemctl${RESET}"
        exit 1
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
        "${ADMIN_DIR}"/startMongoDb.sh
        starterProcess=$!
        wait $starterProcess
    fi

    node "${ADMIN_DIR}"/mongoCleaner.js "clean" > "${LOGS_DIR}"/clean-mongodb.log 2>&1 &
    cleanerProcess=$!
    wait $cleanerProcess

    echo "\"shelfDb\" cleaned"

    if [ $START_THEN_STOP -eq 1 ]; then
        "${ADMIN_DIR}"/stopMongoDb.sh
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
    fi
fi

exit 0