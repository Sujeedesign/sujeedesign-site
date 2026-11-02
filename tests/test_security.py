"""Durcissement : jetons liés à la session, CSRF, IP client, uploads, en-têtes."""

from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient

from app import security
from app.admin import CSRF_PURPOSE, CSRF_TTL


@pytest.fixture(autouse=True)
def _env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SESSION_SECRET", "secret-de-test")
    monkeypatch.setenv("SITE_API_TOKEN", "jeton-de-test")


def test_jeton_non_reutilisable_hors_de_sa_session() -> None:
    token = security.make_token(CSRF_PURPOSE, CSRF_TTL, key="sess:AAA")
    assert security.verify_token(CSRF_PURPOSE, token, CSRF_TTL, key="sess:AAA")
    assert not security.verify_token(CSRF_PURPOSE, token, CSRF_TTL, key="sess:BBB")
    assert not security.verify_token(CSRF_PURPOSE, token, CSRF_TTL)


def test_sniff_rejette_un_fichier_deguise() -> None:
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
    assert security.sniff_matches(png, ".png")
    assert not security.sniff_matches(png, ".pdf")
    # HTML déposé sous une extension image
    assert not security.sniff_matches(b"<html><script>alert(1)</script>", ".png")
    assert not security.sniff_matches(b"", ".png")
    # Extension inconnue : refus par défaut
    assert not security.sniff_matches(png, ".svg")


def test_ip_client_ignore_l_entete_forge_a_gauche() -> None:
    # Un attaquant préfixe l'en-tête : seule la valeur du proxy compte.
    assert security.client_ip_from("10.0.0.2", "1.2.3.4, 93.184.216.34") == "93.184.216.34"
    # Rien de public : on retombe sur le pair direct.
    assert security.client_ip_from("10.0.0.2", "") == "10.0.0.2"
    assert security.client_ip_from("10.0.0.2", "10.1.1.1, 192.168.1.4") == "10.0.0.2"


@pytest.fixture()
def logged(client: TestClient) -> TestClient:
    response = client.post(
        "/admin/connexion",
        data={"password": "mot-de-passe-de-test"},
        follow_redirects=False,
    )
    assert response.status_code == 303, response.text
    return client


def _session_token(client: TestClient) -> str:
    session = client.cookies.get(security.SESSION_COOKIE, "")
    return security.make_token(CSRF_PURPOSE, CSRF_TTL, key="sess:" + session)


def test_csrf_refuse_sans_session(logged: TestClient) -> None:
    token = _session_token(logged)
    logged.cookies.delete(security.SESSION_COOKIE)
    response = logged.post(
        "/admin/projets",
        data={"csrf": token, "nom": "Test", "statut": "brouillon", "ton": "paper"},
        follow_redirects=False,
    )
    # Sans session, la route renvoie vers la connexion : aucune écriture.
    assert response.status_code in (303, 403)
    if response.status_code == 303:
        assert "/connexion" in response.headers["location"]


def test_csrf_refuse_un_jeton_non_lie(logged: TestClient) -> None:
    response = logged.post(
        "/admin/projets",
        data={
            "csrf": security.make_token(CSRF_PURPOSE, CSRF_TTL),
            "nom": "Test",
            "statut": "brouillon",
            "ton": "paper",
        },
        follow_redirects=False,
    )
    assert response.status_code == 403


def test_deconnexion_tolere_une_session_expiree(client: TestClient) -> None:
    client.cookies.set(security.SESSION_COOKIE, "invalide")
    response = client.post("/admin/deconnexion", data={"csrf": ""}, follow_redirects=False)
    assert response.status_code == 303


def test_medias_servis_sans_execution_de_document(logged: TestClient) -> None:
    response = logged.post(
        "/api/v1/admin/media",
        headers={"Authorization": "Bearer jeton-de-test"},
        files={"fichier": ("photo.png", io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"\x00" * 32), "image/png")},
    )
    assert response.status_code in (200, 201), response.text
    path = response.json()["media"]["path"]
    served = logged.get(path)
    assert served.status_code == 200
    assert served.headers["content-security-policy"] == "default-src 'none'; sandbox"
    assert served.headers["x-content-type-options"] == "nosniff"


def test_upload_deguise_refuse(client: TestClient) -> None:
    response = client.post(
        "/api/v1/admin/media",
        headers={"Authorization": "Bearer jeton-de-test"},
        files={"fichier": ("photo.png", io.BytesIO(b"<html>x</html>"), "image/png")},
    )
    assert response.status_code == 415, response.text


def test_corps_trop_volumineux_refuse(client: TestClient) -> None:
    response = client.post(
        "/api/v1/contact",
        content=b"x" * (2 * 1024 * 1024),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 413
