#!/bin/bash
source /.env
source /_VARIABLES
source /.mysql-root-pw

echo "-> $(basename "$0" .sh): $1"

case $1 in
build)

    #

    ;;

save-volume)

    #

    ;;

retrieve-volume)

    #

    ;;

container)

    rm -f /etc/dbconfig-common/roundcube.conf
    rm -f /etc/roundcube

    # /usr/share/debconf/fix_db.pl
    # Fixes the following error: `Cannot find a question for`.
    # Can sometimes occur when using debconf-set-selections
    # This error was reported on debian in 2008 and is now an official fix.
    /usr/share/debconf/fix_db.pl &&
        echo "roundcube-core roundcube/mysql/admin-pass password ${MYSQL_ROOT_PASSWORD}" | debconf-set-selections &&
        echo "roundcube-core roundcube/mysql/app-pass password ${MYSQL_ROOT_PASSWORD}" | debconf-set-selections &&
        echo "roundcube-core roundcube/app-password-confirm password ${MYSQL_ROOT_PASSWORD}" | debconf-set-selections &&
        echo "roundcube-core roundcube/dbconfig-install boolean true" | debconf-set-selections &&
        echo "roundcube-core roundcube/database-type select mysql" | debconf-set-selections &&
        echo "roundcube-core roundcube/install-error select 'ignore'" | debconf-set-selections &&
        echo "roundcube-core roundcube/missing-db-package-error select 'ignore'" | debconf-set-selections &&
        DEBIAN_FRONTEND=noninteractive apt --assume-yes install roundcube roundcube-core roundcube-mysql roundcube-plugins roundcube-plugins-extra

    # Above I reused debconf-set-selections because
    # I found a way to fix the error stipulated `Cannot find a question for`.
    # In the event that this instruction should fail, this one won't,
    # it won't consume any download resources, because if it's installed it will then skip
    # DEBIAN_FRONTEND=noninteractive apt -y install roundcube roundcube-core roundcube-mysql roundcube-plugins roundcube-plugins-extra

    sed -i "s/post_max_size = 8M/post_max_size = 50M/g" /etc/php/*/apache2/php.ini
    sed -i "s/upload_max_filesize = 2M/upload_max_filesize = 50M/g" /etc/php/*/apache2/php.ini

    cat /docker-config/conf.d/roundcube/config.inc.php >/etc/roundcube/config.inc.php
    cat /docker-config/conf.d/roundcube/apache.conf >>/etc/roundcube/apache.conf

    sed -i "s/____ROUNDCUBE_DES_KEY/$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24)/g" /etc/roundcube/config.inc.php
    sed -i "s/____domainFQDN/${DOMAIN_FQDN}/g" /etc/roundcube/config.inc.php

    ;;

run)

    echo "run"

    ;;

*)
    echo "please give me an argument"
    ;;
esac
