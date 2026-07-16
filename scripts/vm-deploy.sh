#!/bin/bash
# Runs on the GCP VM — uses pre-loaded image (no build on VM).
set -e

APP_DIR="/opt/onenexium"
DOMAIN="team.1nexium.com"
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
# Use SSL vhost only when certificates already exist; otherwise HTTP so nginx stays healthy.
if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ] && [ -f "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" ]; then
  echo "SSL certificates found — installing HTTPS nginx site"
  sudo cp nginx/onenexium-host.conf /etc/nginx/sites-available/onenexium
else
  echo "No SSL certificates yet — installing HTTP nginx site"
  sudo cp nginx/onenexium-host-http.conf /etc/nginx/sites-available/onenexium
fi
sudo ln -sf /etc/nginx/sites-available/onenexium /etc/nginx/sites-enabled/onenexium
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
if systemctl is-active --quiet nginx; then
  sudo systemctl reload nginx
else
  sudo systemctl enable nginx
  sudo systemctl start nginx
fi

echo "==> Starting MinIO + app..."
sudo docker compose -f docker-compose.prod.yml up -d --force-recreate
# Ensure bucket exists (idempotent)
sudo docker compose -f docker-compose.prod.yml run --rm minio-init || true

echo "==> Done."
