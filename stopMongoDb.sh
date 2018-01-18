#!/bin/bash

source config.sh

# MONGODB_COMMAND=$(ps -ef | grep "mongod --dbpath $MONGO_DB_DIRECTORY" | grep -v grep)
MONGODB_COMMAND=$(ps -ef | grep "mongod" | grep -v grep)
if command -v service; then
	MONGODB_SERVICE=$(service mongod status | grep -F "is running")
fi

# Ask to Stop MongoDB
if [ -n "$MONGODB_COMMAND" ] || [ -n "$MONGODB_SERVICE" ]; then
	# read -p "Do you also want to clean MongoDB? (y/n): " -r
	# if [[ $REPLY =~ ^[Yy]$ ]]
	# then
	# 	node mongoCleaner.js > "$LOG_DIRECTORY"/clean-mongodb.log 2>&1 &
	# 	cleanerProcess=$!
	# 	wait $cleanerProcess
	# 	echo -e "${RED}Cleaned MongoDB${RESET}"
	# fi

	# Try stopping mongod as a service, if the service command exists and mongod
	# is already set up with it. Otherwise, fallback on standard kill command.
	KILLED=0
	if command -v service; then
		if service mongod status | grep -F "is running"; then    
			sudo service mongod stop
			KILLED=1
		fi
	fi
	if [ $KILLED -eq 0 ]; then
		ps -ef | grep "mongod --dbpath $MONGO_DB_DIRECTORY" | grep -v grep | awk '{print $2}' | xargs kill -9
	fi
	echo -e "${RED}MongoDB stopped${RESET}"
else
	echo -e "${RED}MongoDB is not running${RESET}"
fi
