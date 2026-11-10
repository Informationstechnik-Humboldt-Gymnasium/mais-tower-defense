# Änderungen

## v0.2.0

Anmeldung mit dem Bürgerportal-Konto und Monatsabo.

- Neue API (`api/`): Cloudflare Worker mit D1, alternativ selbst gehostet mit SQLite. Migrationen laufen automatisch beim Deploy bzw. Start.
- Anmeldung mit den Zugangsdaten des Bürgerportals (serverseitig über Supabase Auth). Das Spiel speichert keine Passwörter und legt im Portal kein Konto an.
- Monatsabo 500 Maisdollar: Beim ersten Login im Monat überweist die API den Betrag über die Bank-Funktion des Portals. Idempotenz-Schlüssel pro Spieler und Monat verhindert Doppelabbuchungen, auch bei parallelen Logins. Bei zu wenig Guthaben: „Abo fällig — 500 Maisdollar benötigt".
- Eigene Sitzungen: Zugriffstoken (15 Minuten) und rotierendes Refresh-Token (30 Tage, nur als Hash gespeichert); Logout widerruft sofort; neuer Monat verlangt neue Anmeldung.
- Sicherheit: Rate-Limits auf Login und Refresh, nur parameterisierte Abfragen, CORS nur für erlaubte Adressen, Content-Security-Policy mit API-Adresse, keine internen Fehlerdetails nach außen.
- Spielstand-Speicher (`/api/save`) für die kommende Meta-Progression.
- Login-Maske im Spiel (nur aktiv, wenn eine API-Adresse eingerichtet ist), Abmelden-Knopf.
- GitHub Actions: API-Tests bei jedem Push, automatischer Worker-Deploy inkl. Migrationen, sobald Cloudflare eingerichtet ist.
- Tests: 28 API-Integrationstests, Browser-Test des kompletten Login- und Abo-Ablaufs.

## v0.1.0

Erste spielbare Version.

- Spielgerüst: TypeScript, Vite, Canvas 2D, fester 60-Hz-Takt mit Interpolation, deterministische Simulation.
- Performance: Gegner, Projektile und Effekte in TypedArrays (kein Garbage Collector im Spiel), Spatial Grid für Kollisionen; rund 0,15 ms Simulationszeit pro Tick bei 1400 Gegnern.
- Map „Maisfeld am Bach" (Anfänger) mit Wasser und Hindernissen.
- 5 Türme in 3 Klassen: Kolbenschütze, Körnermörser (Primär), Laserposten (Militär), Maisfarm, Funkmast (Support).
- TDX-Upgradesystem: 2 Pfade mit je 5 Stufen, Crosspath „5-2", Platzierungslimit pro Turm, Verkaufen für 70 %.
- Alle 17 Gegnertypen inkl. 5 Panzer, Spaltung beim Tod, Immunitäten, Eigenschaften Getarnt, Regenerierend, Gepanzert.
- Schwerer Panzer, Superpanzer und Koloss-Panzer greifen Türme an (Betäubung und Turm-Schaden). Türme können repariert werden, der Funkmast repariert und schützt.
- Runden 1–100 (1–40 handgebaut, danach generiert mit Panzer-Meilensteinen), abnehmendes Pop-Geld, Rundeneinkommen.
- Zielmodi Erster, Letzter, Stärkster, Nächster; Tempo 1x/2x/3x; Auto-Start; Tastenkürzel.
- Automatische Veröffentlichung auf GitHub Pages und Netlify-ZIP bei jedem Release.
