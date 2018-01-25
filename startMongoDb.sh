#!/bin/bash

source config.sh

MONGODB_COMMAND_RUNNING=$(ps -ef | grep "mongod --dbpath $MONGO_DB_DIRECTORY" | grep -v grep)
HAS_SERVICE_COMMAND=$(command -v service)
if [ -n "$HAS_SERVICE_COMMAND" ]; then
	HAS_MONGODB_SERVICE=$(service --status-all | grep -F "mongod")
	if [ -n "$HAS_MONGODB_SERVICE" ]; then
		MONGODB_SERVICE_RUNNING=$(service mongod status | grep 'is running\|active (running)')
	fi
fi

# If neither way of running MongoDB is running, start MongoDB
if [ -z "$MONGODB_COMMAND_RUNNING" ] && [ -z "$MONGODB_SERVICE_RUNNING" ]; then
	if [ ! -d "$MONGO_DB_DIRECTORY" ]; then
		mkdir -p "$MONGO_DB_DIRECTORY"
	fi
	if [ ! -d "$LOG_DIRECTORY" ]; then
	    mkdir "$LOG_DIRECTORY";
	fi

	rm "$LOG_DIRECTORY"/mongodb.log 2> /dev/null

	if [ -n "$HAS_MONGODB_SERVICE" ]; then
		sudo service mongod start
		SUCCESS=$?
	else	
		nohup mongod --dbpath "$MONGO_DB_DIRECTORY" > "$LOG_DIRECTORY"/mongodb.log 2>&1 &
		SUCCESS=$?
	fi
	
	if [ $SUCCESS -eq 0 ]; then
		echo -e "${GREEN}MongoDB started${RESET}"
	else
		echo -e "${RED}MongoDB failed to start${RESET}"
	fi
else
	echo -e "${GREEN}MongoDB already running${RESET}"
fi
