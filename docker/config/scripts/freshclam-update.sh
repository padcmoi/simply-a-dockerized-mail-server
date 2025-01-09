#!/bin/bash

service clamav-freshclam stop
rm /var/log/clamav/freshclam.log
freshclam
service clamav-freshclam start
