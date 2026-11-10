# Einrichtung — Schritt für Schritt (iPad-tauglich)

Alles geht **im Browser auf dem iPad** (Safari). Du brauchst kein Terminal: Du legst nur ein paar Schlüssel in GitHub ab, den Rest erledigt GitHub Actions automatisch (Datenbank anlegen, API installieren, Spiel bauen, veröffentlichen).

**Tipp für GitHub auf dem iPad:** Falls der Reiter **Settings** fehlt, in Safari links in der Adressleiste auf **„aA“** tippen und **„Desktop-Website anfordern“** wählen.

Wiederkehrende Wege in GitHub (Repo `mais-tower-defense` öffnen):

- **Secret anlegen:** Settings → Secrets and variables → Actions → Reiter **Secrets** → **New repository secret** → Name und Wert eintragen → **Add secret**.
- **Variable anlegen:** Settings → Secrets and variables → Actions → Reiter **Variables** → **New repository variable** → Name und Wert → **Add variable**.
- **Workflow starten:** Reiter **Actions** → links **„Build, Pages & Release“** → rechts **Run workflow** → Branch **`claude/youthful-volta-nkxw3z`** wählen → **Run workflow**. Nach ca. 2 Minuten ist alles fertig (grüner Haken).

## Stand

| Teil | Status |
|---|---|
| Spiel | fertig, läuft auf GitHub Pages (und auf Wunsch Netlify) |
| Login mit Bürgerportal-Konto, Spielstände | fertig, wird mit Schritt 4 aktiv |
| Maisdollar-Abo (500 M$/Monat) | fertig, braucht Schritt 5 |

Solange Schritt 4 nicht erledigt ist, läuft das Spiel **ohne Anmeldung** (Testbetrieb).

---

## 1. GitHub Pages einschalten (einmalig, 1 Minute)

1. Settings → **Pages** → bei „Build and deployment“ **Source: Deploy from a branch** → Branch **`gh-pages`**, Ordner **`/ (root)`** → **Save**.
2. Settings → **Actions** → **General** → ganz unten „Workflow permissions“ → **Read and write permissions** → **Save**.

Nach 1–2 Minuten läuft das Spiel hier:

https://informationstechnik-humboldt-gymnasium.github.io/mais-tower-defense/

---

## 2. Netlify (wahlweise)

**A) Automatisch (empfohlen auf dem iPad)**

1. Auf https://app.netlify.com anmelden (kostenlos).
2. Unten links auf deinen Namen → **User settings** → **Applications** → **Personal access tokens** → **New access token** → Name „Mais Tower Defense“, Ablauf „No expiration“ → **Generate token** → Token kopieren.
3. In GitHub ein **Secret** anlegen: Name `NETLIFY_AUTH_TOKEN`, Wert = kopiertes Token.
4. **Workflow starten.** Die Seite wird automatisch angelegt und bei jeder neuen Version aktualisiert:
   https://mais-tower-defense-maiskolbistan.netlify.app
   (Falls der Name schon vergeben ist, meldet der Workflow das. Dann eine **Variable** `NETLIFY_SITE_NAME` mit einem anderen Namen anlegen, z. B. `mais-td-daniel`, und erneut starten.)

**B) Von Hand mit der ZIP**

1. In GitHub rechts auf **Releases** → neueste Version → `mais-tower-defense-vX.Y.Z-netlify.zip` antippen → Laden.
2. In der **Dateien-App** die ZIP antippen → sie wird zu einem Ordner entpackt.
3. https://app.netlify.com/drop öffnen → „browse to upload“ → den entpackten Ordner wählen.

---

## 3. Spielen

Einfach die Adresse aus Schritt 1 (oder 2) öffnen. Auf dem iPad kannst du sie über **Teilen → Zum Home-Bildschirm** wie eine App ablegen.

---

## 4. Login und Datenbank (Cloudflare, einmalig ca. 5 Minuten)

> Wichtig: Sobald dieser Schritt fertig ist, verlangt das Spiel die Anmeldung. Damit sich dann auch jemand anmelden kann, am besten **Schritt 5 direkt danach** erledigen (vorher lehnt das Spiel jeden Login mit „Abo-Zahlung ist noch nicht eingerichtet“ ab).

**4.1 Cloudflare-Konto:** Auf https://dash.cloudflare.com/sign-up kostenlos registrieren.

**4.2 Schlüssel (API-Token) erstellen:**
1. https://dash.cloudflare.com/profile/api-tokens öffnen → **Create Token**.
2. Bei der Vorlage **„Edit Cloudflare Workers“** auf **Use template**.
3. Unter „Permissions“ auf **+ Add more** → links **Account**, Mitte **D1**, rechts **Edit**.
4. Bei „Account Resources“ deinen Account wählen, bei „Zone Resources“ **All zones**.
5. **Continue to summary** → **Create Token** → Token **kopieren** (wird nur einmal angezeigt).

**4.3 In GitHub ablegen:** **Secret** `CLOUDFLARE_API_TOKEN` = kopiertes Token.

**4.4 Schlüssel des Bürgerportals:** Die Datei https://github.com/nikesieg4/dPUbtsXv3y/blob/main/src/config.js öffnen. In der Zeile `SUPABASE_ANON_KEY` den langen Text zwischen den Anführungszeichen (beginnt mit `eyJ`) kopieren → in GitHub als **Secret** `SUPABASE_ANON_KEY` ablegen.

**4.5 Workflow starten.** Der Workflow legt jetzt selbst an:
- die Datenbank `maistd` (inkl. aller Tabellen — spätere Änderungen spielt er automatisch ein),
- die API (Cloudflare Worker) mit einem zufällig erzeugten Sitzungs-Geheimnis,
- die Internet-Adresse der API, die er automatisch ins Spiel einbaut.

Die API-Adresse steht danach im Workflow-Lauf unter **Annotations** („API läuft unter …“).

**Falls Netlify (Schritt 2) später dazukommt:** einfach den Workflow erneut starten — die Netlify-Adresse wird dann automatisch für die API freigegeben. Eine andere eigene Adresse kannst du als **Variable** `ALLOWED_ORIGINS` eintragen (mehrere mit Komma getrennt, GitHub-Pages-Adresse mit aufführen).

---

## 5. Abo-Zahlung im Bürgerportal verbinden

**5.1 Konto für das Spiel:** In der ABIS-Konsole → **Bank** → eigenständiges Konto anlegen, Name „Mais Tower Defense“. Die **Konto-UUID** des neuen Kontos kopieren → in GitHub als **Variable** `WALLET_RECIPIENT` ablegen.

**5.2 Name der Überweisungsfunktion:**
1. https://supabase.com/dashboard öffnen → Projekt des Bürgerportals → links **SQL Editor**.
2. Diese Abfrage einfügen und **Run** tippen (sie liest nur, ändert nichts):

```sql
select proname, pg_get_function_arguments(oid) from pg_proc where proname like 'bank_%' and proname not like 'bank_admin_%' order by 1;
```

3. **Am einfachsten:** Das Ergebnis (Screenshot genügt) an Claude schicken — Claude trägt alles passend ein.
   Oder selbst: die Funktion, mit der Bürger überweisen, als **Variable** `WALLET_TRANSFER_RPC` ablegen (z. B. `bank_transfer`).

**5.3 Workflow starten.** Fertig — ab jetzt bucht das Spiel beim ersten Login im Monat 500 Maisdollar ab.

---

## Übersicht aller Schlüssel

| Name | Art | Wofür | Pflicht |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Secret | API + Datenbank automatisch einrichten | für Login |
| `SUPABASE_ANON_KEY` | Secret | Verbindung zum Bürgerportal | für Login |
| `WALLET_RECIPIENT` | Variable | Konto des Spiels im Bürgerportal | für Abo |
| `WALLET_TRANSFER_RPC` | Variable | Überweisungsfunktion des Bürgerportals | für Abo |
| `NETLIFY_AUTH_TOKEN` | Secret | Netlify automatisch befüllen | nein |
| `NETLIFY_SITE_NAME` | Variable | eigener Netlify-Name | nein |
| `ALLOWED_ORIGINS` | Variable | weitere erlaubte Spiel-Adressen | nein |
| `CLOUDFLARE_ACCOUNT_ID` | Secret | nur nötig, wenn du mehrere Cloudflare-Accounts hast (steht im Cloudflare-Dashboard rechts unter „Account ID“) | nein |

## Wenn etwas rot wird

Im Reiter **Actions** den roten Lauf antippen → oben unter **Annotations** steht eine deutsche Meldung, was fehlt (z. B. Token ohne D1-Recht, Netlify-Name vergeben). Den Fehler beheben und den Workflow erneut starten — oder Claude den Screenshot schicken.

---

## Anhang: Für Computer mit Terminal (optional)

Nicht nötig auf dem iPad — nur für Entwicklung oder Self-Hosting.

Lokal starten:

```bash
npm install && npm run dev
```

Build, ZIP und Tests:

```bash
npm run build && npm run zip && npm run smoke
```

```bash
npm install --prefix api && npm run test:api && npm run e2e:login
```

Self-Hosting der API mit SQLite statt Cloudflare (Migrationen laufen beim Start automatisch; hinter einem Reverse-Proxy zusätzlich `TRUST_PROXY=1`):

```bash
DB_ADAPTER=sqlite DB_FILE=./maistd.db PORT=8787 SUPABASE_URL=https://tyfdwdzglguiiqbsttav.supabase.co SUPABASE_ANON_KEY=<anon-key> SESSION_SECRET="$(openssl rand -base64 48)" ALLOWED_ORIGINS=https://<deine-seite> WALLET_TRANSFER_RPC=<funktion> WALLET_RECIPIENT=<konto-uuid> npm run api
```

Frontend dafür mit `VITE_API_URL=https://<deine-api> npm run build` bauen.
