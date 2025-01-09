#!/bin/bash
source /.env
source /_VARIABLES
source /.mysql-root-pw

echo "-> $(basename "$0" .sh): $1"

case $1 in
build)

    apt install -y dovecot-core dovecot-imapd dovecot-pop3d dovecot-lmtpd dovecot-mysql dovecot-sieve dovecot-managesieved mailutils

    cp -R -f /docker-config/conf.d/dovecot/* /etc/dovecot/

    # dovecot changes
    chown -R vmail:dovecot /etc/dovecot
    chmod -R o-rwx /etc/dovecot

    sievec /etc/dovecot/sieve-before/10-spam.sieve
    sievec /etc/dovecot/sieve-after/10-spam.sieve
    sievec /etc/dovecot/sieve/default.sieve
    sievec /etc/dovecot/sieve/report-spam.sieve
    sievec /etc/dovecot/sieve/report-ham.sieve
    chmod u=rw,go= /etc/dovecot/sieve/report-{spam,ham}.{sieve,svbin}
    chown vmail:vmail /etc/dovecot/sieve/report-{spam,ham}.{sieve,svbin}
    chmod u=rwx,go= /etc/dovecot/sieve/sa-learn-{spam,ham}.sh
    chown vmail:vmail /etc/dovecot/sieve/sa-learn-{spam,ham}.sh

    sed -i "s/____mailRootPass/${MYSQL_ROOT_PASSWORD}/g" /etc/dovecot/db-sql/_mysql-connect.conf
    sed -i "s/____domainFQDN/${DOMAIN_FQDN}/g" /etc/dovecot/dovecot.conf

    cp -Rf /var/mail /var/mail.DOCKER_TMP

    ;;
container)

    if [ -d /var/mail.DOCKER_TMP ] && [ -z "$(ls -A '/var/mail')" ]; then
        mv -f /var/mail.DOCKER_TMP/* /var/mail/
    fi
    rm -R /var/mail.DOCKER_TMP

    mkdir -p /var/mail/vhosts/
    groupadd -g 5000 vmail
    useradd -g vmail -u 5000 vmail -d /var/mail
    chown -R vmail:vmail /var/mail

    ;;
*)
    echo "please give me an argument"
    ;;
esac
