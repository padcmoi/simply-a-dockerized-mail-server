#!/bin/bash
source /.env
source /_VARIABLES
source /.system_password

echo "-> $(basename "$0" .sh): $1"

case $1 in
build) ;;

save-volume) ;;

retrieve-volume) ;;

container) ;;

run) ;;

*)
    echo "please give me an argument"
    ;;
esac
