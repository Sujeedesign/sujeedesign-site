"""Back office : authentification, CRUD, médias, protection des écritures."""

from __future__ import annotations

import io
import json

import pytest
from fastapi.testclient import TestClient

from app.db import connect

PASSWORD = "mot-de-passe-de-test"


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


def test_revisions_are_restorable(client: TestClient) -> None:
    login(client)
    page_id = client.post("/api/admin/pages", json={"title": "Version un"}).json()["id"]
    client.patch(f"/api/admin/pages/{page_id}", json={"title": "Version deux"})
    revisions = client.get(f"/api/admin/revisions?entity_type=page&entity_id={page_id}").json()["revisions"]
    assert revisions, "aucune révision enregistrée"
    restored = client.post(f"/api/admin/revisions/{revisions[0]['id']}/restaurer", json={}).json()
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
    assert client.get(payload["path"]).status_code == 200
    conn = connect(db_file)
    try:
        row = conn.execute("SELECT * FROM medias WHERE id = ?", (payload["id"],)).fetchone()
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
