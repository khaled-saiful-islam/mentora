#!/usr/bin/env bash
# Fails when the old product name appears anywhere it should not.
#
# Allowed: PLAN.md (the record of the fork) and the README's one credit line.
set -euo pipefail
cd "$(dirname "$0")/.."

old="pel""ita"   # split so this script does not match itself
hits=$(git grep -n -I -i "$old" -- . ':!PLAN.md' ':!scripts/check-brand.sh' \
  | grep -v -E "^README\.md:[0-9]+:Forked from \[Pel""ita\]" || true)
names=$(git ls-files | grep -i "$old" || true)

if [[ -n "$hits$names" ]]; then
  echo "The old product name is still here:" >&2
  [[ -n "$hits" ]] && echo "$hits" >&2
  [[ -n "$names" ]] && echo "$names" >&2
  exit 1
fi
echo "brand check: clean"
