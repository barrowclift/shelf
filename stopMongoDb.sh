#!/bin/bash

source config.sh

MONGODB_COMMAND_RUNNING=$(ps -ef | grep "mongod --dbpath $MONGO_DB_DIRECTORY" | grep -v grep)
HAS_SERVICE_COMMAND=$(command -v service)
if [ -n "$HAS_SERVICE_COMMAND" ]; then
	HAS_MONGODB_SERVICE=$(ls /etc/init.d/mongod 2>/dev/null)
	if [ -n "$HAS_MONGODB_SERVICE" ]; then
		MONGODB_SERVICE_RUNNING=$(service mongod status | grep 'is running\|active (running)')
	fi
fi

# If either way of running MongoDB is active, stop MongoDB
if [ -n "$MONGODB_COMMAND_RUNNING" ] || [ -n "$MONGODB_SERVICE_RUNNING" ]; then
	if [ -n "$MONGODB_SERVICE_RUNNING" ]; then    
		sudo service mongod stop
	else	
		ps -ef | grep "mongod --dbpath $MONGO_DB_DIRECTORY" | grep -v grep | awk '{print $2}' | xargs kill -9
	fi
	echo -e "${RED}MongoDB stopped${RESET}"
else
	echo -e "${RED}MongoDB is not running${RESET}"
fi
