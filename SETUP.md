# Einrichtung — Schritt für Schritt

Diese Anleitung wird bei jeder Änderung am Setup aktualisiert.

## Stand

| Teil | Status |
|---|---|
| Spiel (Frontend) | fertig spielbar, läuft auf GitHub Pages und Netlify |
| Login mit Bürgerportal-Konto + Spielstände (Cloudflare Worker + D1) | fertig, muss einmalig eingerichtet werden (Schritt 4) |
| Maisdollar-Abo (500 M$/Monat) | fertig, braucht den Namen der Überweisungsfunktion (Schritt 5) |

Ohne Schritt 4 läuft das Spiel **ohne Anmeldung** (Testbetrieb). Sobald die Repo-Variable `API_URL` gesetzt ist, verlangt das Spiel die Anmeldung mit dem Bürgerportal-Konto.

---

## 1. GitHub Pages (einmalig einschalten)

Bei jedem Push baut GitHub Actions das Spiel automatisch und legt es auf den Branch `gh-pages`. Du musst Pages nur **einmal** auf diesen Branch zeigen lassen.

**Per Klick:** Repo auf GitHub öffnen, dann **Settings → Pages → Build and deployment → Source: „Deploy from a branch"**, Branch **`gh-pages`**, Ordner **`/ (root)`**, Speichern.

**Oder per Befehl** (mit installierter GitHub-CLI, angemeldet mit `gh auth login`):

```bash
gh api -X POST repos/informationstechnik-humboldt-gymnasium/mais-tower-defense/pages -f "source[branch]=gh-pages" -f "source[path]=/"
```

Danach ist das Spiel hier erreichbar (kann beim ersten Mal 1–2 Minuten dauern):

https://informationstechnik-humboldt-gymnasium.github.io/mais-tower-defense/

**Falls der Workflow nicht pushen darf** (Fehler „Permission denied" im Actions-Log): **Settings → Actions → General → Workflow permissions → „Read and write permissions"** einschalten. Per Befehl:

```bash
gh api -X PUT repos/informationstechnik-humboldt-gymnasium/mais-tower-defense/actions/permissions/workflow -f default_workflow_permissions=write
```

---

## 2. Netlify (ZIP per Drag & Drop)

1. Auf GitHub unter **Releases** die neueste Datei `mais-tower-defense-vX.Y.Z-netlify.zip` herunterladen.
2. ZIP entpacken.
3. Auf https://app.netlify.com/drop den entpackten Ordner in das Fenster ziehen. Fertig.

Für Updates: In Netlify bei deiner Seite **Deploys → „Drag and drop"** und den neuen Ordner hineinziehen.

**Oder per Netlify-CLI:**

```bash
npm install -g netlify-cli
```

```bash
netlify login
```

```bash
netlify deploy --prod --dir mais-tower-defense-vX.Y.Z-netlify
```

Die ZIP enthält bereits `_redirects` und `_headers` (Sicherheits- und Cache-Header).

---

## 3. Lokal starten (nur für Entwicklung)

Voraussetzung: Node.js 20 oder neuer.

```bash
npm install
```

```bash
npm run dev
```

Produktions-Build und ZIP:

```bash
npm run build && npm run zip
```

Smoke-Test (Headless-Browser, benötigt Playwright mit Chromium):

```bash
npm run smoke
```

---

## 4. Cloudflare: API und Datenbank (einmalig)

Alles im Ordner `api/`. Voraussetzung: kostenloser Cloudflare-Account, Node.js 20+, GitHub-CLI (`gh auth login`).

**4.1 Anmelden und Datenbank anlegen**

```bash
cd api && npm install
```

```bash
npx wrangler login
```

```bash
npx wrangler d1 create maistd
```

Die Ausgabe enthält `database_id = "…"`. Diese ID gleich in Schritt 4.4 verwenden.

**4.2 Geheimnisse setzen** (werden nur bei Cloudflare gespeichert, nie im Repo)

Der öffentliche anon-Key des Bürgerportals steht im Repo `nikesieg4/dPUbtsXv3y` in `src/config.js` (`SUPABASE_ANON_KEY`):

```bash
npx wrangler secret put SUPABASE_ANON_KEY
```

Zufälliges Sitzungs-Geheimnis erzeugen und setzen:

```bash
openssl rand -base64 48 | npx wrangler secret put SESSION_SECRET
```

**4.3 Erster Deploy von Hand**

In `api/wrangler.toml` bei `database_id` die ID aus 4.1 eintragen (nur lokal, nicht committen nötig), dann:

```bash
npx wrangler d1 migrations apply maistd --remote && npx wrangler deploy
```

Die Ausgabe zeigt die Adresse, z. B. `https://mais-tower-defense-api.<dein-name>.workers.dev`. Test:

```bash
curl https://mais-tower-defense-api.<dein-name>.workers.dev/api/health
```

**4.4 Ab jetzt automatisch über GitHub Actions**

Cloudflare-API-Token anlegen: https://dash.cloudflare.com/profile/api-tokens → „Create Token" → Vorlage **„Edit Cloudflare Workers"**, zusätzlich Berechtigung **Account → D1 → Edit**. Dann (im Repo-Ordner):

```bash
gh secret set CLOUDFLARE_API_TOKEN
```

```bash
gh secret set CLOUDFLARE_ACCOUNT_ID --body "$(npx wrangler whoami | grep -oE '[0-9a-f]{32}' | head -1)"
```

```bash
gh secret set D1_DATABASE_ID --body "<database_id aus 4.1>"
```

Dem Spiel die API-Adresse geben und erlaubte Frontend-Adressen setzen (GitHub Pages und ggf. deine Netlify-Adresse, Komma-getrennt):

```bash
gh variable set API_URL --body "https://mais-tower-defense-api.<dein-name>.workers.dev"
```

```bash
gh variable set ALLOWED_ORIGINS --body "https://informationstechnik-humboldt-gymnasium.github.io,https://<deine-seite>.netlify.app"
```

Ab jetzt wendet jeder Push die Migrationen an und deployt den Worker; neue Releases verlangen die Anmeldung.

---

## 5. Abo-Zahlung im Bürgerportal verbinden

**5.1 Konto für das Spiel anlegen:** In der ABIS-Konsole → **Bank → eigenständiges Konto anlegen**, Name „Mais Tower Defense". Die **Konto-UUID** ist der Empfänger:

```bash
gh variable set WALLET_RECIPIENT --body "<Konto-UUID>"
```

**5.2 Name der Überweisungsfunktion:** Im Supabase-Dashboard des Bürgerportals → **SQL Editor** diese reine Leseabfrage ausführen (ändert nichts):

```sql
select proname, pg_get_function_arguments(oid) from pg_proc where proname like 'bank_%' and proname not like 'bank_admin_%' order by 1;
```

Die Funktion, mit der Bürger Geld überweisen, eintragen (Beispiel):

```bash
gh variable set WALLET_TRANSFER_RPC --body "bank_transfer"
```

Die API ruft sie standardmäßig mit `p_recipient`, `p_amount_minor` (50000 = 500 M$), `p_reason` und `p_idempotency_key` auf. Heißen die Parameter anders, sag Claude die Ausgabe der Abfrage — die Zuordnung ist eine Einstellung (`WALLET_TRANSFER_ARGS`), kein Umbau.

Danach einmal pushen (oder den Workflow „Build, Pages & Release" manuell starten).

---

## 6. Self-Hosting statt Cloudflare (SQLite)

```bash
npm install --prefix api
```

```bash
DB_ADAPTER=sqlite DB_FILE=./maistd.db PORT=8787 SUPABASE_URL=https://tyfdwdzglguiiqbsttav.supabase.co SUPABASE_ANON_KEY=<anon-key> SESSION_SECRET="$(openssl rand -base64 48)" ALLOWED_ORIGINS=https://<deine-seite> WALLET_TRANSFER_RPC=<funktion> WALLET_RECIPIENT=<konto-uuid> npm run api
```

Migrationen laufen beim Start automatisch. Hinter einem Reverse-Proxy zusätzlich `TRUST_PROXY=1` setzen. Frontend dann mit `VITE_API_URL=https://<deine-api> npm run build` bauen.

---

## 7. Tests

```bash
npm run test:api
```

```bash
npm run e2e:login
```
