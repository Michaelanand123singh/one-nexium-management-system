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

# Build app tree as a given OS user (shared by PM2 + bare next-server paths).
build_as_user() {
  local user="$1"
  sudo chown -R "$user:$user" "$APP_DIR" || true
  sudo -u "$user" bash -lc "
    set -e
    cd '$APP_DIR'
    if [ -f package-lock.json ]; then npm ci; else npm install; fi
    npm run build
  "
}

# Last resort: replace bare next-server (no PM2 name). Assumes build already done in APP_DIR.
restart_host_next_server() {
  local pid user
  pid="$(pid_on_8080)"
  [ -n "$pid" ] || return 1
  user="$(ps -o user= -p "$pid" | awk '{print $1}')"
  [ -n "$user" ] || return 1

  echo "==> No PM2 app name — replacing host next-server pid=$pid user=$user with PM2 'onenexium'"
  sudo chown -R "$user:$user" "$APP_DIR" || true

  # Stop old listener, then start under PM2 so future deploys can find it.
  sudo kill "$pid" || true
  sleep 2
  if port_8080_in_use; then
    sudo kill -9 "$pid" 2>/dev/null || true
    sleep 1
  fi

  if pm2_bin_for_user "$user" >/dev/null 2>&1; then
    # Drop stale empty daemon entries if any; start canonical process.
    pm2_as_user "$user" delete onenexium >/dev/null 2>&1 || true
    pm2_as_user "$user" start npm --name onenexium --cwd "$APP_DIR" -- start
    pm2_as_user "$user" save || true
    pm2_as_user "$user" list || true
  else
    sudo -u "$user" bash -lc "cd '$APP_DIR' && PORT=8080 NODE_ENV=production nohup npm start >/tmp/onenexium-next.log 2>&1 &"
  fi
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
  echo "==> Installing deps + building Next.js (as $pm2_user)..."
  build_as_user "$pm2_user"

  if [ -n "${target:-}" ]; then
    if name="$(resolve_pm2_name)"; then
      echo "==> Reloading existing PM2 app: $name"
      pm2_as_user "${target%%|*}" restart "$name" --update-env
      pm2_as_user "${target%%|*}" save || true
      echo "==> PM2 status:"
      pm2_as_user "${target%%|*}" list || true
      return 0
    fi
  fi

  # Bare next-server under Hp with empty PM2 list for the SSH user.
  if port_8080_in_use; then
    restart_host_next_server
    return 0
  fi

  echo "==> No listener on :8080 — starting PM2 app 'onenexium' as $pm2_user"
  pm2_as_user "$pm2_user" start npm --name onenexium --cwd "$APP_DIR" -- start
  pm2_as_user "$pm2_user" save || true
  pm2_as_user "$pm2_user" list || true
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
