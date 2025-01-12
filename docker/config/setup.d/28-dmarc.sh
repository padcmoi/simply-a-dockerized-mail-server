#!/bin/bash
source /.env
source /_VARIABLES
source /.mysql-root-pw

echo "-> $(basename "$0" .sh): $1"

# Required
[ ! -f "24-rspamd.sh" ] && exit

case $1 in
build)

    if [ ! $DMARC_ENABLE == false ] && [ $DMARC_REPORTS ] && ([ $DMARC_SELECT == "RSPAMD" ] || [ $DMARC_SELECT == "OpenDMARC" ]); then

        case $DMARC_SELECT in

        RSPAMD)
            echo "configure dmarc with rspamd ..." && sleep 5

            sed -i "s/____dmarcEnable/${DMARC_ENABLE}/g" /etc/rspamd/local.d/dmarc.conf
            sed -i "s/____dmarcReports/${DMARC_REPORTS}/g" /etc/rspamd/local.d/dmarc.conf
            sed -i "s/____dmarcDomain/${DMARC_DOMAIN}/g" /etc/rspamd/local.d/dmarc.conf
            sed -i "s/____dmarcOrgName/${DMARC_ORG_NAME}/g" /etc/rspamd/local.d/dmarc.conf

            ;;

        OpenDMARC)
            echo "configure dmarc with OpenDMARC ..." && sleep 5

            ;;

        esac

    else

        sed -i "s/____dmarcEnable/false/g" /etc/rspamd/local.d/dmarc.conf
        sed -i "s/____dmarcReports/${DMARC_REPORTS}/g" /etc/rspamd/local.d/dmarc.conf
        sed -i "s/____dmarcDomain/${DMARC_DOMAIN}/g" /etc/rspamd/local.d/dmarc.conf
        sed -i "s/____dmarcOrgName/${DMARC_ORG_NAME}/g" /etc/rspamd/local.d/dmarc.conf

    fi

    ;;

save-volume)

    #

    ;;

retrieve-volume)

    #

    ;;

container)

    #

    ;;
*)
    echo "please give me an argument"
    ;;
esac
