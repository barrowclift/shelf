#!/bin/bash

source config.sh

if [ ! -d "$LOG_DIRECTORY" ]; then
    mkdir "$LOG_DIRECTORY";
fi

ALBUM_POLLER_RUNNING=$(ps -ef | grep "node ""${SERVER_SCRIPTS_DIRECTORY}""/albumPoller" | grep -v grep)

if [ -n "$ALBUM_POLLER_RUNNING" ]; then
    echo -e "Album poller already running"
else
    #pm2 --silent start shelf-albumPoller
    pm2 --log "${LOG_DIRECTORY}"/albumPoller.log --name shelf-albumPoller --silent start "${SERVER_SCRIPTS_DIRECTORY}"/albumPoller.js
    #nohup node server/albumPoller.js > "$LOG_DIRECTORY"/albumPoller.log 2>&1 &
    SUCCESS=$?
    
    if [ $SUCCESS -eq 0 ]; then
        echo -e "${GREEN}Album poller started${RESET}"
    else
        echo -e "${RED}Album poller failed to start${RESET}"
    fi
fi
