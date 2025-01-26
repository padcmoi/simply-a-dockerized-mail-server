#!/bin/bash

servicesIsRunning() {
    services=(
        "/usr/lib/postfix"
        "/usr/sbin/dovecot"
        "/usr/sbin/mariadbd"
        "/usr/sbin/rsyslogd"
        "/usr/bin/redis-server"
        "/usr/sbin/clamd"
        "rspamd"
        "/usr/sbin/opendkim"
        "/usr/sbin/opendmarc"
        "/usr/sbin/apache2"
        "/usr/bin/fail2ban-server"
    )

    status=""

    for service in "${services[@]}"; do
        service_name=$(basename "$service")
        if ps aux | grep -v grep | grep "$service" >/dev/null; then
            status+="$service_name: 🟢"
        else
            status+="$service_name: 🔴"
        fi
        status+=" | "
    done

    # Remove the trailing " | "
    status=${status% | }

    echo $status
}

servicesIsRunning
