#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

ENV_FILE="${ENV_FILE:-./ops/.env.local}"

SOURCE_ENV=""
TARGET_ENV=""
MODE="full"
AUTH_MODE="skip"
AUTO_YES=0
KEEP_DUMPS=0
DRY_RUN=0

PUBLIC_EXTENSIONS=(
  "pg_trgm"
)

usage() {
  cat <<'EOF'
Usage:
  ENV_FILE=./ops/.env.sync.local ./scripts/sync_supabase_db.sh --source dev|prod --target prod|dev --mode full|schema-only [--auth copy|skip] [--yes] [--keep-dumps]
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      SOURCE_ENV="${2:-}"
      shift 2
      ;;
    --target)
      TARGET_ENV="${2:-}"
      shift 2
      ;;
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --auth)
      AUTH_MODE="${2:-}"
      shift 2
      ;;
    --yes)
      AUTO_YES=1
      shift
      ;;
    --keep-dumps)
      KEEP_DUMPS=1
      shift
      ;;
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
require_cmd pg_restore
require_cmd psql

load_env_file "$ENV_FILE"

[[ "$SOURCE_ENV" == "dev" || "$SOURCE_ENV" == "prod" ]] || fail "Invalid --source. Use dev or prod."
[[ "$TARGET_ENV" == "dev" || "$TARGET_ENV" == "prod" ]] || fail "Invalid --target. Use dev or prod."
[[ "$SOURCE_ENV" != "$TARGET_ENV" ]] || fail "--source and --target must be different."
[[ "$MODE" == "full" || "$MODE" == "schema-only" ]] || fail "Invalid --mode. Use full or schema-only."
[[ "$AUTH_MODE" == "copy" || "$AUTH_MODE" == "skip" ]] || fail "Invalid --auth. Use copy or skip."

if [[ "$MODE" == "schema-only" && "$AUTH_MODE" == "copy" ]]; then
  fail "--auth copy is only allowed with --mode full."
fi

require_env DEV_DB_URL
require_env PROD_DB_URL

if [[ "$TARGET_ENV" == "prod" ]]; then
  require_prod_write_ack "prod target DB"
fi

resolve_db_url() {
  case "$1" in
    dev)  echo "$DEV_DB_URL" ;;
    prod) echo "$PROD_DB_URL" ;;
    *)    fail "Unknown environment: $1" ;;
  esac
}

SOURCE_DB_URL="$(resolve_db_url "$SOURCE_ENV")"
TARGET_DB_URL="$(resolve_db_url "$TARGET_ENV")"

TMP_DIR="$(mktemp -d /tmp/supabase_sync.XXXXXX)"
PUBLIC_DUMP_FILE="${TMP_DIR}/public.dump"
AUTH_DUMP_FILE="${TMP_DIR}/auth.dump"
SOURCE_TABLES_FILE="${TMP_DIR}/source_tables.txt"
TARGET_TABLES_FILE="${TMP_DIR}/target_tables.txt"

cleanup() {
  if [[ "$KEEP_DUMPS" -eq 0 ]]; then
    rm -rf "$TMP_DIR"
  else
    warn "Keeping temp files at: $TMP_DIR"
  fi
}
trap cleanup EXIT

divider
echo "  Supabase DB Sync"
divider

log "Loaded env file: $ENV_FILE"
warn "Testing database connections..."

if [[ "$DRY_RUN" -eq 0 ]]; then
  psql "$SOURCE_DB_URL" -v ON_ERROR_STOP=1 -c "SELECT current_database(), now();" >/dev/null 2>&1 \
    || fail "Cannot connect to SOURCE database."

  psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -c "SELECT current_database(), now();" >/dev/null 2>&1 \
    || fail "Cannot connect to TARGET database."
fi

log "Source DB connection: OK"
log "Target DB connection: OK"

SOURCE_HOST="$(safe_db_hint "$SOURCE_DB_URL")"
TARGET_HOST="$(safe_db_hint "$TARGET_DB_URL")"

divider
warn "Source : $SOURCE_ENV  ($SOURCE_HOST)"
warn "Target : $TARGET_ENV  ($TARGET_HOST)"
warn "Mode   : $MODE"
warn "Auth   : $AUTH_MODE"

if [[ "$AUTO_YES" -ne 1 ]]; then
  divider
  warn "⚠️  WARNING: This will modify the TARGET database: $TARGET_ENV"
  echo ""
  if [[ "$MODE" == "full" ]]; then
    echo "  - public schema will be dropped and recreated"
    echo "  - public data will be replaced from source"
  else
    echo "  - public schema will be dropped and recreated"
    echo "  - public data will NOT be copied"
  fi

  if [[ "$AUTH_MODE" == "copy" ]]; then
    echo "  - auth.users and auth.identities will be replaced from source"
  else
    echo "  - auth tables will be left untouched"
  fi

  echo ""
  read -r -p "Type the TARGET environment name ('$TARGET_ENV') to continue: " confirm
  [[ "$confirm" == "$TARGET_ENV" ]] || { echo "Aborted."; exit 0; }
fi

divider
if [[ "$MODE" == "full" ]]; then
  warn "Dumping source public schema + data..."
  run_cmd pg_dump \
    "$SOURCE_DB_URL" \
    --format=custom \
    --no-owner \
    --no-acl \
    --schema=public \
    --file="$PUBLIC_DUMP_FILE"
else
  warn "Dumping source public schema only..."
  run_cmd pg_dump \
    "$SOURCE_DB_URL" \
    --format=custom \
    --no-owner \
    --no-acl \
    --schema=public \
    --schema-only \
    --file="$PUBLIC_DUMP_FILE"
fi
log "Public dump complete: $PUBLIC_DUMP_FILE"

if [[ "$MODE" == "full" && "$AUTH_MODE" == "copy" ]]; then
  divider
  warn "Dumping source auth.users and auth.identities..."
  run_cmd pg_dump \
    "$SOURCE_DB_URL" \
    --format=custom \
    --no-owner \
    --no-acl \
    --data-only \
    --table=auth.users \
    --table=auth.identities \
    --file="$AUTH_DUMP_FILE"
  log "Auth dump complete: $AUTH_DUMP_FILE"
fi

divider
warn "Dropping and recreating target public schema..."

if [[ "$DRY_RUN" -eq 0 ]]; then
  psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
SQL
else
  echo "[DRY RUN] would drop and recreate target public schema"
fi

log "Target public schema recreated."

divider
warn "Recreating required extensions on target..."

for ext in "${PUBLIC_EXTENSIONS[@]}"; do
  warn "Ensuring extension exists: $ext"
  if [[ "$DRY_RUN" -eq 0 ]]; then
    psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS $ext WITH SCHEMA public;"
  else
    echo "[DRY RUN] would run: CREATE EXTENSION IF NOT EXISTS $ext WITH SCHEMA public;"
  fi
done

log "Required extensions recreated."

divider
warn "Restoring public schema to target..."

run_cmd pg_restore \
  --dbname="$TARGET_DB_URL" \
  --no-owner \
  --no-acl \
  --schema=public \
  --exit-on-error \
  "$PUBLIC_DUMP_FILE"

log "Public restore complete."

if [[ "$MODE" == "full" && "$AUTH_MODE" == "copy" ]]; then
  divider
  warn "Replacing target auth.users and auth.identities..."

  if [[ "$DRY_RUN" -eq 0 ]]; then
    psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
TRUNCATE TABLE auth.identities CASCADE;
TRUNCATE TABLE auth.users CASCADE;
COMMIT;
SQL
  else
    echo "[DRY RUN] would truncate auth.identities and auth.users"
  fi

  log "Target auth tables cleared."

  warn "Restoring auth.users and auth.identities..."

  run_cmd pg_restore \
    --dbname="$TARGET_DB_URL" \
    --no-owner \
    --no-acl \
    --data-only \
    --disable-triggers \
    --exit-on-error \
    "$AUTH_DUMP_FILE"

  log "Auth restore complete."
fi

divider
log "Sync completed."
echo ""
echo "Summary:"
echo "  Env file: $ENV_FILE"
echo "  Source  : $SOURCE_ENV"
echo "  Target  : $TARGET_ENV"
echo "  Mode    : $MODE"
echo "  Auth    : $AUTH_MODE"
divider
