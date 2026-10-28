"""En-têtes du back office : l'indexation doit rester interdite sur chaque réponse."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_admin_repond_noindex(client: TestClient) -> None:
    for path in ("/admin", "/admin/connexion"):
        response = client.get(path, follow_redirects=False)
        assert response.headers.get("X-Robots-Tag") == "noindex, nofollow", path
        assert response.headers.get("Cache-Control") == "no-store", path


def test_api_repond_noindex(client: TestClient) -> None:
    response = client.get("/api/admin/content/home", follow_redirects=False)
    assert response.headers.get("X-Robots-Tag") == "noindex, nofollow"
