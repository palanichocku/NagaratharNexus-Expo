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

require_env() {
  local name="$1"
  [ -n "${!name:-}" ] || {
    echo "Missing required env var: $name" >&2
    exit 1
  }
}

require_cmd aws
require_cmd pg_restore

require_env TARGET_DB_URL
require_env BACKUP_BUCKET
require_env BACKUP_PREFIX

APP_NAME="${APP_NAME:-nexus}"
ENV_NAME="${ENV_NAME:-prod}"
TMP_DIR="${TMP_DIR:-/tmp/db-backups}"
AWS_REGION="${AWS_REGION:-us-east-1}"
S3_ENDPOINT_URL="${S3_ENDPOINT_URL:-}"

mkdir -p "$TMP_DIR"

AWS_ARGS=(--region "$AWS_REGION")
if [ -n "$S3_ENDPOINT_URL" ]; then
  AWS_ARGS+=(--endpoint-url "$S3_ENDPOINT_URL")
fi

LATEST_KEY="$(
  aws "${AWS_ARGS[@]}" s3 ls "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX%/}/" \
  | awk '{print $4}' \
  | grep "^${APP_NAME}_${ENV_NAME}_.*\.dump$" \
  | sort \
  | tail -n 1
)"

if [ -z "$LATEST_KEY" ]; then
  echo "No backup file found in s3://${BACKUP_BUCKET}/${BACKUP_PREFIX%/}/" >&2
  exit 1
fi

LOCAL_FILE="${TMP_DIR}/${LATEST_KEY}"
REMOTE_FILE="s3://${BACKUP_BUCKET}/${BACKUP_PREFIX%/}/${LATEST_KEY}"

cleanup() {
  rm -f "$LOCAL_FILE"
}
trap cleanup EXIT

log "Downloading latest backup: ${REMOTE_FILE}"
aws "${AWS_ARGS[@]}" s3 cp "$REMOTE_FILE" "$LOCAL_FILE"

log "Restoring into target DB"
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --single-transaction \
  --dbname="$TARGET_DB_URL" \
  "$LOCAL_FILE"

log "Latest-backup restore completed successfully"
