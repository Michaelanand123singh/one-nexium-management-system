#!/bin/bash
set -e
sudo cp /tmp/onenexium-host.conf /etc/nginx/sites-available/onenexium
sudo ln -sf /etc/nginx/sites-available/onenexium /etc/nginx/sites-enabled/onenexium
sudo nginx -t
sudo systemctl reload nginx

ENV=/opt/onenexium/.env
if [ ! -f "$ENV" ]; then
  echo "Missing $ENV" >&2
  exit 1
fi

if grep -qE '^NEXIUM_APP_URL=' "$ENV"; then
  sudo sed -i 's|^NEXIUM_APP_URL=.*|NEXIUM_APP_URL=http://team.1nexium.com|' "$ENV"
else
  echo 'NEXIUM_APP_URL=http://team.1nexium.com' | sudo tee -a "$ENV" >/dev/null
fi

echo "App URL now:"
grep '^NEXIUM_APP_URL=' "$ENV"

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
curl -s -o /dev/null -w 'host_header:%{http_code}\n' -H 'Host: team.1nexium.com' http://127.0.0.1/login
echo "Domain connect done."
