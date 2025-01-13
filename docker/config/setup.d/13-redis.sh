#!/bin/bash
source /.env
source /_VARIABLES
source /.mysql-root-pw

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

    service redis-server start </dev/null &>/dev/null
    service redis-server status

    ;;

*)
    echo "please give me an argument"
    ;;
esac
