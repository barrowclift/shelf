#!/bin/bash

export RED='\033[0;31m'
export RESET='\033[0m'
export YELLOW='\033[0;33m'
export GREEN='\033[0;32m'

export REPO=$(dirname "${ADMIN_DIR}")
export FRONTEND_STATIC_DIR="${REPO}"/frontend/static
export FRONTEND_LIQUID_DIR="${REPO}"/frontend/liquid
export BACKEND_DIR="${REPO}"/backend
export RECORD_IMAGE_CACHE_DIR="${FRONTEND_STATIC_DIR}"/images/records
export BOARD_GAME_IMAGE_CACHE_DIR="${FRONTEND_STATIC_DIR}"/images/board-games
export BOOK_IMAGE_CACHE_DIR="${FRONTEND_STATIC_DIR}"/images/books
export LOGS_DIR="${REPO}"/logs
export MONGO_DB=/var/lib/mongo

# Set to true if you prefer to use pm2.
#
# WARNING: THIS IS CURRENTLY EXPERIMENTAL
# Using pm2 appears to cause an infinite loop or leak somewhere in Shelf v2.0+
# that I haven't yet been able to pin down, use at your own risk.
export USE_PM2=false