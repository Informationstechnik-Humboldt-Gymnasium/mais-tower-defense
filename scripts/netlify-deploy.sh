#!/usr/bin/env bash
# Optional: veröffentlicht die Netlify-ZIP automatisch (Secret NETLIFY_AUTH_TOKEN genügt).
# Legt die Netlify-Seite beim ersten Mal selbst an. Aufruf: scripts/netlify-deploy.sh <zip>
set -euo pipefail
ZIP="$1"
API="${NETLIFY_API:-https://api.netlify.com/api/v1}"
NAME="${NETLIFY_SITE_NAME:-mais-tower-defense-maiskolbistan}"

if [ -z "${NETLIFY_AUTH_TOKEN:-}" ]; then
  echo "::notice::Netlify-Automatik nicht eingerichtet (Secret NETLIFY_AUTH_TOKEN fehlt) – ZIP liegt im Release zum Hochladen bereit."
  exit 0
fi
nf() { curl -sS -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" "$@"; }
json() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let r;try{r=JSON.parse(s)}catch{process.exit(3)};const v=(function(r){return $1})(r);if(v===undefined||v===null){process.exit(4)};process.stdout.write(String(v))})"; }

resp="$(nf "${API}/sites?name=${NAME}&filter=all")"
ID="$(json "Array.isArray(r) ? (r.find(s=>s.name==='${NAME}')||{}).id : undefined" <<<"$resp")" || ID=""
if [ -z "$ID" ]; then
  resp="$(nf -X POST -H "Content-Type: application/json" --data "{\"name\":\"${NAME}\"}" "${API}/sites")"
  ID="$(json 'r.id' <<<"$resp")" \
    || { echo "::error::Netlify-Seite '${NAME}' konnte nicht angelegt werden (Name evtl. vergeben). Repo-Variable NETLIFY_SITE_NAME ändern."; exit 1; }
  echo "::notice::Netlify-Seite ${NAME} angelegt."
fi
resp="$(nf -X POST -H "Content-Type: application/zip" --data-binary "@${ZIP}" "${API}/sites/${ID}/deploys")"
json 'r.id' <<<"$resp" >/dev/null || { echo "::error::Netlify-Deploy fehlgeschlagen."; exit 1; }
echo "::notice::Netlify: https://${NAME}.netlify.app"
