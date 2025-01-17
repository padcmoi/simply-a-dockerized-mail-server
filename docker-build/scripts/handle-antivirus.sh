#!/bin/bash
source /.env

echo "Configuration rspam: $(rspamadm configtest)"

if [ $DISABLE_ANTIVIRUS == true ]; then
    service clamav-freshclam stop
    service clamav-daemon stop

    sed -i "s/enabled = true/enabled = false/g" /etc/rspamd/local.d/antivirus.conf

    service rspamd reload

    echo "ANTIVIRUS CLAMAV DISABLED !!!"
else
    # update then start
    service clamav-daemon stop
    service clamav-freshclam stop
    rm /var/log/clamav/freshclam.log
    freshclam
    service clamav-freshclam start

    service clamav-daemon start

    sed -i "s/enabled = false/enabled = true/g" /etc/rspamd/local.d/antivirus.conf

    service rspamd reload

    echo "ANTIVIRUS CLAMAV ENABLED !!!"
fi

# TODO remove mail test
sleep 10 && swaks --to julien@example.local --attach - --server 127.0.0.1:25 </opt/eicar.com
