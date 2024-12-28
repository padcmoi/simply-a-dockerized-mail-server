#!/bin/bash
source /.env

sed -i "s/#content_filter=smtp-amavis/content_filter=smtp-amavis/g" /etc/postfix/main.cf

if [ $DISABLE_ANTIVIRUS == true ]; then
    sed -i "s/content_filter=smtp-amavis/#content_filter=smtp-amavis/g" /etc/postfix/main.cf
    service amavis stop
    echo "disable antivirus and in postfix"
else
    service amavis restart
    echo "enable antivirus and in postfix"
fi

service postfix restart
