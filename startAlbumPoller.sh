#!/bin/bash

source config.sh

if [ ! -d "$LOG_DIRECTORY" ]; then
    mkdir "$LOG_DIRECTORY";
fi

ALBUM_POLLER=$(ps -ef | grep "node albumPoller.js" | grep -v grep)

if [ -n "$ALBUM_POLLER" ]; then
	echo -e "${GREEN}Album poller already running${RESET}"
else
	nohup node albumPoller.js > "$LOG_DIRECTORY"/albumPoller.log 2>&1 &
	echo -e "${GREEN}Album poller started${RESET}"
fi
