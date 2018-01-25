#!/bin/bash

source config.sh

if [ ! -d "$LOG_DIRECTORY" ]; then
    mkdir "$LOG_DIRECTORY";
fi

SERVER_RUNNING=$(ps -ef | grep "node server/server.js" | grep -v grep)

if [ -n "$SERVER_RUNNING" ]; then
	echo -e "${GREEN}Server already running${RESET}"
else
	nohup node server/server.js > "$LOG_DIRECTORY"/server.log 2>&1 &
	echo -e "${GREEN}Server started${RESET}"
fi
