"""Fixtures partagées des tests."""

from __future__ import annotations

import sqlite3
import sys
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.db import connect, init_db  # noqa: E402
from app.main import create_app  # noqa: E402


@pytest.fixture(autouse=True)
def _clear_render_cache() -> Iterator[None]:
    from app import render as render_module

    render_module.invalidate()
    yield
    render_module.invalidate()


@pytest.fixture()
def db_file(tmp_path: Path) -> Path:
    return tmp_path / "site.db"


@pytest.fixture()
def conn(db_file: Path) -> Iterator[sqlite3.Connection]:
    connection = connect(db_file)
    init_db(connection)
    yield connection
    connection.close()


@pytest.fixture()
def client(db_file: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("SESSION_SECRET", "secret-de-test")
    monkeypatch.setenv("ADMIN_PASSWORD", "mot-de-passe-de-test")
    monkeypatch.setenv("SYNC_TOKEN", "jeton-de-test")
    application = create_app(db_file)
    with TestClient(application) as test_client:
        yield test_client
