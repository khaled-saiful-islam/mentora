#!/usr/bin/env bash
# Bring production up to date with GitHub main. Run on the server:
#
#   cd /opt/mentora && scripts/deploy.sh
#
# Migrations run on backend start (docker-entrypoint.sh). Expect a minute or
# two of downtime while the new images start, and note that anything being
# generated at that moment is abandoned — the job board lives in the backend
# process — so deploy when nobody is building a quiz.
set -euo pipefail
cd "$(dirname "$0")/.."

compose=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

git pull --ff-only
"${compose[@]}" up -d --build --wait
# Each build leaves the previous images behind; on a 60 GB disk they add up.
docker image prune -f >/dev/null
"${compose[@]}" ps
