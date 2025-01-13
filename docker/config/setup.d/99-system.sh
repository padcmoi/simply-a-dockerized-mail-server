#!/bin/bash
source /.env
source /_VARIABLES

echo "-> $(basename "$0" .sh): $1"

case $1 in
build) ;;

save-volume) ;;

retrieve-volume) ;;

container)

    cp -Rf /docker-config/conf.d/default/* /etc/default/

    ;;

run)

    service cron start </dev/null &>/dev/null
    service cron status

    ;;

*)
    echo "please give me an argument"
    ;;
esac
