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

require_cmd pg_dump
require_cmd aws
require_cmd find
require_cmd gzip || true

# Required
require_env SOURCE_DB_URL
require_env BACKUP_BUCKET
require_env BACKUP_PREFIX

# Optional
APP_NAME="${APP_NAME:-nexus}"
ENV_NAME="${ENV_NAME:-prod}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TMP_DIR="${TMP_DIR:-/tmp/db-backups}"
AWS_REGION="${AWS_REGION:-us-east-1}"
S3_ENDPOINT_URL="${S3_ENDPOINT_URL:-}"   # for Cloudflare R2 / Backblaze / MinIO etc.

mkdir -p "$TMP_DIR"

STAMP_UTC="$(date -u '+%Y-%m-%dT%H%M%SZ')"
FILE_BASENAME="${APP_NAME}_${ENV_NAME}_${STAMP_UTC}"
DUMP_FILE="${TMP_DIR}/${FILE_BASENAME}.dump"
META_FILE="${TMP_DIR}/${FILE_BASENAME}.sha256"

S3_URI="s3://${BACKUP_BUCKET}/${BACKUP_PREFIX%/}/${FILE_BASENAME}.dump"
S3_URI_SHA="s3://${BACKUP_BUCKET}/${BACKUP_PREFIX%/}/${FILE_BASENAME}.sha256"

AWS_ARGS=(--region "$AWS_REGION")
if [ -n "$S3_ENDPOINT_URL" ]; then
  AWS_ARGS+=(--endpoint-url "$S3_ENDPOINT_URL")
fi

cleanup() {
  rm -f "$DUMP_FILE" "$META_FILE"
}
trap cleanup EXIT

log "Starting PostgreSQL backup"
log "Dump file: ${DUMP_FILE}"

# Custom format is the right portable format for pg_restore.
pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$DUMP_FILE" \
  "$SOURCE_DB_URL"

sha256sum "$DUMP_FILE" > "$META_FILE"

log "Uploading backup to ${S3_URI}"
aws "${AWS_ARGS[@]}" s3 cp "$DUMP_FILE" "$S3_URI"

log "Uploading checksum to ${S3_URI_SHA}"
aws "${AWS_ARGS[@]}" s3 cp "$META_FILE" "$S3_URI_SHA"

log "Pruning remote backups older than ${RETENTION_DAYS} day(s)"

CUTOFF_EPOCH="$(date -u -d "-${RETENTION_DAYS} days" +%s 2>/dev/null || python3 - <<'PY'
from datetime import datetime, timedelta, timezone
print(int((datetime.now(timezone.utc) - timedelta(days=int(__import__("os").environ["RETENTION_DAYS"]))).timestamp()))
PY
)"

LISTING_FILE="$(mktemp)"
trap 'rm -f "$DUMP_FILE" "$META_FILE" "$LISTING_FILE"' EXIT

aws "${AWS_ARGS[@]}" s3 ls "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX%/}/" > "$LISTING_FILE"

while read -r d t size key; do
  [ -n "${key:-}" ] || continue

  # Only manage dump + checksum files for this app/env naming pattern
  case "$key" in
    ${APP_NAME}_${ENV_NAME}_*.dump|${APP_NAME}_${ENV_NAME}_*.sha256)
      ;;
    *)
      continue
      ;;
  esac

  OBJ_EPOCH="$(date -u -d "${d} ${t}" +%s 2>/dev/null || python3 - "$d" "$t" <<'PY'
import sys
from datetime import datetime, timezone
dt = datetime.strptime(sys.argv[1] + " " + sys.argv[2], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
print(int(dt.timestamp()))
PY
)"
  if [ "$OBJ_EPOCH" -lt "$CUTOFF_EPOCH" ]; then
    log "Deleting old object: s3://${BACKUP_BUCKET}/${BACKUP_PREFIX%/}/${key}"
    aws "${AWS_ARGS[@]}" s3 rm "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX%/}/${key}"
  fi
done < "$LISTING_FILE"

log "Backup completed successfully"
