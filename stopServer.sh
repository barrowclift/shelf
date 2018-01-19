#!/bin/bash

source config.sh

SERVER=$(ps -ef | grep "node server/server.js" | grep -v grep)

if [ -n "$SERVER" ]; then
	ps -ef | grep "node server/server.js" | grep -v grep | awk '{print $2}' | xargs kill -9
	echo -e "${RED}Server stopped${RESET}"
else
	echo -e "${RED}Server is not running${RESET}"
fi
