#!/bin/bash
# Recover MinIO after port conflict; keep existing app image.
set -euo pipefail
APP_DIR=/opt/onenexium
cd "$APP_DIR"

# Update compose from uploaded file if present
if [ -f /tmp/docker-compose.prod.yml ]; then
  cp /tmp/docker-compose.prod.yml "$APP_DIR/docker-compose.prod.yml"
fi

echo "==> Stopping failed/partial stack..."
sudo docker compose -f docker-compose.prod.yml down || true

echo "==> Starting MinIO + app..."
sudo docker compose -f docker-compose.prod.yml up -d
sleep 3
sudo docker compose -f docker-compose.prod.yml run --rm minio-init || true
sleep 2

echo "==> Status"
sudo docker compose -f docker-compose.prod.yml ps
curl -s -o /dev/null -w 'login:%{http_code}\n' https://team.1nexium.com/login || true
sudo docker logs onenexium-minio-1 2>&1 | tail -5 || true
sudo docker logs onenexium-app-1 2>&1 | tail -8 || true
echo "MinIO recover done."
