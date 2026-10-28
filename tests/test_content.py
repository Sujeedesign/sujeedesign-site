"""Contenu du site : API de lecture, formulaire admin, publication."""

from __future__ import annotations

import json
import re

import pytest
from fastapi.testclient import TestClient

from app import content as content_store
from app import admin
from app import content_model
from app.db import connect

PASSWORD = "mot-de-passe-de-test"


def _csrf(client: TestClient, path: str = "/admin/contenu") -> str:
    html = client.get(path).text
    match = re.search(r'name="csrf" value="([^"]+)"', html)
    assert match, f"aucun jeton CSRF sur {path}"
    return match.group(1)


def login(client: TestClient) -> TestClient:
    response = client.post("/admin/connexion", data={"password": PASSWORD}, follow_redirects=False)
    assert response.status_code == 303, response.text
    return client


# ------------------------------------------------------------------ API lecture


def test_content_api_is_public_and_returns_defaults(client: TestClient) -> None:
    response = client.get("/api/v1/content/home")
    assert response.status_code == 200
    payload = response.json()
    assert payload["slug"] == "home"
    hero = payload["data"]["hero"]
    assert hero["title"]["first"]
    assert payload["custom"] is False
    assert payload["schema"], "le formulaire doit recevoir la description des champs"


def test_content_api_rejects_unknown_slug(client: TestClient) -> None:
    response = client.get("/api/v1/content/tarifs")
    assert response.status_code == 404
    assert response.json()["detail"] == "contenu inconnu"


def test_content_api_never_leaks_the_session_cookie(client: TestClient) -> None:
    login(client)
    response = client.get("/api/v1/content/home")
    assert "set-cookie" not in response.headers


# ------------------------------------------------------------------ écran admin


def test_content_screen_requires_login(client: TestClient) -> None:
    response = client.get("/admin/contenu", follow_redirects=False)
    assert response.status_code == 303
    assert response.headers["location"] == "/admin/connexion"


def test_content_screen_lists_every_section(client: TestClient) -> None:
    login(client)
    response = client.get("/admin/contenu")
    assert response.status_code == 200
    assert ">Accueil<" in response.text
    for section in content_model.schema_for("home"):
        assert section["label"] in response.text
    assert 'name="csrf"' in response.text


def test_content_screen_says_when_publication_is_not_configured(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("COOLIFY_TOKEN", raising=False)
    login(client)
    response = client.get("/admin/contenu")
    assert "disabled" in response.text


# ------------------------------------------------------------------ enregistrement


def test_save_then_read_back(client: TestClient, db_file) -> None:
    login(client)
    response = client.post(
        "/admin/contenu",
        data={"csrf": _csrf(client), "action": "save", "f_hero.kicker": "Nouvelle accroche"},
        follow_redirects=False,
    )
    assert response.status_code == 303
    assert response.headers["location"].startswith("/admin/contenu")
    payload = client.get("/api/v1/content/home").json()
    assert payload["data"]["hero"]["kicker"] == "Nouvelle accroche"
    assert payload["custom"] is True

    connection = connect(db_file)
    stored = content_store.stored_doc(connection, "home")
    connection.close()
    assert stored is not None and stored["data"]["hero"]["kicker"] == "Nouvelle accroche"


def test_save_keeps_fields_absent_from_the_form(client: TestClient) -> None:
    login(client)
    before = client.get("/api/v1/content/home").json()["data"]
    client.post(
        "/admin/contenu",
        data={"csrf": _csrf(client), "action": "save", "f_hero.title.first": "Autre"},
        follow_redirects=False,
    )
    after = client.get("/api/v1/content/home").json()["data"]
    assert after["hero"]["title"]["first"] == "Autre"
    assert after["studio"] == before["studio"]


def test_blank_required_field_is_refused_without_writing(client: TestClient, db_file) -> None:
    login(client)
    response = client.post(
        "/admin/contenu",
        data={"csrf": _csrf(client), "action": "save", "f_hero.kicker": "   "},
        follow_redirects=False,
    )
    assert response.status_code == 200
    assert "erreur" in response.text.lower() or "refus" in response.text.lower()
    connection = connect(db_file)
    assert content_store.stored_doc(connection, "home") is None
    connection.close()


def test_save_requires_csrf(client: TestClient) -> None:
    login(client)
    response = client.post(
        "/admin/contenu",
        data={"csrf": "faux", "action": "save", "f_hero.kicker": "pirate"},
        follow_redirects=False,
    )
    assert response.status_code == 403


# ------------------------------------------------------------------ publication


def test_publish_without_token_reports_the_problem(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, db_file
) -> None:
    monkeypatch.delenv("COOLIFY_TOKEN", raising=False)
    login(client)
    response = client.post("/admin/contenu/publier", data={"csrf": _csrf(client)}, follow_redirects=False)
    assert response.status_code == 303
    connection = connect(db_file)
    assert content_store.last_publication(connection) is None
    connection.close()


def test_publish_triggers_a_coolify_deployment(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, db_file
) -> None:
    monkeypatch.setenv("COOLIFY_TOKEN", "jeton-de-test")
    calls: list[tuple[str, str]] = []

    def fake_coolify(path: str, method: str = "GET", payload=None):
        calls.append((method, path))
        return {"deployments": [{"deployment_uuid": "dep-123"}]}

    monkeypatch.setattr(content_store, "_coolify", fake_coolify)
    login(client)
    response = client.post("/admin/contenu/publier", data={"csrf": _csrf(client)}, follow_redirects=False)
    assert response.status_code == 303
    assert calls and calls[0][0] == "POST"
    assert "uuid=" in calls[0][1]
    connection = connect(db_file)
    entry = content_store.last_publication(connection)
    connection.close()
    assert entry is not None
    assert entry["status"] == "lancee"
    assert entry["deployment"] == "dep-123"


def test_save_and_publish_in_one_submit(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, db_file
) -> None:
    monkeypatch.setenv("COOLIFY_TOKEN", "jeton-de-test")
    monkeypatch.setattr(
        content_store, "_coolify", lambda *a, **k: {"deployments": [{"deployment_uuid": "dep-9"}]}
    )
    login(client)
    response = client.post(
        "/admin/contenu",
        data={"csrf": _csrf(client), "action": "publier", "f_hero.kicker": "Publié"},
        follow_redirects=False,
    )
    assert response.status_code == 303
    assert client.get("/api/v1/content/home").json()["data"]["hero"]["kicker"] == "Publié"
    connection = connect(db_file)
    assert content_store.last_publication(connection)["deployment"] == "dep-9"
    connection.close()


def test_failed_publication_is_recorded(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, db_file
) -> None:
    monkeypatch.setenv("COOLIFY_TOKEN", "jeton-de-test")

    def boom(*args, **kwargs):
        raise RuntimeError("coolify indisponible")

    monkeypatch.setattr(content_store, "_coolify", boom)
    login(client)
    response = client.post("/admin/contenu/publier", data={"csrf": _csrf(client)}, follow_redirects=False)
    assert response.status_code == 303
    connection = connect(db_file)
    entry = content_store.last_publication(connection)
    connection.close()
    assert entry["status"] == "echec"
    assert "coolify indisponible" in entry["detail"]


# ------------------------------------------------------------------ modèle


def test_form_roundtrip_preserves_the_default_document() -> None:
    default = content_model.load_defaults()
    sections = content_model.form_sections("home", default)
    form: dict[str, str] = {}
    for section in sections:
        for block in section["blocks"]:
            for field in block["fields"]:
                form[f"f_{field['path']}"] = str(field["value"])
    rebuilt = content_model.from_form("home", form, default)
    assert rebuilt["hero"] == default["hero"]
    assert rebuilt["studio"]["stats"] == default["studio"]["stats"]
    assert len(form) > 50


def test_defaults_file_is_valid_json() -> None:
    payload = json.loads(content_model.defaults_path().read_text(encoding="utf-8"))
    assert payload["hero"]["title"]["highlight"]


# ---------------------------------------------------------------- pages du site


def test_pages_screen_lists_editable_pages(client: TestClient) -> None:
    login(client)
    response = client.get("/admin/pages")
    assert response.status_code == 200
    for slug, label, path in admin.PAGES:
        assert label in response.text
        assert f"/admin/contenu?page={slug}" in response.text
    # les présentations projet ne sont pas éditables en place
    assert "/realisations/" not in response.text


def test_inner_page_can_be_edited_by_form(client: TestClient) -> None:
    login(client)
    page = client.get("/admin/contenu?page=services")
    assert page.status_code == 200
    assert 'name="page" value="services"' in page.text

    response = client.post(
        "/admin/contenu",
        data={
            "csrf": _csrf(client, "/admin/contenu?page=services"),
            "page": "services",
            "action": "save",
            "f_hero.kicker": "Services · test",
        },
        follow_redirects=False,
    )
    assert response.status_code == 303
    assert response.headers["location"].startswith("/admin/contenu?page=services")

    payload = client.get("/api/v1/content/services").json()
    assert payload["data"]["hero"]["kicker"] == "Services · test"
    assert payload["data"]["hero"]["title"][0] == "Cinq métiers,"
    # l'accueil n'a pas bougé
    home = client.get("/api/v1/content/home").json()
    assert home["custom"] is False


def test_editor_api_session_and_field_are_page_aware(client: TestClient) -> None:
    login(client)
    session = client.get("/api/editor/session?page=a-propos").json()
    assert session["slug"] == "a-propos"
    assert session["doc"]["hero"]["title"][0] == "Je dessine,"

    response = client.post(
        "/api/editor/champ",
        json={
            "path": "hero.kicker",
            "value": "À propos · test en place",
            "csrf": session["csrf"],
            "slug": "a-propos",
        },
    )
    assert response.status_code == 200, response.text
    reread = client.get("/api/editor/session?page=a-propos").json()
    assert reread["doc"]["hero"]["kicker"] == "À propos · test en place"
    home = client.get("/api/v1/content/home").json()
    assert home["custom"] is False


def test_editor_api_refuses_unknown_page(client: TestClient) -> None:
    login(client)
    session = client.get("/api/editor/session?page=realisations/mistral").json()
    assert session["slug"] == "home"
