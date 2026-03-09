#!/usr/bin/env bash
set -Eeuo pipefail

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

require_cmd pg_restore

TARGET_DB_URL="${1:-}"
BACKUP_FILE="${2:-}"

if [ -z "$TARGET_DB_URL" ] || [ -z "$BACKUP_FILE" ]; then
  echo "Usage:"
  echo "  $0 <target_db_url> <backup_file>"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

log "Restoring backup into target database"
log "Backup file: $BACKUP_FILE"

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --single-transaction \
  --dbname="$TARGET_DB_URL" \
  "$BACKUP_FILE"

log "Restore completed successfully"
