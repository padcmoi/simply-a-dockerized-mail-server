#!/bin/bash

# Database credentials
DB_HOST="localhost"
DB_USER="root"
DB_PASS="____mailRootPass"
DB_NAME="mailserver"

# Senders entries from the database
sender_data="/var/_custom_rules/senders.dat"
if [ ! -f "$sender_data" ]; then
    touch "$sender_data" && chmod 777 "$sender_data"
fi

# Create the sieve script
sieve_script="/var/_custom_rules/senders.sieve"
if [ ! -f "$sieve_script" ]; then
    echo "require [\"reject\"];" >"$sieve_script" && chmod 777 "$sieve_script"
fi

# Query to get the senders to reject
SQL_QUERY="SELECT sender FROM SieveRejectSenders WHERE date_creation > DATE_SUB(NOW(), INTERVAL 60 SECOND) AND enabled=1"

# Fetch the senders from the database
senders=$(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -se "$SQL_QUERY")

if [ -z "$senders" ]; then
    echo "No new senders to reject."
else
    count=0
    for sender in $senders; do
        # Append each new sender to the senders.dat file
        if ! grep -q "$sender" "$sender_data"; then
            echo "$sender" >>"$sender_data"
            echo "if address :contains \"from\" \"$sender\" { reject \"Emails from this sender are not accepted.\"; }" >>"$sieve_script"
            count=$((count + 1))
        fi
    done

    message="SIEVE FILTER: Number of senders added to reject: $count"
    /usr/bin/logger $message
    echo $message
fi

# Verify if the senders in sender_data exist in the database
while IFS= read -r sender; do
    check_query="SELECT COUNT(*) FROM SieveRejectSenders WHERE sender='$sender' AND enabled=1"
    sender_exists=$(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -se "$check_query")

    if [ "$sender_exists" -eq 0 ]; then
        echo "Sender $sender no longer exists in the database. Removing from sender_data."
        sed -i "/$sender/d" "$sender_data"
        sed -i "/$sender/d" "$sieve_script"
    fi
done <"$sender_data"
