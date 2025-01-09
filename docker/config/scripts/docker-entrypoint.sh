#!/bin/bash
source /.env
source /_VARIABLES
source /.mysql-root-pw

/docker-config/docker-setup.sh container

# start services
service rspamd restart
service rsyslog restart
service cron restart
service mariadb restart
service redis-server restart
handle-antivirus.sh </dev/null &>/dev/null &
opendkim -x $OPENDKIM_CONFIG

service dovecot restart
service postfix restart
service apache2 restart
service fail2ban start

# exec some scripts ...
## check in background changes in ssl certs /etc/_private/fullchain.*
check-mail-ssl-files.sh </dev/null &>/dev/null &
## provides logs in volume/log
debug-autocopy-logs.sh </dev/null &>/dev/null &
## provides mail in volume/mail
make-public-mail-volume.sh </dev/null &>/dev/null &

# Declares .package-installed to avoid repeating the reinstallation of packages at each launch
# touch /.package-installed


# clear
netstat -tulpn | grep -E -w 'tcp|udp'
service fail2ban status
[ $DISABLE_ANTIVIRUS == true ] && echo "ANTIVIRUS CLAMAV DISABLED !!!"
[ ! $DISABLE_ANTIVIRUS == true ] && echo "ANTIVIRUS CLAMAV ENABLED !!!"
if [ ! $NOTIFY_SPAM_REJECT == false ] && [ $NOTIFY_SPAM_REJECT_TO ]; then
    echo "*** Notification for each spam rejection enabled ***"
fi
echo "Hostname: ${DOMAIN_FQDN} (${ADRESSIP})"
echo "MYSQL ROOT PASSWORD: ${MYSQL_ROOT_PASSWORD}"
echo "Postfix log: /var/log/postfix.log"
tail -f /var/log/syslog
