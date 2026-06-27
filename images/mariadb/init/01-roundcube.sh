#!/usr/bin/env bash
# Provision the roundcube database. The roundcube image creates its own
# schema on first boot; here we just hand it an empty database with the right
# charset and grant the mailserver user access to it.
set -euo pipefail

mariadb -u root -p"${MARIADB_ROOT_PASSWORD}" <<SQL
CREATE DATABASE IF NOT EXISTS \`roundcube\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON \`roundcube\`.* TO '${MARIADB_USER}'@'%';
FLUSH PRIVILEGES;
SQL
