# Änderungen

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
