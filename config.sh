#!/bin/bash

ABSOLUTE_PATH_TO_SHELF=/some/example/path

export MONGO_DB_DIRECTORY=/var/lib/mongo
export SERVER_SCRIPTS_DIRECTORY="${ABSOLUTE_PATH_TO_SHELF}"/server
export IMAGE_CACHE_DIRECTORY="${ABSOLUTE_PATH_TO_SHELF}"/client/images/records
export LOG_DIRECTORY="${ABSOLUTE_PATH_TO_SHELF}"/logs

export RESET='\033[0m'
export GREEN='\033[0;32m'
export RED='\033[0;31m'
