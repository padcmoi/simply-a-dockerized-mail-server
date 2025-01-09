#!/bin/bash
source /.env
source /_VARIABLES
source /.mysql-root-pw

echo "-> $(basename "$0" .sh): $1"

case $1 in
build)

    apt -y install redis-server redis

    ;;
container)

    # echo "no config"
    
    ;;
*)
    echo "please give me an argument"
    ;;
esac
