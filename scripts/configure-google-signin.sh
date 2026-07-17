#!/bin/bash
# Update Google Sign-In env on the VM without touching other secrets.
# Run on the VM with credentials in the environment (never commit real values):
#   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... ALLOWED_GOOGLE_EMAILS=... bash configure-google-signin.sh
set -euo pipefail

: "${GOOGLE_CLIENT_ID:?Set GOOGLE_CLIENT_ID before running}"
: "${GOOGLE_CLIENT_SECRET:?Set GOOGLE_CLIENT_SECRET before running}"

ENV=/opt/onenexium/.env
if [ ! -f "$ENV" ]; then
  echo "Missing $ENV" >&2
  exit 1
fi

sudo cp "$ENV" "${ENV}.bak.google.$(date +%Y%m%d%H%M%S)"

set_kv() {
  local key="$1"
  local value="$2"
  if grep -qE "^${key}=" "$ENV"; then
    sudo sed -i "s|^${key}=.*|${key}=${value}|" "$ENV"
  elif grep -qE "^#\s*${key}=" "$ENV"; then
    sudo sed -i "s|^#\s*${key}=.*|${key}=${value}|" "$ENV"
  else
    echo "${key}=${value}" | sudo tee -a "$ENV" >/dev/null
  fi
}

set_kv GOOGLE_CLIENT_ID "${GOOGLE_CLIENT_ID}"
set_kv GOOGLE_CLIENT_SECRET "${GOOGLE_CLIENT_SECRET}"
if [ -n "${ALLOWED_GOOGLE_EMAILS:-}" ]; then
  set_kv ALLOWED_GOOGLE_EMAILS "${ALLOWED_GOOGLE_EMAILS}"
fi
set_kv DEFAULT_GOOGLE_SIGNIN_ROLE "${DEFAULT_GOOGLE_SIGNIN_ROLE:-DEVELOPER}"
set_kv NEXIUM_APP_URL "${NEXIUM_APP_URL:-https://team.1nexium.com}"

echo "==> Updated keys (secrets masked):"
grep -E '^(GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|ALLOWED_GOOGLE_EMAILS|DEFAULT_GOOGLE_SIGNIN_ROLE|NEXIUM_APP_URL)=' "$ENV" \
  | sed 's/^\(GOOGLE_CLIENT_SECRET=\).*/\1***masked***/'

echo "==> Applying env to running app (PM2 or Docker)..."
cd /opt/onenexium
sudo docker compose -f docker-compose.prod.yml up -d minio
if command -v pm2 >/dev/null 2>&1 && pm2 jlist 2>/dev/null | grep -q '"status":"online"'; then
  pm2 restart all --update-env || true
elif sudo docker ps -q --filter publish=8080 | grep -q .; then
  sudo docker compose -f docker-compose.prod.yml --profile docker-app up -d --force-recreate --no-deps app
fi
sleep 5
(pm2 list 2>/dev/null || true)
sudo docker ps --filter name=onenexium --format '{{.Names}} {{.Status}}' || true

code=$(curl -s -o /dev/null -w '%{http_code}' "https://team.1nexium.com/api/auth/google" || true)
echo "google_auth_route_http:${code}"
echo "Done. Password login unchanged."
