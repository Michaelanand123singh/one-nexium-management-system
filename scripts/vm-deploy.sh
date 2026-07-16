#!/bin/bash
# Runs on the GCP VM — uses pre-loaded image (no build on VM).
set -e

APP_DIR="/opt/onenexium"
cd "$APP_DIR"

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

if ! sudo docker compose version >/dev/null 2>&1; then
  sudo mkdir -p /usr/local/lib/docker/cli-plugins
  sudo curl -fsSL "https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-linux-x86_64" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi

if [ -f /tmp/onenexium-image.tar ]; then
  echo "==> Loading pre-built Docker image..."
  sudo docker load -i /tmp/onenexium-image.tar
  rm -f /tmp/onenexium-image.tar
fi

echo "==> Configuring host nginx..."
sudo cp nginx/onenexium-host.conf /etc/nginx/sites-available/onenexium
sudo ln -sf /etc/nginx/sites-available/onenexium /etc/nginx/sites-enabled/onenexium
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo "==> Starting MinIO + app..."
sudo docker compose -f docker-compose.prod.yml up -d --force-recreate
# Ensure bucket exists (idempotent)
sudo docker compose -f docker-compose.prod.yml run --rm minio-init || true

echo "==> Done."
