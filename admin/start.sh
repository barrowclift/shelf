#!/bin/bash

export ADMIN_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
source "${ADMIN_DIR}"/init.sh

MONGODB_NOHUP_RUNNING=$(ps -ef | grep "mongod --dbpath ""$MONGO_DB" | grep -v grep)
HAS_SERVICE_COMMAND=$(command -v service)
if [ -n "$HAS_SERVICE_COMMAND" ]; then
    HAS_MONGODB_INITD_SERVICE=$(ls /etc/init.d/mongod 2>/dev/null)
    HAS_MONGODB_SYSTEMCTL_SERVICE=$(ls /usr/lib/systemd/system/mongod.service 2>/dev/null)
    if [ -n "$HAS_MONGODB_INITD_SERVICE" ]; then
        MONGODB_SERVICE_RUNNING=$(service mongod status | grep 'is running\|active (running)')
    elif [ -n "$HAS_MONGODB_SYSTEMCTL_SERVICE" ]; then
        MONGODB_SERVICE_RUNNING=$(systemctl status mongod | grep 'is running\|active (running)')
    fi
fi
SHELF_RUNNING=$(ps -ef | grep "node ""${BACKEND_DIR}" | grep -v grep)

# If all necessary ingredients are running successfully, nothing to do
if [ -n "$SHELF_RUNNING" ] && { [ -n "$MONGODB_NOHUP_RUNNING" ] || [ -n "$MONGODB_SERVICE_RUNNING" ]; }; then
    echo -e "${GREEN}Shelf already running${RESET}"
    exit 0
fi

"${ADMIN_DIR}"/cleanLogs.sh

echo "Starting Shelf..."

"${ADMIN_DIR}"/startMongoDb.sh
result=$!
wait $result

"${ADMIN_DIR}"/startServer.sh
SUCCESS=$?

if [ $SUCCESS -eq 0 ]; then
    echo -e "${GREEN}All started successfully${RESET}"
    exit 0
else
    echo -e "${RED}Shelf failed to start${RESET}"
    exit 1
fi
