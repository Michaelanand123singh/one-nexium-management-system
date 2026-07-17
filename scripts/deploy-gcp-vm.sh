#!/usr/bin/env bash
# Deploy Nexium OS to a GCP Compute Engine VM (Linux / GitHub Actions).
# Mirrors scripts/deploy-gcp-vm.ps1
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT_ID="${GCP_PROJECT_ID:?GCP_PROJECT_ID required}"
ZONE="${GCP_ZONE:?GCP_ZONE required}"
INSTANCE="${GCP_INSTANCE:?GCP_INSTANCE required}"
APP_URL="${APP_URL:?APP_URL required}"
REMOTE_DIR="${REMOTE_DIR:-/opt/onenexium}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL required for prisma migrate deploy" >&2
  exit 1
fi

if [[ -z "${PRODUCTION_ENV:-}" ]]; then
  echo "PRODUCTION_ENV required (full .env contents for the VM)" >&2
  exit 1
fi

echo "Deploying to VM: ${INSTANCE} (${ZONE})"
echo "Public URL: ${APP_URL}"

gcloud config set project "${PROJECT_ID}" >/dev/null

echo ""
echo "Running database migrations..."
npx prisma migrate deploy

ENV_PROD="${ROOT}/.env.production.deploy"
if grep -qE '^NEXIUM_APP_URL=' <<<"${PRODUCTION_ENV}"; then
  printf '%s\n' "${PRODUCTION_ENV}" | sed -E "s|^NEXIUM_APP_URL=.*|NEXIUM_APP_URL=${APP_URL}|" >"${ENV_PROD}"
else
  printf '%s\nNEXIUM_APP_URL=%s\n' "${PRODUCTION_ENV}" "${APP_URL}" >"${ENV_PROD}"
fi

echo "Building Docker image..."
docker build -t onenexium-os:latest .

IMAGE_ARCHIVE="${RUNNER_TEMP:-/tmp}/onenexium-image.tar"
ARCHIVE="${RUNNER_TEMP:-/tmp}/onenexium-deploy.tar.gz"
rm -f "${IMAGE_ARCHIVE}" "${ARCHIVE}"

docker save onenexium-os:latest -o "${IMAGE_ARCHIVE}"

echo "Packaging app..."
tar -czf "${ARCHIVE}" \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.git \
  --exclude=.env \
  --exclude=.env.production.deploy \
  -C "${ROOT}" .

echo "Uploading to VM..."
# Always land files in /tmp first — /opt/onenexium may be root-owned (scp cannot sudo).
gcloud compute ssh "${INSTANCE}" --zone="${ZONE}" --command="sudo mkdir -p ${REMOTE_DIR}"
gcloud compute scp "${ARCHIVE}" "${INSTANCE}:/tmp/onenexium-deploy.tar.gz" --zone="${ZONE}"
gcloud compute scp "${IMAGE_ARCHIVE}" "${INSTANCE}:/tmp/onenexium-image.tar" --zone="${ZONE}"
gcloud compute scp "${ENV_PROD}" "${INSTANCE}:/tmp/onenexium.env" --zone="${ZONE}"
gcloud compute scp "${ROOT}/scripts/vm-deploy.sh" "${INSTANCE}:/tmp/vm-deploy.sh" --zone="${ZONE}"

echo "Starting on VM..."
# Install .env with sudo (fixes Permission denied on /opt/onenexium/.env), then deploy.
gcloud compute ssh "${INSTANCE}" --zone="${ZONE}" --command="
  set -e
  sudo mkdir -p ${REMOTE_DIR}
  sudo install -m 600 /tmp/onenexium.env ${REMOTE_DIR}/.env
  sudo chown -R \"\$(whoami):\$(whoami)\" ${REMOTE_DIR} || true
  cd ${REMOTE_DIR}
  tar xzf /tmp/onenexium-deploy.tar.gz
  chmod +x /tmp/vm-deploy.sh
  bash /tmp/vm-deploy.sh
  rm -f /tmp/onenexium.env
"

rm -f "${ARCHIVE}" "${IMAGE_ARCHIVE}" "${ENV_PROD}"

echo ""
echo "========================================"
echo "  DEPLOYED TO GCP VM"
echo "  URL:  ${APP_URL}"
echo "========================================"
