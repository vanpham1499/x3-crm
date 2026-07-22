#!/bin/sh
set -eu

cd /opt/x3crm
docker compose start nginx >/dev/null 2>&1
