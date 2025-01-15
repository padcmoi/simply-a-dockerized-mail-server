#!/bin/bash
source /.env
source /_VARIABLES

apt update

cd $(pwd)/setup.d

case $1 in
build)
  arguments="build save-volume"
  ;;
container)
  arguments="retrieve-volume container run"
  ;;
*)
  arguments=""
  echo "Please give me an argument (build or container)"
  exit
  ;;
esac

for argument in $arguments; do

  for script in $(ls *.sh); do
    bash $script $argument
  done

done
