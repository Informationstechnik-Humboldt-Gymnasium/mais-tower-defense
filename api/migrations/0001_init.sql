-- Spielkonten: verknüpft über die Benutzer-ID des Bürgerportals (keine Passwörter im Spiel!)
CREATE TABLE players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  portal_uid TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  last_payment_month TEXT,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

-- Abo-Zahlungen: höchstens eine pro Spieler und Monat
CREATE TABLE payments (
  player_id INTEGER NOT NULL REFERENCES players(id),
  month TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid')),
  tx_ref TEXT,
  created_at INTEGER NOT NULL,
  paid_at INTEGER,
  PRIMARY KEY (player_id, month)
);

-- Sitzungen: nur der SHA-256-Hash des Refresh-Tokens wird gespeichert
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id),
  refresh_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX sessions_player ON sessions(player_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);

-- Spielstände / Meta-Progression (JSON)
CREATE TABLE saves (
  player_id INTEGER PRIMARY KEY REFERENCES players(id),
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Rate-Limits (feste Zeitfenster)
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
