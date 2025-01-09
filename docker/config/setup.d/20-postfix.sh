#!/bin/bash
source /.env
source /_VARIABLES
source /.mysql-root-pw

echo "-> $(basename "$0" .sh): $1"

case $1 in
build)

    echo "postfix postfix/main_mailer_type select Internet Site" | debconf-set-selections &&
        echo "postfix postfix/mailname string $DOMAIN_FQDN" | debconf-set-selections &&
        apt install --assume-yes postfix postfix-mysql &&
        service postfix stop

    cp -R -f /docker-config/conf.d/postfix/* /etc/postfix/

    # postfix changes
    sed -i "s/____domainFQDN/${DOMAIN_FQDN}/g" /etc/postfix/main.cf
    sed -i "s/____mailRootPass/${MYSQL_ROOT_PASSWORD}/g" /etc/postfix/mysql-virtual-alias-maps.cf
    sed -i "s/____mailRootPass/${MYSQL_ROOT_PASSWORD}/g" /etc/postfix/mysql-virtual-email2email.cf
    sed -i "s/____mailRootPass/${MYSQL_ROOT_PASSWORD}/g" /etc/postfix/mysql-virtual-mailbox-domains.cf
    sed -i "s/____mailRootPass/${MYSQL_ROOT_PASSWORD}/g" /etc/postfix/mysql-virtual-mailbox-maps.cf

    if [ $DISABLE_POSTCREEN_DEEP_PROTOCOL_TESTS == true ]; then
        sed -i "s/____postscreenDeepProtocolTests/no/g" /etc/postfix/main.cf
    else
        sed -i "s/____postscreenDeepProtocolTests/yes/g" /etc/postfix/main.cf
    fi

    ;;
container)

    if [ ! -f /etc/_postscreen/postscreen_access.cidr ]; then
        cp -f /docker-config/conf.d/postfix/postscreen_access.cidr /etc/_postscreen/postscreen_access.cidr
        chmod 777 /etc/_postscreen/postscreen_access.cidr
    fi

    ;;
*)
    echo "please give me an argument"
    ;;
esac
