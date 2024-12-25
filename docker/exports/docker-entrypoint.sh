#!/bin/bash
source /.env

# Installation packages after volume mount
if [ ! -f /.package-installed ]; then
    apt update
fi

# Mysql and create if not exists database
if [ ! -f /.package-installed ]; then
    MYSQL_ROOT_PASSWORD=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 50)
    echo "MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}" >/.mysql-root-pw
    sed -i "s/____mailRootPass/${MYSQL_ROOT_PASSWORD}/g" /opt/exports/config.sql
    sed -i "s/____mailUserPass/${MYSQL_USERMAIL_PASSWORD}/g" /opt/exports/config.sql

    apt install -y mariadb-client mariadb-server
    service mariadb restart

    mysql -u root </opt/exports/config.sql && mysql -u root </opt/exports/build.sql

    chmod -R 777 /var/lib/mysql/*
fi

# TODO Account management is done with PhpMyAdmin while waiting for the API to be created, and will be removed at a later date.
if [ ! -f /.package-installed ]; then
    apt install -y php-mysqli
fi

source /.mysql-root-pw

# Postfix
if [ ! -f /.package-installed ]; then
    {
        echo postfix postfix/main_mailer_type select Internet Site
        echo postfix postfix/mailname string $HOSTNAME
    } | debconf-set-selections && apt install --assume-yes postfix postfix-mysql
fi

# Dovecot
if [ ! -f /.package-installed ]; then
    apt install -y dovecot-core dovecot-imapd dovecot-pop3d dovecot-lmtpd dovecot-mysql dovecot-sieve dovecot-managesieved mailutils
fi

# Configure files
if [ ! -f /.package-installed ]; then
    cp -R -f /opt/conf/postfix/* /etc/postfix/
    cp -R -f /opt/conf/dovecot/* /etc/dovecot/

    # postfix changes
    sed -i "s/____hostName/${HOSTNAME}/g" /etc/postfix/main.cf
    sed -i "s/____mailRootPass/${MYSQL_ROOT_PASSWORD}/g" /etc/postfix/mysql-virtual-alias-maps.cf
    sed -i "s/____mailRootPass/${MYSQL_ROOT_PASSWORD}/g" /etc/postfix/mysql-virtual-email2email.cf
    sed -i "s/____mailRootPass/${MYSQL_ROOT_PASSWORD}/g" /etc/postfix/mysql-virtual-mailbox-domains.cf
    sed -i "s/____mailRootPass/${MYSQL_ROOT_PASSWORD}/g" /etc/postfix/mysql-virtual-mailbox-maps.cf

    # dovecot changes
    mkdir -p /var/mail/vhosts/
    groupadd -g 5000 vmail
    useradd -g vmail -u 5000 vmail -d /var/mail
    chown -R vmail:vmail /var/mail
    chown -R vmail:dovecot /etc/dovecot
    chmod -R o-rwx /etc/dovecot
    sed -i "s/____mailRootPass/${MYSQL_ROOT_PASSWORD}/g" /etc/dovecot/db-sql/_mysql-connect.conf
    sed -i "s/____hostName/${HOSTNAME}/g" /etc/dovecot/dovecot.conf

fi

# Amavis Clamav
if [ ! -f /.package-installed ]; then
    apt -y install clamav
    cp -R -f /opt/conf/clamav/* /etc/clamav/
    sed -i -e "s/^NotifyClamd/#NotifyClamd/g" /etc/clamav/freshclam.conf
    service clamav-freshclam stop
    rm /var/log/clamav/freshclam.log
    freshclam
    service clamav-freshclam start

    apt -y install clamav-base clamav-daemon clamav-freshclam clamav-testfiles amavisd-new
    cp -R -f /opt/conf/amavis/* /etc/amavis/
    usermod -a -G amavis clamav
    sed -i "s/____hostName/${HOSTNAME}/g" /etc/amavis/conf.d/05-node_id
    sed -i "s/____hostName/${HOSTNAME}/g" /etc/amavis/conf.d/20-debian_defaults
fi

# start services
service amavis restart
service mariadb restart
service spamd restart
service dovecot restart
service postfix restart
service apache2 restart

service dovecot status
service postfix status

# exec some scripts ...
## check in background changes in ssl certs /etc/_private/fullchain.*
check-mail-ssl-files.sh </dev/null &>/dev/null &
## provides logs in volume/log
debug-autocopy-logs.sh </dev/null &>/dev/null &
## provides mail in volume/mail
make-public-mail-volume.sh </dev/null &>/dev/null &

# Declares .package-installed to avoid repeating the reinstallation of packages at each launch
touch /.package-installed

# # case app
# rm /var/www/html/*
# cd /opt/source/www
# pnpm install
# pnpm run build
# mv dist/* /var/www/html/
# /etc/init.d/./apache2 start

# # case api
mv /opt/source/api /opt/api
cd /opt/api
cp .env.sample .env
pnpm install
pnpm run build

clear
netstat -tulpn | grep -E -w 'tcp|udp'
echo "Hostname: ${HOSTNAME} (${ADRESSIP})"
echo "MYSQL ROOT PASSWORD: ${MYSQL_ROOT_PASSWORD}"

node dist/main

## NodeJS API
## check package to encrypt mail password
# https://github.com/mvo5/sha512crypt-node
# https://stackoverflow.com/questions/37732331/execute-bash-command-in-node-js-and-get-exit-code
