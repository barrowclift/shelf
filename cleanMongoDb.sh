#!/bin/bash

source config.sh

# MONGODB_COMMAND=$(ps -ef | grep "mongod --dbpath $MONGO_DB_DIRECTORY" | grep -v grep)
MONGODB_COMMAND=$(ps -ef | grep "mongod" | grep -v grep)
if command -v service; then
	MONGODB_SERVICE=$(service mongod status | grep -F "is running")
fi

START_THEN_STOP=0
if [ -z "$MONGODB_COMMAND" ] && [ -z "$MONGODB_SERVICE" ]; then
	START_THEN_STOP=1
fi

function stopMongoDb {
	if [ $START_THEN_STOP -eq 1 ]; then
		./startMongoDb.sh
		starterProcess=$!
		wait $starterProcess
	fi

	node server/mongoCleaner.js > "$LOG_DIRECTORY"/clean-mongodb.log 2>&1 &
	cleanerProcess=$!
	wait $cleanerProcess

	echo -e "${GREEN}MongoDB cleaned${RESET}"

	if [ $START_THEN_STOP -eq 1 ]; then
		./stopMongoDb.sh
	fi
}

if [[ $1 == 1 ]] # If 1 is provided, skip safety prompt and just do it.
then
	stopMongoDb
else
	# Confirm if they really want to clean MongoDB's data store
	echo "You are about to clear the MongoDB's entire data store, this CANNOT be undone."
	read -p "Are you absolutely sure you want to proceed? (y/n): " -r
	if [[ $REPLY =~ ^[Yy]$ ]]
	then
		stopMongoDb
	else
		echo -e "${RED}MongoDB NOT cleaned${RESET}"
	fi
fi
