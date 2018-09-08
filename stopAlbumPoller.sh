#!/bin/bash

source config.sh

ALBUM_POLLER_RUNNING=$(ps -ef | grep "node ""${SERVER_SCRIPTS_DIRECTORY}""/albumPoller" | grep -v grep)

if [ -n "$ALBUM_POLLER_RUNNING" ]; then
    pm2 --silent stop shelf-albumPoller
    #ps -ef | grep "node server/albumPoller.js" | grep -v grep | awk '{print $2}' | xargs kill -9
    SUCCESS=$?

    if [ $SUCCESS -eq 0 ]; then
        echo -e "${GREEN}Album poller stopped${RESET}"
    else
        echo -e "${RED}Album poller failed to stop${RESET}"
    fi
else
    echo -e "Album poller is not running"
fi

