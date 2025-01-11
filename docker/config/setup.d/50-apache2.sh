#!/bin/bash
source /.env
source /_VARIABLES
source /.mysql-root-pw

echo "-> $(basename "$0" .sh): $1"

case $1 in
build)

    apt install -y apache2
    a2enmod ssl rewrite proxy proxy_http

    cp -R -f /docker-config/conf.d/apache2/* /etc/apache2/
    sed -i "s/____domainFQDN/${DOMAIN_FQDN}/g" /etc/apache2/sites-available/*.conf
    a2ensite port.4000.conf
    a2ensite rspamd-web-interface.conf
    a2ensite port.4002.conf

    # TODO Account management is done with PhpMyAdmin while waiting for the API to be created, and will be removed at a later date.
    apt install -y libapache2-mod-php php-mbstring php-zip php-gd php-json php-curl php-mysqli
    cd /var/www/
    wget https://files.phpmyadmin.net/phpMyAdmin/5.2.1/phpMyAdmin-5.2.1-all-languages.zip
    unzip /var/www/phpMyAdmin-5.2.1-all-languages.zip -d /var/www/
    rm phpMyAdmin*.zip
    mv /var/www/phpMyAdmin* /var/www/mysql
    chmod -R 755 /var/www/mysql

    ;;

save-volume)

    #

    ;;

retrieve-volume)

    #

    ;;

container)

    #

    ;;
*)
    echo "please give me an argument"
    ;;
esac
