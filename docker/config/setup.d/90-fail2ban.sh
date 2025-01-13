#!/bin/bash
source /.env
source /_VARIABLES
source /.mysql-root-pw

echo "-> $(basename "$0" .sh): $1"

case $1 in
build)

    rm -R $FAIL2BAN_CONFIG_DIR
    apt -y install fail2ban
    service fail2ban stop
    cp -f /docker-config/conf.d/fail2ban/* $FAIL2BAN_CONFIG_DIR/
    echo "" >$FAIL2BAN_CONFIG_DIR/jail.d/defaults-debian.conf
    sed -i "s/loglevel = INFO/loglevel = NOTICE/" $FAIL2BAN_CONFIG_DIR/fail2ban.conf
    sed -i "s/logtarget = \/var\/log\/fail2ban.log/logtarget = SYSLOG/" $FAIL2BAN_CONFIG_DIR/fail2ban.conf

    if [ $FAIL2BAN_MAXRETRY -gt 0 ]; then
        sed -i "s/____fail2BanMaxRetry/${FAIL2BAN_MAXRETRY}/g" $FAIL2BAN_CONFIG_DIR/jail.local
    else
        sed -i "s/____fail2BanMaxRetry/30/g" $FAIL2BAN_CONFIG_DIR/jail.local
    fi

    if [ $FAIL2BAN_FINDTIME -gt 0 ]; then
        sed -i "s/____fail2BanFindtime/${FAIL2BAN_FINDTIME}/g" $FAIL2BAN_CONFIG_DIR/jail.local
    else
        sed -i "s/____fail2BanFindtime/90/g" $FAIL2BAN_CONFIG_DIR/jail.local
    fi

    if [ $FAIL2BAN_BANTIME -gt 0 ]; then
        sed -i "s/____fail2BanBantime/${FAIL2BAN_BANTIME}/g" $FAIL2BAN_CONFIG_DIR/jail.local
    else
        sed -i "s/____fail2BanBantime/3600/g" $FAIL2BAN_CONFIG_DIR/jail.local
    fi

    ;;

save-volume)

    cp -Rf /var/lib/fail2ban /var/lib/fail2ban.DOCKER_TMP

    ;;

retrieve-volume)

    if [ -d /var/lib/fail2ban.DOCKER_TMP ] && [ -z "$(ls -A '/var/lib/fail2ban')" ]; then
        mv -f /var/lib/fail2ban.DOCKER_TMP/* /var/lib/fail2ban/
    fi
    rm -R /var/lib/fail2ban.DOCKER_TMP

    ;;

container)

    # To avoid fail2ban crashing if these logs dont exist
    touch /var/log/dovecot.log && chmod 777 /var/log/dovecot.log
    touch /var/log/postfix.log && chmod 777 /var/log/postfix.log
    mkdir -p /var/log/apache2/
    touch /var/log/apache2/error.log && chmod 777 /var/log/apache2/error.log
    touch /var/log/apache2/access.log && chmod 777 /var/log/apache2/access.log

    ;;

run)

    service fail2ban start </dev/null &>/dev/null
    systemctl status fail2ban | grep 'Active' | sed 's/Active: //'

    ;;

*)
    echo "please give me an argument"
    ;;
esac
