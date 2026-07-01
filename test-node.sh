#!/usr/bin/env bash

cd /var/docker/simply-a-dockerized-mail-server/manager-api
pnpm typecheck ; echo $? ; pnpm lint ; echo $?

cd /var/docker/simply-a-dockerized-mail-server/manager-ui
pnpm typecheck ; echo $? ; pnpm lint ; echo $?
