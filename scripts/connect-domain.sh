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
sudo docker compose -f docker-compose.prod.yml up -d --force-recreate
sleep 4
sudo docker ps --filter name=onenexium-app --format '{{.Names}} {{.Status}}'
curl -s -o /dev/null -w 'host_header:%{http_code}\n' -H 'Host: team.1nexium.com' http://127.0.0.1/login
echo "Domain connect done."
