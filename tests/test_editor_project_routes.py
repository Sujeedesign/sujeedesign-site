from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import db as db_module
from sujee_editor.blocks import DEFAULT_BLOCKS, default_data
from editor_fixtures import sample_data
from sujee_editor.editor.project import sections_to_project
from sujee_editor.editor.theme import THEME_ID, THEME_VERSION
from sujee_editor.routes import build_router
from sujee_editor.store import Store
from sujee_editor.tokens import CSRF_HEADER, SESSION_COOKIE, make_csrf, make_session

SECRET = "visual-project-test-secret"
BASE = "/api/editor"


def _api(db_file: Path) -> FastAPI:
    store = Store(db_file, DEFAULT_BLOCKS)
    conn = store.connect()
    try:
        db_module.init_db(conn)
    finally:
        conn.close()
    app = FastAPI()
    app.include_router(build_router(store, session_secret=SECRET), prefix=BASE)
    return app


def _seed(db_file: Path, *, unsupported: bool = False) -> int:
    conn = db_module.connect(db_file)
    try:
        db_module.init_db(conn)
        page = conn.execute(
            "INSERT INTO pages (slug, kind, title, status) VALUES ('visual-test','page','Page test','publie')"
        )
        page_id = int(page.lastrowid or 0)
        sections = [
            ("chapter", {"kicker": "", "title": "Titre publié", "body": "<p>Texte publié</p>", "list": "", "dark": False}),
            ("image-pleine-largeur", {"src": "/medias/photo.webp", "alt": "Photo", "caption": "Légende"}),
            ("citation", {"quote": "Une citation", "author": "Auteur", "role": ""}),
        ]
        if unsupported:
            sections.append(("faq", {"title": "FAQ", "items": []}))
        for position, (type_, data) in enumerate(sections):
            conn.execute(
                "INSERT INTO sections (page_id, position, type, data, visible) VALUES (?, ?, ?, ?, 1)",
                (page_id, position, type_, json.dumps(data, ensure_ascii=False)),
            )
        conn.commit()
        return page_id
    finally:
        conn.close()


def _auth(*, session: bool = True, csrf: bool = True) -> tuple[dict[str, str], dict[str, str]]:
    cookies = {SESSION_COOKIE: make_session(SECRET)} if session else {}
    headers = {"Origin": "http://testserver"}
    if csrf:
        headers[CSRF_HEADER] = make_csrf(SECRET)
    return cookies, headers


def _find_field_component(nodes: list[dict[str, Any]], field: str) -> dict[str, Any]:
    for node in nodes:
        if node.get("attributes", {}).get("data-sjd-field") == field:
            return node
        children = node.get("components", [])
        if isinstance(children, list):
            try:
                return _find_field_component(children, field)
            except StopIteration:
                pass
    raise StopIteration(field)


def _change_title(project: dict[str, Any], value: str) -> dict[str, Any]:
    result = json.loads(json.dumps(project))
    sections = result["project_data"]["pages"][0]["frames"][0]["component"]["components"]
    component = next((item for item in sections if item.get("attributes", {}).get("data-sjd-section") == "chapter"), None)
    if component is None:
        component = sections[0]
    title = _find_field_component(sections, "title")
    title["content"] = value
    try:
        data = json.loads(component["attributes"]["data-sjd-data"])
        data["title"] = value
        component["attributes"]["data-sjd-data"] = json.dumps(data, ensure_ascii=False)
    except (KeyError, json.JSONDecodeError):
        pass
    return result


@pytest.fixture()
def db_file(tmp_path: Path) -> Path:
    return tmp_path / "visual-projects.db"


@pytest.fixture()
def client(db_file: Path) -> TestClient:
    page_id = _seed(db_file)
    app = _api(db_file)
    app.state.visual_test_page_id = page_id
    with TestClient(app) as test_client:
        yield test_client


def test_visual_project_api_requires_admin_session(client: TestClient) -> None:
    page_id = client.app.state.visual_test_page_id

    assert client.get(f"{BASE}/pages/{page_id}/visual-project").status_code == 401
    assert client.put(f"{BASE}/pages/{page_id}/visual-project", json={}).status_code == 401


def test_visual_project_get_imports_existing_sections_and_returns_csrf(client: TestClient) -> None:
    page_id = client.app.state.visual_test_page_id
    cookies, _ = _auth()

    response = client.get(f"{BASE}/pages/{page_id}/visual-project", cookies=cookies)

    assert response.status_code == 200
    payload = response.json()
    assert payload["draft_version"] == 0
    assert payload["project"]["theme_id"]
    assert payload["project"]["project_data"]["pages"][0]["frames"][0]["component"]["components"]
    assert payload["csrf"]


def test_visual_project_put_saves_draft_without_changing_public_sections(
    client: TestClient, db_file: Path
) -> None:
    page_id = client.app.state.visual_test_page_id
    cookies, headers = _auth()
    initial = client.get(f"{BASE}/pages/{page_id}/visual-project", cookies=cookies).json()
    project = _change_title(initial["project"], "Titre brouillon")

    response = client.put(
        f"{BASE}/pages/{page_id}/visual-project",
        cookies=cookies,
        headers=headers,
        json={"expected_version": 0, "project": project},
    )

    assert response.status_code == 200
    assert response.json()["draft_version"] == 1
    conn = db_module.connect(db_file)
    try:
        section = conn.execute("SELECT data FROM sections WHERE page_id = ? AND type = 'chapter'", (page_id,)).fetchone()
        assert json.loads(section["data"])["title"] == "Titre publié"
        visual = conn.execute("SELECT draft_project_json FROM visual_projects WHERE page_id = ?", (page_id,)).fetchone()
        assert "Titre brouillon" in visual["draft_project_json"]
    finally:
        conn.close()


def test_visual_project_stale_version_cannot_overwrite_a_newer_draft(client: TestClient) -> None:
    page_id = client.app.state.visual_test_page_id
    cookies, headers = _auth()
    project = client.get(f"{BASE}/pages/{page_id}/visual-project", cookies=cookies).json()["project"]
    first = _change_title(project, "Première version")
    second = _change_title(project, "Version en retard")

    saved = client.put(
        f"{BASE}/pages/{page_id}/visual-project",
        cookies=cookies,
        headers=headers,
        json={"expected_version": 0, "project": first},
    )
    stale = client.put(
        f"{BASE}/pages/{page_id}/visual-project",
        cookies=cookies,
        headers=headers,
        json={"expected_version": 0, "project": second},
    )
    stale_rebase = client.post(
        f"{BASE}/pages/{page_id}/visual-project/rebase",
        cookies=cookies,
        headers=headers,
        json={"expected_version": 0},
    )

    assert saved.status_code == 200
    assert stale.status_code == 409
    assert stale_rebase.status_code == 409
    current = client.get(f"{BASE}/pages/{page_id}/visual-project", cookies=cookies).json()
    assert "Première version" in json.dumps(current["project"], ensure_ascii=False)


def test_visual_project_put_requires_csrf_and_exact_origin(client: TestClient) -> None:
    page_id = client.app.state.visual_test_page_id
    cookies, headers = _auth()
    project = client.get(f"{BASE}/pages/{page_id}/visual-project", cookies=cookies).json()["project"]

    no_csrf = client.put(
        f"{BASE}/pages/{page_id}/visual-project",
        cookies=cookies,
        headers={"Origin": "http://testserver"},
        json={"expected_version": 0, "project": project},
    )
    evil_origin = client.put(
        f"{BASE}/pages/{page_id}/visual-project",
        cookies=cookies,
        headers={**headers, "Origin": "http://testserver.attacker.invalid"},
        json={"expected_version": 0, "project": project},
    )
    no_csrf_rebase = client.post(
        f"{BASE}/pages/{page_id}/visual-project/rebase",
        cookies=cookies,
        headers={"Origin": "http://testserver"},
        json={"expected_version": 0},
    )
    evil_origin_rebase = client.post(
        f"{BASE}/pages/{page_id}/visual-project/rebase",
        cookies=cookies,
        headers={**headers, "Origin": "http://testserver.attacker.invalid"},
        json={"expected_version": 0},
    )

    assert no_csrf.status_code == 403
    assert evil_origin.status_code == 403
    assert no_csrf_rebase.status_code == 403
    assert evil_origin_rebase.status_code == 403


def test_visual_project_rejects_unknown_components_and_oversized_payload(client: TestClient) -> None:
    page_id = client.app.state.visual_test_page_id
    cookies, headers = _auth()
    project = client.get(f"{BASE}/pages/{page_id}/visual-project", cookies=cookies).json()["project"]
    sections = project["project_data"]["pages"][0]["frames"][0]["component"]["components"]
    sections[0]["type"] = "image"

    invalid = client.put(
        f"{BASE}/pages/{page_id}/visual-project",
        cookies=cookies,
        headers=headers,
        json={"expected_version": 0, "project": project},
    )
    large = client.put(
        f"{BASE}/pages/{page_id}/visual-project",
        cookies=cookies,
        headers={**headers, "Content-Type": "application/json"},
        content=json.dumps({"expected_version": 0, "project": {"large": "x" * (1024 * 1024 + 5)}}),
    )

    assert invalid.status_code == 400
    assert large.status_code == 400


def test_visual_project_imports_supported_sections_and_includes_formerly_omitted_types(
    db_file: Path,
) -> None:
    page_id = _seed(db_file, unsupported=True)
    app = _api(db_file)
    cookies, _ = _auth()
    with TestClient(app) as client:
        response = client.get(f"{BASE}/pages/{page_id}/visual-project", cookies=cookies)

    assert response.status_code == 200
    sections = response.json()["project"]["project_data"]["pages"][0]["frames"][0]["component"]["components"]
    assert [section["attributes"]["data-sjd-section"] for section in sections] == [
        "chapter", "image-pleine-largeur", "citation", "faq"
    ]
    conn = db_module.connect(db_file)
    try:
        assert conn.execute("SELECT 1 FROM visual_projects WHERE page_id = ?", (page_id,)).fetchone() is not None
    finally:
        conn.close()


def test_visual_project_unknown_page_returns_404(client: TestClient) -> None:
    cookies, _ = _auth()

    assert client.get(f"{BASE}/pages/99999/visual-project", cookies=cookies).status_code == 404


def test_visual_project_publish_materializes_sections_and_stores_published_project(
    client: TestClient, db_file: Path
) -> None:
    page_id = client.app.state.visual_test_page_id
    cookies, headers = _auth()
    project = client.get(f"{BASE}/pages/{page_id}/visual-project", cookies=cookies).json()["project"]
    project = _change_title(project, "Titre publié par GrapesJS")
    saved = client.put(
        f"{BASE}/pages/{page_id}/visual-project",
        cookies=cookies,
        headers=headers,
        json={"expected_version": 0, "project": project},
    )
    assert saved.status_code == 200

    published = client.post(
        f"{BASE}/pages/{page_id}/visual-project/publish",
        cookies=cookies,
        headers=headers,
        json={"expected_version": 1},
    )

    assert published.status_code == 200
    assert published.json()["draft_version"] == 2
    assert published.json()["revision_id"] > 0
    conn = db_module.connect(db_file)
    try:
        section = conn.execute("SELECT data, draft FROM sections WHERE page_id = ? AND type = 'chapter'", (page_id,)).fetchone()
        assert json.loads(section["data"])["title"] == "Titre publié par GrapesJS"
        assert section["draft"] is None
        row = conn.execute("SELECT draft_project_json, published_project_json FROM visual_projects WHERE page_id = ?", (page_id,)).fetchone()
        assert row["draft_project_json"] == row["published_project_json"]
        assert "Titre publié par GrapesJS" in row["published_project_json"]
        assert conn.execute("SELECT COUNT(*) FROM revisions WHERE entity_type = 'page' AND entity_id = ?", (page_id,)).fetchone()[0] == 1
    finally:
        conn.close()


def test_visual_publish_assigns_ids_to_new_sections_and_reopens_without_duplicates(
    client: TestClient, db_file: Path
) -> None:
    page_id = client.app.state.visual_test_page_id
    cookies, headers = _auth()
    project = client.get(f"{BASE}/pages/{page_id}/visual-project", cookies=cookies).json()["project"]
    components = project["project_data"]["pages"][0]["frames"][0]["component"]["components"]
    added = json.loads(json.dumps(components[0]))
    added["attributes"].pop("data-sjd-section-id", None)
    _find_field_component([added], "title")["content"] = "Section ajoutée"
    components.append(added)
    saved = client.put(
        f"{BASE}/pages/{page_id}/visual-project",
        cookies=cookies,
        headers=headers,
        json={"expected_version": 0, "project": project},
    )
    assert saved.status_code == 200

    published = client.post(
        f"{BASE}/pages/{page_id}/visual-project/publish",
        cookies=cookies,
        headers=headers,
        json={"expected_version": 1},
    )

    assert published.status_code == 200
    persisted = client.get(f"{BASE}/pages/{page_id}/visual-project", cookies=cookies).json()
    published_components = persisted["project"]["project_data"]["pages"][0]["frames"][0]["component"]["components"]
    assert len(published_components) == 4
    new_id = published_components[-1]["attributes"]["data-sjd-section-id"]
    assert int(new_id) > 0
    second_publish = client.post(
        f"{BASE}/pages/{page_id}/visual-project/publish",
        cookies=cookies,
        headers=headers,
        json={"expected_version": 2},
    )
    assert second_publish.status_code == 200
    conn = db_module.connect(db_file)
    try:
        assert conn.execute("SELECT COUNT(*) FROM sections WHERE page_id = ?", (page_id,)).fetchone()[0] == 4
        assert conn.execute("SELECT id FROM sections WHERE page_id = ? AND id = ?", (page_id, int(new_id))).fetchone()
    finally:
        conn.close()


def test_visual_publish_keeps_and_updates_all_supported_theme_sections(
    client: TestClient, db_file: Path
) -> None:
    page_id = client.app.state.visual_test_page_id
    conn = db_module.connect(db_file)
    try:
        conn.execute(
            "INSERT INTO sections (page_id, position, type, data, visible) VALUES (?, 3, 'faq', ?, 1)",
            (page_id, json.dumps({"title": "FAQ conservée", "items": []})),
        )
        conn.commit()
    finally:
        conn.close()
    cookies, headers = _auth()

    initial = client.get(f"{BASE}/pages/{page_id}/visual-project", cookies=cookies)
    assert initial.status_code == 200
    editable = initial.json()["project"]["project_data"]["pages"][0]["frames"][0]["component"]["components"]
    assert len(editable) == 4
    changed = _change_title(initial.json()["project"], "Chapitre modifié")
    added = json.loads(json.dumps(changed["project_data"]["pages"][0]["frames"][0]["component"]["components"][0]))
    added["attributes"].pop("data-sjd-section-id", None)
    _find_field_component([added], "title")["content"] = "Nouveau chapitre"
    added_data = json.loads(added["attributes"]["data-sjd-data"])
    added_data["title"] = "Nouveau chapitre"
    added["attributes"]["data-sjd-data"] = json.dumps(added_data, ensure_ascii=False)
    changed["project_data"]["pages"][0]["frames"][0]["component"]["components"].append(added)
    assert client.put(
        f"{BASE}/pages/{page_id}/visual-project",
        cookies=cookies,
        headers=headers,
        json={"expected_version": 0, "project": changed},
    ).status_code == 200
    published = client.post(
        f"{BASE}/pages/{page_id}/visual-project/publish",
        cookies=cookies,
        headers=headers,
        json={"expected_version": 1},
    )
    assert published.status_code == 200

    conn = db_module.connect(db_file)
    try:
        rows = conn.execute("SELECT type, position, data FROM sections WHERE page_id = ? ORDER BY position", (page_id,)).fetchall()
        assert [row["type"] for row in rows] == ["chapter", "image-pleine-largeur", "citation", "faq", "chapter"]
        assert [row["position"] for row in rows] == [0, 1, 2, 3, 4]
        faq_data = json.loads(rows[3]["data"])
        assert faq_data["title"] == "FAQ conservée"
        assert faq_data["items"] == []
        assert json.loads(rows[0]["data"])["title"] == "Chapitre modifié"
        assert json.loads(rows[4]["data"])["title"] == "Nouveau chapitre"
    finally:
        conn.close()


@pytest.mark.parametrize("publish_standard_draft", [False, True])
def test_visual_publish_rejects_page_changes_from_the_standard_editor(
    client: TestClient, db_file: Path, publish_standard_draft: bool
) -> None:
    page_id = client.app.state.visual_test_page_id
    cookies, headers = _auth()
    visual = client.get(f"{BASE}/pages/{page_id}/visual-project", cookies=cookies).json()["project"]
    visual = _change_title(visual, "Titre visuel dépassé")
    saved = client.put(
        f"{BASE}/pages/{page_id}/visual-project",
        cookies=cookies,
        headers=headers,
        json={"expected_version": 0, "project": visual},
    )
    assert saved.status_code == 200

    conn = db_module.connect(db_file)
    try:
        section_id = conn.execute(
            "SELECT id FROM sections WHERE page_id = ? AND type = 'chapter'", (page_id,)
        ).fetchone()["id"]
    finally:
        conn.close()
    edited = client.patch(
        f"{BASE}/pages/{page_id}/sections/{section_id}",
        cookies=cookies,
        headers=headers,
        json={"field": "title", "value": "Titre du back office", "expected_version": 0},
    )
    assert edited.status_code == 200
    if publish_standard_draft:
        assert client.post(f"{BASE}/pages/{page_id}/publish", cookies=cookies, headers=headers).status_code == 200

    published = client.post(
        f"{BASE}/pages/{page_id}/visual-project/publish",
        cookies=cookies,
        headers=headers,
        json={"expected_version": 1},
    )

    assert published.status_code == 409
    assert published.json()["error"]["rule"] == "source_changed"
    conn = db_module.connect(db_file)
    try:
        section = conn.execute("SELECT data, draft FROM sections WHERE id = ?", (section_id,)).fetchone()
        assert json.loads(section["data"])["title"] == (
            "Titre du back office" if publish_standard_draft else "Titre publié"
        )
        assert (json.loads(section["draft"])["title"] if section["draft"] else None) == (
            None if publish_standard_draft else "Titre du back office"
        )
    finally:
        conn.close()


def test_visual_project_rebase_preserves_standard_editor_changes(client: TestClient, db_file: Path) -> None:
    page_id = client.app.state.visual_test_page_id
    cookies, headers = _auth()
    visual = client.get(f"{BASE}/pages/{page_id}/visual-project", cookies=cookies).json()["project"]
    visual = _change_title(visual, "Brouillon visuel obsolète")
    assert client.put(
        f"{BASE}/pages/{page_id}/visual-project",
        cookies=cookies,
        headers=headers,
        json={"expected_version": 0, "project": visual},
    ).status_code == 200

    conn = db_module.connect(db_file)
    try:
        section_id = conn.execute(
            "SELECT id FROM sections WHERE page_id = ? AND type = 'chapter'", (page_id,)
        ).fetchone()["id"]
    finally:
        conn.close()
    standard = client.patch(
        f"{BASE}/pages/{page_id}/sections/{section_id}",
        cookies=cookies,
        headers=headers,
        json={"field": "title", "value": "Brouillon classique conservé", "expected_version": 0},
    )
    assert standard.status_code == 200
    conflict = client.post(
        f"{BASE}/pages/{page_id}/visual-project/publish",
        cookies=cookies,
        headers=headers,
        json={"expected_version": 1},
    )
    assert conflict.status_code == 409
    assert conflict.json()["error"]["rule"] == "source_changed"

    rebased = client.post(
        f"{BASE}/pages/{page_id}/visual-project/rebase",
        cookies=cookies,
        headers=headers,
        json={"expected_version": 1},
    )
    assert rebased.status_code == 200
    assert rebased.json()["draft_version"] == 2
    assert "Brouillon classique conservé" in json.dumps(rebased.json()["project"], ensure_ascii=False)
    published = client.post(
        f"{BASE}/pages/{page_id}/visual-project/publish",
        cookies=cookies,
        headers=headers,
        json={"expected_version": 2},
    )
    assert published.status_code == 200

    conn = db_module.connect(db_file)
    try:
        section = conn.execute("SELECT data, draft FROM sections WHERE id = ?", (section_id,)).fetchone()
        assert json.loads(section["data"])["title"] == "Brouillon classique conservé"
        assert section["draft"] is None
    finally:
        conn.close()


def test_publish_with_a_stale_project_version_keeps_draft_and_public_data(client: TestClient, db_file: Path) -> None:
    page_id = client.app.state.visual_test_page_id
    cookies, headers = _auth()
    project = client.get(f"{BASE}/pages/{page_id}/visual-project", cookies=cookies).json()["project"]
    client.put(
        f"{BASE}/pages/{page_id}/visual-project",
        cookies=cookies,
        headers=headers,
        json={"expected_version": 0, "project": _change_title(project, "En attente")},
    )

    stale = client.post(
        f"{BASE}/pages/{page_id}/visual-project/publish",
        cookies=cookies,
        headers=headers,
        json={"expected_version": 0},
    )

    assert stale.status_code == 409
    conn = db_module.connect(db_file)
    try:
        section = conn.execute("SELECT data FROM sections WHERE page_id = ? AND type = 'chapter'", (page_id,)).fetchone()
        assert json.loads(section["data"])["title"] == "Titre publié"
    finally:
        conn.close()


def _legacy_project_for_page(client: TestClient, page_id: int, cookies: dict[str, str]) -> dict[str, Any]:
    project = client.get(f"{BASE}/pages/{page_id}/visual-project", cookies=cookies).json()["project"]
    project["theme_version"] = 1
    components = project["project_data"]["pages"][0]["frames"][0]["component"]["components"]
    for component in components:
        component["attributes"].pop("data-sjd-data", None)
    return project


def test_visual_project_get_migrates_v1_draft_after_validation(client: TestClient, db_file: Path) -> None:
    page_id = client.app.state.visual_test_page_id
    cookies, _ = _auth()
    legacy = _legacy_project_for_page(client, page_id, cookies)
    conn = db_module.connect(db_file)
    try:
        encoded = json.dumps(legacy, ensure_ascii=False)
        conn.execute(
            "UPDATE visual_projects SET draft_project_json = ?, published_project_json = ?, draft_version = 7, theme_version = 1 WHERE page_id = ?",
            (encoded, encoded, page_id),
        )
        conn.commit()
    finally:
        conn.close()

    response = client.get(f"{BASE}/pages/{page_id}/visual-project", cookies=cookies)

    assert response.status_code == 200
    assert response.json()["theme_version"] == THEME_VERSION == 6
    assert response.json()["draft_version"] == 7
    migrated = response.json()["project"]
    assert migrated["theme_version"] == 6
    assert [item["attributes"]["data-sjd-section"] for item in migrated["project_data"]["pages"][0]["frames"][0]["component"]["components"]] == [
        "chapter", "image-pleine-largeur", "citation"
    ]
    conn = db_module.connect(db_file)
    try:
        row = conn.execute("SELECT draft_project_json, published_project_json, theme_version, draft_version FROM visual_projects WHERE page_id = ?", (page_id,)).fetchone()
        assert json.loads(row["draft_project_json"])["theme_version"] == 6
        assert json.loads(row["published_project_json"])["theme_version"] == 6
        assert row["theme_version"] == 6 and row["draft_version"] == 7
    finally:
        conn.close()


def test_failed_project_migration_keeps_both_json_columns_unchanged(client: TestClient, db_file: Path) -> None:
    page_id = client.app.state.visual_test_page_id
    cookies, _ = _auth()
    legacy = _legacy_project_for_page(client, page_id, cookies)
    legacy["project_data"]["pages"][0]["frames"][0]["component"]["components"][0]["type"] = "not-allowed"
    conn = db_module.connect(db_file)
    try:
        draft = json.dumps(legacy, ensure_ascii=False)
        published = json.dumps(_legacy_project_for_page(client, page_id, cookies), ensure_ascii=False)
        conn.execute(
            "UPDATE visual_projects SET draft_project_json = ?, published_project_json = ?, draft_version = 4, theme_version = 1 WHERE page_id = ?",
            (draft, published, page_id),
        )
        conn.commit()
    finally:
        conn.close()

    response = client.get(f"{BASE}/pages/{page_id}/visual-project", cookies=cookies)

    assert response.status_code == 409
    conn = db_module.connect(db_file)
    try:
        row = conn.execute("SELECT draft_project_json, published_project_json, theme_version, draft_version FROM visual_projects WHERE page_id = ?", (page_id,)).fetchone()
        assert row["draft_project_json"] == draft
        assert row["published_project_json"] == published
        assert row["theme_version"] == 1 and row["draft_version"] == 4
    finally:
        conn.close()


def test_publish_all_nineteen_types_is_atomic_and_ordered(client: TestClient, db_file: Path) -> None:
    page_id = client.app.state.visual_test_page_id
    conn = db_module.connect(db_file)
    try:
        conn.execute("DELETE FROM sections WHERE page_id = ?", (page_id,))
        ids = {}
        for position, block in enumerate(DEFAULT_BLOCKS.values()):
            data = sample_data(block)
            variant = data.get("_variant", "")
            cursor = conn.execute(
                "INSERT INTO sections (page_id, position, type, variant, label, visible, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (page_id, position, block.name, variant, block.label, int(position % 2 == 0), json.dumps(data, ensure_ascii=False)),
            )
            ids[block.name] = int(cursor.lastrowid)
        conn.commit()
    finally:
        conn.close()
    cookies, headers = _auth()
    response = client.get(f"{BASE}/pages/{page_id}/visual-project", cookies=cookies)
    assert response.status_code == 200
    project = response.json()["project"]
    components = project["project_data"]["pages"][0]["frames"][0]["component"]["components"]
    assert [component["attributes"]["data-sjd-section"] for component in components] == list(DEFAULT_BLOCKS)
    hero = next(item for item in components if item["attributes"]["data-sjd-section"] == "hero")
    data = json.loads(hero["attributes"]["data-sjd-data"])
    data["title"] = "Contenu complet publié"
    hero["attributes"]["data-sjd-data"] = json.dumps(data, ensure_ascii=False)
    saved = client.put(
        f"{BASE}/pages/{page_id}/visual-project", cookies=cookies, headers=headers,
        json={"expected_version": 0, "project": project},
    )
    assert saved.status_code == 200
    published = client.post(
        f"{BASE}/pages/{page_id}/visual-project/publish", cookies=cookies, headers=headers,
        json={"expected_version": 1},
    )

    assert published.status_code == 200
    conn = db_module.connect(db_file)
    try:
        rows = conn.execute("SELECT id, type, position, data FROM sections WHERE page_id = ? ORDER BY position", (page_id,)).fetchall()
        assert [row["type"] for row in rows] == list(DEFAULT_BLOCKS)
        assert [row["position"] for row in rows] == list(range(20))
        assert {row["type"]: int(row["id"]) for row in rows} == ids
        assert json.loads(rows[0]["data"])["title"] == "Contenu complet publié"
        stored = conn.execute("SELECT draft_project_json, published_project_json FROM visual_projects WHERE page_id = ?", (page_id,)).fetchone()
        assert stored["draft_project_json"] == stored["published_project_json"]
    finally:
        conn.close()
