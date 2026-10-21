"""Back office : authentification, CRUD, médias, protection des écritures."""

from __future__ import annotations

import io
import json

import pytest
from fastapi.testclient import TestClient

from app import security
from app.db import connect
from sujee_editor.tokens import make_csrf

PASSWORD = "mot-de-passe-de-test"


def _csrf(client: TestClient) -> str:
    return make_csrf(client.app.state.editor.session_secret)


def login(client: TestClient) -> TestClient:
    response = client.post("/admin/connexion", data={"password": PASSWORD, "code": ""}, follow_redirects=False)
    assert response.status_code == 303, response.text
    return client


def test_admin_requires_login(client: TestClient) -> None:
    response = client.get("/admin", follow_redirects=False)
    assert response.status_code == 303
    assert response.headers["location"] == "/admin/connexion"


def test_login_rejects_wrong_password(client: TestClient) -> None:
    response = client.post("/admin/connexion", data={"password": "mauvais", "code": ""})
    assert response.status_code == 200
    assert "Mot de passe incorrect" in response.text
    assert client.get("/admin", follow_redirects=False).status_code == 303


def test_login_sets_session_cookie(client: TestClient) -> None:
    login(client)
    response = client.get("/admin")
    assert response.status_code == 200
    assert "Tableau de bord" in response.text


def test_api_requires_auth(client: TestClient) -> None:
    assert client.get("/api/admin/schema").status_code == 401
    assert client.post("/api/admin/pages", json={"title": "Pirate"}).status_code == 401


def test_write_from_other_origin_is_refused(client: TestClient) -> None:
    login(client)
    response = client.post("/api/admin/pages", json={"title": "X"}, headers={"origin": "https://evil.example", "host": "sujeedesign.com"})
    assert response.status_code == 403


def test_schema_lists_section_types(client: TestClient) -> None:
    login(client)
    data = client.get("/api/admin/schema").json()
    assert "hero" in data["types"]
    assert "cta-final" in data["types"]
    assert any(field["name"] == "title" for field in data["types"]["hero"]["fields"])


def test_admin_page_route_renders_grapesjs_without_classic_section_controls(client: TestClient) -> None:
    login(client)
    page_id = client.post("/api/admin/pages", json={"title": "Édition visuelle"}).json()["id"]
    response = client.get(f"/admin/pages/{page_id}")
    assert response.status_code == 200
    assert 'id="visual-config"' in response.text
    assert "/assets/editor/visual/visual-editor.js" in response.text
    assert 'id="sectionList"' not in response.text
    assert 'id="newSectionType"' not in response.text
    assert 'id="pageForm"' not in response.text


def test_visual_route_redirects_to_canonical_page_editor(client: TestClient) -> None:
    login(client)
    page_id = client.post("/api/admin/pages", json={"title": "Page redirigée"}).json()["id"]
    response = client.get(f"/admin/visual/{page_id}", follow_redirects=False)
    assert response.status_code == 303
    assert response.headers["location"] == f"/admin/pages/{page_id}"


def test_pages_module_can_change_page_status(client: TestClient) -> None:
    login(client)
    page_id = client.post("/api/admin/pages", json={"title": "Page à publier"}).json()["id"]
    response = client.get("/admin/pages")
    assert f'data-page="{page_id}"' in response.text
    assert 'data-status="publie"' in response.text


def test_non_page_admin_modules_still_render(client: TestClient) -> None:
    login(client)
    for path in ("/admin/medias", "/admin/messages", "/admin/reglages", "/admin/sauvegarde"):
        response = client.get(path)
        assert response.status_code == 200, path


def test_page_lifecycle(client: TestClient) -> None:
    login(client)
    created = client.post("/api/admin/pages", json={"title": "Nouvelle réalisation", "kind": "realisation"}).json()
    page_id = created["id"]
    assert created["slug"] == "nouvelle-realisation"

    detail = client.get(f"/api/admin/pages/{page_id}").json()
    assert detail["page"]["kind"] == "realisation"
    assert len(detail["sections"]) == 1

    updated = client.patch(
        f"/api/admin/pages/{page_id}",
        json={"title": "Réalisation renommée", "excerpt": "Accroche", "categories": ["Identité", "Web"], "seo_title": "Titre SEO"},
        headers={"X-SJD-CSRF": _csrf(client)},
    ).json()
    assert updated["page"]["title"] == "Réalisation renommée"
    assert updated["page"]["categories"] == ["Identité", "Web"]

    published = client.post(f"/api/admin/pages/{page_id}/statut", json={"status": "publie"}).json()
    assert published["status"] == "publie"
    assert f"/realisations/{created['slug']}" in client.get("/sitemap.xml").text

    duplicate = client.post(f"/api/admin/pages/{page_id}/dupliquer", json={}).json()
    assert duplicate["slug"].startswith("nouvelle-realisation-copie") or duplicate["slug"] == "nouvelle-realisation-copie"

    assert client.delete(f"/api/admin/pages/{page_id}").json()["ok"] is True
    assert client.get(f"/api/admin/pages/{page_id}").status_code == 404


def test_section_lifecycle_and_order(client: TestClient) -> None:
    login(client)
    page_id = client.post("/api/admin/pages", json={"title": "Page test"}).json()["id"]
    first = client.post(f"/api/admin/pages/{page_id}/sections", json={"type": "chapter"}).json()["id"]
    second = client.post(f"/api/admin/pages/{page_id}/sections", json={"type": "faq"}).json()["id"]

    sections = client.get(f"/api/admin/pages/{page_id}/sections").json()["sections"]
    assert [section["type"] for section in sections] == ["hero", "chapter", "faq"]

    client.patch(f"/api/admin/sections/{second}", json={"data": {"title": "Questions fréquentes", "items": [{"q": "Prix ?", "a": "Sur devis"}]}})
    updated = client.get(f"/api/admin/pages/{page_id}/sections").json()["sections"][-1]
    assert updated["data"]["title"] == "Questions fréquentes"
    assert updated["data"]["items"][0]["q"] == "Prix ?"

    client.post(f"/api/admin/sections/{second}/deplacer", json={"offset": -1})
    order = [section["type"] for section in client.get(f"/api/admin/pages/{page_id}/sections").json()["sections"]]
    assert order == ["hero", "faq", "chapter"]

    duplicated = client.post(f"/api/admin/sections/{second}/dupliquer", json={}).json()
    assert duplicated["ok"] is True

    client.patch(f"/api/admin/sections/{first}", json={"visible": 0})
    hidden = [s for s in client.get(f"/api/admin/pages/{page_id}/sections").json()["sections"] if s["id"] == first][0]
    assert hidden["visible"] == 0

    assert client.delete(f"/api/admin/sections/{first}").json()["ok"] is True


def test_zone_free_legacy_section_api_rejects_invalid_layout_data(client: TestClient) -> None:
    login(client)
    page_id = client.post("/api/admin/pages", json={"title": "Zone contrôlée"}).json()["id"]
    section_id = client.post(f"/api/admin/pages/{page_id}/sections", json={"type": "zone-libre"}).json()["id"]
    original = client.get(f"/api/admin/pages/{page_id}/sections").json()["sections"][-1]["data"]

    response = client.patch(
        f"/api/admin/sections/{section_id}",
        json={"data": {"background_image": "https://example.com/remote.webp"}},
        headers={"Origin": "http://testserver", "X-SJD-CSRF": _csrf(client)},
    )

    assert response.status_code == 400
    saved = client.get(f"/api/admin/pages/{page_id}/sections").json()["sections"][-1]["data"]
    assert saved == original


def test_revisions_are_restorable(client: TestClient) -> None:
    login(client)
    page_id = client.post("/api/admin/pages", json={"title": "Version un"}).json()["id"]
    client.patch(f"/api/admin/pages/{page_id}", json={"title": "Version deux"}, headers={"X-SJD-CSRF": _csrf(client)})
    revisions = client.get(f"/api/admin/revisions?entity_type=page&entity_id={page_id}").json()["revisions"]
    assert revisions, "aucune révision enregistrée"
    restored = client.post(
        f"/api/admin/revisions/{revisions[0]['id']}/restaurer",
        headers={"Origin": "http://testserver", "X-SJD-CSRF": _csrf(client)},
        json={"expected_visual_version": 0, "confirm_discard_draft": True},
    ).json()
    assert restored["ok"] is True


def test_upload_registers_media(client: TestClient, db_file) -> None:
    login(client)
    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (40, 30), (10, 10, 10)).save(buffer, format="PNG")
    buffer.seek(0)
    response = client.post(
        "/api/admin/medias",
        files={"file": ("visuel.png", buffer, "image/png")},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["path"].startswith("/medias/")
    assert payload["original_filename"] == "visuel.png"
    assert client.get(payload["path"]).status_code == 200
    conn = connect(db_file)
    try:
        row = conn.execute("SELECT * FROM medias WHERE id = ?", (payload["id"],)).fetchone()
        assert row["original_filename"] == "visuel.png"
        assert row["width"] == 40 and row["height"] == 30
    finally:
        conn.close()


def test_upload_rejects_other_extensions(client: TestClient) -> None:
    login(client)
    response = client.post("/api/admin/medias", files={"file": ("script.sh", b"#!/bin/sh", "text/plain")})
    assert response.status_code == 400


@pytest.fixture()
def accueil(client: TestClient) -> TestClient:
    """Le site public ne rend une page d'accueil que si elle existe et est publiée."""
    login(client)
    created = client.post("/api/admin/pages", json={"title": "Accueil", "kind": "accueil", "slug": "accueil"}).json()
    client.post(f"/api/admin/pages/{created['id']}/statut", json={"status": "publie"})
    return client


def test_settings_can_be_saved(accueil: TestClient) -> None:
    client = accueil
    assert client.post("/api/admin/reglages", json={"tagline": "Nouvelle signature", "city": "Paris"}).json()["ok"] is True
    data = client.get("/api/admin/reglages").json()["reglages"]
    assert data["tagline"] == "Nouvelle signature"
    assert "Nouvelle signature" in client.get("/").text


def test_redirects_crud(client: TestClient) -> None:
    login(client)
    assert client.post("/api/admin/redirections", json={"path": "/vieux.html", "target": "/nouveau"}).json()["ok"] is True
    assert client.get("/vieux.html", follow_redirects=False).status_code == 301
    assert client.request("DELETE", "/api/admin/redirections", params={"path": "/vieux.html"}).json()["ok"] is True
    assert client.get("/vieux.html").status_code == 404


def test_export_contains_pages(client: TestClient) -> None:
    login(client)
    client.post("/api/admin/pages", json={"title": "Exportable"})
    response = client.get("/api/admin/export")
    assert response.status_code == 200
    payload = json.loads(response.text)
    assert any(page["slug"] == "exportable" for page in payload["pages"])


def test_rejects_paths_outside_slash(client: TestClient) -> None:
    login(client)
    response = client.post("/api/admin/redirections", json={"path": "vieux", "target": "/x"})
    assert response.status_code == 400


def test_preview_shows_draft_page(client: TestClient) -> None:
    login(client)
    page_id = client.post("/api/admin/pages", json={"title": "Page en brouillon"}).json()["id"]
    preview = client.get(f"/admin/apercu/{page_id}")
    assert preview.status_code == 200
    assert "Aperçu du brouillon" in preview.text
    assert preview.headers.get("x-robots-tag") == "noindex"
    assert client.get("/page-en-brouillon").status_code == 404


@pytest.mark.parametrize("path", ["/admin/pages", "/admin/medias", "/admin/messages", "/admin/reglages", "/admin/sauvegarde"])
def test_admin_screens_render(client: TestClient, path: str) -> None:
    login(client)
    response = client.get(path)
    assert response.status_code == 200
    assert "admin-nav" in response.text


def _saved_visual_revision(client: TestClient, title: str = "Nouveau titre") -> tuple[int, int, dict[str, str]]:
    login(client)
    page_id = client.post("/api/admin/pages", json={"title": "Titre original"}).json()["id"]
    client.patch(f"/api/admin/pages/{page_id}", json={"title": title}, headers={"X-SJD-CSRF": _csrf(client)})
    revisions = client.get(f"/api/admin/revisions?entity_type=page&entity_id={page_id}").json()["revisions"]
    revision_id = revisions[0]["id"]
    cookies = {security.SESSION_COOKIE: client.cookies[security.SESSION_COOKIE]}
    editor_url = f"/api/editor/pages/{page_id}/visual-project"
    project = client.get(editor_url, cookies=cookies).json()["project"]
    sections = project["project_data"]["pages"][0]["frames"][0]["component"]["components"]
    hero = next(section for section in sections if section["attributes"]["data-sjd-section"] == "hero")
    data = json.loads(hero["attributes"]["data-sjd-data"])
    data["title"] = "Brouillon visuel"
    hero["attributes"]["data-sjd-data"] = json.dumps(data, ensure_ascii=False)
    headers = {"Origin": "http://testserver", "X-SJD-CSRF": security.make_token("editor")}
    saved = client.put(editor_url, cookies=cookies, headers=headers, json={"expected_version": 0, "project": project})
    assert saved.status_code == 200
    return page_id, revision_id, cookies


def test_revision_restore_requires_csrf(client: TestClient) -> None:
    page_id, revision_id, cookies = _saved_visual_revision(client)
    response = client.post(
        f"/api/admin/revisions/{revision_id}/restaurer",
        cookies=cookies,
        headers={"Origin": "http://testserver"},
        json={"expected_visual_version": 1, "confirm_discard_draft": True},
    )
    assert response.status_code == 403
    assert client.get(f"/api/admin/pages/{page_id}", cookies=cookies).json()["page"]["title"] == "Nouveau titre"


def test_restore_with_unsaved_visual_draft_requires_confirmation(client: TestClient) -> None:
    page_id, revision_id, cookies = _saved_visual_revision(client)
    headers = {"Origin": "http://testserver", "X-SJD-CSRF": security.make_token("editor")}

    response = client.post(
        f"/api/admin/revisions/{revision_id}/restaurer",
        cookies=cookies,
        headers=headers,
        json={"expected_visual_version": 1, "confirm_discard_draft": False},
    )

    assert response.status_code == 409
    assert client.get(f"/api/admin/pages/{page_id}", cookies=cookies).json()["page"]["title"] == "Nouveau titre"


def test_confirmed_restore_updates_sections_and_visual_project_atomically(client: TestClient) -> None:
    page_id, revision_id, cookies = _saved_visual_revision(client)
    headers = {"Origin": "http://testserver", "X-SJD-CSRF": security.make_token("editor")}

    response = client.post(
        f"/api/admin/revisions/{revision_id}/restaurer",
        cookies=cookies,
        headers=headers,
        json={"expected_visual_version": 1, "confirm_discard_draft": True},
    )

    assert response.status_code == 200
    assert response.json()["visual_draft_version"] == 2
    detail = client.get(f"/api/admin/pages/{page_id}", cookies=cookies).json()
    assert detail["page"]["title"] == "Titre original"
    assert detail["sections"][0]["data"]["title"] != "Brouillon visuel"
    conn = connect(client.app.state.db_path)
    try:
        row = conn.execute("SELECT draft_version, draft_project_json, published_project_json FROM visual_projects WHERE page_id = ?", (page_id,)).fetchone()
        assert row["draft_version"] == 2
        assert row["draft_project_json"] == row["published_project_json"]
        project = json.loads(row["draft_project_json"])
        assert "Titre original" in json.dumps(project, ensure_ascii=False)
        assert "Brouillon visuel" not in json.dumps(project, ensure_ascii=False)
    finally:
        conn.close()


def test_export_includes_draft_and_published_visual_project(client: TestClient) -> None:
    login(client)
    page_id = client.post("/api/admin/pages", json={"title": "Export visuel"}).json()["id"]
    client.get(f"/admin/visual/{page_id}")

    payload = client.get("/api/admin/export").json()
    page = next(item for item in payload["pages"] if item["id"] == page_id)

    assert page["sections"]
    assert set(page["visual_project"]) == {
        "schema_version", "theme_id", "theme_version", "draft_version", "draft_project", "published_project"
    }
    assert page["visual_project"]["theme_version"] == 7
