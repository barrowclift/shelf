#!/bin/bash

source config.sh

MONGODB_COMMAND=$(ps -ef | grep "mongod --dbpath $MONGO_DB_DIRECTORY" | grep -v grep)
if command -v service; then
	MONGODB_SERVICE=$(service mongod status | grep -F "is running")
fi

# Start MongoDB
if [ -z "$MONGODB_COMMAND" ] && [ -z "$MONGODB_SERVICE" ]; then
	if [ ! -d "$MONGO_DB_DIRECTORY" ]; then
		mkdir -p "$MONGO_DB_DIRECTORY"
	fi
	if [ ! -d "$LOG_DIRECTORY" ]; then
	    mkdir "$LOG_DIRECTORY";
	fi

	rm "$LOG_DIRECTORY"/mongodb.log 2> /dev/null

	# Try starting mongod as a service, if the service command exists and mongod
	# is already set up with it. Otherwise, fallback on the standard mongod command.
	STARTED=0
	if command -v service; then
		if service mongod status | grep -F "is running"; then
			sudo service mongod start
			STARTED=1
		fi
	fi
	if [ $STARTED -eq 0 ]; then
		nohup mongod --dbpath "$MONGO_DB_DIRECTORY" > "$LOG_DIRECTORY"/mongodb.log 2>&1 &
	fi
	echo -e "${GREEN}MongoDB started${RESET}"
else
	echo -e "${GREEN}MongoDB already running${RESET}"
fi
