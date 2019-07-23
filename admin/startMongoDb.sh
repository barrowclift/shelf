#!/bin/bash

export ADMIN_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
source ${ADMIN_DIR}/init.sh

MONGODB_NOHUP_RUNNING=$(ps -ef | grep "mongod --dbpath ""$MONGO_DB" | grep -v grep)
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
    if [ ! -d "$MONGO_DB" ]; then
        mkdir -p "$MONGO_DB"
    fi
    if [ ! -d "$LOGS_DIR" ]; then
        mkdir "$LOGS_DIR"
    fi

    rm "$LOGS_DIR"/mongodb.log 2> /dev/null

    if [ -n "$HAS_MONGODB_INITD_SERVICE" ]; then
        sudo service mongod start
        SUCCESS=$?
    elif [ -n "$HAS_MONGODB_SYSTEMCTL_SERVICE" ]; then
        sudo systemctl start mongod
        SUCCESS=$?
    else
        nohup mongod --dbpath "$MONGO_DB" > "$LOGS_DIR"/mongodb.log 2>&1 &
        SUCCESS=$?
    fi

    if [ $SUCCESS -eq 0 ]; then
        echo -e "${GREEN}MongoDB started${RESET}"
        exit 0
    else
        echo -e "${RED}MongoDB failed to start${RESET}"
        exit 1
    fi
else
    echo "MongoDB already running"
    exit 0
fi

