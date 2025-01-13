#!/bin/bash
source /.env
source /_VARIABLES
source /.mysql-root-pw

echo "-> $(basename "$0" .sh): $1"

case $1 in
build)

    apt install -y apache2 libapache2-mod-php php-mbstring php-zip php-gd php-json php-curl php-mysqli
    a2enmod ssl rewrite proxy proxy_http

    cp -R -f /docker-config/conf.d/apache2/* /etc/apache2/
    sed -i "s/____domainFQDN/${DOMAIN_FQDN}/g" /etc/apache2/sites-available/*.conf

    a2ensite port.4000.conf

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

run)

    service apache2 start

    ;;

*)
    echo "please give me an argument"
    ;;
esac
