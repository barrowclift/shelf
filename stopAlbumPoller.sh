#!/bin/bash

source config.sh

ALBUM_POLLER_RUNNING=$(ps -ef | grep "node server/albumPoller.js" | grep -v grep)

if [ -n "$ALBUM_POLLER_RUNNING" ]; then
	ps -ef | grep "node server/albumPoller.js" | grep -v grep | awk '{print $2}' | xargs kill -9
	echo -e "${RED}Album poller stopped${RESET}"
else
	echo -e "${RED}Album poller is not running${RESET}"
fi
