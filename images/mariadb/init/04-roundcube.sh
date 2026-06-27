#!/usr/bin/env bash
# Provision the roundcube database (schema is created by the roundcube image
# itself on first boot) and the opendmarc database used by opendmarc-import
# to ingest DMARC history records (parity with v1 production).
set -euo pipefail

mariadb -u root -p"${MARIADB_ROOT_PASSWORD}" <<SQL
CREATE DATABASE IF NOT EXISTS \`roundcube\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS \`opendmarc\` CHARACTER SET utf8 COLLATE utf8_general_ci;
GRANT ALL PRIVILEGES ON \`roundcube\`.* TO '${MARIADB_USER}'@'%';
GRANT ALL PRIVILEGES ON \`opendmarc\`.* TO '${MARIADB_USER}'@'%';
FLUSH PRIVILEGES;
SQL
