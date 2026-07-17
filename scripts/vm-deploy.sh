#!/bin/bash
# Runs on the GCP VM after files are uploaded to /opt/onenexium.
#
# Production reality on this VM:
#   - nginx → 127.0.0.1:8080
#   - App on :8080 is usually PM2 (host Node), NOT Docker
#   - MinIO runs in Docker (host reaches it at 127.0.0.1:9000)
#
# Starting Docker "app" while PM2 holds :8080 causes:
#   listen tcp4 127.0.0.1:8080: bind: address already in use
set -euo pipefail

APP_DIR="/opt/onenexium"
DOMAIN="team.1nexium.com"
COMPOSE="docker-compose.prod.yml"
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
  echo "==> Loading pre-built Docker image (used only if app mode = docker)..."
  sudo docker load -i /tmp/onenexium-image.tar
  rm -f /tmp/onenexium-image.tar
fi

echo "==> Configuring host nginx..."
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

port_8080_in_use() {
  sudo ss -lptn 'sport = :8080' 2>/dev/null | grep -q 8080
}

docker_owns_8080() {
  sudo docker ps -q --filter publish=8080 2>/dev/null | grep -q .
}

# Discover PM2 as: "user|path/to/pm2" (GitHub SSH user may differ from the PM2 owner).
pm2_target() {
  local user home candidate bin
  if [ -n "${PM2_USER:-}" ]; then
    user="$PM2_USER"
    home="$(getent passwd "$user" | cut -d: -f6 || true)"
    bin="$(sudo -u "$user" bash -lc 'command -v pm2' 2>/dev/null || true)"
    if [ -z "$bin" ] && [ -n "$home" ]; then
      for candidate in "$home/.nvm/versions/node"/*/bin/pm2 /usr/local/bin/pm2; do
        if [ -x "$candidate" ]; then bin="$candidate"; break; fi
      done
    fi
    if [ -n "$bin" ]; then echo "${user}|${bin}"; return 0; fi
    return 1
  fi

  # Prefer current user, then common VM users.
  for user in "$(whoami)" ubuntu root; do
    [ -n "$user" ] || continue
    bin="$(sudo -u "$user" bash -lc 'command -v pm2' 2>/dev/null || true)"
    if [ -z "$bin" ] && [ "$user" = "$(whoami)" ] && command -v pm2 >/dev/null 2>&1; then
      bin="$(command -v pm2)"
    fi
    if [ -n "$bin" ]; then
      if sudo -u "$user" "$bin" jlist 2>/dev/null | grep -q '"status":"online"'; then
        echo "${user}|${bin}"
        return 0
      fi
      # Keep first pm2 binary found as fallback
      if [ -z "${_PM2_FALLBACK:-}" ]; then
        _PM2_FALLBACK="${user}|${bin}"
      fi
    fi
  done
  if [ -n "${_PM2_FALLBACK:-}" ]; then
    echo "$_PM2_FALLBACK"
    return 0
  fi
  return 1
}

pm2_has_online() {
  local target user bin
  target="$(pm2_target)" || return 1
  user="${target%%|*}"
  bin="${target#*|}"
  sudo -u "$user" "$bin" jlist 2>/dev/null | grep -q '"status":"online"'
}

pm2_run() {
  local target user bin
  target="$(pm2_target)" || return 1
  user="${target%%|*}"
  bin="${target#*|}"
  sudo -u "$user" "$bin" "$@"
}

# Resolve which PM2 process to reload (never invent a second listener on 8080).
resolve_pm2_name() {
  local name
  if [ -n "${PM2_APP_NAME:-}" ]; then
    echo "$PM2_APP_NAME"
    return 0
  fi
  for name in onenexium onenexium-os nexium nexium-os onenexium-management-system; do
    if pm2_run describe "$name" >/dev/null 2>&1; then
      echo "$name"
      return 0
    fi
  done
  name="$(
    pm2_run jlist 2>/dev/null | node -e '
      let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>{
        try {
          const apps=JSON.parse(s||"[]");
          const online=apps.find(a=>a&&a.pm2_env&&a.pm2_env.status==="online");
          if(online&&online.name) process.stdout.write(online.name);
        } catch {}
      });
    ' 2>/dev/null || true
  )"
  if [ -n "$name" ]; then
    echo "$name"
    return 0
  fi
  return 1
}

detect_app_mode() {
  # Explicit override: DEPLOY_APP_MODE=pm2|docker
  case "${DEPLOY_APP_MODE:-}" in
    pm2|docker) echo "$DEPLOY_APP_MODE"; return ;;
  esac

  if docker_owns_8080; then
    echo docker
    return
  fi

  # Host already serving :8080 (PM2/Node) — never steal that port with Docker.
  if port_8080_in_use; then
    echo pm2
    return
  fi

  if pm2_has_online; then
    echo pm2
    return
  fi

  echo docker
}

deploy_minio() {
  echo "==> Ensuring MinIO (Docker only — does not use host :8080)..."
  # Do NOT "compose down" the whole stack — that fights a live PM2 app and drops MinIO briefly.
  sudo docker compose -f "$COMPOSE" up -d minio
  sudo docker compose -f "$COMPOSE" run --rm minio-init || true
}

deploy_app_pm2() {
  local bin name
  echo "==> App mode: PM2 (host) — Docker app will NOT bind :8080"

  # If a leftover docker app container exists, leave it stopped so it cannot grab 8080 later.
  if sudo docker ps -aq --filter name=onenexium-app 2>/dev/null | grep -q .; then
    echo "==> Stopping leftover Docker app container(s) so they cannot fight PM2 on :8080..."
    sudo docker compose -f "$COMPOSE" --profile docker-app stop app 2>/dev/null || true
    sudo docker rm -f "$(sudo docker ps -aq --filter name=onenexium-app)" 2>/dev/null || true
  fi

  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    echo "ERROR: PM2/host deploy needs node+npm on the VM." >&2
    exit 1
  fi

  target="$(pm2_target)" || {
    echo "ERROR: Port 8080 is in use by a host process, but pm2 was not found." >&2
    echo "Install pm2, or set PM2_USER=<os-user> / PM2_APP_NAME=<name>." >&2
    sudo ss -lptn 'sport = :8080' || true
    exit 1
  }
  pm2_user="${target%%|*}"
  echo "==> Using PM2 owner: $pm2_user"

  # Ensure the PM2 OS user can read the freshly extracted tree.
  sudo chown -R "$pm2_user:$pm2_user" "$APP_DIR" || true

  echo "==> Installing deps + building Next.js for PM2 (as $pm2_user)..."
  sudo -u "$pm2_user" bash -lc "
    set -e
    cd '$APP_DIR'
    if [ -f package-lock.json ]; then npm ci; else npm install; fi
    npm run build
  "

  if name="$(resolve_pm2_name)"; then
    echo "==> Reloading existing PM2 app: $name"
    pm2_run restart "$name" --update-env
  elif port_8080_in_use; then
    echo "ERROR: :8080 is already in use, but no PM2 app name could be resolved." >&2
    echo "Set PM2_USER and/or PM2_APP_NAME to match the live process." >&2
    sudo ss -lptn 'sport = :8080' || true
    pm2_run list || true
    exit 1
  else
    echo "==> No listener on :8080 — starting PM2 app 'onenexium'"
    pm2_run start npm --name onenexium --cwd "$APP_DIR" -- start
  fi
  pm2_run save || true

  echo "==> PM2 status:"
  pm2_run list || true
}

deploy_app_docker() {
  echo "==> App mode: Docker — binding 127.0.0.1:8080 → container"

  if port_8080_in_use && ! docker_owns_8080; then
    echo "ERROR: Host process still holds :8080; refusing to start Docker app (would break PM2)." >&2
    echo "Stop the host/PM2 process first, or leave DEPLOY_APP_MODE unset for auto PM2 mode." >&2
    exit 1
  fi

  # Recreate only the app service; MinIO already up. Profile required (see compose).
  sudo docker compose -f "$COMPOSE" --profile docker-app up -d --force-recreate --no-deps app
}

APP_MODE="$(detect_app_mode)"
echo "==> Detected DEPLOY_APP_MODE=$APP_MODE"

deploy_minio

case "$APP_MODE" in
  pm2) deploy_app_pm2 ;;
  docker) deploy_app_docker ;;
  *) echo "Unknown app mode: $APP_MODE" >&2; exit 1 ;;
esac

echo "==> Done."
