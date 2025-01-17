#!/bin/bash
source /.env
source /_VARIABLES
source /.system_password

/docker-build/docker-setup.sh container

# exec some scripts ...
## check in background changes in ssl certs /etc/_private/fullchain.*
check-mail-ssl-files.sh </dev/null &>/dev/null &
## provides logs in volume/log
debug-autocopy-logs.sh </dev/null &>/dev/null &
## provides mail in volume/mail
make-public-mail-volume.sh </dev/null &>/dev/null &

# fix permission issue opendkim keys
/docker-build/setup.d/26-opendkim.sh container </dev/null &>/dev/null &

# WebAPI
# /docker-build/webapi.sh

# netstat -tulpn | grep -E -w 'tcp|udp'
[ $DISABLE_ANTIVIRUS == true ] && echo "ANTIVIRUS CLAMAV DISABLED !!!"
[ ! $DISABLE_ANTIVIRUS == true ] && echo "ANTIVIRUS CLAMAV ENABLED !!!"
if [ ! $NOTIFY_SPAM_REJECT == false ] && [ $NOTIFY_SPAM_REJECT_TO ]; then
    echo "*** Notification for each spam rejection enabled ***"
fi
echo "Hostname: ${DOMAIN_FQDN} (${ADRESSIP})"
echo "AUTOMATICALLY GENERATED PASSWORD: ${SYSTEM_PASSWORD}"
tail -f /var/log/syslog
