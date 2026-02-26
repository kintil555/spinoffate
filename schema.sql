-- Jalankan sekali untuk setup database
-- Command: wrangler d1 execute spinoffate-db --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS spins (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  result     TEXT    NOT NULL,
  avatar     TEXT    DEFAULT NULL,
  created_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS ip_limits (
  ip         TEXT    NOT NULL,
  date       TEXT    NOT NULL,
  spin_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip, date)
);

CREATE TABLE IF NOT EXISTS segment_requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  request    TEXT    NOT NULL,
  created_at TEXT    NOT NULL
);
