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
# Prebuilt Next standalone extracted from the CI Docker image (never run next build on the VM).
RELEASE_DIR="${APP_DIR}/release"
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

# PID listening on 127.0.0.1:8080 (if any).
pid_on_8080() {
  sudo ss -lptn 'sport = :8080' 2>/dev/null \
    | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' \
    | head -1
}

# OS user that owns the live next-server on :8080 (this VM: Hp, not the SSH user).
owner_of_8080() {
  local pid
  pid="$(pid_on_8080)"
  [ -n "$pid" ] || return 1
  ps -o user= -p "$pid" 2>/dev/null | awk '{print $1}'
}

user_home() {
  getent passwd "$1" | cut -d: -f6
}

# Find pm2 binary for a user (login PATH + nvm + system).
pm2_bin_for_user() {
  local user="$1" home bin candidate
  home="$(user_home "$user")"
  bin="$(sudo -u "$user" bash -lc 'command -v pm2' 2>/dev/null || true)"
  if [ -z "$bin" ] && [ -n "$home" ]; then
    for candidate in \
      "$home/.nvm/versions/node"/*/bin/pm2 \
      /usr/local/bin/pm2 \
      /usr/bin/pm2
    do
      if [ -x "$candidate" ]; then
        bin="$candidate"
        break
      fi
    done
  fi
  [ -n "$bin" ] || return 1
  echo "$bin"
}

# Run pm2 as a specific OS user with that user's PM2_HOME (critical on multi-user VMs).
pm2_as_user() {
  local user="$1"
  shift
  local home bin
  home="$(user_home "$user")"
  bin="$(pm2_bin_for_user "$user")" || return 1
  sudo -u "$user" env "PM2_HOME=${home}/.pm2" "HOME=${home}" "$bin" "$@"
}

# Candidate OS users that may own the production PM2 daemon.
pm2_candidate_users() {
  local u seen=""
  if [ -n "${PM2_USER:-}" ]; then
    echo "$PM2_USER"
    return 0
  fi
  # 1) Whoever owns the live :8080 process (Hp on this VM)
  if u="$(owner_of_8080)"; then
    echo "$u"
    seen="|$u|"
  fi
  # 2) Anyone with a ~/.pm2 directory
  for u in Hp onenexium anand ubuntu runner vyshnavi root "$(whoami)"; do
    case "$seen" in *"|$u|"*) continue ;; esac
    home="$(user_home "$u" 2>/dev/null || true)"
    [ -n "$home" ] && [ -d "$home/.pm2" ] || continue
    echo "$u"
    seen="${seen}|$u|"
  done
  for home in /home/*; do
    [ -d "$home/.pm2" ] || continue
    u="$(basename "$home")"
    case "$seen" in *"|$u|"*) continue ;; esac
    echo "$u"
    seen="${seen}|$u|"
  done
}

# Discover PM2 as: "user|path/to/pm2"
# Prefer the user who owns :8080 / has online apps — never the empty SSH-user daemon.
pm2_target() {
  local user bin
  local fallback=""

  for user in $(pm2_candidate_users); do
    bin="$(pm2_bin_for_user "$user")" || continue
    if pm2_as_user "$user" jlist 2>/dev/null | grep -q '"status":"online"'; then
      echo "${user}|${bin}"
      return 0
    fi
    # Prefer owner of :8080 even if jlist is briefly empty (daemon needs resurrect).
    if [ -z "$fallback" ] && [ "$user" = "$(owner_of_8080 2>/dev/null || true)" ]; then
      fallback="${user}|${bin}"
    fi
    if [ -z "$fallback" ] && [ -f "$(user_home "$user")/.pm2/dump.pm2" ]; then
      fallback="${user}|${bin}"
    fi
  done

  if [ -n "$fallback" ]; then
    echo "$fallback"
    return 0
  fi
  return 1
}

pm2_has_online() {
  local user
  for user in $(pm2_candidate_users); do
    if pm2_as_user "$user" jlist 2>/dev/null | grep -q '"status":"online"'; then
      return 0
    fi
  done
  return 1
}

pm2_run() {
  local target user
  target="$(pm2_target)" || return 1
  user="${target%%|*}"
  pm2_as_user "$user" "$@"
}

# Resolve which PM2 process to reload (never invent a second listener on 8080).
resolve_pm2_name() {
  local name user target
  if [ -n "${PM2_APP_NAME:-}" ]; then
    echo "$PM2_APP_NAME"
    return 0
  fi

  target="$(pm2_target)" || return 1
  user="${target%%|*}"

  # If daemon looks empty but dump exists, resurrect saved processes (Hp case).
  if ! pm2_as_user "$user" jlist 2>/dev/null | grep -q '"status":"online"'; then
    if [ -f "$(user_home "$user")/.pm2/dump.pm2" ]; then
      echo "==> PM2 list empty for $user — resurrecting from dump.pm2..." >&2
      pm2_as_user "$user" resurrect >/dev/null 2>&1 || true
    fi
  fi

  for name in onenexium onenexium-os nexium nexium-os onenexium-management-system; do
    if pm2_as_user "$user" describe "$name" >/dev/null 2>&1; then
      echo "$name"
      return 0
    fi
  done
  name="$(
    pm2_as_user "$user" jlist 2>/dev/null | node -e '
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

# Extract the already-built standalone app from onenexium-os:latest (built on GitHub Actions).
# The VM is too small to run `next build` — that hung/OOM'd for 40+ minutes.
extract_release_from_image() {
  local user="$1"
  local cid=""
  local tmp

  if ! sudo docker image inspect onenexium-os:latest >/dev/null 2>&1; then
    echo "ERROR: Docker image onenexium-os:latest not loaded (needed for host/PM2 release)." >&2
    exit 1
  fi

  echo "==> Extracting prebuilt standalone from Docker image (no next build on VM)..."
  tmp="$(mktemp -d /tmp/onenexium-release.XXXXXX)"
  cid="$(sudo docker create onenexium-os:latest)"
  sudo docker cp "${cid}:/app/." "${tmp}/"
  sudo docker rm -f "$cid" >/dev/null

  if [ ! -f "${tmp}/server.js" ]; then
    echo "ERROR: Extracted image has no server.js (standalone layout unexpected)." >&2
    sudo rm -rf "$tmp"
    exit 1
  fi

  # Atomic swap of release directory
  sudo rm -rf "${RELEASE_DIR}.prev"
  if [ -d "$RELEASE_DIR" ]; then
    sudo mv "$RELEASE_DIR" "${RELEASE_DIR}.prev"
  fi
  sudo mkdir -p "$APP_DIR"
  sudo mv "$tmp" "$RELEASE_DIR"
  sudo cp -f "$APP_DIR/.env" "$RELEASE_DIR/.env"
  sudo chown -R "${user}:${user}" "$RELEASE_DIR"
  sudo rm -rf "${RELEASE_DIR}.prev"

  echo "==> Release ready at $RELEASE_DIR"
}

# Stop whatever currently holds :8080 (old next-server / old PM2), then start release under PM2.
start_release_with_pm2() {
  local user="$1"
  local pid name

  if [ ! -f "$RELEASE_DIR/server.js" ]; then
    echo "ERROR: missing $RELEASE_DIR/server.js" >&2
    exit 1
  fi

  # Free :8080 briefly for the new process.
  if pid="$(pid_on_8080)"; then
    echo "==> Stopping old listener pid=$pid on :8080..."
    sudo kill "$pid" 2>/dev/null || true
    sleep 2
    if port_8080_in_use; then
      sudo kill -9 "$pid" 2>/dev/null || true
      sleep 1
    fi
  fi

  # Remove known old app names so we don't leave duplicates.
  for name in onenexium onenexium-os nexium nexium-os onenexium-management-system; do
    pm2_as_user "$user" delete "$name" >/dev/null 2>&1 || true
  done

  echo "==> Starting PM2 'onenexium' → node server.js (cwd=$RELEASE_DIR)"
  # Bind loopback only — nginx proxies to 127.0.0.1:8080
  # Write a tiny ecosystem so PORT/HOSTNAME survive pm2 save/reboot.
  cat <<EOF | sudo tee "$RELEASE_DIR/ecosystem.config.cjs" >/dev/null
module.exports = {
  apps: [{
    name: "onenexium",
    cwd: "$RELEASE_DIR",
    script: "server.js",
    env: {
      NODE_ENV: "production",
      PORT: "8080",
      HOSTNAME: "127.0.0.1",
    },
  }],
};
EOF
  sudo chown "${user}:${user}" "$RELEASE_DIR/ecosystem.config.cjs"

  pm2_as_user "$user" start "$RELEASE_DIR/ecosystem.config.cjs"
  pm2_as_user "$user" save || true
  pm2_as_user "$user" list || true

  sleep 2
  if ! port_8080_in_use; then
    echo "ERROR: :8080 not listening after PM2 start." >&2
    pm2_as_user "$user" logs onenexium --lines 40 || true
    exit 1
  fi
  echo "==> Host app listening on 127.0.0.1:8080"
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
  local name target pm2_user
  echo "==> App mode: host/PM2 — Docker app will NOT bind :8080"
  if owner="$(owner_of_8080 2>/dev/null || true)"; then
    echo "==> Live :8080 owner: $owner (pid $(pid_on_8080))"
  fi

  # If a leftover docker app container exists, leave it stopped so it cannot grab 8080 later.
  if sudo docker ps -aq --filter name=onenexium-app 2>/dev/null | grep -q .; then
    echo "==> Stopping leftover Docker app container(s) so they cannot fight PM2 on :8080..."
    sudo docker compose -f "$COMPOSE" --profile docker-app stop app 2>/dev/null || true
    sudo docker rm -f "$(sudo docker ps -aq --filter name=onenexium-app)" 2>/dev/null || true
  fi

  # Prefer the OS user that owns :8080 (Hp), else discovered PM2 home.
  pm2_user="$(owner_of_8080 2>/dev/null || true)"
  target="$(pm2_target)" || true
  if [ -z "$pm2_user" ] && [ -n "${target:-}" ]; then
    pm2_user="${target%%|*}"
  fi
  if [ -z "${pm2_user:-}" ]; then
    echo "ERROR: Could not determine OS user for host app (:8080 / PM2)." >&2
    echo "On the VM run: sudo ss -lptn 'sport = :8080'; sudo -u Hp bash -lc 'pm2 list'" >&2
    exit 1
  fi

  echo "==> Deploying as OS user: $pm2_user"
  extract_release_from_image "$pm2_user"
  start_release_with_pm2 "$pm2_user"
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
