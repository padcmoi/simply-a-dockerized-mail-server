#!/bin/bash
source /.env
source /_VARIABLES

echo "-> $(basename "$0" .sh): $1"

case $1 in
build)

    SYSTEM_PASSWORD=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 50)
    echo "SYSTEM_PASSWORD=${SYSTEM_PASSWORD}" >/.system_password

    mkdir -p /etc/rsyslog.d

    cp -R -f /docker-build/conf.d/rsyslog.d/* /etc/rsyslog.d/

    ;;

save-volume) ;;

retrieve-volume)

    if [ -d /var/log.DOCKER_TMP ] && [ -z "$(ls -A '/var/log')" ]; then
        mv -f /var/log.DOCKER_TMP/* /var/log/
    fi
    rm -R /var/log.DOCKER_TMP

    ;;

container)

    # check default SSL certs
    if [ ! -f /etc/_private/fullchain.pem ] || [ ! -f /etc/_private/privkey.pem ]; then
        cp -u /docker-build/default_ssl/* /etc/_private/
    fi

    ;;

run)

    service rsyslog start </dev/null &>/dev/null
    service rsyslog status

    ;;

*)
    echo "please give me an argument"
    ;;
esac
