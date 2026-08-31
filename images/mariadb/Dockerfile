FROM mariadb:11.4

COPY init/ /docker-entrypoint-initdb.d/
COPY my.cnf /etc/mysql/conf.d/server.cnf
