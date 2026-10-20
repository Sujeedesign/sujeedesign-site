from __future__ import annotations

import json
import re

from fastapi.testclient import TestClient

from app.db import connect
from sujee_editor.blocks import DEFAULT_BLOCKS
from tests.test_editor_bootstrap import seed_page, session_cookies

CONFIG_RE = re.compile(r'<script id="visual-config" type="application/json">(.*?)</script>', re.S)


def test_visual_admin_route_requires_admin(client: TestClient, db_file) -> None:
    page_id, _ = seed_page(db_file)
    response = client.get(f"/admin/visual/{page_id}", follow_redirects=False)
    assert response.status_code == 303
    assert response.headers["location"] == "/admin/connexion"


def test_visual_admin_route_mounts_saved_project_and_theme(client: TestClient, db_file) -> None:
    page_id, _ = seed_page(db_file)
    response = client.get(f"/admin/pages/{page_id}", cookies=session_cookies())
    assert response.status_code == 200
    html = response.text
    assert "Éditeur visuel ·" in html
    assert 'id="visual-settings-open"' not in html
    assert 'id="visual-history-open"' not in html
    assert 'id="visual-save"' in html
    assert "/assets/editor/visual/visual-editor.js" in html
    assert "/assets/site.css" in html
    match = CONFIG_RE.search(html)
    assert match is not None
    config = json.loads(match.group(1))
    assert config["page"]["id"] == page_id
    assert config["api"] == "/api/editor"
    assert config["draft_version"] == 0
    assert config["project"]["project_data"]["pages"]
    assert config["csrf"]
    assert list(config["blocks"]) == list(DEFAULT_BLOCKS)
    assert all("fields" in block and "variants" in block for block in config["blocks"].values())


def test_visual_editor_includes_all_supported_sections_in_project(client: TestClient, db_file) -> None:
    page_id, _ = seed_page(db_file)
    conn = connect(db_file)
    try:
        conn.execute(
            "INSERT INTO sections (page_id, position, type, data) VALUES (?, 1, 'faq', ?)",
            (page_id, json.dumps({"title": "Question"})),
        )
        conn.commit()
    finally:
        conn.close()

    response = client.get(f"/admin/pages/{page_id}", cookies=session_cookies())

    assert response.status_code == 200
    assert "Mode pilote" not in response.text
    assert "Questions fréquentes" in response.text
    match = CONFIG_RE.search(response.text)
    assert match is not None
    config = json.loads(match.group(1))
    components = config["project"]["project_data"]["pages"][0]["frames"][0]["component"]["components"]
    assert [component["attributes"]["data-sjd-section"] for component in components] == ["chapter", "faq"]


def test_visual_admin_route_rejects_unknown_page(client: TestClient) -> None:
    response = client.get("/admin/visual/99999", cookies=session_cookies())
    assert response.status_code == 404


def test_visual_config_contains_page_settings_and_csrf(client: TestClient, db_file) -> None:
    page_id, _ = seed_page(db_file)
    response = client.get(f"/admin/pages/{page_id}", cookies=session_cookies())
    assert response.status_code == 200
    match = CONFIG_RE.search(response.text)
    assert match is not None
    config = json.loads(match.group(1))
    assert config["page"]["id"] == page_id
    assert {"title", "slug", "kind", "excerpt", "cover", "cover_alt", "client", "year", "num", "position", "categories", "external_url", "in_menu", "menu_label", "menu_position", "seo_title", "seo_description", "og_image", "robots", "meta"} <= set(config["page"])
    assert config["csrf"]


def test_visual_editor_blocks_pages_with_unsupported_section_types(client: TestClient, db_file) -> None:
    page_id, _ = seed_page(db_file)
    conn = connect(db_file)
    try:
        conn.execute(
            "INSERT INTO sections (page_id, position, type, label, data) VALUES (?, 2, 'future-widget', 'Future widget', '{}')",
            (page_id,),
        )
        conn.commit()
    finally:
        conn.close()

    response = client.get(f"/admin/pages/{page_id}", cookies=session_cookies())
    assert response.status_code == 409
    assert "future-widget" in response.text
    conn = connect(db_file)
    try:
        assert conn.execute("SELECT 1 FROM visual_projects WHERE page_id = ?", (page_id,)).fetchone() is None
    finally:
        conn.close()


def test_visual_editor_rejects_unsupported_sections_even_with_an_existing_project(client: TestClient, db_file) -> None:
    page_id, _ = seed_page(db_file)
    first = client.get(f"/admin/pages/{page_id}", cookies=session_cookies())
    assert first.status_code == 200
    conn = connect(db_file)
    try:
        original = conn.execute("SELECT draft_project_json FROM visual_projects WHERE page_id = ?", (page_id,)).fetchone()[0]
        conn.execute(
            "INSERT INTO sections (page_id, position, type, label, data) VALUES (?, 2, 'future-widget', 'Future widget', '{}')",
            (page_id,),
        )
        conn.commit()
    finally:
        conn.close()

    response = client.get(f"/admin/pages/{page_id}", cookies=session_cookies())
    assert response.status_code == 409
    assert "future-widget" in response.text
    conn = connect(db_file)
    try:
        assert conn.execute("SELECT draft_project_json FROM visual_projects WHERE page_id = ?", (page_id,)).fetchone()[0] == original
    finally:
        conn.close()


def test_page_update_requires_valid_csrf(client: TestClient, db_file) -> None:
    page_id, _ = seed_page(db_file)
    response = client.patch(
        f"/api/admin/pages/{page_id}",
        json={"title": "Nouveau titre"},
        cookies=session_cookies(),
    )
    assert response.status_code == 403
