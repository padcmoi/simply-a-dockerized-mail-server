
# Certificates note

The container is not accessible from the outside on port 80, so certificates will have to be updated from the host machine

## NOTE

Certificates can be hot-swapped without rebooting, changing certificates will automatically update dovecot and postfix

For letsencrypt, this script will search for changes made to certificates and copy them to the folder, please use this script in this directory

Example syntax

`./update-letsencrypt-certs.sh fqdn.example.com`

Letsencrypt certs have a short validity, for other certificates you can use a cron job.
