#!/bin/bash
source /.env
source /_VARIABLES

echo "-> $(basename "$0" .sh): $1"

case $1 in
build)

    SYSTEM_PASSWORD=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 50)
    echo "SYSTEM_PASSWORD=${SYSTEM_PASSWORD}" >/.system_password

    ;;

save-volume) ;;

retrieve-volume) ;;

container) ;;

run)

    service rsyslog start </dev/null &>/dev/null
    service rsyslog status

    ;;

*)
    echo "please give me an argument"
    ;;
esac
