#!/bin/sh
set -eu
campaign_path="${ZALO_TEAM_CAMPAIGN_PATH:-/data/campaigns}"
mkdir -p /data/archive /data/backups "$campaign_path"
chown www-data:www-data /data /data/archive /data/backups "$campaign_path"
# FPM master opens Docker's stderr as root, then its pool drops to www-data.
# CLI workers do not need a privileged master.
if [ "$1" = "php-fpm" ]; then
  exec "$@"
fi
exec su-exec www-data "$@"
