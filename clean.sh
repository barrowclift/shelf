#!/bin/bash

source config.sh

# Confirm if they really want to clean MongoDB's data store
echo "You are about to clean ALL cached images, data, and logs. This CANNOT be undone."
read -p "Are you absolutely sure you want to proceed? (y/n): " -r
if [[ $REPLY =~ ^[Yy]$ ]]
then
	./cleanMongoDb.sh 1
	./cleanLocalImageStore.sh 1
	./cleanLogs.sh
	echo -e "\n${GREEN}EVERYTHING CLEANED!${RESET}"
else
	echo -e "${RED}Nothing cleaned${RESET}"
fi
