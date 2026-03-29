#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage:
  reset one user:
    ENV_FILE=./ops/.env.admin.dev ./scripts/reset-test-password.sh \
      --email member1@nexus.com \
      --password 'XYZ123' \
      --confirm-email

  reset all matching users by domain:
    ENV_FILE=./ops/.env.admin.dev ./scripts/reset-test-password.sh \
      --all \
      --domain nexus.com \
      --password 'XYZ123'

  reset all users flagged as test accounts in profiles:
    ENV_FILE=./ops/.env.admin.dev ./scripts/reset-test-password.sh \
      --all-test-profiles \
      --password 'XYZ123'

Options:
  --email <email>             Reset one auth user by email
  --all                       Reset all auth users matching --domain
  --domain <domain>           Domain for --all mode, e.g. nexus.com
  --all-test-profiles         Reset all users whose profiles.is_test_data = true
  --password <password>       New password to set
  --confirm-email             Mark email as confirmed
  --dry-run                   Show which users would be updated only
  --help                      Show this help

Environment:
  ENV_FILE                    Optional path to env file
  SUPABASE_URL                Required
  SUPABASE_SERVICE_ROLE_KEY   Required
EOF
}

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required env var: $name" >&2
    exit 1
  fi
}

load_env_file() {
  local env_file="${ENV_FILE:-}"
  if [[ -z "$env_file" ]]; then
    return 0
  fi

  if [[ ! -f "$env_file" ]]; then
    echo "ENV_FILE does not exist: $env_file" >&2
    exit 1
  fi

  log "Loading env file: $env_file"
  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
}

EMAIL=""
PASSWORD=""
DOMAIN=""
MODE=""
CONFIRM_EMAIL="false"
DRY_RUN="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email)
      EMAIL="${2:-}"
      shift 2
      ;;
    --password)
      PASSWORD="${2:-}"
      shift 2
      ;;
    --domain)
      DOMAIN="${2:-}"
      shift 2
      ;;
    --all)
      MODE="all"
      shift
      ;;
    --all-test-profiles)
      MODE="all-test-profiles"
      shift
      ;;
    --confirm-email)
      CONFIRM_EMAIL="true"
      shift
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

load_env_file

require_env SUPABASE_URL
require_env SUPABASE_SERVICE_ROLE_KEY

if [[ -n "$EMAIL" ]]; then
  MODE="single"
fi

if [[ -z "$MODE" ]]; then
  echo "Choose one mode: --email, --all, or --all-test-profiles" >&2
  usage
  exit 1
fi

if [[ "$MODE" == "all" && -z "$DOMAIN" ]]; then
  echo "--all requires --domain" >&2
  exit 1
fi

if [[ -z "$PASSWORD" ]]; then
  echo "--password is required" >&2
  exit 1
fi

if [[ ${#PASSWORD} -lt 8 ]]; then
  echo "Password must be at least 8 characters" >&2
  exit 1
fi

export EMAIL PASSWORD DOMAIN MODE CONFIRM_EMAIL DRY_RUN SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY

node --input-type=module - <<'NODE'
import { createClient } from '@supabase/supabase-js';

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  EMAIL = '',
  PASSWORD = '',
  DOMAIN = '',
  MODE = '',
  CONFIRM_EMAIL = 'false',
  DRY_RUN = 'false',
} = process.env;

const confirmEmail = CONFIRM_EMAIL === 'true';
const dryRun = DRY_RUN === 'true';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function listAllAuthUsers() {
  const users = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const batch = data?.users ?? [];
    users.push(...batch);

    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
}

async function getTargetUsers() {
  if (MODE === 'single') {
    const users = await listAllAuthUsers();
    return users.filter(
      (u) => String(u.email || '').toLowerCase() === EMAIL.toLowerCase()
    );
  }

  if (MODE === 'all') {
    const users = await listAllAuthUsers();
    return users.filter((u) =>
      String(u.email || '').toLowerCase().endsWith(`@${DOMAIN.toLowerCase()}`)
    );
  }

  if (MODE === 'all-test-profiles') {
    const { data, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('is_test_data', true);

    if (error) throw error;

    const emails = new Set(
      (data ?? [])
        .map((r) => String(r.email || '').toLowerCase().trim())
        .filter(Boolean)
    );

    if (emails.size === 0) return [];

    const users = await listAllAuthUsers();
    return users.filter((u) =>
      emails.has(String(u.email || '').toLowerCase().trim())
    );
  }

  throw new Error(`Unsupported mode: ${MODE}`);
}

async function main() {
  const targets = await getTargetUsers();

  if (targets.length === 0) {
    console.log('No matching auth users found.');
    return;
  }

  console.log(`Matched ${targets.length} user(s):`);
  for (const u of targets) {
    console.log(`- ${u.email} (${u.id})`);
  }

  if (dryRun) {
    console.log('Dry run only. No passwords changed.');
    return;
  }

  let success = 0;
  let failed = 0;

  for (const user of targets) {
    try {
      const payload = {
        password: PASSWORD,
        ...(confirmEmail ? { email_confirm: true } : {}),
      };

      const { error } = await supabase.auth.admin.updateUserById(user.id, payload);
      if (error) throw error;

      success += 1;
      console.log(`✅ Reset password: ${user.email}`);
    } catch (err) {
      failed += 1;
      console.error(`❌ Failed: ${user.email} -> ${err.message}`);
    }
  }

  console.log(`Done. Success: ${success}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
});
NODE