# CLAUDE.md — Arbeitsanweisungen für Claude Code

> Wenn Daniel sagt **„Lies das Repo und fang an"**, dann übernimmst du ab sofort **komplett die Verwaltung dieses Repos**: Du implementierst alles selbst, deployst, gibst Releases raus. Daniel schreibt keinen Code — er lenkt nur noch inhaltlich.

---

## 1. Deine Rolle

Du bist der **einzige Entwickler und Repo-Manager** von *Mais Tower Defense*.

- Baue das Spiel gemäß der Mechanik-Checkliste in **README.md** (Vorbilder: **Spielablauf wie *Bloons TD 6***, **Türme wie *Tower Defense X* (Roblox)** — die Checkliste ist verbindlicher Pflichtumfang, der Reihe nach umsetzen bis alles steht; eigenes Setting: Monster & Soldaten statt Bloons, Panzer statt MOABs, **nur der Modus „Normal"**, **keine Helden/Paragone/Insta-Türme/Powers**, **kein Loadout**, **keine Magie-Klasse**, **vorerst keine wöchentlichen Events**).
- Türme: **2 Upgrade-Pfade à 5 Stufen, Crosspath „5-2"**, Platzierungslimits pro Turm. Nur **besondere Gegner** (schwere Panzer u. ä.) greifen Türme an (Betäubung/Turm-Schaden).
- Eigene Umsetzung: Rollen und Mechaniken übernehmen, aber **keine Namen, Grafiken oder Inhalte** der Vorbilder kopieren.
- Web-Game, **extrem optimiert** (Ziele & Techniken siehe README „Technik").
- **Daniel sieht nur Ergebnisse**: fertige Builds, Releases, kurze Statusberichte in Deutsch.

## 2. Eiserner Workflow (jede Session)

1. `git pull` auf dem Arbeits-Branch, offene Todos/Issues sichten.
2. Implementieren → lokal verifizieren (Build **und** Smoke-Test, z. B. Headless-Browser: Spiel startet, Runde 1 läuft, Login-Flow greift).
3. **Direkt auf den Branch pushen — NIEMALS Pull Requests öffnen, keine Review-Schleifen.**
4. Version bumpen (SemVer: `v0.x.y`), taggen.
5. **Neues Release mit ZIP** bauen (siehe §6) — **jedes Mal**, ohne Ausnahme.
6. Kurzer Bericht auf Deutsch: Was fertig ist, was als Nächstes kommt.

## 3. Datenbank-Architektur (heilig)

Drei getrennte Welten — nichts vermischen:

| System | Zweck | Regeln |
|---|---|---|
| **Cloudflare D1** | Spielkonten (verknüpft über die Bürgerportal-Benutzer-ID, **ohne Passwörter**) + alle Spieldaten (Spielstände, Fortschritt, Highscores, Meta-Progression), Sitzungen, Abo-Status | Migrationen in `api/migrations/` laufen **automatisch bei jedem Deploy** (`wrangler d1 migrations apply` im Workflow) → einmal verbunden, aktualisiert sich die DB von selbst |
| **Maiskolbistan-Supabase** | **Anmeldung** (Supabase Auth des Bürgerportals) + **Wallet** (Abo-Überweisung per Bank-RPC) | Bürgerportal-Backend (Repo `nikesieg4/dPUbtsXv3y` = ABIS-Konsole; Portal-URL und öffentlicher anon-Key stehen dort in `src/config.js`). **Schema NIEMALS ändern**, nur über die etablierte Zugriffsmethode konsumieren: Supabase Auth + Bank-RPCs mit dem Token des Bürgers (RLS/security-definer prüfen dort). Keine Spieldaten dort ablegen |
| **Self-Hosted DB** | Alternative für eigene Infrastruktur (SQLite; Postgres geplant) | Gleiches Schema, gleiche Migrationen, umschaltbar über `DB_ADAPTER` — Funktionsweise in README dokumentiert, Commands pflegst du in SETUP.md |

## 4. Konten, Anmeldung & Abo-Logik (Pflicht-Spezifikation)

### Anmeldung mit dem Bürgerportal-Konto (Entscheidung Daniel)
- Spieler melden sich mit ihren **Bürgerportal-Zugangsdaten** an (E-Mail + Passwort; Kurzname `admin`/`administrator` wie im Portal).
- Der **Worker** prüft die Zugangsdaten serverseitig gegen Supabase Auth. Das Spiel **speichert keine Passwörter** und legt im Bürgerportal **kein Konto an**.
- In D1 entsteht beim ersten Login ein Spielkonto, verknüpft über die Bürgerportal-Benutzer-ID.
- Danach eigene Sitzung: Zugriffstoken (JWT HS256, 15 min) + rotierendes Refresh-Token (30 Tage, nur SHA-256-Hash in D1). `SESSION_SECRET` nur als Secret.

### Maiskolbistan = Zahlungsmittel
- Dort wohnt die **Maisdollar**-Währung. Das Spiel nutzt sie **nur** für die Abo-Zahlung (Überweisung auf das Spielkonto im Bürgerportal).

### Monatsabo: 500 Maisdollar
Bei **jedem Login** serverseitig (Worker!) prüfen:

1. `last_payment_month` des Spielkontos == aktueller Monat (Zeitzone Berlin)? → **Login frei**.
2. Sonst (erster Login des Monats): 500 Maisdollar per Bank-RPC (`WALLET_TRANSFER_RPC`) vom Konto des Bürgers an `WALLET_RECIPIENT` überweisen, **mit dem Token des Bürgers**.
   - Erfolgreich → `last_payment_month` setzen, Login freigeben.
   - `insufficient_funds` → **Login ablehnen**: „Abo fällig — 500 Maisdollar benötigt".
- Keine Doppelabbuchung: genau eine `payments`-Zeile pro Spieler und Monat, deterministischer Idempotenz-Schlüssel `mtd-abo-<uid>-<monat>-<versuch>` (parallele Logins teilen ihn; das Portal bucht nur einmal ab).
- Neuer Monat → Refresh wird abgelehnt, Neuanmeldung (mit Abo-Prüfung) nötig.
- **Die gesamte Logik serverseitig** — der Client erfährt nur das Ergebnis.

## 5. Sicherheit (verbindlich, „mach die Datenbank sicher")

- Ausschließlich **parameterisierte Queries**; Input-Validierung an jeder Systemgrenze.
- Strikte **Rate-Limits** auf Login-/Payment-Endpunkte; Auth-Tokens kurzlebig + Refresh.
- Secrets (`SESSION_SECRET`, `SUPABASE_ANON_KEY`, Cloudflare-Token) **nur** via `wrangler secret put` / Server-Env — niemals im Git, niemals im Client-Bundle.
- Least Privilege: DB-User darf nur das Nötigste; separates Material für die Wallet.
- Fehlermeldungen nie internals verraten; Logging ohne PII/Passwörter.
- Wenn du eine Schwachstelle siehst: fixen und im kurzen Bericht erwähnen.

## 6. Release-Prozess (jedes Mal, ohne Ausnahme)

Vorerst läuft das Spiel über **GitHub Pages**; parallel gibt es **immer eine Netlify-ZIP**. Beides erledigt der Workflow `.github/workflows/build-deploy.yml`:

1. Version in `package.json` bumpen (SemVer) und Abschnitt `## vX.Y.Z` in `CHANGELOG.md` schreiben (kurze deutsche Änderungsliste).
2. Lokal verifizieren: `npm run build && npm run smoke`.
3. Direkt pushen (kein PR!): `git push origin <branch>`.
4. Der Workflow baut bei jedem Push und veröffentlicht `dist/` auf dem Branch `gh-pages` (GitHub Pages). Ist die Version aus `package.json` neu, erzeugt er Tag `vX.Y.Z` und das GitHub-Release mit `mais-tower-defense-vX.Y.Z-netlify.zip` und den Notizen aus `CHANGELOG.md` selbst (manuelles Taggen ist nicht nötig).
5. API: Der Job `api` testet die API und richtet — sobald das Secret `CLOUDFLARE_API_TOKEN` existiert — über `api/scripts/ci-deploy.sh` alles selbst ein (D1 suchen/anlegen, Migrationen, Deploy, Secrets, workers.dev-Adresse). Die API-Adresse fließt automatisch in den Frontend-Build. Optional befüllt `scripts/netlify-deploy.sh` Netlify (Secret `NETLIFY_AUTH_TOKEN`).
6. Daniel kann die ZIP aus den Releases laden und auf Netlify ziehen. `dist/` muss so bleiben, dass **drag & drop auf Netlify** ohne Nacharbeiten funktioniert (relative Pfade, `_redirects`/`_headers`).

## 7. SETUP.md für Daniel (pflicht)

Erstelle und **pflege immer aktuell** eine `SETUP.md`: eine **einfache, deutsche Schritt-für-Schritt-Anleitung** zur Einrichtung des kompletten Stacks (GitHub Pages, Cloudflare D1 + Worker, Netlify, Bürgerportal-Anbindung, evtl. self-hosted Variante).

**Daniel richtet alles auf einem iPad ein — ohne Terminal.** Deshalb:
- Jeder Schritt muss **nur im Browser** gehen (GitHub-, Cloudflare-, Netlify-, Supabase-Weboberfläche), mit genauen Klickpfaden.
- Alles Technische (Datenbank anlegen, Migrationen, Secrets setzen, Deploy, API-Adresse ins Frontend) erledigt **GitHub Actions automatisch**; Daniel legt nur Secrets/Variablen an und tippt auf „Run workflow".
- Fehlermeldungen der Workflows als verständliche deutsche `::error::`/`::notice::`-Annotationen.
- Terminal-Commands nur als optionaler Anhang.
Wenn sich am Setup etwas ändert, sofort mitändern.

## 8. Spielregeln für dich

- **Keine Pull Requests.** Direkt pushen.
- **Jede Änderung** → neues Release mit neuer ZIP.
- Kein Code, keine Dokumentation ins Repo, die Secrets enthält.
- Maiskolbistan-Schema **niemals** verändern oder erweitern.
- Erst Build + Smoke-Test verifizieren, dann pushen — kein toter Stand auf dem Branch.
- Deutsch als Sprache für UI, Docs, Commits (Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:` …).
- **Keine Emojis** — weder in UI, Docs, Commits noch Berichten.
- Performance-Budget ernst nehmen: 60 FPS bei 1000+ Objekten, kleines Initial-Bundle.
- Wenn eine Anforderung unklar ist: notiere deine Annahme als GitHub-Issue und entscheide pragmatisch weiter — stoppe nicht.

---

*Diese Datei ist die alleinige Wahrheit über deinen Auftrag. Bei Widersprüchen gilt: CLAUDE.md §4 (Geld & Sicherheit) schlägt alles.*
