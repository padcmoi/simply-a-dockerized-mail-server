#!/bin/bash
source /.env
source /_VARIABLES
source /.system_password

echo "-> $(basename "$0" .sh): $1"

case $1 in
build)

    for fullpath in $(ls /docker-build/database/*.sql); do
        sed -i "s/____mailRootPass/${SYSTEM_PASSWORD}/g" $fullpath
        sed -i "s/____mailUserPass/${ADMIN_PASSWORD}/g" $fullpath
    done

    apt install -y mariadb-client mariadb-server

    # separate log warn, ... in dedicated file
    sed -i "/nice =./{N;N;d}" /etc/mysql/mariadb.conf.d/50-mysqld_safe.cnf
    echo "log_error = /var/log/mysql/error.log" >>/etc/mysql/mariadb.conf.d/50-mysqld_safe.cnf

    # Opens a socket to allow applications to add content to the database during the image build.
    /bin/bash -c "/usr/bin/mysqld_safe --skip-grant-tables &"

    # apt install debconf-get-selections
    apt -y install dbconfig-common dbconfig-mysql dbconfig-sqlite3

    ;;

save-volume)

    cp -Rf /var/lib/mysql /var/lib/mysql.DOCKER_TMP

    ;;

retrieve-volume)

    if [ -d /var/lib/mysql.DOCKER_TMP ] && [ -z "$(ls -A '/var/lib/mysql')" ]; then
        mv -f /var/lib/mysql.DOCKER_TMP/* /var/lib/mysql/
        chmod -R 755 /var/lib/mysql
        chown -R mysql:mysql /var/lib/mysql
    fi
    rm -R /var/lib/mysql.DOCKER_TMP

    ;;

container)

    source /.system_password

    service mariadb start >/dev/null

    mysql -u root </docker-build/database/config.sql && mysql -u root </docker-build/database/build.sql

    ;;

run)

    service mariadb start </dev/null &>/dev/null
    nn 3306

    ;;

*)
    echo "please give me an argument"
    ;;
esac
