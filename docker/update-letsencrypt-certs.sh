#!/bin/bash

if [ $1 ]; then
    _execBg() {

        echo $1

        cp /etc/letsencrypt/live/$1/*.pem ./volumes/ssl/

        inotifywait -m -e modify /etc/letsencrypt/live/$1/*.pem |
            while read file_path event file_name; do
                cp -f $file_path$file_name ./volumes/ssl/
            done
    }

    _execBg $1 &>/dev/null &

else
    echo "Please define an argument %domain"
    killall update-letsencrypt-certs.sh
fi
