#!/bin/bash
# Nexium OS full smoke — run on VM against app on :8080
# Creates then deletes test rows where possible. Does not change env/config.
set -u
BASE="${BASE:-http://127.0.0.1:8080}"
pass=0; fail=0; skip=0
RESULTS=/tmp/nx-full-smoke-results.txt
: > "$RESULTS"

ok()  { echo "PASS  $1" | tee -a "$RESULTS"; pass=$((pass+1)); }
bad() { echo "FAIL  $1 :: $2" | tee -a "$RESULTS"; fail=$((fail+1)); }
skp() { echo "SKIP  $1 :: $2" | tee -a "$RESULTS"; skip=$((skip+1)); }

login() {
  local email="$1" passw="$2" jar="$3"
  rm -f "$jar"
  CODE=$(curl -sS -c "$jar" -b "$jar" -o /tmp/login.json -w "%{http_code}" \
    -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$passw\"}")
  echo "$CODE"
}

http() {
  # http METHOD PATH JAR [json-body]
  local method="$1" path="$2" jar="$3"
  local body="${4:-}"
  if [ -n "$body" ]; then
    curl -sS -c "$jar" -b "$jar" -o /tmp/body.json -w "%{http_code}" \
      -X "$method" "$BASE$path" -H 'Content-Type: application/json' -d "$body"
  else
    curl -sS -c "$jar" -b "$jar" -o /tmp/body.json -w "%{http_code}" \
      -X "$method" "$BASE$path"
  fi
}

expect_code() {
  local name="$1" got="$2" want="$3"
  if [ "$got" = "$want" ]; then ok "$name ($got)"; else bad "$name" "got=$got want=$want body=$(head -c 160 /tmp/body.json)"; fi
}

expect_one_of() {
  local name="$1" got="$2"; shift 2
  for w in "$@"; do
    if [ "$got" = "$w" ]; then ok "$name ($got)"; return; fi
  done
  bad "$name" "got=$got want_one_of=$* body=$(head -c 160 /tmp/body.json)"
}

# ─── Auth ───────────────────────────────────────────────────────────────────
CODE=$(curl -sS -o /tmp/body.json -w "%{http_code}" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' -d '{"email":"admin@onenexium.com","password":"wrong"}')
expect_code "Auth wrong password" "$CODE" "401"

for pair in \
  "admin@onenexium.com:admin123:ADMIN" \
  "pm@onenexium.com:pm123:PM" \
  "englead@onenexium.com:englead123:EL" \
  "dev@onenexium.com:dev123:DEV"
do
  IFS=: read -r EM PW TAG <<<"$pair"
  JAR="/tmp/nx-$TAG.txt"
  CODE=$(login "$EM" "$PW" "$JAR")
  expect_code "Login $TAG" "$CODE" "200"
done

ADMIN=/tmp/nx-ADMIN.txt
PM=/tmp/nx-PM.txt
EL=/tmp/nx-EL.txt
DEV=/tmp/nx-DEV.txt

# ─── Module GETs as admin ────────────────────────────────────────────────────
for path in \
  /api/dashboard /api/notifications /api/planning/board /api/roadmap /api/backlog \
  /api/tasks /api/sprints /api/bugs /api/documents /api/pipeline /api/customers \
  /api/hr/onboarding /api/infrastructure/status /api/workstation/devices \
  /api/settings/team-members /api/settings/phases /api/mail/accounts \
  /api/quarters /api/feature-requests /api/support-tickets
do
  CODE=$(http GET "$path" "$ADMIN")
  expect_code "ADMIN GET $path" "$CODE" "200"
done

# Pages redirect checks (module access) — look for Location or final path
# Unauthenticated API → 307 login
CODE=$(curl -sS -o /tmp/body.json -w "%{http_code}" "$BASE/api/roadmap")
expect_code "No-cookie API → 307" "$CODE" "307"

# DEV forbidden customers API
CODE=$(http GET /api/customers "$DEV")
expect_code "DEV customers API forbidden" "$CODE" "403"

# PM forbidden customers
CODE=$(http GET /api/customers "$PM")
expect_code "PM customers API forbidden" "$CODE" "403"

# DEV can bugs
CODE=$(http GET /api/bugs "$DEV")
expect_code "DEV GET bugs" "$CODE" "200"

# DEV cannot create backlog
CODE=$(http POST /api/backlog "$DEV" '{"title":"sys-smoke-should-fail"}')
expect_code "DEV backlog create forbidden" "$CODE" "403"

# DEV cannot create roadmap
CODE=$(http POST /api/roadmap "$DEV" '{"title":"sys-smoke-should-fail"}')
expect_code "DEV roadmap create forbidden" "$CODE" "403"

# Page guards via cookie (HTTP code 200 HTML or 307 to /)
page_mod() {
  local role="$1" jar="$2" path="$3" expect="$4" # allow|deny
  CODE=$(curl -sS -c "$jar" -b "$jar" -o /tmp/page.html -w "%{http_code}" "$BASE$path")
  # deny: requireModuleAccess redirects to /
  if [ "$expect" = "deny" ]; then
    # may be 307 to / or 200 on / after follow — without -L we get 307
    if [ "$CODE" = "307" ] || [ "$CODE" = "302" ]; then
      LOC=$(curl -sS -c "$jar" -b "$jar" -D - -o /dev/null "$BASE$path" | tr -d '\r' | grep -i '^Location:' | awk '{print $2}')
      if echo "$LOC" | grep -qE '/$|/(\?|$)'; then ok "$role PAGE $path denied→home"; else
        # Location might be absolute /
        if echo "$LOC" | grep -qE '://[^/]+/?$'; then ok "$role PAGE $path denied→home"; else bad "$role PAGE $path deny" "code=$CODE loc=$LOC"; fi
      fi
    elif [ "$CODE" = "200" ]; then
      # Sometimes Next serves redirect as RSC differently — check title less reliable
      bad "$role PAGE $path deny" "got 200 expected redirect"
    else
      bad "$role PAGE $path deny" "code=$CODE"
    fi
  else
    expect_code "$role PAGE $path allow" "$CODE" "200"
  fi
}

page_mod DEV "$DEV" /customers deny
page_mod DEV "$DEV" /terminal deny
page_mod DEV "$DEV" /hr deny
page_mod DEV "$DEV" /planning allow
page_mod DEV "$DEV" /bugs allow
page_mod PM "$PM" /customers deny
page_mod PM "$PM" /terminal deny
page_mod PM "$PM" /hr allow
page_mod PM "$PM" /roadmap allow
page_mod EL "$EL" /terminal allow
page_mod EL "$EL" /hr allow
page_mod EL "$EL" /customers deny
page_mod ADMIN "$ADMIN" /customers allow
page_mod ADMIN "$ADMIN" /terminal allow

# ─── CRUD smokes with cleanup (admin) ───────────────────────────────────────
# Roadmap create/delete
CODE=$(http POST /api/roadmap "$ADMIN" '{"title":"sys-smoke-roadmap","status":"PLANNED","priority":"LOW"}')
RID=$(python3 -c 'import json; print(json.load(open("/tmp/body.json")).get("id",""))' 2>/dev/null || true)
if [ "$CODE" = "200" ] && [ -n "$RID" ]; then
  ok "ADMIN create roadmap"
  CODE=$(http DELETE "/api/roadmap/$RID" "$ADMIN")
  expect_one_of "ADMIN delete roadmap" "$CODE" 200 204
else
  bad "ADMIN create roadmap" "code=$CODE body=$(head -c 200 /tmp/body.json)"
fi

# Backlog
CODE=$(http POST /api/backlog "$ADMIN" '{"title":"sys-smoke-backlog","type":"FEATURE"}')
BID=$(python3 -c 'import json; print(json.load(open("/tmp/body.json")).get("id",""))' 2>/dev/null || true)
if [ "$CODE" = "200" ] && [ -n "$BID" ]; then
  ok "ADMIN create backlog"
  CODE=$(http DELETE "/api/backlog/$BID" "$ADMIN")
  expect_one_of "ADMIN delete backlog" "$CODE" 200 204
else
  bad "ADMIN create backlog" "code=$CODE $(head -c 200 /tmp/body.json)"
fi

# Bugs
CODE=$(http POST /api/bugs "$ADMIN" '{"title":"sys-smoke-bug","severity":"LOW"}')
BUG=$(python3 -c 'import json; print(json.load(open("/tmp/body.json")).get("id",""))' 2>/dev/null || true)
if [ "$CODE" = "200" ] && [ -n "$BUG" ]; then
  ok "ADMIN create bug"
  CODE=$(http DELETE "/api/bugs/$BUG" "$ADMIN")
  expect_one_of "ADMIN delete bug" "$CODE" 200 204
else
  bad "ADMIN create bug" "code=$CODE $(head -c 200 /tmp/body.json)"
fi

# Customers (admin only)
CODE=$(http POST /api/customers "$ADMIN" '{"name":"Sys Smoke Co","email":"sys-smoke-cust@example.com","plan":"FREE","churnRisk":"LOW"}')
CID=$(python3 -c 'import json; print(json.load(open("/tmp/body.json")).get("id",""))' 2>/dev/null || true)
if [ "$CODE" = "200" ] && [ -n "$CID" ]; then
  ok "ADMIN create customer"
  CODE=$(http DELETE "/api/customers/$CID" "$ADMIN")
  expect_one_of "ADMIN delete customer" "$CODE" 200 204
else
  bad "ADMIN create customer" "code=$CODE $(head -c 200 /tmp/body.json)"
fi

# Documents wiki
CODE=$(http POST /api/documents "$ADMIN" '{"title":"sys-smoke-doc","content":"x","sourceType":"library"}')
DID=$(python3 -c 'import json; print(json.load(open("/tmp/body.json")).get("id",""))' 2>/dev/null || true)
if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
  ok "ADMIN create document"
  if [ -n "$DID" ]; then
    CODE=$(http DELETE "/api/documents/$DID" "$ADMIN")
    expect_one_of "ADMIN delete document" "$CODE" 200 204
  fi
else
  bad "ADMIN create document" "code=$CODE $(head -c 200 /tmp/body.json)"
fi

# Upload + download
printf 'smoke-%s' "$(date +%s)" > /tmp/smoke.txt
CODE=$(curl -sS -c "$ADMIN" -b "$ADMIN" -o /tmp/up.json -w "%{http_code}" -X POST "$BASE/api/upload" -F "file=@/tmp/smoke.txt;type=text/plain")
if [ "$CODE" = "200" ]; then
  ok "ADMIN upload MinIO"
  FPATH=$(python3 -c 'import json; from urllib.parse import urlparse; print(urlparse(json.load(open("/tmp/up.json"))["url"]).path)')
  CODE=$(curl -sS -c "$ADMIN" -b "$ADMIN" -o /tmp/dl.bin -w "%{http_code}" "$BASE$FPATH")
  expect_code "ADMIN download file" "$CODE" "200"
else
  bad "ADMIN upload" "code=$CODE $(cat /tmp/up.json)"
fi

# Planning board IDOR: admin card vs englead
BOARD=$(curl -sS -c "$ADMIN" -b "$ADMIN" "$BASE/api/planning/board")
echo "$BOARD" > /tmp/admin-board.json
ACARD=$(python3 -c 'import json; b=json.load(open("/tmp/admin-board.json"));
cards=[]
for x in b.get("buckets",[]): cards += x.get("cards") or []
print(cards[0]["id"] if cards else "")')
if [ -z "$ACARD" ]; then
  # create one
  ABID=$(python3 -c 'import json; b=json.load(open("/tmp/admin-board.json")); print(b["buckets"][0]["id"])')
  CODE=$(http POST /api/planning/cards "$ADMIN" "{\"title\":\"sys-smoke-card\",\"bucketId\":\"$ABID\"}")
  ACARD=$(python3 -c 'import json; print(json.load(open("/tmp/body.json")).get("id",""))')
  CREATED_CARD=1
fi
if [ -n "$ACARD" ]; then
  CODE=$(http PATCH "/api/planning/cards/$ACARD" "$EL" '{"title":"hacked"}')
  expect_one_of "EL cannot PATCH admin planning card (IDOR)" "$CODE" 404 403 401 307
  if [ "${CREATED_CARD:-0}" = "1" ]; then
    http DELETE "/api/planning/cards/$ACARD" "$ADMIN" >/dev/null
  fi
else
  skp "Planning IDOR" "no admin card"
fi

# Settings phases GET already ok; team-members GET ok
# HR onboarding GET ok

# PM can create roadmap
CODE=$(http POST /api/roadmap "$PM" '{"title":"sys-smoke-pm-roadmap","priority":"LOW"}')
PRID=$(python3 -c 'import json; print(json.load(open("/tmp/body.json")).get("id",""))' 2>/dev/null || true)
if [ "$CODE" = "200" ] && [ -n "$PRID" ]; then
  ok "PM create roadmap"
  http DELETE "/api/roadmap/$PRID" "$PM" >/dev/null || http DELETE "/api/roadmap/$PRID" "$ADMIN" >/dev/null
else
  bad "PM create roadmap" "code=$CODE $(head -c 160 /tmp/body.json)"
fi

# Eng lead / DEV can create bug
CODE=$(http POST /api/bugs "$DEV" '{"title":"sys-smoke-dev-bug","severity":"LOW"}')
DBUG=$(python3 -c 'import json; print(json.load(open("/tmp/body.json")).get("id",""))' 2>/dev/null || true)
if [ "$CODE" = "200" ] && [ -n "$DBUG" ]; then
  ok "DEV create bug"
  http DELETE "/api/bugs/$DBUG" "$DEV" >/dev/null || http DELETE "/api/bugs/$DBUG" "$ADMIN" >/dev/null
else
  bad "DEV create bug" "code=$CODE $(head -c 160 /tmp/body.json)"
fi

# Logout admin
CODE=$(http POST /api/auth/logout "$ADMIN")
expect_one_of "ADMIN logout" "$CODE" 200 307

echo "----"
echo "SUMMARY pass=$pass fail=$fail skip=$skip" | tee -a "$RESULTS"
exit 0
