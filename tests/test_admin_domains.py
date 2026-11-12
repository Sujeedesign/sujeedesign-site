"""Back office sur son propre domaine : portée des cookies et « éditer en place ».

Depuis le 12/11 l'administration est servie par `admin.sujeedesign.com`, alors
que l'édition en place se fait sur le site public. Ces tests verrouillent les
deux points qui font le lien entre les deux hôtes :

- les cookies de session sont posés avec `Domain=sujeedesign.com`, sinon la
  vitrine ne voit ni la session ni la demande d'édition ;
- « Éditer en place » redirige vers l'URL publique absolue, sinon `/services`
  renverrait à l'écran de connexion du back office.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import security, settings as settings_module
from app.main import create_app


def _req(host: str) -> SimpleNamespace:
    return SimpleNamespace(headers={"host": host})


@pytest.mark.parametrize(
    "host",
    ["sujeedesign.com", "www.sujeedesign.com", "admin.sujeedesign.com", "ADMIN.SujeeDesign.com:443"],
)
def test_domaine_partage_sur_le_site(host: str) -> None:
    assert settings_module.cookie_domain(_req(host)) == ".sujeedesign.com"


@pytest.mark.parametrize(
    "host",
    ["admin-sujeedesign.145.241.167.66.sslip.io", "testserver", "sujeedesign.com.evil.tld", "evilsujeedesign.com"],
)
def test_domaine_host_only_ailleurs(host: str) -> None:
    assert settings_module.cookie_domain(_req(host)) is None


def _client(db_file, monkeypatch: pytest.MonkeyPatch, host: str) -> TestClient:
    monkeypatch.setenv("SESSION_SECRET", "secret-de-test")
    monkeypatch.setenv("ADMIN_PASSWORD", "mot-de-passe-de-test")
    monkeypatch.setenv("SYNC_TOKEN", "jeton-de-test")
    monkeypatch.setenv("COOKIE_SECURE", "1")
    monkeypatch.setenv("SITE_BASE_URL", "https://sujeedesign.com")
    return TestClient(create_app(db_file), base_url=f"https://{host}")


def _login(client: TestClient):
    response = client.post(
        "/connexion",
        data={"password": "mot-de-passe-de-test"},
        follow_redirects=False,
    )
    assert response.status_code == 303, response.text
    return response


def test_connexion_sur_le_back_office_partage_la_session(db_file, monkeypatch) -> None:
    with _client(db_file, monkeypatch, "admin.sujeedesign.com") as client:
        response = _login(client)
    cookies = response.headers.get_list("set-cookie")
    session = next(c for c in cookies if c.startswith(security.SESSION_COOKIE + "="))
    marker = next(c for c in cookies if c.startswith(security.UI_MARKER_COOKIE + "="))
    assert "Domain=.sujeedesign.com" in session
    assert "HttpOnly" in session
    assert "Domain=.sujeedesign.com" in marker


def test_editer_en_place_renvoie_vers_le_site_public(db_file, monkeypatch) -> None:
    with _client(db_file, monkeypatch, "admin.sujeedesign.com") as client:
        _login(client)
        response = client.get("/editer?page=services", follow_redirects=False)
        assert response.status_code == 303
        assert response.headers["location"] == "https://sujeedesign.com/services"
        cookie = response.headers["set-cookie"]
        assert cookie.startswith(security.EDIT_MARKER_COOKIE + "=1")
        assert "Domain=.sujeedesign.com" in cookie


def test_la_vitrine_voit_la_session_posee_par_le_back_office(db_file, monkeypatch) -> None:
    """Le scénario réel : connexion sur le sous-domaine, puis appel depuis l'apex."""
    with _client(db_file, monkeypatch, "admin.sujeedesign.com") as admin:
        _login(admin)
        cookies = dict(admin.cookies)

    with _client(db_file, monkeypatch, "sujeedesign.com") as site:
        for name, value in cookies.items():
            site.cookies.set(name, value, domain="sujeedesign.com", path="/")
        state = site.get("/api/editor/session", params={"page": "home"})
        assert state.status_code == 200, state.text
        assert state.json().get("ok") is True


def test_deconnexion_efface_les_deux_portees(db_file, monkeypatch) -> None:
    with _client(db_file, monkeypatch, "admin.sujeedesign.com") as client:
        _login(client)
        csrf = client.get("/api/editor/session", params={"page": "home"}).json().get("csrf", "")
        response = client.post("/deconnexion", data={"csrf": csrf}, follow_redirects=False)
    cookies = response.headers.get_list("set-cookie")
    deleted = [c for c in cookies if c.startswith(security.SESSION_COOKIE + "=") and "Max-Age=0" in c]
    assert any("Domain=.sujeedesign.com" in c for c in deleted)
    assert any("Domain=" not in c for c in deleted)
