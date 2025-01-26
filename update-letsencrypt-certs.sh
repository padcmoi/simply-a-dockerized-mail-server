#!/bin/bash

source .env

if [ $1 ]; then
    _execBg() {

        echo $1

        sudo cp /etc/letsencrypt/live/$1/*.pem $DOCKER_VOLUMES/ssl/

        sudo inotifywait -m -e modify /etc/letsencrypt/live/$1/*.pem |
            while read file_path event file_name; do
                sudo cp -f $file_path$file_name $DOCKER_VOLUMES/ssl/
            done
    }

    _execBg $1 &>/dev/null &

else
    echo "Please define an argument %domain"
    sudo killall -w update-letsencrypt-certs.sh
fi
