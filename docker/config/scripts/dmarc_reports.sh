#!/bin/bash
# dmarc_reports.sh  v1.1  - March 6, 2019
# Copyright Noel Butler <noelb@ausics.net> 2015-2019. All Rights Reserved.
#
# Licenced under GPL v3.0 - https://www.gnu.org/licenses/gpl-3.0.en.html
# This entitles you to freely share or modify this scipt providing original
# author and copyright information is retained.
############################################################################

# Import report data if any exists, normal to be missing in quiet periods of the day.

if [ -f "/var/run/opendmarc/opendmarc.dat" ]; then
	/usr/local/sbin/opendmarc-import --dbhost=localhost --dbname=opendmarc --dbpasswd=CHANGEME --dbuser=opendmarc --input=/var/run/opendmarc/opendmarc.dat
	sleep 1
	/usr/bin/rm /var/run/opendmarc/opendmarc.dat
fi

# Send daily reports, once, in reality the below works at to around 00:05

currenttime=$(date +%H:%M)
currentdom=$(date +%d)

if [[ "$currenttime" > "00:00" ]] && [[ "$currenttime" < "00:08" ]]; then
	/usr/bin/logger "Sending Reports"
	/usr/local/sbin/opendmarc-reports --day --dbhost=localhost --dbname=opendmarc --dbpasswd=CHANGEME --dbuser=opendmarc --report-email=dmarc_reports@CHANGEME-YOURDOMAIN --smtp-port=25 --smtp-server=localhost

	# Expire old reports once a month, keeping only 90 days to avoid bloated database.

	if [ "$currentdom" == "01" ]; then
		/usr/bin/logger "Expire"
		/usr/local/sbin/opendmarc-expire --alltables --expire=90 --dbhost=localhost --dbname=opendmarc --dbpasswd=CHANGEME --dbuser=opendmarc
	fi

fi
