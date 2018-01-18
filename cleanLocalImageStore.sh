#!/bin/bash

source config.sh

if [[ $1 == 1 ]] # If 1 is provided, skip safety prompt and just do it.
then
	rm client/images/records/record[0-9][0-9]*/discogs-album-art.jpg 2> /dev/null
	rm client/images/records/record[0-9][0-9]*/itunes-album-art.jpg 2> /dev/null
	rmdir client/images/records/record[0-9][0-9]* 2> /dev/null
	echo -e "${GREEN}Local image store cleaned${RESET}"
else
	# Confirm if they really want to clean MongoDB's data store
	echo "You are about to clear all locally cached images. This CANNOT be undone."
	read -p "Are you absolutely sure you want to proceed? (y/n): " -r
	if [[ $REPLY =~ ^[Yy]$ ]]
	then
		rm client/images/records/record[0-9][0-9]*/itunes-album-art.jpg 2> /dev/null
		rmdir client/images/records/record[0-9][0-9]* 2> /dev/null
		echo -e "${GREEN}Local image store cleaned${RESET}"
	else
		echo -e "${RED}Local image store NOT cleaned${RESET}"
	fi
fi
