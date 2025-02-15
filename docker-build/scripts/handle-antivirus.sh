#!/bin/bash
source /.env

SOCKET_CLAMD="/var/run/clamav/clamd.ctl"

echo "Configuration rspam: $(rspamadm configtest)"

chmod -R 774 /var/log/clamav

_escapeSed() {
    echo "$1" | sed -e 's/[]\/$*.^|[]/\\&/g'
}

if [ "$ANTIVIRUS" -eq 0 ]; then
    service clamav-freshclam stop
    service clamav-daemon stop

    sed -i "s/^enabled = .*/enabled = false/" /etc/rspamd/local.d/antivirus.conf
    sed -i "s/servers = .*/servers = \"$(_escapeSed "$SOCKET_CLAMD")\"/" /etc/rspamd/local.d/antivirus.conf

    service rspamd reload

    echo "ANTIVIRUS DISABLED !!!"
elif [ "$ANTIVIRUS" -eq 1 ]; then
    # update then start
    service clamav-daemon stop
    service clamav-freshclam stop
    rm /var/log/clamav/freshclam.log
    freshclam
    service clamav-freshclam start

    service clamav-daemon start

    sed -i "s/^enabled = .*/enabled = true/" /etc/rspamd/local.d/antivirus.conf
    sed -i "s/servers = .*/servers = \"$(_escapeSed "$SOCKET_CLAMD")\"/" /etc/rspamd/local.d/antivirus.conf

    service rspamd reload

    echo "ANTIVIRUS ENABLED (local clamav) !!!"
elif [ "$ANTIVIRUS" -eq 2 ]; then
    # update then start
    service clamav-daemon stop
    service clamav-freshclam stop

    sed -i "s/^enabled = .*/enabled = true/" /etc/rspamd/local.d/antivirus.conf
    sed -i "s/servers = .*/servers = \"$(_escapeSed "$ANTIVIRUS_REMOTE_SERVER")\"/" /etc/rspamd/local.d/antivirus.conf

    service rspamd reload

    echo "ANTIVIRUS ENABLED (remote server clamav) !!!"
fi
