#!/bin/bash
# Inspired by the configuration in this tutorial
# https://blog.ausics.net/archives/154-Email-Anti-Spoofing-DMARC.html

source /.env
source /_VARIABLES
source /.system_password
source /utils/escape

echo "-> $(basename "$0" .sh): $1"

# Required
[ ! -f "24-rspamd.sh" ] && exit

case $1 in
build)

    if [ "$DMARC_ENABLE" != "false" ] && [ "$DMARC_REPORTS" ] && [ "$DMARC_DOMAIN" ] && [ "$DMARC_ORG_NAME" ] &&
        ([ "$DMARC_SELECT" == "RSPAMD" ] || [ "$DMARC_SELECT" == "OpenDMARC" ]); then

        case $DMARC_SELECT in

        RSPAMD)
            echo "configure dmarc with rspamd ..." && sleep 5

            sed -i "s/____dmarcEnable/${DMARC_ENABLE}/g" /etc/rspamd/local.d/dmarc.conf

            ;;

        OpenDMARC)

            sed -i "s/____dmarcEnable/false/g" /etc/rspamd/local.d/dmarc.conf

            # install opendmarc
            /usr/share/debconf/fix_db.pl &&
                echo "opendmarc opendmarc/dbconfig-install boolean true" | debconf-set-selections &&
                echo "opendmarc opendmarc/dbconfig-reinstall boolean true" | debconf-set-selections &&
                echo "opendmarc opendmarc/mysql/app-pass password ${SYSTEM_PASSWORD}" | debconf-set-selections &&
                echo "opendmarc opendmarc/mysql/app-pass-confirm password ${SYSTEM_PASSWORD}" | debconf-set-selections &&
                DEBIAN_FRONTEND=noninteractive apt --assume-yes install opendmarc

            # add to postfix milters
            if [ -f "26-opendkim.sh" ]; then
                # Special case, should be loaded between OpenDKIM and RSPAMD (this rule does not check for RSPAMD)
                sed -i '/inet:localhost:12301,/ s/,/, inet:localhost:8893,/' /etc/postfix/main.cf
            else
                sed -i '/^smtpd_milters =/ s/=/= inet:localhost:8893,/' /etc/postfix/main.cf
            fi

            if [ "$DMARC_REPORT_HOUR" -ge 0 ] && [ "$DMARC_REPORT_HOUR" -le 23 ]; then
                dmarcReportHourChecked=$DMARC_REPORT_HOUR
            else
                dmarcReportHourChecked=2
            fi

            sed -i "s/____dmarcDomain/${DMARC_DOMAIN}/g" /usr/local/bin/dmarc_reports.sh
            sed -i "s/____dmarcOrgName/${DMARC_ORG_NAME}/g" /usr/local/bin/dmarc_reports.sh
            sed -i "s/____dmarcReportHour/${dmarcReportHourChecked}/g" /usr/local/bin/dmarc_reports.sh

            ;;

        esac

    else

        sed -i "s/____dmarcEnable/false/g" /etc/rspamd/local.d/dmarc.conf

    fi

    sed -i "s/____dmarcReports/${DMARC_REPORTS}/g" /etc/rspamd/local.d/dmarc.conf
    sed -i "s/____dmarcDomain/${DMARC_DOMAIN}/g" /etc/rspamd/local.d/dmarc.conf
    sed -i "s/____dmarcOrgName/${DMARC_ORG_NAME}/g" /etc/rspamd/local.d/dmarc.conf

    ;;

save-volume)

    #

    ;;

retrieve-volume)

    #

    ;;

container)

    if [ "$DMARC_ENABLE" != "false" ] && [ "$DMARC_REPORTS" ] && [ "$DMARC_DOMAIN" ] && [ "$DMARC_ORG_NAME" ] &&
        ([ "$DMARC_SELECT" == "RSPAMD" ] || [ "$DMARC_SELECT" == "OpenDMARC" ]); then

        case $DMARC_SELECT in

        RSPAMD)

            # action

            ;;

        OpenDMARC)

            # check database
            mysql -u root </docker-build/database/opendmarc.sql

            # import and configure conf files

            cp -R -f /docker-build/conf.d/opendmarc/* /etc/

            sed -i "s/____domainFQDN/${DOMAIN_FQDN}/g" $OPENDMARC_CONFIG
            sed -i "s/____dmarcReports/${DMARC_REPORTS}/g" $OPENDMARC_CONFIG
            sed -i "s/____opendmarcVarFolder/$(escape_slash "$OPENDMARC_VAR")/g" $OPENDMARC_CONFIG
            sed -i "s/____opendmarcRejectFailures/${DMARC_REJECT_FAILURES}/g" $OPENDMARC_CONFIG

            # permission

            mkdir -p $OPENDMARC_VAR
            mkdir -p $OPENDMARC_VAR/etc
            mkdir -p $OPENDMARC_VAR/archives

            [ ! -f "${OPENDMARC_VAR}/etc/ignore.hosts" ] && cat /etc/opendmarc/ignore.hosts >$OPENDMARC_VAR/etc/ignore.hosts
            [ ! -f "${OPENDMARC_VAR}/etc/whitelist.domains" ] && cat /etc/opendmarc/whitelist.domains >$OPENDMARC_VAR/etc/whitelist.domains

            chown -R opendmarc:opendmarc $OPENDMARC_VAR
            chmod -R 755 $OPENDMARC_VAR
            chown -R opendmarc:opendmarc $OPENDMARC_RUNDIR
            chmod -R 777 $OPENDMARC_RUNDIR

            ;;

        esac

    fi

    ;;

run)

    systemctl start opendmarc && systemctl status opendmarc | grep 'Active'
    nn 8893

    ;;

*)
    echo "please give me an argument"
    ;;
esac
