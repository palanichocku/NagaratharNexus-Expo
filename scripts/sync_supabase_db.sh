#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

ENV_FILE="${ENV_FILE:-./ops/.env.sync.local}"

SOURCE_ENV=""
TARGET_ENV=""
MODE="full"               # full | schema-only
AUTH_MODE="skip"          # copy | skip
AUTO_YES=0
KEEP_DUMPS=0
DRY_RUN=0
INCLUDE_ACL=1             # 1 = restore grants/default privileges
VALIDATE_AFTER=1          # 1 = run post-restore validation
EXTENSION_MODE="allowlist"   # source | allowlist
EXTENSION_ALLOWLIST=(
  "pg_trgm"
  "pgcrypto"
  "uuid-ossp"
)


usage() {
  cat <<'EOF'
Usage:
  ENV_FILE=./ops/.env.sync.local ./scripts/sync_supabase_db.sh \
    --source dev|prod \
    --target dev|prod \
    --mode full|schema-only \
    [--auth copy|skip] \
    [--no-acl] \
    [--no-validate] \
    [--extension-mode source|allowlist] \
    [--yes] \
    [--keep-dumps] \
    [--dry-run]

Examples:
  ENV_FILE=./ops/.env.sync.local ./scripts/sync_supabase_db.sh \
    --source dev \
    --target prod \
    --mode schema-only

  ENV_FILE=./ops/.env.sync.local ./scripts/sync_supabase_db.sh \
    --source dev \
    --target prod \
    --mode full \
    --auth copy

Notes:
  - --source and --target must be different
  - --auth copy is only allowed with --mode full
  - writing to prod requires ALLOW_PROD_WRITE=1
  - --yes is NOT allowed with --target prod
  - default behavior restores ACL/grants for dumped public objects
  - only public schema is mirrored; this is not a full Supabase project clone
EOF
}

if [[ $# -eq 0 ]]; then
  usage
  exit 1
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      [[ $# -ge 2 ]] || fail "Missing value for --source"
      SOURCE_ENV="$2"
      shift 2
      ;;
    --target)
      [[ $# -ge 2 ]] || fail "Missing value for --target"
      TARGET_ENV="$2"
      shift 2
      ;;
    --mode)
      [[ $# -ge 2 ]] || fail "Missing value for --mode"
      MODE="$2"
      shift 2
      ;;
    --auth)
      [[ $# -ge 2 ]] || fail "Missing value for --auth"
      AUTH_MODE="$2"
      shift 2
      ;;
    --no-acl)
      INCLUDE_ACL=0
      shift
      ;;
    --no-validate)
      VALIDATE_AFTER=0
      shift
      ;;
    --extension-mode)
      [[ $# -ge 2 ]] || fail "Missing value for --extension-mode"
      EXTENSION_MODE="$2"
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
      echo "Unknown argument: $1" >&2
      echo >&2
      usage >&2
      exit 1
      ;;
  esac
done

require_cmd pg_dump
require_cmd pg_restore
require_cmd psql
require_cmd awk
require_cmd sed
require_cmd sort
require_cmd tr

load_env_file "$ENV_FILE"

[[ "$SOURCE_ENV" == "dev" || "$SOURCE_ENV" == "prod" ]] || fail "Invalid --source. Use dev or prod."
[[ "$TARGET_ENV" == "dev" || "$TARGET_ENV" == "prod" ]] || fail "Invalid --target. Use dev or prod."
[[ "$SOURCE_ENV" != "$TARGET_ENV" ]] || fail "--source and --target must be different."
[[ "$MODE" == "full" || "$MODE" == "schema-only" ]] || fail "Invalid --mode. Use full or schema-only."
[[ "$AUTH_MODE" == "copy" || "$AUTH_MODE" == "skip" ]] || fail "Invalid --auth. Use copy or skip."
[[ "$EXTENSION_MODE" == "source" || "$EXTENSION_MODE" == "allowlist" ]] || fail "Invalid --extension-mode. Use source or allowlist."

if [[ "$MODE" == "schema-only" && "$AUTH_MODE" == "copy" ]]; then
  fail "--auth copy is only allowed with --mode full."
fi

if [[ "$TARGET_ENV" == "prod" && "$AUTO_YES" -eq 1 ]]; then
  fail "--yes is not allowed when --target prod."
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
EXTENSIONS_FILE="${TMP_DIR}/extensions.txt"
VALIDATION_FILE="${TMP_DIR}/validation.sql"
PUBLIC_TOC_FILE="${TMP_DIR}/public.list"
PUBLIC_TOC_FILTERED_FILE="${TMP_DIR}/public.filtered.list"

cleanup() {
  if [[ "$KEEP_DUMPS" -eq 0 ]]; then
    rm -rf "$TMP_DIR"
  else
    warn "Keeping temp files at: $TMP_DIR"
  fi
}
trap cleanup EXIT

divider
echo "  Supabase DB Sync v2"
divider

log "Loaded env file: $ENV_FILE"
warn "Testing database connections..."

if [[ "$DRY_RUN" -eq 0 ]]; then
  psql -P pager=off "$SOURCE_DB_URL" -v ON_ERROR_STOP=1 -c "SELECT current_database(), now();" >/dev/null 2>&1 \
    || fail "Cannot connect to SOURCE database."

  psql -P pager=off "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -c "SELECT current_database(), now();" >/dev/null 2>&1 \
    || fail "Cannot connect to TARGET database."
fi

log "Source DB connection: OK"
log "Target DB connection: OK"

SOURCE_HOST="$(safe_db_hint "$SOURCE_DB_URL")"
TARGET_HOST="$(safe_db_hint "$TARGET_DB_URL")"

divider
warn "Source          : $SOURCE_ENV  ($SOURCE_HOST)"
warn "Target          : $TARGET_ENV  ($TARGET_HOST)"
warn "Mode            : $MODE"
warn "Auth            : $AUTH_MODE"
warn "ACL restore     : $INCLUDE_ACL"
warn "Validate        : $VALIDATE_AFTER"
warn "Extension mode  : $EXTENSION_MODE"
warn "Dry run         : $DRY_RUN"

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

  if [[ "$INCLUDE_ACL" -eq 1 ]]; then
    echo "  - grants / ACLs for dumped public objects will be restored"
  else
    echo "  - grants / ACLs / default privileges will NOT be restored"
  fi

  echo ""

  if [[ "$TARGET_ENV" == "prod" ]]; then
    warn "PRODUCTION SAFETY CHECK"
    warn "ALLOW_PROD_WRITE=1 is set. One more explicit confirmation is required."
    read -r -p "Type EXACTLY 'yes-sync-prod' to continue: " confirm
    [[ "$confirm" == "yes-sync-prod" ]] || { echo "Aborted."; exit 0; }
  else
    read -r -p "Type the TARGET environment name ('$TARGET_ENV') to continue: " confirm
    [[ "$confirm" == "$TARGET_ENV" ]] || { echo "Aborted."; exit 0; }
  fi
fi

divider
warn "Discovering source extensions..."

if [[ "$EXTENSION_MODE" == "source" ]]; then
  if [[ "$DRY_RUN" -eq 0 ]]; then
    psql -P pager=off "$SOURCE_DB_URL" -v ON_ERROR_STOP=1 -At <<'SQL' > "$EXTENSIONS_FILE"
select extname
from pg_extension
where extname not in ('plpgsql')
order by extname;
SQL
  else
    echo "[DRY RUN] would query source pg_extension" > "$EXTENSIONS_FILE"
  fi
else
  : > "$EXTENSIONS_FILE"
  for ext in "${EXTENSION_ALLOWLIST[@]}"; do
    echo "$ext" >> "$EXTENSIONS_FILE"
  done
fi

log "Extension list:"
cat "$EXTENSIONS_FILE" || true

divider
warn "Dumping source public schema/data..."

DUMP_ARGS=(
  "$SOURCE_DB_URL"
  --format=custom
  --schema=public
  --file="$PUBLIC_DUMP_FILE"
  --no-owner
)

if [[ "$MODE" == "schema-only" ]]; then
  DUMP_ARGS+=(--schema-only)
fi

if [[ "$INCLUDE_ACL" -eq 0 ]]; then
  DUMP_ARGS+=(--no-acl)
fi

run_cmd pg_dump "${DUMP_ARGS[@]}"
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
  psql -P pager=off "$TARGET_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO postgres;
GRANT CREATE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO public;
SQL
else
  echo "[DRY RUN] would drop and recreate target public schema"
fi

log "Target public schema recreated."

divider
warn "Ensuring source extensions exist on target..."

if [[ "$DRY_RUN" -eq 0 ]]; then
  while IFS= read -r ext; do
    [[ -n "$ext" ]] || continue
    warn "Ensuring extension exists: $ext"

    if [[ "$ext" == "pg_trgm" ]]; then
      existing_schema="$(psql -P pager=off "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -Atc \
        "select n.nspname
        from pg_extension e
        join pg_namespace n on n.oid = e.extnamespace
        where e.extname = 'pg_trgm';")"

      if [[ -z "$existing_schema" ]]; then
        psql -P pager=off "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION "pg_trgm" WITH SCHEMA public;'
      elif [[ "$existing_schema" == "public" ]]; then
        warn "pg_trgm already exists in public"
      else
  warn "pg_trgm exists in schema '$existing_schema'; recreating it in public"
  psql -P pager=off "$TARGET_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
DROP EXTENSION IF EXISTS pg_trgm CASCADE;
CREATE EXTENSION pg_trgm WITH SCHEMA public;
SQL
fi
    else
      psql -P pager=off "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS \"$ext\";"
    fi
  done < "$EXTENSIONS_FILE"
else
  while IFS= read -r ext; do
    [[ -n "$ext" ]] || continue
    if [[ "$ext" == "pg_trgm" ]]; then
      echo '[DRY RUN] would run: CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA public;'
    else
      echo "[DRY RUN] would run: CREATE EXTENSION IF NOT EXISTS \"$ext\";"
    fi
  done < "$EXTENSIONS_FILE"
fi

log "Extensions ensured."

divider
warn "Preparing filtered restore list..."

if [[ "$DRY_RUN" -eq 0 ]]; then
  pg_restore --list "$PUBLIC_DUMP_FILE" > "$PUBLIC_TOC_FILE"

  grep -v ' SCHEMA - public ' "$PUBLIC_TOC_FILE" > "$PUBLIC_TOC_FILTERED_FILE"

  [[ -s "$PUBLIC_TOC_FILTERED_FILE" ]] || fail "Filtered TOC file is empty: $PUBLIC_TOC_FILTERED_FILE"

  if grep -q ' SCHEMA - public ' "$PUBLIC_TOC_FILTERED_FILE"; then
    fail "Filtered TOC still contains SCHEMA - public entry"
  fi
else
  echo "[DRY RUN] would generate filtered TOC list from $PUBLIC_DUMP_FILE"
fi

log "Filtered restore list prepared."

divider
warn "Restoring public dump to target..."

RESTORE_ARGS=(
  --dbname="$TARGET_DB_URL"
  --exit-on-error
  --no-owner
  --use-list="$PUBLIC_TOC_FILTERED_FILE"
  "$PUBLIC_DUMP_FILE"
)

if [[ "$INCLUDE_ACL" -eq 0 ]]; then
  RESTORE_ARGS+=(--no-acl)
fi

run_cmd pg_restore "${RESTORE_ARGS[@]}"
log "Public restore complete."

if [[ "$MODE" == "full" && "$AUTH_MODE" == "copy" ]]; then
  divider
  warn "Replacing target auth.users and auth.identities..."

  if [[ "$DRY_RUN" -eq 0 ]]; then
    psql -P pager=off "$TARGET_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
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

if [[ "$VALIDATE_AFTER" -eq 1 ]]; then
  divider
  warn "Running post-restore validation..."

  cat > "$VALIDATION_FILE" <<'SQL'
\echo '=== TABLES / RLS ==='
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

\echo '=== POLICIES ==='
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

\echo '=== TABLE GRANTS ==='
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
order by table_name, grantee, privilege_type;

\echo '=== SEQUENCE GRANTS ==='
select grantee, object_name as sequence_name, privilege_type
from information_schema.usage_privileges
where object_schema = 'public'
order by object_name, grantee, privilege_type;

\echo '=== ROUTINES ==='
select routine_schema, routine_name, routine_type
from information_schema.routines
where routine_schema = 'public'
order by routine_name;

\echo '=== EXTENSIONS ==='
select extname, extversion
from pg_extension
order by extname;
SQL

  if [[ "$DRY_RUN" -eq 0 ]]; then
    psql -P pager=off "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -P pager=off -f "$VALIDATION_FILE"
  else
    echo "[DRY RUN] would run validation file: $VALIDATION_FILE"
  fi

  log "Validation complete."
fi

divider
log "Sync completed."
echo ""
echo "Summary:"
echo "  Env file        : $ENV_FILE"
echo "  Source          : $SOURCE_ENV"
echo "  Target          : $TARGET_ENV"
echo "  Mode            : $MODE"
echo "  Auth            : $AUTH_MODE"
echo "  ACL restore     : $INCLUDE_ACL"
echo "  Validate        : $VALIDATE_AFTER"
echo "  Extension mode  : $EXTENSION_MODE"
echo "  Dry run         : $DRY_RUN"
echo "  Temp dir        : $TMP_DIR"
divider

cat <<'EOF'

Important:
- This mirrors the public schema much more closely, including RLS/policies/grants when possible.
- It does NOT clone Supabase dashboard/project settings, storage objects, Edge Functions, SMTP, Auth provider config, or secrets.
- If your app depends on storage policies/buckets or non-public schemas, handle those separately.

EOF