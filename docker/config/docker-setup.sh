#!/bin/bash
source /.env
source /_VARIABLES

apt update

cd $(pwd)/setup.d

for file in $(ls *.sh); do
  bash $file $1
done

#
# Execution after build or container ...
#

case $1 in
build)

  # 10-mysql.sh build
  cp -Rf /var/lib/mysql /var/lib/mysql.DOCKER_TMP

  ;;
container) ;;
*)
  echo "please give me an argument"
  ;;
esac
