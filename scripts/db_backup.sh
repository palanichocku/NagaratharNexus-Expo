#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

ENV_FILE="${ENV_FILE:-./ops/.env.local}"
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage:
  AWS_PROFILE=palamc ENV_FILE=./ops/.env.backup.local ./scripts/db_backup.sh [--dry-run]
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
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

require_cmd pg_dump
require_cmd aws
require_cmd python3

load_env_file "$ENV_FILE"

require_env SOURCE_DB_URL
require_env BACKUP_BUCKET
require_env BACKUP_PREFIX

APP_NAME="${APP_NAME:-nexus}"
ENV_NAME="${ENV_NAME:-prod}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TMP_DIR="${TMP_DIR:-/tmp/db-backups}"
AWS_REGION="${AWS_REGION:-us-east-1}"
S3_ENDPOINT_URL="${S3_ENDPOINT_URL:-}"

mkdir -p "$TMP_DIR"
build_aws_args

STAMP_UTC="$(date -u '+%Y-%m-%dT%H%M%SZ')"
FILE_BASENAME="${APP_NAME}_${ENV_NAME}_${STAMP_UTC}"
DUMP_FILE="${TMP_DIR}/${FILE_BASENAME}.dump"
META_FILE="${TMP_DIR}/${FILE_BASENAME}.sha256"

S3_KEY_DUMP="${BACKUP_PREFIX%/}/${FILE_BASENAME}.dump"
S3_KEY_SHA="${BACKUP_PREFIX%/}/${FILE_BASENAME}.sha256"
S3_URI_DUMP="s3://${BACKUP_BUCKET}/${S3_KEY_DUMP}"
S3_URI_SHA="s3://${BACKUP_BUCKET}/${S3_KEY_SHA}"

LISTING_JSON=""
cleanup() {
  rm -f "$DUMP_FILE" "$META_FILE"
  [[ -n "$LISTING_JSON" ]] && rm -f "$LISTING_JSON"
}
trap cleanup EXIT

log "Loaded env file: $ENV_FILE"
log "Starting PostgreSQL backup"
log "Database host: $(safe_db_hint "$SOURCE_DB_URL")"
log "Backup target: ${S3_URI_DUMP}"

if [[ "$DRY_RUN" -eq 0 ]]; then
  pg_dump \
    --format=custom \
    --no-owner \
    --no-privileges \
    --schema=public \
    --file="$DUMP_FILE" \
    "$SOURCE_DB_URL"

  checksum_file "$DUMP_FILE" > "$META_FILE"

  if command -v pg_restore >/dev/null 2>&1; then
    log "Validating dump structure with pg_restore --list"
    pg_restore --list "$DUMP_FILE" >/dev/null
  fi
else
  log "Skipping local dump creation because --dry-run was used"
fi

log "Uploading backup"
run_cmd aws "${AWS_ARGS[@]}" s3 cp "$DUMP_FILE" "$S3_URI_DUMP"

log "Uploading checksum"
run_cmd aws "${AWS_ARGS[@]}" s3 cp "$META_FILE" "$S3_URI_SHA"

log "Pruning remote backups older than ${RETENTION_DAYS} day(s)"
CUTOFF_EPOCH="$(epoch_days_ago "$RETENTION_DAYS")"
LISTING_JSON="$(mktemp)"

if [[ "$DRY_RUN" -eq 0 ]]; then
  aws "${AWS_ARGS[@]}" s3api list-objects-v2 \
    --bucket "$BACKUP_BUCKET" \
    --prefix "${BACKUP_PREFIX%/}/" \
    > "$LISTING_JSON"
else
  echo '{"Contents":[]}' > "$LISTING_JSON"
fi

python3 - "$LISTING_JSON" "$APP_NAME" "$ENV_NAME" "$CUTOFF_EPOCH" <<'PY' | while IFS= read -r line; do
import json, sys, re

path, app, env, cutoff = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])

with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

pattern = re.compile(rf'(^|/){re.escape(app)}_{re.escape(env)}_.*\.(dump|sha256)$')

for obj in data.get("Contents", []):
    key = obj.get("Key", "")
    lm = obj.get("LastModified", "")
    if not pattern.search(key):
        continue
    print(f"{key}\t{lm}")
PY
  key="${line%%$'\t'*}"
  last_modified="${line#*$'\t'}"
  [[ -n "$key" ]] || continue

  OBJ_EPOCH="$(iso_to_epoch "$last_modified")"
  if [[ "$OBJ_EPOCH" -lt "$CUTOFF_EPOCH" ]]; then
    log "Deleting old object: s3://${BACKUP_BUCKET}/${key}"
    run_cmd aws "${AWS_ARGS[@]}" s3 rm "s3://${BACKUP_BUCKET}/${key}"
  fi
done

log "Backup completed successfully"
