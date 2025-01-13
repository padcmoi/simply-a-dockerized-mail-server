#!/bin/bash
source /.env
source /_VARIABLES
source /.mysql-root-pw

echo "-> $(basename "$0" .sh): $1"

# openDKIM

# SPF / OpenDKIM
# Inspired by this tutorial https://www.linuxbabe.com/mail-server/spf-dkim-postfix-debian-server
#
# the API must use these scripts when creating or deleting the domain
# - dkim-create.sh <domain>
# - dkim-delete.sh <domain>
# - dkim-update.sh <domain> # just update private key

case $1 in
build)

    apt -y install postfix-policyd-spf-python opendkim opendkim-tools

    killall -w opendkim # opendkim must stopped before configuration

    sudo gpasswd -a postfix opendkim
    cp -f /docker-config/conf.d/opendkim/opendkim.conf /etc/

    sed -i "/SOCKET=./d" $OPENDKIM_DEFAULT
    echo "SOCKET=inet:12301@localhost" >>$OPENDKIM_DEFAULT

    mkdir -p $OPENDKIM_KEYS_PATH

    [ ! -f $OPENDKIM_SIGNING_TABLE ] && touch $OPENDKIM_SIGNING_TABLE
    [ ! -f $OPENDKIM_KEY_TABLE ] && touch $OPENDKIM_KEY_TABLE
    if [ ! -f $OPENDKIM_TRUSTED_HOSTS ]; then
        echo "127.0.0.1" >>$OPENDKIM_TRUSTED_HOSTS
        echo "localhost" >>$OPENDKIM_TRUSTED_HOSTS
        echo "${ADRESSIP}/24" >>$OPENDKIM_TRUSTED_HOSTS
        echo "" >>$OPENDKIM_TRUSTED_HOSTS
    fi

    # if you use the socket instead of the port
    [ ! -d $OPENDKIM_SOCKET_FOLDER ] && mkdir -p $OPENDKIM_SOCKET_FOLDER
    [ ! -d $OPENDKIM_SOCKET_FOLDER ] && chown opendkim:postfix $OPENDKIM_SOCKET_FOLDER

    # add to postfix milters
    sed -i '/^smtpd_milters =/ s/=/= inet:localhost:12301,/' /etc/postfix/main.cf

    ;;

save-volume)

    cp -Rf /etc/opendkim /etc/opendkim.DOCKER_TMP

    ;;

retrieve-volume)

    if [ -d /etc/opendkim.DOCKER_TMP ] && [ -z "$(ls -A '/etc/opendkim')" ]; then
        mv -f /etc/opendkim.DOCKER_TMP/* /etc/opendkim/
    fi
    rm -R /etc/opendkim.DOCKER_TMP

    ;;

container)

    # permissions
    chown -R $OPENDKIM_OWNER_FILE $OPENDKIM_CONFIG_TABLES
    chmod -R 655 $OPENDKIM_CONFIG_TABLES

    # force permissions on private keys
    chmod 600 $OPENDKIM_KEYS_PATH/*/*.private_key
    chown -R $OPENDKIM_OWNER_FILE $OPENDKIM_KEYS_PATH/*/*.private_key

    ;;

run)

    opendkim -x $OPENDKIM_CONFIG

    ;;

*)
    echo "please give me an argument"
    ;;
esac
