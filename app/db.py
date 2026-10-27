"""Accès à la base SQLite du site : schéma, migrations idempotentes, révision."""

from __future__ import annotations

import sqlite3
from pathlib import Path

SCHEMA_VERSION = 4

# Colonnes ajoutées après la première mise en production. Chaque entrée est
# appliquée une seule fois, dans l'ordre, par `migrate` (idempotent).
MIGRATIONS: tuple[tuple[str, str, str], ...] = (
    ("sections", "draft", "TEXT"),
    ("sections", "draft_version", "INTEGER NOT NULL DEFAULT 0"),
    ("medias", "original_filename", "TEXT NOT NULL DEFAULT ''"),
)

REQUIRED_TABLES = (
    "pages",
    "sections",
    "visual_projects",
    "medias",
    "messages",
    "reglages",
    "revisions",
    "redirections",
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'page',
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'brouillon',
  excerpt TEXT NOT NULL DEFAULT '',
  cover TEXT NOT NULL DEFAULT '',
  cover_alt TEXT NOT NULL DEFAULT '',
  client TEXT NOT NULL DEFAULT '',
  year INTEGER,
  categories TEXT NOT NULL DEFAULT '[]',
  external_url TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  num INTEGER NOT NULL DEFAULT 0,
  in_menu INTEGER NOT NULL DEFAULT 0,
  menu_position INTEGER NOT NULL DEFAULT 0,
  menu_label TEXT NOT NULL DEFAULT '',
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  og_image TEXT NOT NULL DEFAULT '',
  robots TEXT NOT NULL DEFAULT 'index,follow',
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  visible INTEGER NOT NULL DEFAULT 1,
  data TEXT NOT NULL DEFAULT '{}',
  draft TEXT,
  draft_version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sections_page ON sections(page_id, position);

CREATE TABLE IF NOT EXISTS visual_projects (
  page_id INTEGER PRIMARY KEY REFERENCES pages(id) ON DELETE CASCADE,
  draft_project_json TEXT NOT NULL DEFAULT '{}',
  published_project_json TEXT NOT NULL DEFAULT '{}',
  draft_version INTEGER NOT NULL DEFAULT 0,
  theme_id TEXT NOT NULL DEFAULT '',
  theme_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS medias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL DEFAULT '',
  path TEXT NOT NULL DEFAULT '',
  alt TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  credit TEXT NOT NULL DEFAULT '',
  mime TEXT NOT NULL DEFAULT '',
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  size INTEGER NOT NULL DEFAULT 0,
  variants TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  project_type TEXT NOT NULL DEFAULT '',
  budget TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'nouveau',
  spam_score INTEGER NOT NULL DEFAULT 0,
  ip TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  assigned_to TEXT NOT NULL DEFAULT '',
  notified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status, created_at);

CREATE TABLE IF NOT EXISTS reglages (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  snapshot TEXT NOT NULL DEFAULT '{}',
  note TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_revisions_entity ON revisions(entity_type, entity_id, created_at);

CREATE TABLE IF NOT EXISTS redirections (
  path TEXT PRIMARY KEY,
  target TEXT NOT NULL,
  code INTEGER NOT NULL DEFAULT 301,
  hits INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS content_docs (
  slug TEXT PRIMARY KEY,
  data TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT NOT NULL DEFAULT 'admin'
);

CREATE TABLE IF NOT EXISTS publications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'demande',
  deployment TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS _meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
"""


def connect(path: str | Path) -> sqlite3.Connection:
    """Ouvre une connexion SQLite configurée (WAL, clés étrangères, Row)."""
    target = Path(path)
    if target.parent and str(target.parent) not in ("", "."):
        target.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(target), timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 8000")
    return conn


def migrate(conn: sqlite3.Connection) -> list[str]:
    """Ajoute les colonnes manquantes aux bases existantes. Idempotent.

    Aucune donnée publiée n'est touchée : seules des colonnes sont ajoutées.
    Retourne la liste des colonnes réellement ajoutées.
    """
    added: list[str] = []
    for table, column, definition in MIGRATIONS:
        columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
        if not columns or column in columns:
            continue
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
        added.append(column)
    if added or get_meta(conn, "schema_version") != str(SCHEMA_VERSION):
        set_meta(conn, "schema_version", str(SCHEMA_VERSION))
    conn.commit()
    return added


def init_db(conn: sqlite3.Connection) -> None:
    """Crée le schéma si nécessaire. Idempotent."""
    conn.executescript(SCHEMA)
    conn.execute(
        "INSERT INTO _meta (key, value) VALUES ('content_revision', '1') "
        "ON CONFLICT(key) DO NOTHING",
        (),
    )
    migrate(conn)


def get_meta(conn: sqlite3.Connection, key: str, default: str = "") -> str:
    row = conn.execute("SELECT value FROM _meta WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def set_meta(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute(
        "INSERT INTO _meta (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, str(value)),
    )


def content_revision(conn: sqlite3.Connection) -> str:
    return get_meta(conn, "content_revision", "1")


def bump_revision(conn: sqlite3.Connection) -> str:
    """Incrémente la révision globale du contenu : invalide tout cache de rendu."""
    current = int(get_meta(conn, "content_revision", "1") or "1")
    set_meta(conn, "content_revision", str(current + 1))
    return str(current + 1)
