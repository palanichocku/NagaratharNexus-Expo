#!/usr/bin/env bash
set -euo pipefail

# Path to your app's environment file
ENV_FILE=".env.local"
DEV_FILE=".env.development"
PROD_FILE=".env.production"

# ─────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()   { echo -e "${GREEN}[✔]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✘]${NC} $1"; exit 1; }

require_file() {
  [[ -f "$1" ]] || error "Missing file: $1"
}

switch_to() {
  local src="$1" label="$2"
  require_file "$src"

  # Backup
  [[ -f "$ENV_FILE" ]] && cp "$ENV_FILE" "${ENV_FILE}.bak"

  cp "$src" "$ENV_FILE"

  log "Switched env to: $label"
  warn "Restart Expo with cache clear:"
  echo "  npx expo start -c"
  echo ""
  show_status
}

show_status() {
  if [[ ! -f "$ENV_FILE" ]]; then
    warn "No $ENV_FILE found. (Using default env resolution)"
    return
  fi

  local current
  current="$(grep -E '^EXPO_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | head -n1 | cut -d'=' -f2- || true)"

  if [[ -z "$current" ]]; then
    warn "No EXPO_PUBLIC_SUPABASE_URL found in $ENV_FILE"
    return
  fi

  echo ""
  echo "  Current EXPO_PUBLIC_SUPABASE_URL:"
  echo "  $current"
  echo ""
}

# ─────────────────────────────────────────────
case "${1:-}" in
  dev)
    warn "Switching to DEV..."
    switch_to "$DEV_FILE" "DEV (.env.development → .env.local)"
    ;;
  prod)
    warn "Switching to PROD..."
    switch_to "$PROD_FILE" "PROD (.env.production → .env.local)"
    ;;
  status)
    show_status
    ;;
  *)
    echo "Usage: $0 [dev|prod|status]"
    exit 1
    ;;
esac
