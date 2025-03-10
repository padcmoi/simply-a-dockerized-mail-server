#!/bin/bash
source /.env
source /_VARIABLES
source /.system_password

echo "-> $(basename "$0" .sh): $1"

case $1 in
build)

    apt -y install redis-server redis

    ;;

save-volume)

    cp -Rf /var/lib/redis /var/lib/redis.DOCKER_TMP

    ;;

retrieve-volume)

    if [ -d /var/lib/redis.DOCKER_TMP ] && [ -z "$(ls -A '/var/lib/redis')" ]; then
        mv -f /var/lib/redis.DOCKER_TMP/* /var/lib/redis/
    fi
    rm -R /var/lib/redis.DOCKER_TMP

    ;;

container)

    #

    ;;

run)

    chmod -R o+rwx /var/lib/redis
    chmod -R o+rwx /var/log/redis
    service redis-server start </dev/null &>/dev/null
    nn 6379

    ;;

*)
    echo "please give me an argument"
    ;;
esac
