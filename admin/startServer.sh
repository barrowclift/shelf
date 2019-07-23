#!/bin/bash
#
export ADMIN_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
source "${ADMIN_DIR}"/init.sh

if [ ! -d "$LOGS_DIR" ]; then
    mkdir "$LOGS_DIR";
fi

SERVER_RUNNING=$(ps -ef | grep "node ""${SERVER_DIR}" | grep -v grep)

if [ -n "$SERVER_RUNNING" ]; then
    echo -e "Server already running"
else
    if [ "$USE_PM2" = true ] ; then
        pm2 --log "${LOGS_DIR}"/server.log --name shelf --silent start "${SERVER_DIR}"/main.js
    else
        nohup node "${SERVER_DIR}"/main.js > "$LOGS_DIR"/server.log 2>&1 &
    fi

    SUCCESS=$?
    if [ $SUCCESS -eq 0 ]; then
        echo -e "${GREEN}Server started${RESET}"
        exit 0
    else
        echo -e "${RED}Server failed to start${RESET}"
        exit 1
    fi
fi
