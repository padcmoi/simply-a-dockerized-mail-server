#!/bin/bash

cp -R /var/log/* /var/_log/
chmod 777 -R /var/_log/*

inotifywait -r -m -e modify /var/log |
    while read file_path file_name; do
        cp -R /var/log/* /var/_log/
        chmod 777 -R /var/_log/*
    done
