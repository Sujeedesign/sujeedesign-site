"""Schéma, migrations et point de santé."""

from __future__ import annotations

from pathlib import Path

from app.db import (
    REQUIRED_TABLES,
    bump_revision,
    connect,
    content_revision,
    init_db,
)
from app.main import create_app


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
