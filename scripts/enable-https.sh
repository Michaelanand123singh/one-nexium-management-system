#!/bin/bash
# Enable HTTPS for team.1nexium.com carefully (Let's Encrypt + nginx).
set -euo pipefail

DOMAIN="team.1nexium.com"
APP_URL="https://${DOMAIN}"
NGINX_SITE="/etc/nginx/sites-available/onenexium"
BACKUP="/etc/nginx/sites-available/onenexium.bak.$(date +%Y%m%d%H%M%S)"

echo "==> Backing up nginx site -> $BACKUP"
sudo cp "$NGINX_SITE" "$BACKUP"

echo "==> Ensuring certbot nginx plugin..."
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx

# Fresh HTTP vhost for ACME (must be reachable on :80 before certificate).
# Prefer /tmp upload if present, else keep current site.
if [ -f /tmp/onenexium-host-http.conf ]; then
  sudo cp /tmp/onenexium-host-http.conf "$NGINX_SITE"
  sudo ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/onenexium
  sudo nginx -t && sudo systemctl reload nginx
fi

echo "==> Requesting / renewing Let's Encrypt certificate for $DOMAIN..."
if [ -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
  sudo certbot renew --cert-name "$DOMAIN" --nginx --non-interactive || true
  # Ensure nginx SSL config is in place even if renew was a no-op.
  sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect --keep-until-expiring
else
  sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect
fi

sudo nginx -t && sudo systemctl reload nginx

echo "==> Setting NEXIUM_APP_URL=$APP_URL"
ENV=/opt/onenexium/.env
if [ ! -f "$ENV" ]; then
  echo "Missing $ENV" >&2
  exit 1
fi
if grep -qE '^NEXIUM_APP_URL=' "$ENV"; then
  sudo sed -i "s|^NEXIUM_APP_URL=.*|NEXIUM_APP_URL=${APP_URL}|" "$ENV"
else
  echo "NEXIUM_APP_URL=${APP_URL}" | sudo tee -a "$ENV" >/dev/null
fi
grep '^NEXIUM_APP_URL=' "$ENV"

echo "==> Applying HTTPS app URL to running app (PM2 or Docker)..."
cd /opt/onenexium
sudo docker compose -f docker-compose.prod.yml up -d minio
if command -v pm2 >/dev/null 2>&1 && pm2 jlist 2>/dev/null | grep -q '"status":"online"'; then
  pm2 restart all --update-env || true
elif sudo docker ps -q --filter publish=8080 | grep -q .; then
  sudo docker compose -f docker-compose.prod.yml --profile docker-app up -d --force-recreate --no-deps app
fi
sleep 4
(pm2 list 2>/dev/null || true)
sudo docker ps --filter name=onenexium --format '{{.Names}} {{.Status}}' || true

echo "==> Local checks"
curl -s -o /dev/null -w 'https_local:%{http_code}\n' --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/login" || true
curl -s -o /dev/null -w 'http_redirect:%{http_code}\n' -H "Host: ${DOMAIN}" http://127.0.0.1/login || true

echo "==> Saving effective nginx site to /tmp/onenexium-host-ssl.conf"
sudo cp "$NGINX_SITE" /tmp/onenexium-host-ssl.conf
sudo chmod 644 /tmp/onenexium-host-ssl.conf

echo "HTTPS enable done."
