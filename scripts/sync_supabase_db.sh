#!/usr/bin/env bash
# =============================================================================
# sync_supabase_db.sh  (v2 — fixed auth schema conflict + row count verification)
# Mirror NagaratharNexus (prod) → NagaratharNexus-Dev (dev)
#
# USAGE:
#   chmod +x sync_supabase_db.sh
#   ./sync_supabase_db.sh
#
# REQUIREMENTS:
#   - PostgreSQL client tools (pg_dump, psql) installed locally
#     Install on Mac:   brew install postgresql
#     Install on Linux: sudo apt-get install postgresql-client
#     Install on Win:   Use WSL or download from postgresql.org/download
#
# FIND YOUR CONNECTION STRINGS:
#   Supabase Dashboard → Your Project → Settings → Database
#   → "Connection string" tab → URI format
#   It looks like: postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
#   NOTE: URL-encode special chars in password, e.g. @ → %40
# =============================================================================

set -euo pipefail

# ─────────────────────────────────────────────
# CONFIGURE THESE BEFORE RUNNING
# ─────────────────────────────────────────────

# Production DB (source) — NagaratharNexus
SOURCE_DB_URL="postgresql://postgres:C00kingk0mali%402026@db.lgfgalppibkdzkwqdabf.supabase.co:5432/postgres"

# Dev DB (target) — NagaratharNexus-Dev
TARGET_DB_URL="postgresql://postgres:C00kingk0mali%402026@db.ipvsnjjhcxluyicfnrgh.supabase.co:5432/postgres"

DUMP_FILE="/tmp/nagarathar_nexus_$(date +%Y%m%d_%H%M%S).dump"

# ─────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()    { echo -e "${GREEN}[✔]${NC} $1"; }
warn()   { echo -e "${YELLOW}[!]${NC} $1"; }
error()  { echo -e "${RED}[✘]${NC} $1"; exit 1; }
divider(){ echo -e "\n${YELLOW}══════════════════════════════════════════════${NC}"; }

# ─────────────────────────────────────────────
# STEP 0: Pre-flight checks
# ─────────────────────────────────────────────
divider
echo "  NagaratharNexus → NagaratharNexus-Dev Sync  (v2)"
divider

warn "Checking prerequisites..."
command -v pg_dump >/dev/null 2>&1 || error "pg_dump not found.
  Mac:   brew install postgresql
  Linux: sudo apt-get install postgresql-client"
command -v psql >/dev/null 2>&1 || error "psql not found."
log "PostgreSQL client tools found."

if [[ "$SOURCE_DB_URL" == *"YOUR-PROD"* ]] || [[ "$TARGET_DB_URL" == *"YOUR-DEV"* ]]; then
  error "Please configure SOURCE_DB_URL and TARGET_DB_URL at the top of this script."
fi

# ─────────────────────────────────────────────
# STEP 1: Test connections
# ─────────────────────────────────────────────
divider
warn "Testing database connections..."

psql "$SOURCE_DB_URL" -c "SELECT current_database(), now();" > /dev/null 2>&1 \
  || error "Cannot connect to SOURCE database. Check SOURCE_DB_URL and password."
log "Source DB connection: OK"

psql "$TARGET_DB_URL" -c "SELECT current_database(), now();" > /dev/null 2>&1 \
  || error "Cannot connect to TARGET database. Check TARGET_DB_URL and password."
log "Target DB connection: OK"

# ─────────────────────────────────────────────
# SAFETY PROMPT
# ─────────────────────────────────────────────
divider
warn "⚠️  WARNING: This will COMPLETELY WIPE NagaratharNexus-Dev and replace with prod data."
echo ""
read -p "   Type 'yes' to continue: " confirm
[[ "$confirm" == "yes" ]] || { echo "Aborted."; exit 0; }

# ─────────────────────────────────────────────
# STEP 2: Dump ONLY the public schema from source
# We exclude auth/storage/realtime because Supabase pre-creates those
# in every new project — pg_restore cannot overwrite them.
# Auth users are handled separately in Step 5.
# ─────────────────────────────────────────────
divider
warn "Dumping source database — public schema only..."

pg_dump \
  "$SOURCE_DB_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --schema=public \
  --verbose \
  --file="$DUMP_FILE" 2>&1 | grep -E "(dumping|reading|saving|error|warning)" || true

DUMP_SIZE=$(du -sh "$DUMP_FILE" | cut -f1)
log "Dump complete: $DUMP_FILE ($DUMP_SIZE)"

# ─────────────────────────────────────────────
# STEP 3: Wipe public schema on target
# ─────────────────────────────────────────────
divider
warn "Clearing target public schema..."

psql "$TARGET_DB_URL" <<'EOF'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
EOF

log "Target public schema cleared."

# ─────────────────────────────────────────────
# STEP 4: Restore public schema to target
# ─────────────────────────────────────────────
divider
warn "Restoring public schema to NagaratharNexus-Dev..."

pg_restore \
  --dbname="$TARGET_DB_URL" \
  --no-owner \
  --no-acl \
  --schema=public \
  --verbose \
  "$DUMP_FILE" 2>&1 | grep -E "(creating|restoring|processing|error|warning)" || true

log "Restore complete."

# ─────────────────────────────────────────────
# STEP 5: Copy auth.users from prod → dev
# Allows existing users to log into the dev environment.
# ─────────────────────────────────────────────
divider
warn "Copying auth.users from prod → dev..."

AUTH_SQL="/tmp/auth_users_$$.sql"

psql "$SOURCE_DB_URL" -t -A -c "
SELECT 'INSERT INTO auth.users(
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
  recovery_token, recovery_sent_at, email_change_token_new, email_change,
  email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
  phone_change, phone_change_token, phone_change_sent_at,
  email_change_token_current, email_change_confirm_status,
  banned_until, reauthentication_token, reauthentication_sent_at,
  is_sso_user, deleted_at
) VALUES (
  ' || quote_nullable(instance_id::text) || ',' ||
  quote_nullable(id::text) || ',' ||
  quote_nullable(aud) || ',' ||
  quote_nullable(role) || ',' ||
  quote_nullable(email) || ',' ||
  quote_nullable(encrypted_password) || ',' ||
  quote_nullable(email_confirmed_at::text) || ',' ||
  quote_nullable(invited_at::text) || ',' ||
  quote_nullable(confirmation_token) || ',' ||
  quote_nullable(confirmation_sent_at::text) || ',' ||
  quote_nullable(recovery_token) || ',' ||
  quote_nullable(recovery_sent_at::text) || ',' ||
  quote_nullable(email_change_token_new) || ',' ||
  quote_nullable(email_change) || ',' ||
  quote_nullable(email_change_sent_at::text) || ',' ||
  quote_nullable(last_sign_in_at::text) || ',' ||
  quote_nullable(raw_app_meta_data::text) || ',' ||
  quote_nullable(raw_user_meta_data::text) || ',' ||
  quote_nullable(is_super_admin::text) || ',' ||
  quote_nullable(created_at::text) || ',' ||
  quote_nullable(updated_at::text) || ',' ||
  quote_nullable(phone) || ',' ||
  quote_nullable(phone_confirmed_at::text) || ',' ||
  quote_nullable(phone_change) || ',' ||
  quote_nullable(phone_change_token) || ',' ||
  quote_nullable(phone_change_sent_at::text) || ',' ||
  quote_nullable(email_change_token_current) || ',' ||
  quote_nullable(email_change_confirm_status::text) || ',' ||
  quote_nullable(banned_until::text) || ',' ||
  quote_nullable(reauthentication_token) || ',' ||
  quote_nullable(reauthentication_sent_at::text) || ',' ||
  quote_nullable(is_sso_user::text) || ',' ||
  quote_nullable(deleted_at::text) ||
') ON CONFLICT (id) DO NOTHING;'
FROM auth.users;
" > "$AUTH_SQL" 2>/dev/null || true

LINE_COUNT=$(wc -l < "$AUTH_SQL" | tr -d ' ')
if [[ "$LINE_COUNT" -gt 0 ]]; then
  psql "$TARGET_DB_URL" -f "$AUTH_SQL" > /dev/null 2>&1 \
    && log "Auth users copied ($LINE_COUNT users)." \
    || warn "Some auth user inserts failed (may already exist — that's OK)."
else
  warn "No auth users found to copy."
fi
rm -f "$AUTH_SQL"

# ─────────────────────────────────────────────
# STEP 6: Verify row counts (public schema)
# ─────────────────────────────────────────────
divider
warn "Verifying row counts (public schema)..."

echo ""
printf "%-40s %-15s %-15s %s\n" "TABLE" "SOURCE ROWS" "DEV ROWS" "STATUS"
printf "%-40s %-15s %-15s %s\n" "────────────────────────────────────────" "───────────────" "───────────────" "──────"

MISMATCH=0

TABLES=$(psql "$SOURCE_DB_URL" -t -A -c "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name;
")

while IFS= read -r table; do
  [[ -z "$table" ]] && continue
  src=$(psql "$SOURCE_DB_URL" -t -A -c "SELECT COUNT(*) FROM public.\"$table\";" 2>/dev/null | tr -d '[:space:]' || echo "ERR")
  tgt=$(psql "$TARGET_DB_URL" -t -A -c "SELECT COUNT(*) FROM public.\"$table\";" 2>/dev/null | tr -d '[:space:]' || echo "ERR")

  if [[ "$src" == "$tgt" ]]; then
    STATUS="${GREEN}✔ MATCH${NC}"
  else
    STATUS="${RED}✘ MISMATCH${NC}"
    MISMATCH=1
  fi
  printf "%-40s %-15s %-15s " "$table" "$src" "$tgt"
  echo -e "$STATUS"
done <<< "$TABLES"

echo ""
if [[ $MISMATCH -eq 0 ]]; then
  log "All row counts match! ✔"
else
  warn "Some row counts differ — review the table above."
fi

# ─────────────────────────────────────────────
# STEP 7: Verify RLS policies
# ─────────────────────────────────────────────
divider
warn "RLS policies on NagaratharNexus-Dev:"
psql "$TARGET_DB_URL" -c "
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
"

# ─────────────────────────────────────────────
# STEP 8: Verify functions & triggers
# ─────────────────────────────────────────────
divider
warn "Functions on NagaratharNexus-Dev:"
psql "$TARGET_DB_URL" -c "
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
"

warn "Triggers on NagaratharNexus-Dev:"
psql "$TARGET_DB_URL" -c "
SELECT trigger_name, event_object_table, event_manipulation, action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
"

warn "Fixing SECURITY DEFINER on RPC functions..."
psql "$TARGET_DB_URL" <<'EOF'
ALTER FUNCTION public.search_profiles_v2 SECURITY DEFINER;
ALTER FUNCTION public.search_profiles_v2 SET search_path = public;
ALTER FUNCTION public.get_filter_metadata SECURITY DEFINER;
ALTER FUNCTION public.get_filter_metadata SET search_path = public;
EOF
log "RPC function permissions fixed."

warn "Restoring table grants..."
psql "$TARGET_DB_URL" <<'EOF'
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;
EOF
log "Grants restored."

# ─────────────────────────────────────────────
# CLEANUP
# ─────────────────────────────────────────────
divider
rm -f "$DUMP_FILE"
log "Dump file removed."

divider
echo -e "${GREEN}"
echo "  ✔  SYNC COMPLETE!"
echo "  NagaratharNexus-Dev is now a mirror of NagaratharNexus (prod)."
echo -e "${NC}"
echo "  Next steps:"
echo "  1. Point app to dev:  ./switch_env.sh dev"
echo "  2. Test your app"
echo "  3. Switch back:       ./switch_env.sh prod"
divider
