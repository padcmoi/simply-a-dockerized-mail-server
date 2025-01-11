#!/bin/bash
source /.env
source /_VARIABLES
source /.mysql-root-pw

echo "-> $(basename "$0" .sh): $1"

case $1 in
build)

    apt -y install clamav-daemon clamav-freshclam clamav clamav-freshclam clamav-testfiles clamav-base

    cp -R -f /docker-config/conf.d/clamav/* /etc/clamav/
    sed -i -e "s/^NotifyClamd/#NotifyClamd/g" /etc/clamav/freshclam.conf

    ;;

save-volume)

    cp -Rf /var/lib/clamav /var/lib/clamav.DOCKER_TMP

    ;;

retrieve-volume)

    if [ -d /var/lib/clamav.DOCKER_TMP ] && [ -z "$(ls -A '/var/lib/clamav')" ]; then
        mv -f /var/lib/clamav.DOCKER_TMP/* /var/lib/clamav/
        chown -R clamav:clamav /var/lib/clamav
    fi
    rm -R /var/lib/clamav.DOCKER_TMP

    ;;

container)

    #
    ;;
*)
    echo "please give me an argument"
    ;;
esac
