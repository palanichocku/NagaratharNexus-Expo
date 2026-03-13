#!/usr/bin/env bash

# Shared helpers for ops scripts.
# Intended to be sourced, not executed directly.

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "This file is meant to be sourced, not run directly." >&2
  exit 1
fi

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
  printf '[%s] %b%s%b\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${GREEN}" "$*" "${NC}"
}

warn() {
  printf '[%s] %b%s%b\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${YELLOW}" "$*" "${NC}"
}

fail() {
  printf '[%s] %bERROR:%b %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${RED}" "${NC}" "$*" >&2
  exit 1
}

divider() {
  printf '\n%b%s%b\n' "${YELLOW}" "════════════════════════════════════════════════════════════" "${NC}"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

require_env() {
  local name="$1"
  [[ -n "${!name:-}" ]] || fail "Missing required env var: $name"
}

load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || fail "Env file not found: $file"

  set -a
  # shellcheck disable=SC1090
  source "$file"
  set +a
}

safe_db_hint() {
  local url="$1"
  echo "$url" | sed -E 's#^[^@]+@([^:/?]+).*$#\1#'
}

run_cmd() {
  if [[ "${DRY_RUN:-0}" -eq 1 ]]; then
    printf '[DRY RUN] '
    printf '%q ' "$@"
    printf '\n'
  else
    "$@"
  fi
}

run_db_cmd() {
  local preview="$1"
  shift

  if [[ "${DRY_RUN:-0}" -eq 1 ]]; then
    echo "[DRY RUN] $preview"
  else
    "$@"
  fi
}

checksum_file() {
  local file="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file"
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file"
  else
    fail "Missing required command: sha256sum or shasum"
  fi
}

epoch_days_ago() {
  local days="$1"
  date -u -d "-${days} days" +%s 2>/dev/null || python3 - "$days" <<'PY'
import sys
from datetime import datetime, timedelta, timezone
days = int(sys.argv[1])
print(int((datetime.now(timezone.utc) - timedelta(days=days)).timestamp()))
PY
}

iso_to_epoch() {
  local iso="$1"
  date -u -d "$iso" +%s 2>/dev/null || python3 - "$iso" <<'PY'
import sys
from datetime import datetime

s = sys.argv[1]
patterns = [
    "%Y-%m-%dT%H:%M:%S.%fZ",
    "%Y-%m-%dT%H:%M:%SZ",
]

for fmt in patterns:
    try:
        dt = datetime.strptime(s, fmt)
        print(int(dt.timestamp()))
        raise SystemExit(0)
    except ValueError:
        pass

raise SystemExit(f"Unsupported timestamp format: {s}")
PY
}

build_aws_args() {
  AWS_ARGS=(--region "${AWS_REGION:-us-east-1}")
  if [[ -n "${S3_ENDPOINT_URL:-}" ]]; then
    AWS_ARGS+=(--endpoint-url "$S3_ENDPOINT_URL")
  fi
}

require_prod_write_ack() {
  local target_name="${1:-target}"

  if [[ "${ALLOW_PROD_WRITE:-0}" != "1" ]]; then
    fail "Refusing to write to ${target_name}. Set ALLOW_PROD_WRITE=1 if you really want this."
  fi
}
