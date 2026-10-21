from __future__ import annotations

import json
import re

from fastapi.testclient import TestClient

from app.db import connect
from sujee_editor.blocks import DEFAULT_BLOCKS, default_data
from sujee_editor.editor.project import sections_to_project
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
    assert config["preview_api"] == f"/api/admin/pages/{page_id}/visual-preview"
    assert config["draft_version"] == 0
    assert config["project"]["project_data"]["pages"]
    assert config["theme_styles"] == ["/assets/site.css", "/assets/site-extras.css", "/assets/site-noscript.css"]
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


def test_visual_editor_rebuilds_legacy_pilot_projects_from_all_page_sections(client: TestClient, db_file) -> None:
    page_id, chapter_id = seed_page(db_file)
    conn = connect(db_file)
    try:
        section_ids = [chapter_id]
        for position, name in enumerate(("hero", "etude-de-cas", "cta-final"), start=1):
            block = DEFAULT_BLOCKS[name]
            data = default_data(block)
            cursor = conn.execute(
                "INSERT INTO sections (page_id, position, type, label, data) VALUES (?, ?, ?, ?, ?)",
                (page_id, position, name, block.label, json.dumps(data, ensure_ascii=False)),
            )
            section_ids.append(int(cursor.lastrowid or 0))
        legacy = sections_to_project([{
            "id": chapter_id, "position": 0, "type": "chapter",
            "data": {"title": "Titre publié", "body": "<p>Texte</p>", "dark": False},
        }])
        legacy["theme_version"] = 1
        legacy["project_data"]["pages"][0]["frames"][0]["component"]["components"][0]["attributes"].pop("data-sjd-data")
        draft = sections_to_project([{
            "id": chapter_id, "position": 0, "type": "chapter",
            "data": {"title": "Brouillon hérité", "body": "<p>Texte</p>", "dark": False},
        }])
        draft["theme_version"] = 1
        encoded_draft = json.dumps(draft, ensure_ascii=False)
        encoded_published = json.dumps(legacy, ensure_ascii=False)
        conn.execute(
            "INSERT INTO visual_projects (page_id, draft_project_json, published_project_json, draft_version, theme_id, theme_version) "
            "VALUES (?, ?, ?, 7, 'sujee-site', 1)",
            (page_id, encoded_draft, encoded_published),
        )
        conn.commit()
    finally:
        conn.close()

    response = client.get(f"/admin/pages/{page_id}", cookies=session_cookies())

    assert response.status_code == 200, response.text
    match = CONFIG_RE.search(response.text)
    assert match is not None
    config = json.loads(match.group(1))
    project = config["project"]
    components = project["project_data"]["pages"][0]["frames"][0]["component"]["components"]
    assert project["theme_version"] == 4
    assert config["draft_version"] == 7
    assert [item["attributes"]["data-sjd-section"] for item in components] == ["chapter", "hero", "etude-de-cas", "cta-final"]
    assert [int(item["attributes"]["data-sjd-section-id"]) for item in components] == section_ids
    assert json.loads(components[0]["attributes"]["data-sjd-data"])["title"] == "Brouillon hérité"
    conn = connect(db_file)
    try:
        row = conn.execute("SELECT draft_project_json, published_project_json, draft_version, theme_version FROM visual_projects WHERE page_id = ?", (page_id,)).fetchone()
        published = json.loads(row["published_project_json"])
        published_components = published["project_data"]["pages"][0]["frames"][0]["component"]["components"]
        assert [item["attributes"]["data-sjd-section"] for item in published_components] == ["chapter", "hero", "etude-de-cas", "cta-final"]
        assert json.loads(published_components[0]["attributes"]["data-sjd-data"])["title"] == "Titre publié"
        assert row["draft_version"] == 7 and row["theme_version"] == 4
    finally:
        conn.close()


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


def test_visual_preview_renders_unsaved_project_with_real_theme_markup(client: TestClient, db_file) -> None:
    page_id, section_id = seed_page(db_file)
    cookies = session_cookies()
    editor_response = client.get(f"/admin/pages/{page_id}", cookies=cookies)
    assert editor_response.status_code == 200
    match = CONFIG_RE.search(editor_response.text)
    assert match is not None
    config = json.loads(match.group(1))
    project = config["project"]
    component = project["project_data"]["pages"][0]["frames"][0]["component"]["components"][0]
    assert component["attributes"]["data-sjd-section-id"] == str(section_id)
    data = json.loads(component["attributes"]["data-sjd-data"])
    data["title"] = "Aperçu dynamique sans sauvegarde"
    component["attributes"]["data-sjd-data"] = json.dumps(data, ensure_ascii=False)

    response = client.post(
        f"/api/admin/pages/{page_id}/visual-preview",
        json={"project": project},
        cookies=cookies,
        headers={"Origin": "http://testserver", "X-SJD-CSRF": config["csrf"]},
    )

    assert response.status_code == 200, response.text
    assert "Aperçu dynamique sans sauvegarde" in response.text
    assert 'class="s-chap reveal"' in response.text
    assert 'class="sjd-editor-preview sjd-editor-preview-chapter"' not in response.text
    assert "/assets/site.css" in response.text
    assert "data-edit-mode=\"1\"" not in response.text
    conn = connect(db_file)
    try:
        saved = json.loads(conn.execute("SELECT data FROM sections WHERE id = ?", (section_id,)).fetchone()[0])
        assert saved["title"] == "Titre publié"
    finally:
        conn.close()


def test_visual_preview_requires_admin(client: TestClient, db_file) -> None:
    page_id, _ = seed_page(db_file)
    response = client.post(
        f"/api/admin/pages/{page_id}/visual-preview",
        json={"project": {}},
        headers={"Origin": "http://testserver"},
    )
    assert response.status_code == 401


def test_visual_preview_requires_csrf(client: TestClient, db_file) -> None:
    page_id, _ = seed_page(db_file)
    response = client.post(
        f"/api/admin/pages/{page_id}/visual-preview",
        json={"project": {}},
        cookies=session_cookies(),
        headers={"Origin": "http://testserver"},
    )
    assert response.status_code == 403


def test_visual_preview_rejects_sections_owned_by_another_page(client: TestClient, db_file) -> None:
    page_id, _ = seed_page(db_file)
    conn = connect(db_file)
    try:
        other_page_id = conn.execute(
            "INSERT INTO pages (slug, kind, title, status) VALUES ('autre-page', 'page', 'Autre page', 'publie')"
        ).lastrowid
        other_section_id = conn.execute(
            "INSERT INTO sections (page_id, position, type, data) VALUES (?, 0, 'chapter', '{}')",
            (other_page_id,),
        ).lastrowid
        conn.commit()
    finally:
        conn.close()
    cookies = session_cookies()
    config_response = client.get(f"/admin/pages/{page_id}", cookies=cookies)
    match = CONFIG_RE.search(config_response.text)
    assert match is not None
    config = json.loads(match.group(1))
    project = config["project"]
    component = project["project_data"]["pages"][0]["frames"][0]["component"]["components"][0]
    component["attributes"]["data-sjd-section-id"] = str(other_section_id)
    response = client.post(
        f"/api/admin/pages/{page_id}/visual-preview",
        json={"project": project},
        cookies=cookies,
        headers={"Origin": "http://testserver", "X-SJD-CSRF": config["csrf"]},
    )
    assert response.status_code == 400
