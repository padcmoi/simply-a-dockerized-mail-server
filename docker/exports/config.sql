SET PASSWORD FOR root@localhost = PASSWORD('____mailRootPass');

CREATE DATABASE IF NOT EXISTS mailserver;

CREATE USER IF NOT EXISTS mailuser@localhost IDENTIFIED BY '____mailUserPass';

GRANT ALL PRIVILEGES ON mailserver.* TO mailuser@localhost IDENTIFIED BY '____mailUserPass';

GRANT ALL PRIVILEGES ON opendmarc.* TO mailuser@localhost IDENTIFIED BY '____mailUserPass';

GRANT ALL PRIVILEGES ON roundcube.* TO mailuser@localhost IDENTIFIED BY '____mailUserPass';

FLUSH PRIVILEGES;

SET GLOBAL general_log = 'OFF';