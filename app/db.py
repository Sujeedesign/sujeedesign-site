"""Base SQLite du back office : schéma, migrations idempotentes, révision.

Le back office ne rend plus de page publique. Cette base ne contient donc que
ce qu'il pilote vraiment : messages du formulaire, médias, réglages, révisions
et documents de contenu consommés par la vitrine Next.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

SCHEMA_VERSION = 11

# Colonnes ajoutées après la première mise en production. Chaque entrée est
# appliquée une seule fois, dans l'ordre, par `migrate` (idempotent).
MIGRATIONS: tuple[tuple[str, str, str], ...] = (
    ("medias", "original_filename", "TEXT NOT NULL DEFAULT ''"),
    # Visuel de couverture distinct de la galerie (2 novembre 2026) : la vitrine
    # garde exactement le même rendu qu'avec les fiches statiques historiques.
    ("projets", "cover", "TEXT NOT NULL DEFAULT ''"),
    # Couverture portrait (mobile), même format que `cover` (2 novembre 2026) :
    # optionnelle, une fiche sans portrait garde son rendu paysage.
    ("projets", "cover_portrait", "TEXT NOT NULL DEFAULT ''"),
)

REQUIRED_TABLES = (
    "medias",
    "messages",
    "reglages",
    "revisions",
    "content_docs",
    "publications",
    "projets",
    "prestations",
    "instagram_posts",
    "_meta",
)

SCHEMA = """
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

CREATE TABLE IF NOT EXISTS content_published (
  slug TEXT PRIMARY KEY,
  data TEXT NOT NULL DEFAULT '{}',
  published_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL DEFAULT '',
  client TEXT NOT NULL DEFAULT '',
  annee TEXT NOT NULL DEFAULT '',
  ville TEXT NOT NULL DEFAULT '',
  pitch TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL DEFAULT '',
  duree TEXT NOT NULL DEFAULT '',
  ton TEXT NOT NULL DEFAULT 'paper',
  disciplines TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  images TEXT NOT NULL DEFAULT '[]',
  cover TEXT NOT NULL DEFAULT '',
  cover_portrait TEXT NOT NULL DEFAULT '',
  sections TEXT NOT NULL DEFAULT '[]',
  results TEXT NOT NULL DEFAULT '[]',
  statut TEXT NOT NULL DEFAULT 'brouillon',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_projets_statut ON projets(statut, position);

CREATE TABLE IF NOT EXISTS prestations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL DEFAULT '',
  accroche TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  prix TEXT NOT NULL DEFAULT '',
  duree TEXT NOT NULL DEFAULT '',
  livrables TEXT NOT NULL DEFAULT '[]',
  statut TEXT NOT NULL DEFAULT 'brouillon',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prestations_statut ON prestations(statut, position);

-- Slugs déjà repris depuis le site statique : sert de pierre tombale pour ne
-- jamais ressusciter une fiche supprimée volontairement dans l'admin.
CREATE TABLE IF NOT EXISTS catalogue_seeded (
  slug TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Même pierre tombale pour les prestations reprises du site statique.
CREATE TABLE IF NOT EXISTS prestations_seeded (
  slug TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Grille « Sur Instagram » de l'accueil : cinq emplacements, remplis à la main
-- depuis l'admin. Aucun lien avec l'API Instagram : Sujee choisit les posts.
CREATE TABLE IF NOT EXISTS instagram_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  position INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'image',
  src TEXT NOT NULL DEFAULT '',
  poster TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  permalink TEXT NOT NULL DEFAULT '',
  alt TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_instagram_position ON instagram_posts(position);

-- Suivi des propositions clients envoyées par lien direct
-- (/propositions/<slug>/). Une ligne par ouverture, mise à jour en fin de
-- visite avec le temps passé. Aucune IP en clair : seul un condensat salé.
CREATE TABLE IF NOT EXISTS proposition_vues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL DEFAULT '',
  session TEXT NOT NULL DEFAULT '',
  evenement TEXT NOT NULL DEFAULT 'ouverture',
  secondes INTEGER NOT NULL DEFAULT 0,
  referer TEXT NOT NULL DEFAULT '',
  ua TEXT NOT NULL DEFAULT '',
  ip_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_proposition_vues_slug ON proposition_vues(slug, created_at);

CREATE TABLE IF NOT EXISTS _meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
"""


def connect(path: str | Path, *, check_same_thread: bool = True) -> sqlite3.Connection:
    """Ouvre une connexion SQLite configurée (WAL, clés étrangères, Row)."""
    target = Path(path)
    if target.parent and str(target.parent) not in ("", "."):
        target.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(target), timeout=15, check_same_thread=check_same_thread)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 8000")
    return conn


def migrate(conn: sqlite3.Connection) -> list[str]:
    """Ajoute les colonnes manquantes aux bases existantes. Idempotent."""
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
    from .agent.schema import init_agent_db

    init_agent_db(conn)


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
    """Incrémente la révision globale du contenu : invalide tout cache de lecture."""
    current = int(get_meta(conn, "content_revision", "1") or "1")
    set_meta(conn, "content_revision", str(current + 1))
    return str(current + 1)
