#!/bin/bash

source config.sh

rm "$LOG_DIRECTORY"/mongodb.log 2> /dev/null
rm "$LOG_DIRECTORY"/server.log 2> /dev/null
rm "$LOG_DIRECTORY"/clean-mongodb.log 2> /dev/null
rm "$LOG_DIRECTORY"/albumPoller.log 2> /dev/null

echo -e "${GREEN}Logs directory cleaned${RESET}"