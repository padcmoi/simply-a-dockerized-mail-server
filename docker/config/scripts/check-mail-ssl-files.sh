#!/bin/bash

service postfix status
service dovecot status

inotifywait -m -e modify /etc/_private/*.pem |
    while read; do
        sleep 15
        service postfix restart
        service dovecot restart
    done
