FROM debian:bullseye

# Bullseye reached end of LTS and bullseye-security is gone from deb.debian.org, so apt is pinned to a frozen snapshot
RUN printf '%s\n' \
    'deb http://snapshot.debian.org/archive/debian/20260824T000000Z bullseye main' \
    'deb http://snapshot.debian.org/archive/debian-security/20260824T000000Z bullseye-security main' \
    'deb http://snapshot.debian.org/archive/debian/20260824T000000Z bullseye-updates main' \
    > /etc/apt/sources.list
RUN printf '%s\n' 'Acquire::Check-Valid-Until "false";' 'Acquire::Retries "5";' > /etc/apt/apt.conf.d/99bullseye-snapshot

# Update, remove useless and install require package
RUN apt update
RUN apt autoremove -y exim4
RUN apt install -y git curl sudo net-tools nano htop procps findutils wget zip systemctl rsyslog \ 
inotify-tools bind9-dnsutils kmod

# Copy the entire docker-build folder into the image and select this folder
COPY ./docker-build docker-build
WORKDIR /docker-build

# Copy environnement file
COPY .env /.env

# Modify permissions before moving to respective folder
RUN chmod 644 ./conf.d/cron.d/*
RUN chmod 444 ./conf.d/_VARIABLES
RUN chmod +x ./scripts/*
RUN chmod +x **/*.sh
RUN chmod +x *.sh

# Copy or move into the respective folder
RUN cp -Rf ./conf.d/cron.d/* /etc/cron.d/
RUN mv ./conf.d/_VARIABLES /_VARIABLES
RUN mv ./scripts/* /usr/local/bin/
RUN mv ./utils /utils

# Configures and builds the image with the required packages
RUN /docker-build/docker-setup.sh build

# Executed by the container
ENTRYPOINT ["/docker-build/docker-entrypoint.sh"]
