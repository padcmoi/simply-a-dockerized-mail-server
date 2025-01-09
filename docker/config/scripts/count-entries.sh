#!/bin/bash

request=$(mysql -e "SELECT count(*) FROM mailserver.account" | cut -d \t -f 7)

if [ $request == "0" ]; then
    echo "ok"
fi

echo $request
