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

if [ $1 ]; then

    check $1

    if [ ! -d $KEYS_PATH/$1 ]; then
        echo "Warn, the folder containing the key $1 doesnt exist"
        echo "Recreating from scratch ..."
        dkim-create.sh $1 force
    elif
        [ ! $signingTable -eq 0 ] || [ ! $keyTable -eq 0 ] || [ ! $trustedHosts -eq 0 ]
    then
        echo "Error, one or more domains are missing in the configuration"
        echo "Recreating from scratch ..."
        dkim-create.sh $1 force
    else
        # OLD_KEY_NAME=$(basename $KEYS_PATH/$1/*.private_key .private_key)

        sudo opendkim-genkey -b 2048 -d $1 -D $KEYS_PATH/$1 -s $KEY_NAME -v

        sudo mv $KEYS_PATH/$1/$KEY_NAME.private $KEYS_PATH/$1/$KEY_NAME.private_key
        sudo mv $KEYS_PATH/$1/$KEY_NAME.txt $KEYS_PATH/$1/public_key-$KEY_NAME-$1.txt

        # permissions
        sudo chown -R $OPENDKIM_OWNER_FILE $OPENDKIM_CONFIG_TABLES
        sudo chmod -R 655 $OPENDKIM_CONFIG_TABLES

        # force permissions on private keys
        sudo chmod 600 $OPENDKIM_KEYS_PATH/*/*.private_key
        sudo chown -R $OPENDKIM_OWNER_FILE $OPENDKIM_KEYS_PATH/*/*.private_key

        sudo opendkim-testkey -d $1 -s $KEY_NAME -vvv

        sudo cat $KEYS_PATH/$1/public_key-$KEY_NAME-$1.txt

        sudo killall -w opendkim
        sudo opendkim -x /etc/opendkim.conf
        sudo netstat -tuln | grep '12301'
    fi

else
    echo "Please give me an arg"
fi
