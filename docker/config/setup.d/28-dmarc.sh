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

            ;;

        OpenDMARC)

            sed -i "s/____dmarcEnable/false/g" /etc/rspamd/local.d/dmarc.conf

            # add to postfix milters
            if [ -f "26-opendkim.sh" ]; then
                # Special case, should be loaded between OpenDKIM and RSPAMD (this rule does not check for RSPAMD)
                sed -i '/inet:localhost:12301,/ s/,/, inet:localhost:12305,/' /etc/postfix/main.cf
            else
                sed -i '/^smtpd_milters =/ s/=/= inet:localhost:12305,/' /etc/postfix/main.cf
            fi

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

    if [ ! $DMARC_ENABLE == false ] && [ $DMARC_REPORTS ] && ([ $DMARC_SELECT == "RSPAMD" ] || [ $DMARC_SELECT == "OpenDMARC" ]); then

        case $DMARC_SELECT in

        RSPAMD)

            # action

            ;;

        OpenDMARC)

            apt -y install dbconfig-common dbconfig-mysql dbconfig-sqlite3

            # install opendmarc
            /usr/share/debconf/fix_db.pl &&
                echo "opendmarc opendmarc/dbconfig-install boolean true" | debconf-set-selections &&
                echo "opendmarc opendmarc/dbconfig-reinstall boolean true" | debconf-set-selections &&
                echo "opendmarc opendmarc/mysql/app-pass password ${MYSQL_ROOT_PASSWORD}" | debconf-set-selections &&
                echo "opendmarc opendmarc/mysql/app-pass-confirm password ${MYSQL_ROOT_PASSWORD}" | debconf-set-selections &&
                apt --assume-yes install opendmarc

            # import and configure conf files

            cp -R -f /docker-config/conf.d/opendmarc/* /etc/

            sed -i "s/____domainFQDN/${DOMAIN_FQDN}/g" /etc/opendmarc.conf
            sed -i "s/____dmarcReports/${DMARC_REPORTS}/g" /etc/opendmarc.conf

            # run daemon
            opendmarc -c /etc/opendmarc.conf

            # permission
            chown opendmarc:opendmarc -R /var/run/opendmarc

            ;;

        esac

    fi

    ;;
*)
    echo "please give me an argument"
    ;;
esac
