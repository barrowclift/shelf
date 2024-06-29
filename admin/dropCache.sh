#!/bin/bash

export ADMIN_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
source "${ADMIN_DIR}"/init.sh

function dropCache {
    node "${ADMIN_DIR}"/mongoCleaner.js "clear" > "${LOGS_DIR}"/drop-cache.log 2>&1 &
    dropCacheProcess=$!
    wait $dropCacheProcess

    echo "Shelf cache has been dropped"
}

dropCache

exit 0