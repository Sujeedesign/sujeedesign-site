"""Schéma SQLite de l'agent de contact (sessions, messages, leads, rendez-vous).

Appliqué au démarrage du back office, en plus du schéma historique. Les tables
sont additives : aucun impact sur les messages du formulaire classique.
"""

from __future__ import annotations

import sqlite3

AGENT_SCHEMA_VERSION = 1

SCHEMA = """
CREATE TABLE IF NOT EXISTS agent_sessions (
  id TEXT PRIMARY KEY,
  step TEXT NOT NULL DEFAULT 'accueil',
  status TEXT NOT NULL DEFAULT 'ouverte',
  fields TEXT NOT NULL DEFAULT '{}',
  recap TEXT NOT NULL DEFAULT '',
  recap_ok INTEGER NOT NULL DEFAULT 0,
  proposals TEXT NOT NULL DEFAULT '[]',
  consent INTEGER NOT NULL DEFAULT 0,
  turns INTEGER NOT NULL DEFAULT 0,
  tokens INTEGER NOT NULL DEFAULT 0,
  ip_hash TEXT NOT NULL DEFAULT '',
  reference TEXT NOT NULL DEFAULT '',
  lead_id INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status, updated_at);

CREATE TABLE IF NOT EXISTS agent_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agent_messages_session ON agent_messages(session_id, id);

CREATE TABLE IF NOT EXISTS agent_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  fields TEXT NOT NULL DEFAULT '{}',
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'qualifie',
  event_id TEXT NOT NULL DEFAULT '',
  slot_start TEXT NOT NULL DEFAULT '',
  notified_at TEXT,
  ip_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agent_leads_status ON agent_leads(status, created_at);

CREATE TABLE IF NOT EXISTS agent_bookings (
  slot_start TEXT PRIMARY KEY,
  session_id TEXT NOT NULL DEFAULT '',
  event_id TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


def _add_missing_columns(conn: sqlite3.Connection) -> None:
    """Ajoute les colonnes apparues après la v1 sur une base existante."""
    columns = {row["name"] for row in conn.execute("PRAGMA table_info(agent_sessions)")}
    if "proposals" not in columns:
        conn.execute("ALTER TABLE agent_sessions ADD COLUMN proposals TEXT NOT NULL DEFAULT '[]'")


def init_agent_db(conn: sqlite3.Connection) -> None:
    """Crée les tables de l'agent si nécessaire. Idempotent."""
    conn.executescript(SCHEMA)
    _add_missing_columns(conn)
    conn.execute(
        "INSERT INTO _meta (key, value) VALUES ('agent_schema_version', ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (str(AGENT_SCHEMA_VERSION),),
    )
    conn.commit()
