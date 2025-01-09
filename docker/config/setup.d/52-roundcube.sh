#!/bin/bash
source /.env
source /_VARIABLES
source /.mysql-root-pw

echo "-> $(basename "$0" .sh): $1"

case $1 in
build)

    rm -R /etc/roundcube
    DEBIAN_FRONTEND=noninteractive apt -y install roundcube roundcube-core roundcube-mysql roundcube-plugins roundcube-plugins-extra

    sed -i "s/post_max_size = 8M/post_max_size = 50M/g" /etc/php/*/apache2/php.ini
    sed -i "s/upload_max_filesize = 2M/upload_max_filesize = 50M/g" /etc/php/*/apache2/php.ini

    cat /docker-config/conf.d/roundcube/config.inc.php >/etc/roundcube/config.inc.php
    cat /docker-config/conf.d/roundcube/apache.conf >>/etc/roundcube/apache.conf

    sed -i "s/____ROUNDCUBE_DES_KEY/$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24)/g" /etc/roundcube/config.inc.php
    sed -i "s/____domainFQDN/${DOMAIN_FQDN}/g" /etc/roundcube/config.inc.php

    ;;
container)

    # echo "no config"

    ;;
*)
    echo "please give me an argument"
    ;;
esac
