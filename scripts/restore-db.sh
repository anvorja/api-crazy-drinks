#!/usr/bin/env bash
# Restores a backup made by backup-db.sh. DESTRUCTIVE: replaces the objects in the target DB.
#   scripts/restore-db.sh backups/api-drinks-db-20260924T120000Z.dump
set -euo pipefail

dump="${1:?usage: scripts/restore-db.sh <file.dump>}"
# DB_* from .env, without overriding variables already set in the environment.
if [[ -f .env ]]; then
  while IFS='=' read -r key value; do
    [[ -z "${!key:-}" ]] && export "$key=$value"
  done < <(grep -E '^DB_(HOST|PORT|NAME|USER|PASSWORD)=' .env)
fi
: "${DB_HOST:?}" "${DB_PORT:?}" "${DB_NAME:?}" "${DB_USER:?}" "${DB_PASSWORD:?}"

read -r -p "This will overwrite database '$DB_NAME' on $DB_HOST. Type its name to continue: " answer
[[ "$answer" == "$DB_NAME" ]] || { echo "Aborted."; exit 1; }

PGPASSWORD="$DB_PASSWORD" pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --clean --if-exists --no-owner "$dump"
echo "Restored $dump into $DB_NAME"
