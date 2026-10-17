"""Accroche de l'éditeur dans le site : ressources, état injecté, entrée en édition."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import security
from app.db import connect

SLUG = "a-propos"
DATA_RE = re.compile(r'<script id="sjd-editor-data" type="application/json">(.*?)</script>', re.S)


def seed_page(db_file: Path) -> tuple[int, int]:
    connection = connect(db_file)
    try:
        page = connection.execute(
            "INSERT INTO pages (slug, kind, title, status) VALUES (?, 'page', 'À propos', 'publie')", (SLUG,)
        )
        page_id = int(page.lastrowid or 0)
        section = connection.execute(
            "INSERT INTO sections (page_id, position, type, data) VALUES (?, 0, 'chapter', ?)",
            (page_id, json.dumps({"title": "Titre publié", "body": "<p>Texte</p>", "dark": False})),
        )
        connection.commit()
        return page_id, int(section.lastrowid or 0)
    finally:
        connection.close()


def payload_of(html: str) -> dict:
    match = DATA_RE.search(html)
    assert match is not None, "état de l'éditeur absent"
    return json.loads(match.group(1))


def session_cookies() -> dict:
    return {security.SESSION_COOKIE: security.make_session()}


def test_a_visitor_gets_no_editor_at_all(client: TestClient, db_file: Path) -> None:
    seed_page(db_file)
    html = client.get(f"/{SLUG}").text
    assert "/assets/editor/editor.js" not in html
    assert "/assets/editor/editor.css" not in html
    assert "sjd-editor-data" not in html
    assert "Modifier cette page" not in html
    assert "data-edit-mode" not in html


def test_the_edit_flag_without_a_session_changes_nothing(client: TestClient, db_file: Path) -> None:
    seed_page(db_file)
    html = client.get(f"/{SLUG}?edit=1").text
    assert "sjd-editor-data" not in html
    assert "/assets/editor/editor.js" not in html


def test_a_signed_in_reader_gets_the_entry_link(client: TestClient, db_file: Path) -> None:
    seed_page(db_file)
    html = client.get(f"/{SLUG}", cookies=session_cookies()).text
    assert 'href="?edit=1"' in html
    assert "sjd-editor-data" not in html


def test_edit_mode_injects_the_state_and_the_assets(client: TestClient, db_file: Path) -> None:
    page_id, section_id = seed_page(db_file)
    response = client.get(f"/{SLUG}?edit=1", cookies=session_cookies())
    assert response.status_code == 200
    html = response.text
    assert 'data-edit-mode="1"' in html
    assert "/assets/editor/editor.js" in html
    assert "/assets/editor/editor.css" in html
    data = payload_of(html)
    assert data["api"] == "/api/editor"
    assert data["page"]["id"] == page_id
    assert data["page"]["path"] == f"/{SLUG}"
    assert len(data["blocks"]) == 19
    assert [section["type"] for section in data["sections"]] == ["chapter"]
    assert data["sections"][0]["id"] == section_id
    assert data["sections"][0]["draft_version"] == 0
    assert data["sections"][0]["revised"] is False
    assert data["csrf"]
    assert data["revisions"] == []


def test_edit_mode_serves_the_draft_and_keeps_it_out_of_the_schema(client: TestClient, db_file: Path) -> None:
    page_id, section_id = seed_page(db_file)
    connection = connect(db_file)
    try:
        connection.execute(
            "UPDATE sections SET draft = ?, draft_version = 1 WHERE id = ?",
            (json.dumps({"title": "Brouillon privé", "body": "<p>Brouillon</p>", "dark": False}), section_id),
        )
        connection.commit()
    finally:
        connection.close()
    data = payload_of(client.get(f"/{SLUG}?edit=1", cookies=session_cookies()).text)
    section = data["sections"][0]
    assert section["effective"]["title"] == "Brouillon privé"
    assert section["data"]["title"] == "Titre publié"
    assert section["revised"] is True
    public = client.get(f"/{SLUG}").text
    assert "Brouillon privé" not in public


def test_the_editor_assets_are_served(client: TestClient) -> None:
    for path in ("/assets/editor/editor.js", "/assets/editor/api.js", "/assets/editor/panel.js", "/assets/editor/editor.css"):
        assert client.get(path).status_code == 200, path
    assert client.get("/assets/site.css").status_code == 200
    assert client.get("/assets/editor/inconnu.js").status_code == 404


def test_the_editor_api_is_mounted(client: TestClient, db_file: Path) -> None:
    page_id, _ = seed_page(db_file)
    assert client.get(f"/api/editor/pages/{page_id}/state").status_code == 401
    response = client.get(f"/api/editor/pages/{page_id}/state", cookies=session_cookies())
    assert response.status_code == 200
    assert response.json()["page"]["id"] == page_id
