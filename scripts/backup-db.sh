#!/usr/bin/env bash
# Logical backup of the database in pg_dump custom format, with retention.
#   scripts/backup-db.sh                 # reads DB_* from .env or the environment
#   BACKUP_DIR=/backups BACKUP_RETENTION_DAYS=14 scripts/backup-db.sh
# Schedule it (cron, systemd timer, your platform's jobs). Managed Postgres (RDS, Cloud SQL,
# Neon, Supabase…) also offers automatic backups with point-in-time recovery: prefer it there.
set -euo pipefail

# DB_* from .env, without overriding variables already set in the environment.
if [[ -f .env ]]; then
  while IFS='=' read -r key value; do
    [[ -z "${!key:-}" ]] && export "$key=$value"
  done < <(grep -E '^DB_(HOST|PORT|NAME|USER|PASSWORD)=' .env)
fi
: "${DB_HOST:?}" "${DB_PORT:?}" "${DB_NAME:?}" "${DB_USER:?}" "${DB_PASSWORD:?}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/${DB_NAME}-$(date -u +%Y%m%dT%H%M%SZ).dump"
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --format=custom --no-owner --file="$file"
echo "Backup: $file ($(du -h "$file" | cut -f1))"

find "$BACKUP_DIR" -name "${DB_NAME}-*.dump" -mtime +"$BACKUP_RETENTION_DAYS" -print -delete
