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

# If neither way of running MongoDB is running, start MongoDB
if [ -z "$MONGODB_NOHUP_RUNNING" ] && [ -z "$MONGODB_SERVICE_RUNNING" ]; then
    if [ ! -d "$MONGO_DB_DIRECTORY" ]; then
        mkdir -p "$MONGO_DB_DIRECTORY"
    fi
    if [ ! -d "$LOG_DIRECTORY" ]; then
        mkdir "$LOG_DIRECTORY";
    fi

    rm "$LOG_DIRECTORY"/mongodb.log 2> /dev/null

    if [ -n "$HAS_MONGODB_INITD_SERVICE" ]; then
        sudo service mongod start
        SUCCESS=$?
    elif [ -n "$HAS_MONGODB_SYSTEMCTL_SERVICE" ]; then
        sudo systemctl start mongod
        SUCCESS=$?
    else    
        nohup mongod --dbpath "$MONGO_DB_DIRECTORY" > "$LOG_DIRECTORY"/mongodb.log 2>&1 &
        SUCCESS=$?
    fi
    
    if [ $SUCCESS -eq 0 ]; then
        echo -e "${GREEN}MongoDB started${RESET}"
    else
        echo -e "${RED}MongoDB failed to start${RESET}"
    fi
else
    echo -e "${GREEN}MongoDB already running${RESET}"
fi

