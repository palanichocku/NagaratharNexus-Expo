#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()   { echo -e "${GREEN}[✔]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✘]${NC} $1"; exit 1; }

DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# ── Staff to seed ────────────────────────────────────────────
# Format: "email|password|full_name|role"
STAFF=(
  "admin1@nexus.com|password123|Seed Admin1|ADMIN"
  "mod1@nexus.com|password123|Seed Moderator1|MODERATOR"
)

# ── Ensure auth user exists via direct DB insert ─────────────
ensure_auth_user() {
  local email="$1" password="$2" full_name="$3"

  # Check if already exists
  local uid
  uid=$(psql "$DB_URL" -t -A -c \
    "SELECT id FROM auth.users WHERE email = lower('${email}') LIMIT 1;")
  uid=$(echo "$uid" | tr -d '[:space:]')

  if [[ -n "$uid" ]]; then
    warn "Already exists: ${email} -> ${uid}"
    echo "$uid"
    return
  fi

  # Insert directly into auth.users using pgcrypto for bcrypt hashing
  uid=$(psql "$DB_URL" -t -A <<SQL
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  raw_app_meta_data,
  role,
  aud,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  lower('${email}'),
  crypt('${password}', gen_salt('bf')),
  now(),
  jsonb_build_object('full_name', '${full_name}'),
  jsonb_build_object('provider', 'email', 'providers', array['email']),
  'authenticated',
  'authenticated',
  now(),
  now(),
  '',
  '',
  '',
  ''
)
RETURNING id;
SQL
)
  # Strip whitespace and extract only the UUID (first line matching UUID format)
  uid=$(echo "$uid" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
  [[ -z "$uid" ]] && error "Failed to insert auth user: ${email}"

  echo "$uid"
}

# ── Upsert profile + user_role ───────────────────────────────
upsert_profile_and_role() {
  local uid="$1" email="$2" full_name="$3" role="$4"

  psql -q "$DB_URL" <<SQL
INSERT INTO public.profiles
  (id, email, full_name, role, is_approved, is_submitted, account_status, hide_phone, hide_email, is_test_data)
VALUES
  ('${uid}', '${email}', '${full_name}', '${role}', true, false, 'ACTIVE', true, true, false)
ON CONFLICT (id) DO UPDATE SET
  role           = EXCLUDED.role,
  full_name      = EXCLUDED.full_name,
  is_approved    = true,
  account_status = 'ACTIVE';

INSERT INTO public.user_roles (user_id, role)
VALUES ('${uid}', '${role}')
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
SQL

  log "Upserted profile + role: ${email} -> ${role}"
}

# ── Main ─────────────────────────────────────────────────────
echo ""
echo "👤 Seeding local staff users..."
echo ""

for entry in "${STAFF[@]}"; do
  IFS='|' read -r email password full_name role <<< "$entry"
  warn "Processing: ${email} (${role})"

  uid=$(ensure_auth_user "$email" "$password" "$full_name")
  [[ -z "$uid" ]] && error "Could not get uid for ${email}"

  log "Auth user id: ${uid}"
  upsert_profile_and_role "$uid" "$email" "$full_name" "$role"
  echo ""
done

echo -e "${GREEN}🎉 Done seeding local staff.${NC}"
