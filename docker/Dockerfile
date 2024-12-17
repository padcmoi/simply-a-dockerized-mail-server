FROM debian:bullseye

ARG HOSTNAME

# Installation
RUN apt update
RUN apt install -y git nano curl sudo net-tools vim nano curl htop procps findutils

# download repository
RUN mkdir -p /opt/source
WORKDIR /opt/source
RUN git clone https://github.com/padcmoi/simply-docker-sql-mailserver
RUN mv simply-docker-sql-mailserver/webadmin/* .
RUN rm -R simply-docker-sql-mailserver

# nodejs
RUN curl -sL https://deb.nodesource.com/setup_20.x | sudo -E bash -
RUN apt install -y nodejs
RUN npm install -g pnpm

# web admin
RUN apt install -y apache2
RUN a2enmod ssl

# database
RUN apt install -y mariadb-server

# mail daemons ...
RUN apt install -y dovecot-antispam dovecot-dev dovecot-ldap dovecot-managesieved dovecot-pgsql dovecot-solr dovecot-core dovecot-gssapi dovecot-lmtpd dovecot-pop3d dovecot-sqlite dovecot-imapd dovecot-lucene dovecot-mysql dovecot-sieve
RUN { \
    echo postfix postfix/main_mailer_type select Internet Site; \
    echo postfix postfix/mailname string ${HOSTNAME}; \
    } | debconf-set-selections \
    && apt install --assume-yes postfix postfix-mysql
RUN apt install -y rspamd amavis spamassassin clamav opendkim fail2ban fetchmail getmail6 postgrey letsencrypt
RUN DEBIAN_FRONTEND=noninteractive apt-get -y install opendmarc

# Executes actions in the container
WORKDIR /opt

COPY run.sh .
RUN chmod +x ./run.sh

CMD ["./run.sh"]