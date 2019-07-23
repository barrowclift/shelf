#!/bin/bash

export ADMIN_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
source "${ADMIN_DIR}"/init.sh

SERVER_RUNNING=$(ps -ef | grep "node ""${SERVER_DIR}" | grep -v grep)

if [ -n "$SERVER_RUNNING" ]; then
	if [ "$USE_PM2" = true ] ; then
	    pm2 --silent stop shelf
	else
	    ps -ef | grep "node ""${SERVER_DIR}""/main.js" | grep -v grep | awk '{print $2}' | xargs kill -9
	fi

    SUCCESS=$?
    if [ $SUCCESS -eq 0 ]; then
        echo -e "${GREEN}Server stopped${RESET}"
        exit 0
    else
        echo -e "${RED}Server failed to stop${RESET}"
        exit 1
    fi
else
    echo "Server is not running"
    exit 0
fi
