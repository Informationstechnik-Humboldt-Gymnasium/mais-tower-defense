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
| **Cloudflare D1** | Spielkonten (Username/Passwort) + alle Spieldaten (Spielstände, Fortschritt, Highscores, Meta-Progression) | Migrationen laufen **automatisch bei jedem Deploy** (`wrangler d1 migrations apply` im Deploy-Script) → einmal verbunden, aktualisiert sich die DB von selbst |
| **Maiskolbistan-Supabase** | **NUR die Wallet**: Maisdollar-Guthaben lesen + Abo-Abbuchung schreiben | Das ist das Bürgerportal-Backend eines Mitstreiters. **Schema NIEMALS ändern**, nur über die etablierte Zugriffsmethode konsumieren. Zugriffsweise/Credentials: im Org-Geschwister-Repo **`app-buergerportal`** bzw. dessen lokaler Kopie nachschauen und identisch übernehmen |
| **Self-Hosted DB** | Alternative für eigene Infrastruktur (SQLite oder Postgres) | Gleiches Schema, gleiche Migrationen, umschaltbar über `DB_ADAPTER` — Funktionsweise in README dokumentiert, Commands pflegst du in SETUP.md |

## 4. Konten, Passwörter & Abo-Logik (Pflicht-Spezifikation)

### Spielkonto (in D1)
- Separates Konto mit **Username + Passwort** — unabhängig von Maiskolbistan.
- Passwörter: **Argon2id**-Hash, einzigartiger 16-Byte-Salt pro User, Pepper aus Server-Secret, timing-sicherer Vergleich. Keine Klartext-Passwörter, keine schwachen Hashes. Den Pepper/Secrets niemals in Repo oder Client-Build.

### Maiskolbistan = reines Zahlungsmittel
- Dort wohnt die **Maisdollar**-Währung. Das Spiel nutzt sie **nur** für die Abo-Zahlung.
- Es wird **dort kein zusätzliches Konto angelegt** — das Spielkonto existiert nur in D1.

### Monatsabo: 500 Maisdollar
Beim **jeden Login** serverseitig (Worker!) prüfen:

1. `last_payment_month` des Spielkontos == aktueller Monat? → **Login frei** (Monat schon bezahlt).
2. Sonst (erster Login des Monats): Maisdollar-Guthaben in Maiskolbistan lesen.
   - Guthaben ≥ 500 → **500 abbuchen**, `last_payment_month` setzen, Login freigeben.
   - Guthaben < 500 → **Login ablehnen**, klare Meldung: „Abo fällig — 500 Maisdollar benötigt".
- Abbuchung atomar/sicher gestalten (keine Doppelabbuchung bei Parallel-Logins: zeilenweise Transaktion bzw. bedingtes Update `WHERE balance >= 500`).
- **Die gesamte Logik serverseitig** — der Client erfährt nur das Ergebnis.

## 5. Sicherheit (verbindlich, „mach die Datenbank sicher")

- Ausschließlich **parameterisierte Queries**; Input-Validierung an jeder Systemgrenze.
- Strikte **Rate-Limits** auf Login-/Payment-Endpunkte; Auth-Tokens kurzlebig + Refresh.
- Secrets (D1-Binding, Supabase-Zugang, Pepper) **nur** via `wrangler secret put` / Server-Env — niemals im Git, niemals im Client-Bundle.
- Least Privilege: DB-User darf nur das Nötigste; separates Material für die Wallet.
- Fehlermeldungen nie internals verraten; Logging ohne PII/Passwörter.
- Wenn du eine Schwachstelle siehst: fixen und im kurzen Bericht erwähnen.

## 6. Release-Prozess (jedes Mal, ohne Ausnahme)

Vorerst läuft das Spiel über **GitHub Pages**; parallel gibt es **immer eine Netlify-ZIP**. Beides erledigt der Workflow `.github/workflows/build-deploy.yml`:

1. Version in `package.json` bumpen (SemVer) und Abschnitt `## vX.Y.Z` in `CHANGELOG.md` schreiben (kurze deutsche Änderungsliste).
2. Lokal verifizieren: `npm run build && npm run smoke`.
3. Direkt pushen (kein PR!) und taggen:
   ```bash
   git push origin <branch> && git tag vX.Y.Z && git push origin vX.Y.Z
   ```
4. Der Workflow baut bei jedem Push und veröffentlicht `dist/` auf dem Branch `gh-pages` (GitHub Pages). Beim Tag erstellt er das GitHub-Release mit `mais-tower-defense-vX.Y.Z-netlify.zip` und den Notizen aus `CHANGELOG.md`.
5. Sobald die API existiert: Migrationen anwenden (`wrangler d1 migrations apply …`) und Worker deployen.
6. Daniel kann die ZIP aus den Releases laden und auf Netlify ziehen. `dist/` muss so bleiben, dass **drag & drop auf Netlify** ohne Nacharbeiten funktioniert (relative Pfade, `_redirects`/`_headers`).

## 7. SETUP.md für Daniel (pflicht)

Erstelle und **pflege immer aktuell** eine `SETUP.md`: eine **einfache, deutsche Schritt-für-Schritt-Anleitung** zur Einrichtung des kompletten Stacks (Cloudflare-Account, D1 + Worker, Netlify, evtl. self-hosted Variante) — **möglichst viel über Commands gelöst** (Copy-Paste-fähig: `wrangler`, `gh`, `netlify`), damit Daniel kaum Handarbeit hat. Wenn sich am Setup etwas ändert, sofort mitändern.

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
