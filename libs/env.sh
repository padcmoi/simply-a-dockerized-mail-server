#!/bin/bash

MIN_PASSWORD_LENGTH=12

# Define color
COLOR_BLUE='\033[0;30m'
COLOR_RED='\033[0;32m'
COLOR_CYAN='\033[0;36m'
COLOR_YELLOW='\033[0;33m'
COLOR_DEFAULT='\033[0m'
# Env files
ENV_MENU_TARGET=".env.menu"
ENV_MENU_SAMPLE="./libs/.env.menu.sample"
ENV_TARGET=./.env # .env
ENV_SAMPLE=./.env.sample
ENV_TMPFILE=./.env.file_tmp
ENV_TMPFILE2=./.env.file_tmp2
ENV_MAKEFILE=./.env.file_made
ENV_NEWFILE=./.env.file_new
ENV_CERTBOT_INFO=./.env.file_certbot_info
