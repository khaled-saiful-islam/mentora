#!/usr/bin/env bash
# Dump the production database to backups/ on the server's own disk and keep
# the last KEEP_DAYS days (default 7). Cheap insurance against a bad migration
# or an accidental delete — not against losing the server itself.
#
#   scripts/backup-db.sh
#   # nightly, from the server's crontab (03:00 Malaysia time = 19:00 UTC;
#   # deploy.sh creates backups/ before the first run):
#   0 19 * * * /opt/mentora/scripts/backup-db.sh >> /opt/mentora/backups/backup.log 2>&1
#
# Restore one (stops nothing; replaces the database's contents):
#   docker compose exec -T db sh -c 'pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backups/<file>.dump
set -euo pipefail
cd "$(dirname "$0")/.."

keep_days="${KEEP_DAYS:-7}"
stamp="$(date -u +%Y%m%d-%H%M%S)"
file="backups/mentora-${stamp}.dump"

mkdir -p backups
# A failed dump must not leave a half-written file that looks like a backup.
trap 'rm -f "${file}.partial"' EXIT
# The db container already knows its own user and database name.
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "${file}.partial"
mv "${file}.partial" "$file"
find backups -name 'mentora-*.dump' -mtime +"$keep_days" -delete

echo "$(date -u +%FT%TZ) wrote $file ($(du -h "$file" | cut -f1))"
