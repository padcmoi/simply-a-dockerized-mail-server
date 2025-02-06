#!/bin/bash

# Read permission for other users to view logs on the host machine
chmod -R o+rx /var/log

# check db reject mail
/usr/local/bin/handle-sieve-rules.sh
