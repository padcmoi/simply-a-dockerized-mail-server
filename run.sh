#!/bin/bash

echo "serveur a dit"

cat /etc/postfix/main.cf

netstat -tulpn | grep -E -w '25|80|110|143|443|465|587|993|995|4190'


# case app
rm /var/www/html/*
cd /webadmin/www
pnpm install
pnpm run build
mv dist/* /var/www/html/
/etc/init.d/./apache2 start

# case api
cd /webadmin/api
pnpm install
pnpm run build
pnpm run start:prod



