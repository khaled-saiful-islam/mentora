#!/usr/bin/env bash
# Bring production up to date with GitHub main. Run on the server:
#
#   cd /opt/mentora && scripts/deploy.sh
#
# Migrations run on backend start (docker-entrypoint.sh), so the database is
# dumped first. Expect a minute or two of downtime while the new images start,
# and note that anything being generated at that moment is abandoned — the job
# board lives in the backend process — so deploy when nobody is building a quiz.
set -euo pipefail
cd "$(dirname "$0")/.."

compose=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

# Without these nginx crash-loops (and Docker would create empty directories in
# their place), and the old frontend is already gone by the time that shows.
for required in .env deploy/certs/origin.pem deploy/certs/origin.key; do
  if [ ! -s "$required" ]; then
    echo "deploy: missing $required — see docs/deployment.md" >&2
    exit 1
  fi
done

mkdir -p backups
if [ -n "$("${compose[@]}" ps --status running --quiet db 2>/dev/null)" ]; then
  scripts/backup-db.sh
else
  echo "deploy: database not running yet (first deploy?) — no pre-deploy dump"
fi

git pull --ff-only
# Generous: a first start runs every migration before the healthcheck passes.
"${compose[@]}" up -d --build --wait --wait-timeout 300
# Each build leaves the previous images behind; on a 60 GB disk they add up.
docker image prune -f >/dev/null
"${compose[@]}" ps
