#!/bin/bash
source /.env
source /_VARIABLES
source /.mysql-root-pw

echo "-> $(basename "$0" .sh): $1"

case $1 in
build)

    apt -y install rspamd
    cp -R -f /docker-config/conf.d/rspamd/* /etc/rspamd/
    echo password="$(rspamadm pw -q -p ${MYSQL_USERMAIL_PASSWORD})" >/etc/rspamd/local.d/worker-controller.inc

    if [ ! $NOTIFY_SPAM_REJECT == false ] && [ $NOTIFY_SPAM_REJECT_TO ]; then
        sed -i "s/____notifySpamRejectTo/${NOTIFY_SPAM_REJECT_TO}/g" /etc/rspamd/local.d/metadata_exporter.conf
        sed -i "s/enabled = false/enabled = true/g" /etc/rspamd/local.d/metadata_exporter.conf
    else
        sed -i "s/enabled = true/enabled = false/g" /etc/rspamd/local.d/metadata_exporter.conf
    fi

    ;;
container)

    rm -f /var/lib/rspamd/*.hs*
    rm -f /var/lib/rspamd/*.map

    ;;
*)
    echo "please give me an argument"
    ;;
esac
