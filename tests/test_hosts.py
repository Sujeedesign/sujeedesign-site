"""Hôtes du back office : séparation stricte avec la vitrine publique.

Après la bascule, sujeedesign.com est servi par la vitrine Next.js. Le back
office FastAPI garde un hôte dédié (*.sslip.io). Ces tests verrouillent le
contrat : sur cet hôte, seuls le back office et ses assets sont servis, tout le
reste redirige en 301 vers le domaine public, et l'ensemble est en noindex.
"""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

ADMIN_HOST = "http://admin-sujeedesign.145.241.167.66.sslip.io"


@pytest.fixture()
def admin_client(db_file: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("SESSION_SECRET", "secret-de-test")
    monkeypatch.setenv("ADMIN_PASSWORD", "mot-de-passe-de-test")
    monkeypatch.setenv("SYNC_TOKEN", "jeton-de-test")
    monkeypatch.setenv("COOKIE_SECURE", "0")
    monkeypatch.delenv("ADMIN_ONLY_HOSTS", raising=False)
    application = create_app(db_file)
    with TestClient(application, base_url=ADMIN_HOST) as test_client:
        yield test_client


@pytest.mark.parametrize(
    "path",
    ["/", "/services", "/apropos.html", "/realisations/vaasam", "/images/photo.jpg"],
)
def test_public_pages_redirect_to_the_canonical_domain(
    admin_client: TestClient, path: str
) -> None:
    response = admin_client.get(path, follow_redirects=False)

    assert response.status_code == 301
    assert response.headers["location"] == f"https://sujeedesign.com{path}"


@pytest.mark.parametrize("path", ["/admin/connexion", "/api/health", "/assets/admin.css"])
def test_back_office_paths_stay_served_and_are_noindexed(
    admin_client: TestClient, path: str
) -> None:
    response = admin_client.get(path, follow_redirects=False)

    assert response.status_code == 200
    assert response.headers["x-robots-tag"] == "noindex, nofollow"


def test_the_canonical_domain_is_never_redirected(client: TestClient) -> None:
    response = client.get(
        "/api/health",
        headers={"host": "sujeedesign.com"},
        follow_redirects=False,
    )

    assert response.status_code == 200
    assert "x-robots-tag" not in response.headers


def test_an_unknown_host_is_left_untouched(db_file: Path, conn: sqlite3.Connection) -> None:
    """Un hôte non déclaré (proxy interne, test) ne doit jamais être redirigé."""
    conn.close()
    application = create_app(db_file)
    with TestClient(application, base_url="http://previsualisation.interne") as test_client:
        response = test_client.get("/api/health", follow_redirects=False)

    assert response.status_code == 200
    assert "x-robots-tag" not in response.headers


def test_admin_only_hosts_extends_the_redirect_to_a_named_host(
    db_file: Path, conn: sqlite3.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ADMIN_ONLY_HOSTS", "atelier.sujeedesign.com")
    conn.close()
    application = create_app(db_file)
    with TestClient(application, base_url="http://atelier.sujeedesign.com") as test_client:
        response = test_client.get("/services", follow_redirects=False)

    assert response.status_code == 301
    assert response.headers["location"] == "https://sujeedesign.com/services"
