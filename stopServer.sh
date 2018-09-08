#!/bin/bash

source config.sh

SERVER_RUNNING=$(ps -ef | grep "node ""${SERVER_SCRIPTS_DIRECTORY}""/server" | grep -v grep)

if [ -n "$SERVER_RUNNING" ]; then
    pm2 --silent stop shelf-server
    #ps -ef | grep "node ""${SERVER_SCRIPTS_DIRECTORY}""/server.js" | grep -v grep | awk '{print $2}' | xargs kill -9
    SUCCESS=$?

    if [ $SUCCESS -eq 0 ]; then
        echo -e "${GREEN}Server stopped${RESET}"
    else
        echo -e "${RED}Server failed to stop${RESET}"
    fi
else
    echo -e "Server is not running"
fi

