#!/bin/bash

export ADMIN_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
source "${ADMIN_DIR}"/init.sh

if [[ $1 == 1 ]] # If 1 is provided, skip safety prompt and just do it.
then
    rm "${RECORD_IMAGE_CACHE_DIR}"/record[0-9][0-9]*/discogs-album-art.jpg 2> /dev/null
    rm "${RECORD_IMAGE_CACHE_DIR}"/record[0-9][0-9]*/itunes-album-art.jpg 2> /dev/null
    rmdir "${RECORD_IMAGE_CACHE_DIR}"/record[0-9][0-9]* 2> /dev/null

    rm "${BOARD_GAME_IMAGE_CACHE_DIR}"/boardgame[0-9][0-9]*/board-game-cover-art.jpg 2> /dev/null
    rmdir "${BOARD_GAME_IMAGE_CACHE_DIR}"/boardgame[0-9][0-9]* 2> /dev/null

    rm "${BOOK_IMAGE_CACHE_DIR}"/book[0-9][0-9]*/book-cover-art.jpg 2> /dev/null
    rmdir "${BOOK_IMAGE_CACHE_DIR}"/book[0-9][0-9]* 2> /dev/null

    echo "Image cache cleaned"
else
    echo "You are about to clear all locally cached images. This CANNOT be undone."
    read -p "Are you absolutely sure you want to proceed? (y/n): " -r
    if [[ $REPLY =~ ^[Yy]$ ]]
    then
        rm "${RECORD_IMAGE_CACHE_DIR}"/record[0-9][0-9]*/discogs-album-art.jpg 2> /dev/null
        rm "${RECORD_IMAGE_CACHE_DIR}"/record[0-9][0-9]*/itunes-album-art.jpg 2> /dev/null
        rmdir "${RECORD_IMAGE_CACHE_DIR}"/record[0-9][0-9]* 2> /dev/null

        rm "${BOARD_GAME_IMAGE_CACHE_DIR}"/boardgame[0-9][0-9]*/board-game-cover-art.jpg 2> /dev/null
        rmdir "${BOARD_GAME_IMAGE_CACHE_DIR}"/boardgame[0-9][0-9]* 2> /dev/null
        echo "Image cache cleaned"
    fi
fi