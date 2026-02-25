-- Run this once to create the table in your D1 database
-- Command: wrangler d1 execute spinoffate-db --file=schema.sql

CREATE TABLE IF NOT EXISTS spins (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  result     TEXT    NOT NULL,
  created_at TEXT    NOT NULL
);
