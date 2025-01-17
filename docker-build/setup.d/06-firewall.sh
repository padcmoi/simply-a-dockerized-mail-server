#!/bin/bash
source /.env
source /_VARIABLES
source /.system_password

echo "-> $(basename "$0" .sh): $1"

case $1 in
build)

    apt -y install ufw

    cp /etc/ufw/before.rules /etc/ufw/before.rules.org

    ;;

save-volume) ;;

retrieve-volume) ;;

container)

    ufw default deny incoming
    ufw default allow outgoing

    ufw allow 4000,4001,4002,4080,4443/tcp
    ufw allow 3000/tcp

    ufw allow 25,465,587/tcp
    ufw allow 143,993/tcp

    # Need to be improved, I chose ufw for simplicity,
    # I don't know if you can filter syn attacks for example ...
    # Or implement another firewall,
    # NOTE dont forget the jail.conf of fail2ban which uses ufw

    # cat /docker-build/conf.d/ufw/before.rules >/etc/ufw/before.rules

    ;;

run)

    ufw enable
    ufw status

    ;;

*)
    echo "please give me an argument"
    ;;
esac
