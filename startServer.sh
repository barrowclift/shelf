#!/bin/bash

source config.sh

if [ ! -d "$LOG_DIRECTORY" ]; then
    mkdir "$LOG_DIRECTORY";
fi

SERVER=$(ps -ef | grep "node server.js" | grep -v grep)

if [ -n "$SERVER" ]; then
	echo -e "${GREEN}Server already running${RESET}"
else
	nohup node server.js > "$LOG_DIRECTORY"/server.log 2>&1 &
	echo -e "${GREEN}Server started${RESET}"
fi