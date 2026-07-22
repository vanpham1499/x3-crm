#!/bin/sh
set -eu

cd /opt/x3crm
docker compose stop nginx >/dev/null 2>&1
