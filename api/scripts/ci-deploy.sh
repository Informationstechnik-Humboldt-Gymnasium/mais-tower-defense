#!/usr/bin/env bash
# Vollautomatische Einrichtung + Deploy der API in GitHub Actions (kein Terminal nötig, iPad-tauglich).
# Braucht nur das GitHub-Secret CLOUDFLARE_API_TOKEN (optional CLOUDFLARE_ACCOUNT_ID, SUPABASE_ANON_KEY).
#  1. Account-ID ermitteln
#  2. D1-Datenbank "maistd" suchen oder anlegen
#  3. Migrationen anwenden (DB aktualisiert sich selbst)
#  4. Worker deployen (mit Variablen aus GitHub)
#  5. Secrets setzen: SUPABASE_ANON_KEY (falls angegeben), SESSION_SECRET (einmalig zufällig erzeugt)
#  6. workers.dev-Adresse ermitteln (Subdomain bei Bedarf anlegen) -> api_url für den Frontend-Build
set -euo pipefail
cd "$(dirname "$0")/.."

CF_API="${CF_API:-https://api.cloudflare.com/client/v4}"
WRANGLER="${WRANGLER:-npx wrangler}"
DB_NAME="maistd"
WORKER_NAME="mais-tower-defense-api"
OUT="${GITHUB_OUTPUT:-/dev/null}"

note() { echo "::notice::$*"; }
fail() { echo "::error::$*"; exit 1; }

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  note "Cloudflare ist noch nicht eingerichtet (Secret CLOUDFLARE_API_TOKEN fehlt) – API-Deploy übersprungen."
  echo "api_url=" >> "$OUT"
  exit 0
fi

cf() { # cf METHOD PFAD [JSON]
  local args=(-sS -X "$1" -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" -H "Content-Type: application/json")
  [ $# -ge 3 ] && args+=(--data "$3")
  curl "${args[@]}" "${CF_API}$2"
}
# JSON-Feld per Node lesen: json 'ausdruck mit r' <<< "$antwort"
json() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let r;try{r=JSON.parse(s)}catch{process.exit(3)};const v=(function(r){return $1})(r);if(v===undefined||v===null){process.exit(4)};process.stdout.write(String(v))})"; }

# 1. Account-ID
if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  resp="$(cf GET /accounts)"
  CLOUDFLARE_ACCOUNT_ID="$(json 'r.success && r.result.length===1 ? r.result[0].id : undefined' <<<"$resp")" \
    || fail "Cloudflare-Token ungültig oder ohne Rechte (oder mehrere Accounts: dann Secret CLOUDFLARE_ACCOUNT_ID setzen). Siehe SETUP.md."
fi
export CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_API_TOKEN
ACC="/accounts/${CLOUDFLARE_ACCOUNT_ID}"

# 2. D1 suchen oder anlegen
resp="$(cf GET "${ACC}/d1/database?name=${DB_NAME}")"
DB_ID="$(json "r.success ? (r.result.find(d=>d.name==='${DB_NAME}')||{}).uuid : undefined" <<<"$resp")" || DB_ID=""
if [ -z "$DB_ID" ]; then
  echo "Lege D1-Datenbank ${DB_NAME} an …"
  resp="$(cf POST "${ACC}/d1/database" "{\"name\":\"${DB_NAME}\"}")"
  DB_ID="$(json 'r.success ? r.result.uuid : undefined' <<<"$resp")" \
    || fail "D1-Datenbank konnte nicht angelegt werden. Hat das Token die Berechtigung 'D1: Edit'?"
  note "D1-Datenbank ${DB_NAME} angelegt."
fi
sed -i.bak "s/^database_id = \".*\"/database_id = \"${DB_ID}\"/" wrangler.toml && rm -f wrangler.toml.bak

# 3. Migrationen
$WRANGLER d1 migrations apply "$DB_NAME" --remote

# 4. Deploy mit Variablen (leere Werte = Standard aus wrangler.toml)
ORIGINS="${ALLOWED_ORIGINS:-https://informationstechnik-humboldt-gymnasium.github.io}"
[ -n "${EXTRA_ORIGIN:-}" ] && ORIGINS="${ORIGINS},${EXTRA_ORIGIN}"
ARGS=(--var "ALLOWED_ORIGINS:${ORIGINS}")
[ -n "${WALLET_TRANSFER_RPC:-}" ] && ARGS+=(--var "WALLET_TRANSFER_RPC:${WALLET_TRANSFER_RPC}")
[ -n "${WALLET_RECIPIENT:-}" ] && ARGS+=(--var "WALLET_RECIPIENT:${WALLET_RECIPIENT}")
$WRANGLER deploy "${ARGS[@]}"

# 5. Secrets
existing="$($WRANGLER secret list --format json 2>/dev/null || echo '[]')"
if [ -n "${SUPABASE_ANON_KEY:-}" ]; then
  printf '%s' "$SUPABASE_ANON_KEY" | $WRANGLER secret put SUPABASE_ANON_KEY >/dev/null
  echo "SUPABASE_ANON_KEY gesetzt."
elif ! grep -q '"SUPABASE_ANON_KEY"' <<<"$existing"; then
  note "Secret SUPABASE_ANON_KEY fehlt noch (GitHub-Secret anlegen, siehe SETUP.md) – Login ist bis dahin gesperrt."
fi
if ! grep -q '"SESSION_SECRET"' <<<"$existing"; then
  openssl rand -base64 48 | tr -d '\n' | $WRANGLER secret put SESSION_SECRET >/dev/null
  echo "SESSION_SECRET einmalig erzeugt."
fi

# 6. workers.dev-Adresse
resp="$(cf GET "${ACC}/workers/subdomain")"
SUB="$(json 'r.success && r.result ? r.result.subdomain : undefined' <<<"$resp")" || SUB=""
if [ -z "$SUB" ]; then
  SUB="maistd-$(printf '%s' "$CLOUDFLARE_ACCOUNT_ID" | cut -c1-8)"
  resp="$(cf PUT "${ACC}/workers/subdomain" "{\"subdomain\":\"${SUB}\"}")"
  json 'r.success ? true : undefined' <<<"$resp" >/dev/null \
    || fail "workers.dev-Subdomain konnte nicht angelegt werden. Bitte im Cloudflare-Dashboard unter Workers & Pages einmal eine Subdomain wählen."
  note "workers.dev-Subdomain ${SUB} angelegt (DNS kann einige Minuten brauchen)."
fi
# workers.dev-Route für den Worker sicher aktivieren
cf POST "${ACC}/workers/scripts/${WORKER_NAME}/subdomain" '{"enabled":true}' >/dev/null || true

API_URL="https://${WORKER_NAME}.${SUB}.workers.dev"
echo "api_url=${API_URL}" >> "$OUT"
note "API läuft unter ${API_URL}"
if health="$(curl -sS -m 10 "${API_URL}/api/health" 2>/dev/null)"; then
  echo "Health: ${health}"
fi
