#!/bin/bash
source /.env
source /_VARIABLES

echo "-> $(basename "$0" .sh): $1"

case $1 in
build)

    MYSQL_ROOT_PASSWORD=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 50)
    echo "MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}" >/.mysql-root-pw

    sed -i "s/____mailRootPass/${MYSQL_ROOT_PASSWORD}/g" /docker-config/database/config.sql
    sed -i "s/____mailUserPass/${ADMIN_PASSWORD}/g" /docker-config/database/config.sql

    apt install -y mariadb-client mariadb-server

    # separate log warn, ... in dedicated file
    sed -i "/nice =./{N;N;d}" /etc/mysql/mariadb.conf.d/50-mysqld_safe.cnf
    echo "log_error = /var/log/mysql/error.log" >>/etc/mysql/mariadb.conf.d/50-mysqld_safe.cnf

    ;;
container)

    if [ -d /var/lib/mysql.DOCKER_TMP ] && [ -z "$(ls -A '/var/lib/mysql')" ]; then
        mv -f /var/lib/mysql.DOCKER_TMP/* /var/lib/mysql/
        chmod -R 755 /var/lib/mysql
        chown -R mysql:mysql /var/lib/mysql
    fi
    rm -R /var/lib/mysql.DOCKER_TMP

    source /.mysql-root-pw

    service mariadb start

    mysql -u root </docker-config/database/config.sql && mysql -u root </docker-config/database/build.sql

    ;;
*)
    echo "please give me an argument"
    ;;
esac
