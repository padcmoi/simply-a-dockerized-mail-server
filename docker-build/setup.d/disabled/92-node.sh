#!/bin/bash
source /.env
source /_VARIABLES
source /.system_password

echo "-> $(basename "$0" .sh): $1"

case $1 in
build)

    # Webadmin & API

    curl -sL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    apt install -y nodejs
    npm install -g pnpm

    ;;

save-volume) ;;

retrieve-volume) ;;

container) ;;

run) ;;

*)
    echo "please give me an argument"
    ;;
esac
