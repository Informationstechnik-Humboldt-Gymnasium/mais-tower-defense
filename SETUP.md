# Einrichtung — Schritt für Schritt

Diese Anleitung wird bei jeder Änderung am Setup aktualisiert.

## Stand

| Teil | Status |
|---|---|
| Spiel (Frontend) | fertig spielbar, läuft auf GitHub Pages und Netlify |
| Spielkonten / Login (Cloudflare Worker + D1) | kommt in einer späteren Version |
| Maisdollar-Abo (Maiskolbistan) | kommt in einer späteren Version |

Solange es noch keine Konten gibt, brauchst du **nur Schritt 1** (GitHub Pages) oder **Schritt 2** (Netlify).

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

## 4. Cloudflare (Konten und Abo) — folgt

Wird ergänzt, sobald die API gebaut ist. Geplant: `wrangler login`, D1-Datenbank anlegen, Secrets per `wrangler secret put` setzen, Worker deployen; Migrationen laufen dann automatisch bei jedem Deploy.
