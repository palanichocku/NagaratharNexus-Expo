#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

ENV_FILE="${ENV_FILE:-./ops/.env.local}"
DRY_RUN=0
RESTORE_KEY=""

usage() {
  cat <<'EOF'
Usage:
  ENV_FILE=./ops/.env.local ./scripts/restore_db.sh [--dry-run] [--key <backup-file-name>]
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --key)
      RESTORE_KEY="${2:-}"
      [[ -n "$RESTORE_KEY" ]] || fail "--key requires a value"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown argument: $1"
      ;;
  esac
done

require_cmd aws
require_cmd pg_restore
require_cmd psql

load_env_file "$ENV_FILE"

require_env TARGET_DB_URL
require_env BACKUP_BUCKET
require_env BACKUP_PREFIX

APP_NAME="${APP_NAME:-nexus}"
ENV_NAME="${ENV_NAME:-prod}"
TMP_DIR="${TMP_DIR:-/tmp/db-backups}"
AWS_REGION="${AWS_REGION:-us-east-1}"
S3_ENDPOINT_URL="${S3_ENDPOINT_URL:-}"
ALLOW_PROD_WRITE="${ALLOW_PROD_WRITE:-0}"

mkdir -p "$TMP_DIR"
build_aws_args

if [[ "$TARGET_DB_URL" == *"prod"* || "$ENV_NAME" == "prod" ]]; then
  require_prod_write_ack "prod-like target DB"
fi

log "Loaded env file: $ENV_FILE"
log "Target DB host: $(safe_db_hint "$TARGET_DB_URL")"

if [[ "$DRY_RUN" -eq 0 ]]; then
  log "Checking target DB connectivity"
  psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -c "SELECT current_database(), now();" >/dev/null
fi

if [[ -n "$RESTORE_KEY" ]]; then
  LATEST_KEY="$RESTORE_KEY"
else
  LATEST_KEY="$(
    aws "${AWS_ARGS[@]}" s3 ls "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX%/}/" \
    | awk '{print $4}' \
    | grep "^${APP_NAME}_${ENV_NAME}_.*\.dump$" \
    | sort \
    | tail -n 1
  )"
fi

[[ -n "$LATEST_KEY" ]] || fail "No backup file found in s3://${BACKUP_BUCKET}/${BACKUP_PREFIX%/}/"

LOCAL_FILE="${TMP_DIR}/$(basename "$LATEST_KEY")"
REMOTE_FILE="s3://${BACKUP_BUCKET}/${BACKUP_PREFIX%/}/${LATEST_KEY}"

cleanup() {
  rm -f "$LOCAL_FILE"
}
trap cleanup EXIT

log "Selected backup: ${REMOTE_FILE}"
log "Downloading backup"
run_cmd aws "${AWS_ARGS[@]}" s3 cp "$REMOTE_FILE" "$LOCAL_FILE"

if [[ "$DRY_RUN" -eq 0 ]]; then
  log "Validating dump structure with pg_restore --list"
  pg_restore --list "$LOCAL_FILE" >/dev/null
fi

log "Restoring into target DB"
run_db_cmd \
  "pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction --dbname=<redacted-target-db-url> $LOCAL_FILE" \
  pg_restore \
    --schema=public \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --single-transaction \
    --dbname="$TARGET_DB_URL" \
    "$LOCAL_FILE"

log "Latest-backup restore completed successfully"
