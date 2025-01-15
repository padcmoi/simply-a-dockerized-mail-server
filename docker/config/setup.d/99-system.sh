#!/bin/bash
source /.env
source /_VARIABLES
source /.mysql-root-pw

echo "-> $(basename "$0" .sh): $1"

case $1 in
build)

    #

    ;;

save-volume) ;;

retrieve-volume) ;;

container)

    cp -Rf /docker-config/conf.d/default/* /etc/default/
    cp -Rf /docker-config/conf.d/dbconfig-common/* /etc/dbconfig-common/

    for fullpath in $(ls /etc/dbconfig-common/*.conf); do
        sed -i "s/____mailRootPass/${MYSQL_ROOT_PASSWORD}/g" $fullpath
        sed -i "s/____mailUserPass/${ADMIN_PASSWORD}/g" $fullpath
    done

    ;;

run)

    service cron start </dev/null &>/dev/null
    service cron status

    ;;

*)
    echo "please give me an argument"
    ;;
esac
