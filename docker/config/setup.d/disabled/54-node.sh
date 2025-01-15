#!/bin/bash
source /.env
source /_VARIABLES
source /.mysql-root-pw

echo "-> $(basename "$0" .sh): $1"

case $1 in
build)

    # Webadmin & API

    curl -sL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    apt install -y nodejs
    npm install -g pnpm

    ;;
container)

    # Download repository

    mkdir -p /docker-config/source
    cd /docker-config/source
    git clone https://github.com/padcmoi/simply-docker-sql-mailserver
    mv simply-docker-sql-mailserver/webadmin/* .
    rm -R simply-docker-sql-mailserver

    # # case app
    # rm /var/www/html/*
    # cd /docker-config/source/www
    # pnpm install
    # pnpm run build
    # mv dist/* /var/www/html/
    # /etc/init.d/./apache2 start

    # # case api
    # mv /docker-config/source/api /docker-config/api
    # cd /docker-config/api
    # cp .env.sample .env
    # pnpm install
    # pnpm run build
    # node dist/main </dev/null &>/dev/null &
    ## NodeJS API
    ## check package to encrypt mail password
    # https://github.com/mvo5/sha512crypt-node
    # https://stackoverflow.com/questions/37732331/execute-bash-command-in-node-js-and-get-exit-code

    ;;

run) ;;

*)
    echo "please give me an argument"
    ;;
esac
