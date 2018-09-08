#!/bin/bash

source config.sh

if [ ! -d "$LOG_DIRECTORY" ]; then
    mkdir "$LOG_DIRECTORY";
fi

SERVER_RUNNING=$(ps -ef | grep "node ""${SERVER_SCRIPTS_DIRECTORY}""/server" | grep -v grep)

if [ -n "$SERVER_RUNNING" ]; then
    echo -e "Server already running"
else
    #pm2 --silent start shelf-server
    pm2 --log "${LOG_DIRECTORY}"/server.log --name shelf-server --silent start "${SERVER_SCRIPTS_DIRECTORY}"/server.js
    #nohup node server/server.js > "$LOG_DIRECTORY"/server.log 2>&1 &
    SUCCESS=$?

    if [ $SUCCESS -eq 0 ]; then
        echo -e "${GREEN}Server started${RESET}"
    else
        echo -e "${RED}Server failed to start${RESET}"
    fi    
fi

