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
container)

    # echo "no action

    ;;
*)
    echo "please give me an argument"
    ;;
esac
