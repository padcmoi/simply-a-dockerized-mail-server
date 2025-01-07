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

[ ! $2 ] && echo "OPTIONNAL Args: <DOMAIN> force"

if [ $1 ]; then

    [ $2 ] && [ $2 == "force" ] && dkim-delete.sh $1 no-restart

    check $1

    if [ ! $signingTable -eq 0 ]; then
        echo "#__DOMAIN__$1" >>$SIGNING_TABLE
        echo "*@$1      $KEY_NAME._domainkey.$1" >>$SIGNING_TABLE
        echo "*@*.$1    $KEY_NAME._domainkey.$1" >>$SIGNING_TABLE
        echo "" >>$SIGNING_TABLE
    else
        echo "Error, the domain $1 already exists in signing.table"
    fi

    if [ ! $keyTable -eq 0 ]; then
        echo "#__DOMAIN__$1" >>$KEY_TABLE
        echo "$KEY_NAME._domainkey.$1     $1:$KEY_NAME:$KEYS_PATH/$1/$KEY_NAME.private_key" >>$KEY_TABLE
        echo "" >>$KEY_TABLE
    else
        echo "Error, the domain $1 already exists in key.table"
    fi

    if [ ! $trustedHosts -eq 0 ]; then
        echo "#__DOMAIN__$1" >>$TRUSTED_HOSTS
        echo ".$1" >>$TRUSTED_HOSTS
        echo "" >>$TRUSTED_HOSTS
    else
        echo "Error, the domain $1 already exists in trusted.hosts"
    fi

    check $1

    if [ ! -d $KEYS_PATH/$1 ] &&
        [ $signingTable -eq 0 ] &&
        [ $keyTable -eq 0 ] &&
        [ $trustedHosts -eq 0 ]; then

        sudo mkdir -p $KEYS_PATH/$1

        sudo opendkim-genkey -b 2048 -d $1 -D $KEYS_PATH/$1 -s $KEY_NAME -v

        sudo mv $KEYS_PATH/$1/$KEY_NAME.private $KEYS_PATH/$1/$KEY_NAME.private_key
        sudo mv $KEYS_PATH/$1/$KEY_NAME.txt $KEYS_PATH/$1/public_key-$KEY_NAME-$1.txt

        sudo chown $OWNER_FILE $KEYS_PATH/$1/$KEY_NAME.private_key
        sudo chmod 600 $KEYS_PATH/$1/$KEY_NAME.private_key
        sudo chmod 777 $KEYS_PATH/$1/public_key-$KEY_NAME-$1.txt

        sudo opendkim-testkey -d $1 -s $KEY_NAME -vvv

        sudo cat $KEYS_PATH/$1/public_key-$KEY_NAME-$1.txt
    else
        echo "Error, domain key dkim $1 could not be created"
    fi

    sudo killall -w opendkim
    sudo opendkim -x /etc/opendkim.conf
    sudo netstat -tuln | grep '12301'

else
    echo "Please give me an arg"
fi
