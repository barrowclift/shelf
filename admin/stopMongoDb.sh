#!/bin/bash

export ADMIN_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
source "${ADMIN_DIR}"/init.sh

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

# If either way of running MongoDB is active, stop MongoDB
if [ -n "$MONGODB_NOHUP_RUNNING" ] || [ -n "$MONGODB_SERVICE_RUNNING" ]; then
    if [ -n "$HAS_MONGODB_INITD_SERVICE" ]; then
        sudo service mongod stop
        SUCCESS=$?
    elif [ -n "$HAS_MONGODB_SYSTEMCTL_SERVICE" ]; then
        sudo systemctl stop mongod
        SUCCESS=$?
    else
        ps -ef | grep "mongod --dbpath $MONGO_DB" | grep -v grep | awk '{print $2}' | xargs kill -9
        SUCCESS=$?
    fi

    if [ $SUCCESS -eq 0 ]; then
        echo -e "${GREEN}MongoDB stopped${RESET}"
        exit 0
    else
        echo -e "${RED}MongoDB failed to stop${RESET}"
        exit 1
    fi
else
    echo "MongoDB is not running"
    exit 0
fi

