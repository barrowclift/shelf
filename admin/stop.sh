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
SERVER_RUNNING=$(ps -ef | grep "node ""${ADMIN_DIR}" | grep -v grep)

# If all necessary ingredients aren't running, then there's nothing to stop
if [ -z "$SERVER_RUNNING" ] && { [ -z "$MONGODB_NOHUP_RUNNING" ] && [ -z "$MONGODB_SERVICE_RUNNING" ]; }; then
    echo "Shelf is not running"
    exit 0
fi

echo "Stopping Shelf..."

# Ask to Stop MongoDB
if [ -n "$MONGODB_NOHUP_RUNNING" ] || [ -n "$MONGODB_SERVICE_RUNNING" ]; then
    read -p "Do you want to stop MongoDB? (y/n): " -r
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Do you also want to clean MongoDB? (y/n): " -r
        if [[ $REPLY =~ ^[Yy]$ ]]
        then
            echo "Cleaning MongoDB..."
            "${ADMIN_DIR}"/cleanMongoDb.sh 1
            result=$!
            wait $result
        fi

        echo "Stopping MongoDB..."
        "${ADMIN_DIR}"/stopMongoDb.sh
    elif [ -z "$SERVER_RUNNING" ]; then
        echo "Server is not running"
        exit 0
    fi
else
    echo "MongoDB is not running"
fi
if [ -n "$SERVER_RUNNING" ]; then
    "${ADMIN_DIR}"/stopServer.sh
else
    echo "Server is not running"
fi

echo -e "${GREEN}Shelf has been stopped${RESET}"