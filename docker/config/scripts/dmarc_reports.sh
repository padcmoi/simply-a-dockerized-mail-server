#!/bin/bash
# dmarc_reports.sh  v1.1  - March 6, 2019
# Copyright Noel Butler <noelb@ausics.net> 2015-2019. All Rights Reserved.
#
# Licenced under GPL v3.0 - https://www.gnu.org/licenses/gpl-3.0.en.html
# This entitles you to freely share or modify this scipt providing original
# author and copyright information is retained.
############################################################################

source /.env
source /_VARIABLES
source /.mysql-root-pw

increment() {
	if [ ! -f "${OPENDMARC_VAR}/counter_dmarc_${1}.txt" ]; then
		echo 0 >$OPENDMARC_VAR/counter_dmarc_$1.txt
		chmod 777 $OPENDMARC_VAR/counter_dmarc_$1.txt
	fi

	oldnum=$(cut -d ',' -f2 $OPENDMARC_VAR/counter_dmarc_$1.txt)
	newnum=$(expr $oldnum + 1)
	sed -i "s/$oldnum\$/$newnum/g" $OPENDMARC_VAR/counter_dmarc_$1.txt
}

# Import report data if any exists, normal to be missing in quiet periods of the day.

if [ -f "${OPENDMARC_VAR}/opendmarc.dat" ]; then
	opendmarc-import --dbhost=localhost --dbname=opendmarc --dbpasswd=$MYSQL_ROOT_PASSWORD --dbuser=root --input=$OPENDMARC_VAR/opendmarc.dat
	sleep 1
	rm $OPENDMARC_VAR/opendmarc.dat
	increment import
fi

# Send daily reports, once, in reality the below works at to around 00:05

currenttime=$(date +%H:%M)
currentdom=$(date +%d)

if [[ "$currenttime" > "00:00" ]] && [[ "$currenttime" < "00:08" ]]; then
	logger "Sending Reports"
	opendmarc-reports --day --dbhost=localhost --dbname=opendmarc --dbpasswd=$MYSQL_ROOT_PASSWORD --dbuser=opendmarc --report-email=$DMARC_REPORTS --smtp-port=25 --smtp-server=localhost
	increment reports

	# Expire old reports once a month, keeping only 90 days to avoid bloated database.

	if [ "$currentdom" == "01" ]; then
		logger "Expire"
		opendmarc-expire --alltables --expire=90 --dbhost=localhost --dbname=opendmarc --dbpasswd=$MYSQL_ROOT_PASSWORD --dbuser=opendmarc
	fi

fi

increment script-executed
