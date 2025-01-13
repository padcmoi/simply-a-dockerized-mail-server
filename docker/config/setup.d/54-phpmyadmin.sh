#!/bin/bash
source /.env
source /_VARIABLES
source /.mysql-root-pw

echo "-> $(basename "$0" .sh): $1"

# Require 50-apache2
[ ! -f "50-apache2.sh" ] && exit

case $1 in
build)

    cd /var/www/

    wget https://files.phpmyadmin.net/phpMyAdmin/5.2.1/phpMyAdmin-5.2.1-all-languages.zip
    unzip /var/www/phpMyAdmin-5.2.1-all-languages.zip -d /var/www/

    rm phpMyAdmin*.zip
    mv /var/www/phpMyAdmin* /var/www/mysql

    chmod -R 755 /var/www/mysql

    a2ensite _phpmyadmin.conf

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

run) ;;

*)
    echo "please give me an argument"
    ;;
esac
