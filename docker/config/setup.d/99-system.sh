#!/bin/bash
source /.env
source /_VARIABLES

echo "-> $(basename "$0" .sh): $1"

case $1 in
build) ;;

save-volume) ;;

retrieve-volume) ;;

container) ;;

run)

    service cron start

    ;;

*)
    echo "please give me an argument"
    ;;
esac
