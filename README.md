# 🌽🛡️ Mais Tower Defense

**Ein Web-Tower-Defense nach dem Vorbild von Bloons TD 6** — die Maiskolben der Republik Maiskolbistan verteidigen ihre Felder gegen die invasive Schädlingsschar! 🐛💣

> 🤖 **Dieses Repo wird von Claude Code verwaltet.** Die Arbeitsanweisungen liegen in [CLAUDE.md](./CLAUDE.md). Einfach sagen: *„Lies das Repo und fang an."*

---

## 🎮 Spielkonzept: Wie Bloons TD 6 — mit ALLEN Mechaniken

Das Spiel ist eine eigenständige Web-Umsetzung des BTD6-Gameplay-Loops im Maiskolbistan-Look. Die folgende Liste ist die **verbindliche Mechanik-Checkliste** (Pflichtumfang, nicht optional):

### 🏗️ Türme & Klassen
- **4 reguläre Klassen** wie in BTD6:
  - 🌾 **Primär** (Basis-Türme, günstig & zuverlässig)
  - 🎖️ **Militär** (flexibel, Spezialfähigkeiten, teuer)
  - ✨ **Magie** (Energie, Spezialeffekte — Achtung: wirkt nicht auf Purpur-Bloons)
  - 🛠️ **Support** (Buff-Türme, Wirtschaft, Verlangsamung, Platz-Umstellung)
- **Helden** 👑: Genau **1 Held pro Spiel**, levelt **automatisch per XP** (Level 1–20), hat eigene Aktiv-Fähigkeiten mit Cooldowns und wählbare Skins.

### 🔺 Upgrade-System
- Jeder Turm hat **3 Upgrade-Wege mit je 5 Stufen** (T1–T5).
- **Crosspathing nach BTD6-Regel („5-2-2")**: Ein Weg geht auf **T5**, genau **ein weiterer** auf **T2** — der dritte Weg schließt sich damit.
- **Turm-XP**: Upgrades werden per Turm-XP freigeschaltet (separat vom In-Game-Geld), genau wie in BTD6.
- **Paragone** 🌟 (höchste Stufe): kombinieren alle drei T5-Varianten eines Turms.
  - Kauf nur möglich, wenn **alle 3 T5-Türme** des Typs auf dem Feld stehen → sie verschmelzen (alle Türme desselben Typs werden absorbiert).
  - **Paragon-Degree 1–100**, abhängig von investiertem Geld, gepoppten Bloons, erzeugtem Cash der absorbierten Türme usw.
  - Enorme Bonuskraft speziell gegen **Boss-Bloons**.

### 🎈 Bloons — komplett wie BTD6
| Bloon | Besonderheit / Immunität |
|---|---|
| 🔴 Rot, 🔵 Blau, 🟢 Grün, 🟡 Gelb, 🩷 Pink | Basis (lassen Kinder beim Poppen frei) |
| ⚫ Schwarz | immun gegen **Explosionen** |
| ⚪ Weiß | immun gegen **Frost/Eis** |
| 🟣 Purpur | immun gegen **Energie, Plasma & Feuer** |
| 🟤 Blei | immun gegen **scharfe** Projektile |
| 🦓 Zebra | immun gegen Explosionen **UND** Frost |
| 🌈 Regenbogen | mehr HP, poppt in Zwei auf |
| 🏺 Ceramic | 10 HP-Hülle, danach sehr schnell |
| ✈️ **MOAB-Klasse**: MOAB, BFB, ZOMG, DDT, BAD | riesige Luftschiffe; **BAD** immun gegen Slowdown/Knockback/Instakill; **DDT** = Camo + Schwarz-Eigenschaften + sehr schnell |
| 🌋 **Boss-Bloons**: Bloonarius, Lych, Vortex, Dreadbloon, Phayze, Blastapopoulos | Boss-Events mit **5 HP-Stufen** je **Normal & Elite** |

### 🎈 Bloon-Eigenschaften (auf jedem Bloon möglich)
- 🫥 **Camo** (nur mit Camo-Erkennung treffbar)
- ♻️ **Regrow** (regeneriert nach oben)
- 🛡️ **Fortified** (doppelte HP; Blei ×4)

### 🔢 Runden & Freeplay
- Standard-Runden **1–100** mit BTD6-typischer Wellenlogik (Kind-Bloons, Cluster, Skalierung).
- **Freeplay** ab Runde 101+ (abnehmendes Pop-Geld pro Runde, wie BTD6).

### 🏔️ Schwierigkeitsgrade & Modi (alle BTD6-Modi)
| Modus | Regeln |
|---|---|
| 🟢 Easy | 200 Leben, 0,85× Preise, Runde 1–40 |
| 🟡 Medium | 150 Leben, Standard, Runde 1–60 |
| 🟠 Hard | 100 Leben, 1,08× Preise, Runde 3–80 |
| 🔴 Impoppable | 1 Leben, 1,2× Preise, keine Continues, Runde 6–100 |
| 💀 **CHIMPS** | kein **C**ontinue, keine **H**earts-Heilung, kein Extra-**I**ncome, kein **M**onkey-Knowledge, keine **P**owers, kein **S**elling — 1 Leben |

Zusatz-Modi: **Nur Primär / Nur Militär / Nur Magie**, **Deflation**, **Apopalypse**, **Reverse**, **Doppelte-MOAB-HP**, **Halbes Geld**, **Alternative Bloon-Runden**, **Double Cash**, **Fast Track**, **Sandbox**, **Co-op**.

### 💰 Wirtschaft
- Pop-Geld je Bloon, Rundenende-Einkommen, **Einkommens-Türme** (Banana-Farm-Äquivalent 🌽), **Verkaufen** für 70–75 % des Werts (in CHIMPS verboten), Continue-Kosten je Schwierigkeit.

### ⚡ Fähigkeiten & Buffs
- Aktiv-Fähigkeiten mit Cooldowns (v. a. Helden), Support-Buffs (Reichweite, Feuerrate, Pierce, Schaden, Camo-Entdeckung), **Sichtlinien** & Platzierungsregeln (Wasser/Land, Footprint, Hindernisse).

### 🧠 Meta-Progression
- **Kolbenmünzen** 🪙 (In-Game-Metawährung, das BTD6-„Monkey Money"): für Helden, Helden-Skins, Continues, Powers.
- **Monkey Knowledge** 📚: 6 Skill-Bäume (Primär/Militär/Magie/Support/Helden/Powers) mit permanenten Boni (in CHIMPS deaktiviert).
- **Insta-Türme** 🎟️: einmalig platzierbare Türme mit voreingestellten Upgrades (gelten als Powers).
- **Powers** ⏩: z. B. Turbo-Boost, Cash-Drop, Super-Sturm, Zeitstopp.
- **Trophäen-Shop** 🏆 (Event-Währung gegen Kosmetik), **Medaillen** pro Map×Modus, **Achievements**.

### 🗺️ Maps
- 4 Map-Schwierigkeiten (Anfänger → Experte), mehrere Pfade, **Sichtlinien**, Wasser/Land-Platzierung.

### 🏁 Events (wöchentlich rotierend)
- 🏃 **Rennen** (Time-Trial: feste Runden so schnell wie möglich, Leaderboard)
- 🗺️ **Odysseen** (3–5 Maps am Stück, verknüpfter Lebenspool, Türme wandern mit)
- 🌋 **Boss-Events** (Normal & Elite, 5 HP-Stufen)
- 📦 **Sammlungs-Events**, **Daily Challenges**, **Contested-Territory-artiges Liga-Event**

---

## 🚀 Technik: Web-Game, extrem optimiert

- **Reines Web-Frontend** (TypeScript, Canvas/WebGL — keine Engine-Runtimes) → läuft in jedem Browser, mobil & Desktop.
- **Performance-Ziele (hart):** stabile 60 FPS auch bei 1000+ Objekten gleichzeitig.
  - Fixed-Timestep-Loop mit Interpolation
  - **Object Pooling** für Bloons/Projektile/Partikel (keine GC-Spikes)
  - **Spatial Grid / Quadtree** statt O(n²)-Kollisionen
  - Offscreen-Canvas-Layer, Sprite-Atlanten, Asset-Streaming, Lazy-Loading
  - Initial-Bundle klein halten (< 500 KB gzip)
- **Architektur:** Statisches Frontend (Netlify) + dünne API (Cloudflare Worker) + Datenbank. Alle Secrets liegen **nur** serverseitig — der Client sieht niemals Schlüssel.

---

## 🗄️ Datenbanken — drei getrennte Welten

```mermaid
flowchart LR
    A[Browser-Spiel] -->|HTTPS| B[Cloudflare Worker API]
    B --> C[(🟠 Cloudflare D1<br/>Spielkonten + Spielstände)]
    B --> D[(🟢 Maiskolbistan-Supabase<br/>NUR Maisdollar-Wallet)]
    B -.->|Alternative| E[(📦 Self-Hosted DB<br/>eigene Infrastruktur)]
```

### 1️⃣ 🟠 Cloudflare D1 — Spielkonten & Spieldaten
- **Separate Spiel-Konten** (Username + Passwort) — bewusst getrennt vom Maiskolbistan-System.
- Spielstände, Fortschritt, Meta-Progression, Event-Highscores.
- Passwörter: **Argon2id** mit per-User-Salt (+ Pepper via Server-Secret) — niemals Plaintext, niemals MD5/SHA1/SHA256-allein.
- Schema-Migrationen laufen **automatisch bei jedem Deploy** → die DB aktualisiert sich von selbst, sobald sie einmal verbunden ist.

### 2️⃣ 🟢 Maiskolbistan-Supabase — NUR die Wallet 💰
- Das bestehende **Bürgerportal-Backend** (Supabase; wird vom Mitstreiter betrieben — Schema bleibt unangetastet, wird exakt so konsumiert, wie es ist).
- Wird **ausschließlich als Zahlungsmittel-Quelle** verwendet: **Maisdollar**.
- Kein Spielkonto dort, keine Spieldaten dort — nur das Maisdollar-Guthaben **lesen** und die Abo-Abbuchung **schreiben**.

### 💳 Abo-Logik: 500 Maisdollar / Monat
- Das Spiel kostet ein **Monatsabo von 500 Maisdollar**.
- **Beim Login** prüft die API:
  1. Wurde **in diesem Kalendermonat** schon bezahlt? → Login frei.
  2. Wenn nicht (erster Login des Monats): Maisdollar-Guthaben in Maiskolbistan prüfen → wenn ≥ 500: **500 Maisdollar abbuchen**, Monatsmarke im Spielkonto setzen, Login freigeben.
  3. Wenn Guthaben < 500: Login ablehnen mit klarer Meldung („Abo fällig — 500 Maisdollar benötigt").
- Die Abbuchung läuft **komplett serverseitig** (Worker), nie im Client.

### 3️⃣ 📦 Self-Hosted Datenbank (Alternative) — Anleitung
Das Spiel ist **portabel**: Die API spricht über einen Datenbank-Adapter mit zwei Beinen — Cloudflare D1 (Standard) **oder** eine eigene, selbst gehostete DB. Die Migrationsdateien sind identisch.

**Variante A: SQLite auf eigenem Server (einfachste Selbsthosting-Wahl)**
1. Node.js ≥ 20 installieren.
2. Repo klonen und in `SETUP.md` (pflegt Claude) die Copy-Paste-Commands abarbeiten:
   ```bash
   npm install
   DB_ADAPTER=sqlite DB_FILE=./maistd.db npm run api
   ```
3. Frontend per Build-Umgebungsvariable auf die eigene API zeigen lassen (`VITE_API_URL=http://dein-server:8787`).
4. Migrationen laufen beim API-Start automatisch → Datenbank ist fertig.

**Variante B: Postgres per Docker auf eigenem Server**
```bash
docker run -d --name maistd-db -e POSTGRES_PASSWORD=STARKES_PASSWORT -e POSTGRES_DB=maistd -p 5432:5432 postgres:16
DB_ADAPTER=postgres DATABASE_URL=postgres://postgres:STARKES_PASSWORT@localhost:5432/maistd npm run api
```

> ⚙️ Die immer aktuellen Copy-Paste-Commands pflegt Claude in **[SETUP.md](./SETUP.md)** — Einrichtung muss ohne Lesen des Quellcodes möglich sein.

---

## 🔐 Sicherheitsanforderungen (verbindlich)
- Passwort-Hashing: **Argon2id**, einzigartiger 16-Byte-Salt pro User, Pepper aus Server-Secret, timing-sicherer Vergleich.
- Strikte **Rate-Limits** auf Login- & Payment-Endpunkte.
- **Ausschließlich parameterisierte Queries** (kein SQL-Injection-Risiko), Input-Validierung an jeder Grenze.
- Kurzlebige Auth-Tokens mit Refresh; komplette Zahlungs- & Login-Logik **serverseitig**.
- Secrets nur via `wrangler secret put` — **niemals** ins Repo, niemals in den Client-Build.
- Maiskolbistan-DB nur über die im Bürgerportal etablierte Zugriffsmethode nutzen — **keine Schema-Änderungen**, kein direkter Schreibzugriff außer der Abo-Abbuchung.

---

## 📦 Deployment & Releases
- **Frontend:** Netlify (Release-ZIP herunterladen → auf Netlify ziehen, oder Netlify-CLI).
- **API:** Cloudflare Worker mit D1-Bindung; Migrationen greifen automatisch bei jedem Deploy.
- **Jede neue Version** bekommt automatisch:
  1. einen Commit **direkt auf dem Branch** (kein Pull Request),
  2. einen Git-Tag (`v0.x.y`),
  3. einen **GitHub Release mit frischem ZIP** des fertigen Netlify-Ordners (`dist/` inkl. `_redirects`/`_headers`). ⬇️

---

## 🤖 Entwicklung mit Claude Code
Dieses Repo ist so aufgebaut, dass Claude Code es **selbstständig** bauen, deployen und verwalten kann:

```text
Daniel:  „Lies das Repo und fang an."
Claude:  implementiert die Mechanik-Checkliste aus diesem README,
         pusht direkt auf den Branch, baut & lädt die neue Release-ZIP hoch.
```

Die vollständigen Arbeitsanweisungen — Rolle, Abo-Flow, Sicherheitsregeln, Release-Prozess — stehen in **[CLAUDE.md](./CLAUDE.md)**.

---

*Informationstechnik-AG des Humboldt-Gymnasiums für die Republik Maiskolbistan 🌽*
