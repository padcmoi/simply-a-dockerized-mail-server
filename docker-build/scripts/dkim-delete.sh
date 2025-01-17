#!/bin/bash
source /_VARIABLES

SIGNING_TABLE=$OPENDKIM_SIGNING_TABLE
KEY_TABLE=$OPENDKIM_KEY_TABLE
TRUSTED_HOSTS=$OPENDKIM_TRUSTED_HOSTS
KEYS_PATH=$OPENDKIM_KEYS_PATH
KEY_NAME=$OPENDKIM_KEY_NAME
OWNER_FILE=$OPENDKIM_OWNER_FILE

check() {
    grep -E "#__DOMAIN__$1$" $SIGNING_TABLE >>/dev/null
    signingTable=$?

    grep -E "#__DOMAIN__$1$" $KEY_TABLE >>/dev/null
    keyTable=$?

    grep -E "#__DOMAIN__$1$" $TRUSTED_HOSTS >>/dev/null
    trustedHosts=$?
}

[ ! $2 ] && echo "OPTIONNAL Args: <DOMAIN> no-restart"

if [ $1 ]; then

    check $1

    if [ $signingTable -eq 0 ]; then
        sed -i "/#__DOMAIN__$1$/{N;N;N;d}" $SIGNING_TABLE
    else
        echo "Warn, the domain $1 doesnt exist in signing.table"
    fi

    if [ $keyTable -eq 0 ]; then
        sed -i "/#__DOMAIN__$1$/{N;N;d}" $KEY_TABLE
    else
        echo "Warn, the domain $1 doesnt exist in key.table"
    fi

    if [ $trustedHosts -eq 0 ]; then
        sed -i "/#__DOMAIN__$1$/{N;N;d}" $TRUSTED_HOSTS

    else
        echo "Warn, the domain $1 doesnt exist in trusted.hosts"
    fi

    if [ -d $KEYS_PATH/$1 ]; then
        sudo rm -Rf $KEYS_PATH/$1
    else
        echo "Warn, the folder containing the key $1 doesnt exist"
    fi

    if [ ! $2 ] || [ ! $2 == "no-restart" ]; then
        sudo killall -w opendkim
        sudo opendkim -x /etc/opendkim.conf
        sudo netstat -tuln | grep '12301'
    else
        echo "No restart"
    fi
else
    echo "Please give me an arg"
fi
