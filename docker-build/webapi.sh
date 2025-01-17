#!/bin/bash
source /.env
source /_VARIABLES
source /.system_password

# Download repository

mkdir -p /docker-build/source
cd /docker-build/source
git clone https://github.com/padcmoi/simply-docker-sql-mailserver
mv simply-docker-sql-mailserver/webadmin/* .
rm -R simply-docker-sql-mailserver

# # case app
# rm /var/www/html/*
# cd /docker-build/source/www
# pnpm install
# pnpm run build
# mv dist/* /var/www/html/
# /etc/init.d/./apache2 start

# # case api
# mv /docker-build/source/api /docker-build/api
# cd /docker-build/api
# cp .env.sample .env
# pnpm install
# pnpm run build
# node dist/main </dev/null &>/dev/null &
## NodeJS API
## check package to encrypt mail password
# https://github.com/mvo5/sha512crypt-node
# https://stackoverflow.com/questions/37732331/execute-bash-command-in-node-js-and-get-exit-code
