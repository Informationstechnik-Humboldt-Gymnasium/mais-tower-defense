# Mais Tower Defense

**Ein Web-Tower-Defense mit dem Spielablauf von Bloons TD 6 und Türmen nach dem Vorbild von Tower Defense X (Roblox).** Die Maiskolben der Republik Maiskolbistan verteidigen ihre Felder gegen die invasive Schädlingsschar: Monster, Soldaten und Panzer.

**Jetzt spielen:** https://informationstechnik-humboldt-gymnasium.github.io/mais-tower-defense/ (GitHub Pages) — oder die Netlify-ZIP aus den [Releases](../../releases) nehmen. Einrichtung: [SETUP.md](./SETUP.md).

> **Dieses Repo wird von Claude Code verwaltet.** Die Arbeitsanweisungen liegen in [CLAUDE.md](./CLAUDE.md). Einfach sagen: *„Lies das Repo und fang an."*

---

## Spielkonzept: BTD6-Ablauf + TDX-Türme

Das Spiel ist eine eigenständige Web-Umsetzung und mischt zwei Vorbilder:

- **Ablauf aus BTD6:** Runden 1–100 + Freeplay, Spaltungs-Wellenlogik, Wirtschaft, Meta-Progression.
- **Türme aus TDX:** zwei Upgrade-Pfade pro Turm, Platzierungslimits pro Turm, Militär-/Technik-Stil, Spawner-Türme, Wasser-Türme, Support-Türme, die andere Türme heilen und schützen.
- **Eigenes Setting:** Monster & Soldaten statt Bloons, Panzer statt MOABs.

Es gibt **genau einen Spielmodus (Normal)** — keine Helden, keine Paragone, keine Insta-Türme, keine Powers, **kein Loadout** (alle freigeschalteten Türme sind in jedem Spiel verfügbar).

Die folgende Liste ist die **verbindliche Mechanik-Checkliste** (Pflichtumfang, nicht optional).

### Türme & Klassen
- **3 Klassen**:
  - **Primär** (Basis-Türme, günstig & zuverlässig)
  - **Militär** (Geschütze, Fahrzeuge, Schiffe, Fabriken; flexibel, Spezialfähigkeiten, teurer)
  - **Support** (Buff-Türme, Wirtschaft, Verlangsamung, Heilung/Reparatur und Schilde für Türme)
- **Platzierungslimit pro Turm** (wie TDX): starke oder Support-Türme dürfen nur begrenzt oft gebaut werden, einfache Türme häufiger.
- **Spawner-Türme** (Fabriken): schicken eigene Einheiten den Pfad entlang, die Gegner rammen bzw. beschießen.
- **Wasser-Türme** (Boote, Schiffe): nur auf Wasserflächen platzierbar.
- **Golden-Varianten**: stärkere, teurere Versionen einzelner Türme, über Meta-Progression freischaltbar (keine Paragone).
- **Turm-Skins/Kosmetik** optional, gegen Kolbenmünzen.

### Upgrade-System (TDX-Stil)
- Jeder Turm hat **2 Upgrade-Pfade (oben / unten) mit je 5 Stufen**.
- Jeder Pfad steht für eine eigene Spielweise (z. B. Flächenschaden vs. Einzelziel, Angriff vs. Wirtschaft).
- **Crosspathing „5-2"**: Ein Pfad darf bis Stufe 5, der andere bis maximal Stufe 2. Sobald ein Pfad Stufe 3 erreicht, ist der andere auf Stufe 2 gedeckelt.
- **Turm-XP**: Upgrades werden per Turm-XP freigeschaltet (separat vom In-Game-Geld), wie in BTD6.

### Schadensarten
Jeder Angriff hat eine Schadensart: **Kugel/scharf**, **Explosion**, **Frost**, **Energie/Plasma**, **Feuer**. Gegner können gegen einzelne Arten immun sein (siehe unten) oder prozentuale Resistenzen haben.

### Gegner — Monster & Soldaten (statt Bloons)
Gegner sind **normale Feinde**: Monster- und Soldaten-Truppen, die in Wellen angreifen. Beim Tod geben viele Gegner **niedrigere Stufen frei** (Spaltungs-Prinzip wie bei Bloons).

| Gegner | Besonderheit / Immunität |
|---|---|
| **Soldaten (Stufe 1–5)** | Basis-Gegner; Tod lässt die nächste niedrigere Stufe frei |
| **Schwarzkrabbler** | immun gegen **Explosionen** |
| **Eisgeist** | immun gegen **Frost/Eis** |
| **Arkanschimmer** | immun gegen **Energie, Plasma & Feuer** |
| **Eisenrüstung** | immun gegen **scharfe** Projektile |
| **Graubalg** | immun gegen Explosionen **UND** Frost |
| **Prisma-Geist** | deutlich mehr HP, teilt sich beim Tod in zwei |
| **Keramik-Golem** | 10 HP-Hülle, danach sehr schnell |

### Panzer (die schweren Gegner)
| Panzer | Verhalten |
|---|---|
| **Leichter Panzer** | mittlere HP, normal schnell |
| **Schwerer Panzer** | hohe HP, lässt Leichte Panzer frei |
| **Superpanzer** | sehr hohe HP |
| **Tarnpanzer** | **getarnt**, sehr schnell, immun gegen Explosionen |
| **Koloss-Panzer** | der Stärkste; immun gegen Verlangsamung, Rückstoß & Instakill |

### Gegner greifen Türme an (nur besondere Gegner)
Wie in TDX können **besondere Gegner** Türme angreifen — normale Soldaten und Monster nicht.
- Angreifer: **Schwerer Panzer, Superpanzer, Koloss-Panzer** sowie einzelne besondere Gegner späterer Runden.
- Wirkung: **Betäubung** (Turm schießt einige Sekunden nicht) und/oder **Turm-Schaden**. Türme haben dafür eigene HP; bei 0 HP ist ein Turm **außer Gefecht**, bis er repariert ist (er wird nicht gelöscht).
- Gegenmittel: Support-Türme mit **Reparatur/Heilung** und **Schilden**, Betäubungs-Resistenz durch Upgrades.

### Gegner-Eigenschaften (auf jedem Gegner möglich)
- **Getarnt** (nur mit Tarn-Erkennung treffbar)
- **Regenerierend** (heilt sich nach oben)
- **Gepanzert** (doppelte HP; Eisenrüstung ×4)

### Runden & Freeplay
- Standard-Runden **1–100** mit BTD6-typischer Wellenlogik (Spaltungen, Cluster, Skalierung).
- **Freeplay** ab Runde 101+ (abnehmendes Pop-Geld pro Runde, wie BTD6).

### Spielmodus
Es gibt **genau einen Modus: Normal** — keine Schwierigkeitsgrade, keine Zusatz-Modi.
- 150 Leben, Standard-Preise, Runde 1–100.
- Continue gegen Kolbenmünzen möglich.
- Verlust = alle Leben aufgebraucht → Spielende (Neustart möglich).

### Wirtschaft
- Pop-Geld je Gegner, Rundenende-Einkommen, **Einkommens-Türme** (Maisfarm, Ölpumpe o. ä.), **Verkaufen** für 70–75 % des Werts.

### Fähigkeiten & Buffs
- Aktiv-Fähigkeiten mit Cooldowns bei bestimmten Türmen, Support-Buffs (Reichweite, Feuerrate, Pierce, Schaden, Tarn-Entdeckung, Upgrade-Rabatt), **Sichtlinien** & Platzierungsregeln (Wasser/Land, Footprint, Hindernisse).

### Meta-Progression
- **Kolbenmünzen** (In-Game-Metawährung): für Continues, Golden-Varianten und Kosmetik.
- **Wissensbäume**: 3 Skill-Bäume (Primär/Militär/Support) mit permanenten Boni.
- **Medaillen** pro Map, **Achievements**.

### Maps
- 4 Map-Schwierigkeiten (Anfänger → Experte), mehrere Pfade, **Sichtlinien**, Wasser/Land-Platzierung.

### Vorerst gestrichen
- **Wöchentliche Events** (Rennen, Odysseen, Endgegner-Events, Sammlungs-Events, Daily Challenges, Liga-Event) und der daran hängende Trophäen-Shop sind **vorerst nicht Teil des Umfangs**. Sie können später wieder aufgenommen werden.
- **Magie-Klasse** entfällt.

---

## Technik: Web-Game, extrem optimiert

- **Reines Web-Frontend** (TypeScript, Canvas/WebGL — keine Engine-Runtimes) → läuft in jedem Browser, mobil & Desktop.
- **Performance-Ziele (hart):** stabile 60 FPS auch bei 1000+ Objekten gleichzeitig.
  - Fixed-Timestep-Loop mit Interpolation, deterministische Simulation
  - **Object Pooling** für Gegner/Projektile/Partikel (keine GC-Spikes)
  - **Spatial Grid / Quadtree** statt O(n²)-Kollisionen
  - Offscreen-Canvas-Layer, Sprite-Atlanten, Asset-Streaming, Lazy-Loading
  - Initial-Bundle klein halten (< 500 KB gzip)
- **Architektur:** Statisches Frontend (Netlify) + dünne API (Cloudflare Worker) + Datenbank. Alle Secrets liegen **nur** serverseitig — der Client sieht niemals Schlüssel.

---

## Datenbanken — drei getrennte Welten

```mermaid
flowchart LR
    A[Browser-Spiel] -->|HTTPS| B[Cloudflare Worker API]
    B --> C[(Cloudflare D1<br/>Spielkonten + Spielstände)]
    B --> D[(Maiskolbistan-Supabase<br/>NUR Maisdollar-Wallet)]
    B -.->|Alternative| E[(Self-Hosted DB<br/>eigene Infrastruktur)]
```

### 1. Cloudflare D1 — Spielkonten & Spieldaten
- **Separate Spiel-Konten** (Username + Passwort) — bewusst getrennt vom Maiskolbistan-System.
- Spielstände, Fortschritt, Meta-Progression, Highscores.
- Passwörter: **Argon2id** mit per-User-Salt (+ Pepper via Server-Secret) — niemals Plaintext, niemals MD5/SHA1/SHA256-allein.
- Schema-Migrationen laufen **automatisch bei jedem Deploy** → die DB aktualisiert sich von selbst, sobald sie einmal verbunden ist.

### 2. Maiskolbistan-Supabase — NUR die Wallet
- Das bestehende **Bürgerportal-Backend** (Supabase; wird vom Mitstreiter betrieben — Schema bleibt unangetastet, wird exakt so konsumiert, wie es ist).
- Wird **ausschließlich als Zahlungsmittel-Quelle** verwendet: **Maisdollar**.
- Kein Spielkonto dort, keine Spieldaten dort — nur das Maisdollar-Guthaben **lesen** und die Abo-Abbuchung **schreiben**.

### Abo-Logik: 500 Maisdollar / Monat
- Das Spiel kostet ein **Monatsabo von 500 Maisdollar**.
- **Beim Login** prüft die API:
  1. Wurde **in diesem Kalendermonat** schon bezahlt? → Login frei.
  2. Wenn nicht (erster Login des Monats): Maisdollar-Guthaben in Maiskolbistan prüfen → wenn ≥ 500: **500 Maisdollar abbuchen**, Monatsmarke im Spielkonto setzen, Login freigeben.
  3. Wenn Guthaben < 500: Login ablehnen mit klarer Meldung („Abo fällig — 500 Maisdollar benötigt").
- Die Abbuchung läuft **komplett serverseitig** (Worker), nie im Client.

### 3. Self-Hosted Datenbank (Alternative) — Anleitung
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

> Die immer aktuellen Copy-Paste-Commands pflegt Claude in **[SETUP.md](./SETUP.md)** — Einrichtung muss ohne Lesen des Quellcodes möglich sein.

---

## Sicherheitsanforderungen (verbindlich)
- Passwort-Hashing: **Argon2id**, einzigartiger 16-Byte-Salt pro User, Pepper aus Server-Secret, timing-sicherer Vergleich.
- Strikte **Rate-Limits** auf Login- & Payment-Endpunkte.
- **Ausschließlich parameterisierte Queries** (kein SQL-Injection-Risiko), Input-Validierung an jeder Grenze.
- Kurzlebige Auth-Tokens mit Refresh; komplette Zahlungs- & Login-Logik **serverseitig**.
- Secrets nur via `wrangler secret put` — **niemals** ins Repo, niemals in den Client-Build.
- Maiskolbistan-DB nur über die im Bürgerportal etablierte Zugriffsmethode nutzen — **keine Schema-Änderungen**, kein direkter Schreibzugriff außer der Abo-Abbuchung.

---

## Deployment & Releases
- **Frontend:** vorerst **GitHub Pages** (automatisch bei jedem Push über GitHub Actions, Branch `gh-pages`) und zusätzlich **Netlify** (Release-ZIP herunterladen → auf Netlify ziehen, oder Netlify-CLI).
- **API:** Cloudflare Worker mit D1-Bindung; Migrationen greifen automatisch bei jedem Deploy.
- **Jede neue Version** bekommt automatisch:
  1. einen Commit **direkt auf dem Branch** (kein Pull Request),
  2. einen Git-Tag (`v0.x.y`),
  3. einen **GitHub Release mit frischem ZIP** des fertigen Netlify-Ordners (`dist/` inkl. `_redirects`/`_headers`).

---

## Entwicklung mit Claude Code
Dieses Repo ist so aufgebaut, dass Claude Code es **selbstständig** bauen, deployen und verwalten kann:

```text
Daniel:  „Lies das Repo und fang an."
Claude:  implementiert die Mechanik-Checkliste aus diesem README,
         pusht direkt auf den Branch, baut & lädt die neue Release-ZIP hoch.
```

Die vollständigen Arbeitsanweisungen — Rolle, Abo-Flow, Sicherheitsregeln, Release-Prozess — stehen in **[CLAUDE.md](./CLAUDE.md)**.

---

*Informationstechnik-AG des Humboldt-Gymnasiums für die Republik Maiskolbistan*
