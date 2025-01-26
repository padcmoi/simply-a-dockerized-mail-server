#!/bin/bash

service postfix status
service dovecot status

inotifywait -m -e modify /etc/_private/privkey.pem |
    while read; do
        /usr/bin/logger "SSL Certs updating ..."
        service postfix restart
        service dovecot restart
        /usr/bin/logger "SSL Certs updated ..."
    done
