"""API JSON de l'éditeur visuel : session, écriture d'un champ, publication."""

from __future__ import annotations

import re
from pathlib import Path

from fastapi.testclient import TestClient

from app.db import connect

PASSWORD = "mot-de-passe-de-test"


def _csrf(client: TestClient, path: str = "/admin/contenu") -> str:
    match = re.search(r'name="csrf" value="([^"]+)"', client.get(path).text)
    assert match, f"aucun jeton CSRF sur {path}"
    return match.group(1)


def login(client: TestClient) -> TestClient:
    response = client.post("/admin/connexion", data={"password": PASSWORD}, follow_redirects=False)
    assert response.status_code == 303, response.text
    return client


def test_session_refuse_les_anonymes(client: TestClient) -> None:
    response = client.get("/api/editor/session")
    assert response.status_code == 401
    assert response.json()["ok"] is False


def test_session_expose_document_et_schema(client: TestClient) -> None:
    login(client)
    response = client.get("/api/editor/session")
    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["csrf"]
    assert payload["doc"]["hero"]["title"]["first"]
    sections = payload["sections"]
    paths = {
        field["path"]
        for section in sections
        for block in section["blocks"]
        for field in block["fields"]
    }
    assert "hero.kicker" in paths
    assert "medias" in payload
    assert "publish_ready" in payload
    assert "token" not in str(payload), "aucun secret Coolify ne doit sortir"


def test_marqueur_edition_pose_a_la_connexion(client: TestClient) -> None:
    response = client.post(
        "/admin/connexion", data={"password": PASSWORD}, follow_redirects=False
    )
    cookies = response.headers.get_list("set-cookie")
    assert any(c.startswith("sjd_edit=1") for c in cookies)
    assert any("sjd_edit=1" in c and "HttpOnly" not in c for c in cookies)


def test_ecriture_champ_puis_lecture(client: TestClient) -> None:
    login(client)
    csrf = client.get("/api/editor/session").json()["csrf"]
    response = client.post(
        "/api/editor/champ",
        json={"path": "hero.kicker", "value": "Studio de test", "csrf": csrf},
    )
    assert response.status_code == 200, response.text
    assert response.json()["doc"]["hero"]["kicker"] == "Studio de test"
    assert client.get("/api/editor/session").json()["doc"]["hero"]["kicker"] == "Studio de test"


def test_ecriture_d_une_ligne_de_titre(client: TestClient) -> None:
    """Un titre multiligne est rendu ligne par ligne : `hero.title.0` doit passer."""
    login(client)
    csrf = client.get("/api/editor/session?page=services").json()["csrf"]
    response = client.post(
        "/api/editor/champ",
        json={"slug": "services", "path": "hero.title.0", "value": "Services de test", "csrf": csrf},
    )
    assert response.status_code == 200, response.text
    doc = client.get("/api/editor/session?page=services").json()["doc"]
    assert doc["hero"]["title"][0] == "Services de test"
    assert isinstance(doc["hero"]["title"][1], str)


def test_ecriture_refuse_un_index_hors_liste(client: TestClient) -> None:
    login(client)
    csrf = client.get("/api/editor/session?page=services").json()["csrf"]
    for path in ("hero.title.12", "hero.lead.0"):
        response = client.post(
            "/api/editor/champ", json={"slug": "services", "path": path, "value": "x", "csrf": csrf}
        )
        assert response.status_code == 404, (path, response.text)


def test_ecriture_refuse_sans_csrf(client: TestClient) -> None:
    login(client)
    response = client.post(
        "/api/editor/champ", json={"path": "hero.kicker", "value": "pirate", "csrf": "faux"}
    )
    assert response.status_code in (400, 403)


def test_ecriture_refuse_un_champ_inconnu(client: TestClient) -> None:
    login(client)
    csrf = client.get("/api/editor/session").json()["csrf"]
    response = client.post(
        "/api/editor/champ", json={"path": "hero.inconnu", "value": "x", "csrf": csrf}
    )
    assert response.status_code == 404


def test_ecriture_refuse_une_valeur_invalide(client: TestClient) -> None:
    login(client)
    csrf = client.get("/api/editor/session").json()["csrf"]
    response = client.post(
        "/api/editor/champ", json={"path": "hero.kicker", "value": "   ", "csrf": csrf}
    )
    assert response.status_code == 422
    assert response.json()["ok"] is False


def test_publication_transmet_le_document(client: TestClient, monkeypatch) -> None:
    login(client)
    csrf = client.get("/api/editor/session").json()["csrf"]
    calls: list[str] = []

    def fake_publish(conn, slug="home"):
        calls.append(slug)
        return {"ok": True, "message": "Déploiement demandé"}

    from app import content as content_store

    monkeypatch.setattr(content_store, "request_publish", fake_publish)
    response = client.post("/api/editor/publier", json={"csrf": csrf})
    assert response.status_code == 200, response.text
    assert response.json()["ok"] is True
    assert calls == ["home"]

def test_ecriture_accepte_l_origine_du_proxy(client: TestClient) -> None:
    """Derrière les rewrites Next, l'origine du navigateur diffère du Host reçu."""
    login(client)
    csrf = client.get("/api/editor/session").json()["csrf"]
    response = client.post(
        "/api/editor/champ",
        json={"path": "hero.title.first", "value": "Votre marque", "csrf": csrf},
        headers={"origin": "https://sujeedesign.com", "x-forwarded-host": "sujeedesign.com"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["ok"] is True


def test_ecriture_refuse_une_origine_etrangere(client: TestClient) -> None:
    login(client)
    csrf = client.get("/api/editor/session").json()["csrf"]
    response = client.post(
        "/api/editor/champ",
        json={"path": "hero.title.first", "value": "Pirate", "csrf": csrf},
        headers={"origin": "https://evil.example", "x-forwarded-host": "sujeedesign.com"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "origine refusée"


def test_double_envoi_ne_cree_pas_deux_revisions(client: TestClient, db_file: Path) -> None:
    """Entrée puis blur renvoient la même valeur : une seule révision."""
    login(client)
    cookie = client.get("/api/editor/session?page=services").json()
    csrf = cookie["csrf"]
    payload = {"path": "hero.kicker", "value": "Un seul envoi", "csrf": csrf, "slug": "services"}
    first = client.post("/api/editor/champ", json=payload)
    assert first.status_code == 200, first.text
    second = client.post("/api/editor/champ", json=payload)
    assert second.status_code == 200, second.text
    assert second.json().get("unchanged") is True
    conn = connect(db_file)
    try:
        rows = conn.execute(
            "select count(*) from revisions where entity_type='content:services'"
        ).fetchone()[0]
    finally:
        conn.close()
    assert rows == 1, rows


def test_publier_reste_grisé_tant_que_rien_ne_change(client: TestClient) -> None:
    """Règle : sans modification enregistrée, `pending` est faux (bouton grisé)."""
    login(client)
    session = client.get("/api/editor/session?page=services").json()
    assert session["pending"] is False


def test_une_modification_allume_le_bouton_puis_la_publication_l_eteint(
    client: TestClient, monkeypatch
) -> None:
    login(client)
    csrf = client.get("/api/editor/session?page=services").json()["csrf"]
    written = client.post(
        "/api/editor/champ",
        json={"slug": "services", "path": "hero.lead", "value": "Périmètre modifié", "csrf": csrf},
    )
    assert written.status_code == 200, written.text
    assert written.json()["pending"] is True

    monkeypatch.setattr("app.content.publish_ready", lambda: True)
    monkeypatch.setattr("app.content._coolify", lambda *a, **k: {"deployments": [{"message": "ok"}]})
    published = client.post("/api/editor/publier", json={"csrf": csrf, "slug": "services"})
    assert published.status_code == 200, published.text
    assert published.json()["pending"] is False
    assert client.get("/api/editor/session?page=services").json()["pending"] is False


def _modifier(client: TestClient, slug: str = "services") -> str:
    csrf = client.get(f"/api/editor/session?page={slug}").json()["csrf"]
    written = client.post(
        "/api/editor/champ",
        json={"slug": slug, "path": "hero.lead", "value": "Périmètre modifié en direct", "csrf": csrf},
    )
    assert written.status_code == 200, written.text
    return csrf


def test_publication_rapide_invalide_le_cache_sans_deploiement(
    client: TestClient, monkeypatch
) -> None:
    """Le cache Next remplace le build : la publication ne doit pas déployer."""
    login(client)
    csrf = _modifier(client)
    monkeypatch.setenv("WEB_REVALIDATE_URL", "https://sujeedesign.com/")
    monkeypatch.setenv("REVALIDATE_SECRET", "secret-de-test")
    appels: list[str] = []
    monkeypatch.setattr("app.content._revalidate", lambda: appels.append("cache"))

    def _interdit(*args, **kwargs):
        raise AssertionError("Coolify ne doit pas être appelé quand le cache répond")

    monkeypatch.setattr("app.content._coolify", _interdit)
    published = client.post("/api/editor/publier", json={"csrf": csrf, "slug": "services"})
    assert published.status_code == 200, published.text
    assert published.json()["mode"] == "cache"
    assert published.json()["pending"] is False
    assert appels == ["cache"]


def test_cache_injoignable_retombe_sur_le_deploiement(client: TestClient, monkeypatch) -> None:
    """Si le site ne répond pas, on repart sur le rebuild complet plutôt que bloquer."""
    login(client)
    csrf = _modifier(client)
    monkeypatch.setenv("WEB_REVALIDATE_URL", "https://sujeedesign.com")
    monkeypatch.setenv("REVALIDATE_SECRET", "secret-de-test")

    def _panne() -> None:
        raise RuntimeError("cache injoignable")

    monkeypatch.setattr("app.content._revalidate", _panne)
    monkeypatch.setattr("app.content.publish_ready", lambda: True)
    monkeypatch.setattr(
        "app.content._coolify", lambda *a, **k: {"deployments": [{"deployment_uuid": "abc"}]}
    )
    published = client.post("/api/editor/publier", json={"csrf": csrf, "slug": "services"})
    assert published.status_code == 200, published.text
    assert published.json()["deployment"] == "abc"


def test_revalidation_appelle_la_route_avec_le_secret(monkeypatch) -> None:
    """Contrat avec la route Next : POST /api/revalidate + en-tête secret."""
    monkeypatch.setenv("WEB_REVALIDATE_URL", "https://sujeedesign.com/")
    monkeypatch.setenv("REVALIDATE_SECRET", "secret-de-test")
    seen: list[tuple[str, str, bytes | None]] = []

    class _Response:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    def _urlopen(request, timeout=0):
        seen.append((request.full_url, request.get_header("X-revalidate-secret"), request.data))
        return _Response()

    monkeypatch.setattr("app.content.urllib.request.urlopen", _urlopen)
    from app import content as content_store

    content_store._revalidate()
    assert seen == [("https://sujeedesign.com/api/revalidate", "secret-de-test", b"")]


def test_health_expose_le_mode_de_publication(client: TestClient) -> None:
    """Diagnostic : on doit pouvoir savoir si la publication rapide est branchée."""
    health = client.get("/api/health")
    assert health.status_code == 200
    publication = health.json()["publication"]
    assert set(publication) == {"rapide", "deploiement"}
