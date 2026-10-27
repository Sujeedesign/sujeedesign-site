"""API d'écriture du contenu : jeton porteur, validation, révision, publication."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

TOKEN = "jeton-api-de-test"
AUTH = {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture()
def api(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("SITE_API_TOKEN", TOKEN)
    monkeypatch.delenv("COOLIFY_TOKEN", raising=False)
    return client


def test_refuse_sans_jeton(api: TestClient) -> None:
    assert api.get("/api/v1/admin/content/home").status_code == 401
    assert api.get(
        "/api/v1/admin/content/home", headers={"Authorization": "Bearer faux"}
    ).status_code == 401


def test_desactive_sans_secret(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SITE_API_TOKEN", raising=False)
    response = client.get("/api/v1/admin/content/home", headers=AUTH)
    assert response.status_code == 503


def test_lit_le_contenu_et_les_champs(api: TestClient) -> None:
    response = api.get("/api/v1/admin/content/home", headers=AUTH)
    assert response.status_code == 200
    body = response.json()
    assert body["slug"] == "home"
    assert body["data"]["hero"]["title"]["first"]
    assert any(field["path"] == "hero.title.first" for field in body["fields"])


def test_modifie_par_chemin_et_cree_une_revision(api: TestClient, conn) -> None:
    avant = api.get("/api/v1/admin/content/home", headers=AUTH).json()["data"]
    response = api.put(
        "/api/v1/admin/content/home",
        headers={**AUTH, "X-Author": "sita"},
        json={"changes": {"hero.title.first": "Studio"}},
    )
    assert response.status_code == 200
    assert response.json()["author"] == "sita"

    apres = api.get("/api/v1/admin/content/home", headers=AUTH).json()["data"]
    assert apres["hero"]["title"]["first"] == "Studio"
    autres = apres["hero"]["title"]["last"]
    assert autres == avant["hero"]["title"]["last"]

    revisions = conn.execute(
        "SELECT author, snapshot FROM revisions WHERE entity_type = 'content' ORDER BY id DESC"
    ).fetchall()
    assert revisions and revisions[0]["author"] == "sita"


def test_refuse_un_champ_vide(api: TestClient) -> None:
    response = api.put(
        "/api/v1/admin/content/home",
        headers=AUTH,
        json={"changes": {"hero.title.first": "   "}},
    )
    assert response.status_code == 422
    assert "Titre" in response.json()["detail"]

    apres = api.get("/api/v1/admin/content/home", headers=AUTH).json()["data"]
    assert apres["hero"]["title"]["first"].strip()


def test_refuse_un_slug_inconnu(api: TestClient) -> None:
    assert api.get("/api/v1/admin/content/contact", headers=AUTH).status_code == 404


def test_publication_non_configuree(api: TestClient) -> None:
    response = api.post("/api/v1/admin/publish", headers=AUTH)
    assert response.status_code == 409
    assert response.json()["ok"] is False


def test_statut(api: TestClient) -> None:
    body = api.get("/api/v1/admin/status", headers=AUTH).json()
    assert body["ok"] is True
    assert body["publish_ready"] is False
