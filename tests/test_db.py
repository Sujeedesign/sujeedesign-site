"""Schéma, migrations et point de santé."""

from __future__ import annotations

from pathlib import Path

from app.db import (
    REQUIRED_TABLES,
    SCHEMA_VERSION,
    bump_revision,
    connect,
    content_revision,
    get_meta,
    init_db,
    migrate,
)
from app.main import create_app

# Schéma de la version 1, figé : c'est ce que porte une base déjà en production.
LEGACY_SECTIONS_TABLE = """
CREATE TABLE pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'page',
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'brouillon'
);
CREATE TABLE sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  visible INTEGER NOT NULL DEFAULT 1,
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '');
INSERT INTO pages (slug, title) VALUES ('a-propos', 'À propos');
INSERT INTO sections (page_id, position, type, data) VALUES (1, 0, 'chapter', '{"title": "Parcours"}');
"""


def table_names(db_file: Path) -> set[str]:
    conn = connect(db_file)
    try:
        rows = conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
        return {row["name"] for row in rows}
    finally:
        conn.close()


def test_init_db_creates_required_tables(db_file: Path) -> None:
    conn = connect(db_file)
    try:
        init_db(conn)
    finally:
        conn.close()
    names = table_names(db_file)
    for table in REQUIRED_TABLES:
        assert table in names, f"table manquante : {table}"


def test_init_db_is_idempotent(db_file: Path) -> None:
    conn = connect(db_file)
    try:
        init_db(conn)
        init_db(conn)
        assert content_revision(conn) == "1"
    finally:
        conn.close()


def test_bump_revision_increments(db_file: Path) -> None:
    conn = connect(db_file)
    try:
        init_db(conn)
        assert bump_revision(conn) == "2"
        assert bump_revision(conn) == "3"
        assert content_revision(conn) == "3"
    finally:
        conn.close()


def test_migration_adds_draft_columns_to_an_existing_db(tmp_path: Path) -> None:
    db_file = tmp_path / "prod.db"
    conn = connect(db_file)
    try:
        conn.executescript(LEGACY_SECTIONS_TABLE)
        assert migrate(conn) == ["draft", "draft_version"]
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(sections)")}
        assert {"draft", "draft_version"} <= columns
        row = conn.execute("SELECT data, draft, draft_version FROM sections WHERE id = 1").fetchone()
        assert row["data"] == '{"title": "Parcours"}'
        assert row["draft"] is None
        assert row["draft_version"] == 0
        assert get_meta(conn, "schema_version") == str(SCHEMA_VERSION)
    finally:
        conn.close()


def test_migrate_is_idempotent(tmp_path: Path) -> None:
    conn = connect(tmp_path / "site.db")
    try:
        init_db(conn)
        assert migrate(conn) == []
        init_db(conn)
        assert migrate(conn) == []
        assert get_meta(conn, "schema_version") == "3"
    finally:
        conn.close()


def test_init_db_adds_visual_projects_table_to_an_existing_db(tmp_path: Path) -> None:
    db_file = tmp_path / "prod.db"
    conn = connect(db_file)
    try:
        conn.executescript(LEGACY_SECTIONS_TABLE)
        init_db(conn)
        tables = {row["name"] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        assert "visual_projects" in tables
        row = conn.execute("SELECT title FROM pages WHERE id = 1").fetchone()
        assert row["title"] == "À propos"
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(visual_projects)")}
        assert {"page_id", "draft_project_json", "published_project_json", "draft_version", "theme_id", "theme_version"} <= columns
        assert get_meta(conn, "schema_version") == "3"
        assert migrate(conn) == []
    finally:
        conn.close()


def test_init_db_is_idempotent_and_creates_the_draft_columns(db_file: Path) -> None:
    conn = connect(db_file)
    try:
        init_db(conn)
        init_db(conn)
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(sections)")}
        assert {"draft", "draft_version"} <= columns
        assert content_revision(conn) == "1"
    finally:
        conn.close()


def test_health_endpoint(db_file: Path) -> None:
    app = create_app(db_file)
    from fastapi.testclient import TestClient

    with TestClient(app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["version"]
    assert payload["revision"] == "1"
