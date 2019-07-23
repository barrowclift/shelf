#!/bin/bash

export ADMIN_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
source "${ADMIN_DIR}"/init.sh

rm "${LOGS_DIR}"/mongodb.log 2> /dev/null
rm "${LOGS_DIR}"/server.log 2> /dev/null
rm "${LOGS_DIR}"/clean-mongodb.log 2> /dev/null

echo "Log directory cleaned"