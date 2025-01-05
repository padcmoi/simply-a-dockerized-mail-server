# Distribution tests:
# bullseye (debian11) = OK, All services work except clamav-daemon, but antivirus works on emails
# bookworm (debian12) = ERROR, issues with dovecot quota domain, amavis
FROM debian:bullseye

ARG DOMAIN_FQDN

# Installation packages
RUN apt update 
RUN apt autoremove -y exim4
RUN apt install -y git curl sudo net-tools nano htop procps findutils wget zip inotify-tools iptables systemctl rsyslog bind9-dnsutils

# download repository
RUN mkdir -p /opt/source
WORKDIR /opt/source
RUN git clone https://github.com/padcmoi/simply-docker-sql-mailserver
RUN mv simply-docker-sql-mailserver/webadmin/* .
RUN rm -R simply-docker-sql-mailserver

# Webadmin & API
RUN apt install -y apache2
RUN a2enmod ssl rewrite proxy proxy_http
RUN curl -sL https://deb.nodesource.com/setup_20.x | sudo -E bash -
RUN apt install -y nodejs
RUN npm install -g pnpm

# TODO Account management is done with PhpMyAdmin while waiting for the API to be created, and will be removed at a later date.
RUN apt install -y libapache2-mod-php php-mbstring php-zip php-gd php-json php-curl
WORKDIR /var/www/
RUN wget https://files.phpmyadmin.net/phpMyAdmin/5.2.1/phpMyAdmin-5.2.1-all-languages.zip
RUN unzip /var/www/phpMyAdmin-5.2.1-all-languages.zip -d /var/www/
RUN rm phpMyAdmin*.zip
RUN mv /var/www/phpMyAdmin* /var/www/mysql
RUN chmod -R 755 /var/www/mysql

# Copy config files
WORKDIR /opt
COPY .env /.env
COPY ./conf/ ./conf/
COPY ./exports/ ./exports/
RUN chmod +x ./exports/*.sh
RUN mv ./exports/*.sh /usr/local/bin/

RUN cp -R -f /opt/conf/cron.d/* /etc/cron.d/
RUN chmod 644 /etc/cron.d/*

ENTRYPOINT ["docker-entrypoint.sh"]
