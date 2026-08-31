#!/usr/bin/env bash
# Provision the opendmarc database used by opendmarc-import to ingest the
# daily DMARC history record produced by the milter (parity with v1
# production). Charset matches the v1 schema.
set -euo pipefail

mariadb -u root -p"${MARIADB_ROOT_PASSWORD}" <<SQL
CREATE DATABASE IF NOT EXISTS \`opendmarc\` CHARACTER SET utf8 COLLATE utf8_general_ci;
GRANT ALL PRIVILEGES ON \`opendmarc\`.* TO '${MARIADB_USER}'@'%';
FLUSH PRIVILEGES;
SQL
