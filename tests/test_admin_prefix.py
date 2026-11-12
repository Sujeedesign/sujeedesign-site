"""Back office à la racine de `admin.sujeedesign.com` (plus de préfixe `/admin`).

L'URL publique doit être `https://admin.sujeedesign.com/connexion`, pas
`.../admin/connexion`. Le préfixe historique reste le chemin interne des 48
routes : un middleware ASGI le rajoute à la volée sur l'hôte d'administration,
et les liens sortants sont calculés par `admin_base()`. Ces tests verrouillent
les deux côtés, plus la compatibilité des anciens favoris et de l'hôte de
secours `*.sslip.io`.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.db import connect, init_db
from app.main import create_app

ADMIN = "https://admin.sujeedesign.com"
SECOURS = "https://admin-sujeedesign.145.241.167.66.sslip.io"


@pytest.fixture()
def app_client(db_file: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SESSION_SECRET", "secret-de-test")
    monkeypatch.setenv("ADMIN_PASSWORD", "mot-de-passe-de-test")
    monkeypatch.setenv("COOKIE_SECURE", "0")
    monkeypatch.setenv("SITE_BASE_URL", "https://sujeedesign.com")
    init_db(connect(db_file))
    application = create_app(db_file)

    def make(base_url: str) -> TestClient:
        return TestClient(application, base_url=base_url, follow_redirects=False)

    return make


def test_racine_renvoie_vers_la_connexion(app_client) -> None:
    c = app_client(ADMIN)
    assert c.get("/").headers["location"] == "/connexion"
    assert c.get("/").status_code == 303


def test_connexion_sans_prefixe(app_client) -> None:
    c = app_client(ADMIN)
    response = c.get("/connexion")
    assert response.status_code == 200
    assert 'action="/connexion"' in response.text
    assert '"/admin' not in response.text


def test_ancien_favori_redirige_vers_la_racine(app_client) -> None:
    c = app_client(ADMIN)
    assert c.get("/admin").status_code == 308
    assert c.get("/admin").headers["location"] == "/"
    assert c.get("/admin/pages").headers["location"] == "/pages"
    # 308 conserve la méthode : un POST vers l'ancienne URL repart en POST.
    assert c.post("/admin/connexion", data={"username": "x", "password": "y"}).status_code == 308


def test_pages_protegees_redirigent_vers_connexion(app_client) -> None:
    c = app_client(ADMIN)
    response = c.get("/pages")
    assert response.status_code == 303
    assert response.headers["location"] == "/connexion"


def test_liens_internes_sans_prefixe_une_fois_connecte(app_client) -> None:
    c = app_client(ADMIN)
    assert c.post("/connexion", data={"username": "admin", "password": "mot-de-passe-de-test"}).status_code == 303
    for path in ("/", "/pages", "/medias", "/reglages"):
        response = c.get(path)
        assert response.status_code == 200, path
        assert '"/admin' not in response.text, path
    assert '"/deconnexion"' in c.get("/pages").text


def test_hote_de_secours_garde_le_prefixe(app_client) -> None:
    c = app_client(SECOURS)
    assert c.get("/connexion").status_code == 404
    assert c.get("/admin/connexion").status_code == 200


def test_apex_ne_sert_pas_le_back_office(app_client) -> None:
    c = app_client("https://sujeedesign.com")
    assert c.get("/connexion").status_code == 404
    assert c.get("/admin").headers["location"] == "/admin/connexion"


def test_assets_et_api_ne_sont_pas_reecrits(app_client) -> None:
    c = app_client(ADMIN)
    assert c.get("/static-admin/admin.css").status_code == 200
    assert c.get("/sante").status_code == 200
