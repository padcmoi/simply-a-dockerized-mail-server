# Distribution tests:
# bullseye (debian11) = OK, All services work except clamav-daemon, but antivirus works on emails
# bookworm (debian12) = ERROR, issues with dovecot quota domain, amavis
FROM debian:bullseye

ARG DOMAIN_FQDN

# Installation packages
RUN apt update
RUN apt autoremove -y exim4
RUN apt install -y git curl sudo net-tools nano htop procps findutils wget zip systemctl rsyslog \ 
inotify-tools bind9-dnsutils kmod iptables nftables

RUN mkdir -p /docker-config

# Configuration
WORKDIR /docker-config
COPY ./config/ .
COPY .env /.env

RUN cp -R -f ./conf.d/cron.d/* /etc/cron.d/
RUN chmod 644 /etc/cron.d/*

RUN mv ./conf.d/_VARIABLES /_VARIABLES
RUN chmod 444 /_VARIABLES

RUN chmod +x **/*.sh
RUN chmod +x *.sh

RUN chmod +x ./scripts/*
RUN mv ./scripts/* /usr/local/bin/

RUN /docker-config/docker-setup.sh build

ENTRYPOINT ["docker-entrypoint.sh"]
