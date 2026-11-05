"""Écran Instagram de l'admin : cinq posts choisis à la main.

Couvre la page vide, l'import d'une image, l'import d'une vidéo, le plafond de
cinq places, la lecture publique `/api/v1/instagram`, le réordonnancement et la
suppression. Aucun appel réseau vers Instagram.
"""

from __future__ import annotations

from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from app import security
from app.admin import CSRF_PURPOSE, CSRF_TTL

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
MP4 = b"\x00\x00\x00\x18ftypisom" + b"\x00" * 64
GARBAGE = b"pas-un-media" * 8


def _session_csrf(client: TestClient) -> str:
    session = client.cookies.get(security.SESSION_COOKIE, "")
    return security.make_token(CSRF_PURPOSE, CSRF_TTL, key="sess:" + (security.session_nonce(session) or ""))


@pytest.fixture()
def logged(client: TestClient, tmp_path: Path) -> TestClient:
    client.app.state.media_dir = str(tmp_path / "medias")  # type: ignore[attr-defined]
    response = client.post(
        "/admin/connexion",
        data={"password": "mot-de-passe-de-test"},
        follow_redirects=False,
    )
    assert response.status_code == 303, response.text
    _TOKEN.clear()
    _TOKEN.append(_session_csrf(client))
    return client


_TOKEN: list[str] = []


def _add(client: TestClient, payload: bytes = PNG, name: str = "post.png", **fields: str):
    data = {"csrf": _TOKEN[0], "legende": "Identité Vaasam", "permalien": "", "alt": ""}
    data.update(fields)
    mime = "video/mp4" if name.endswith((".mp4", ".mov")) else "image/png"
    return client.post(
        "/admin/instagram/ajouter",
        data=data,
        files={"fichier": (name, payload, mime)},
        follow_redirects=False,
    )


def _posts(client: TestClient) -> list[dict]:
    return client.get("/api/v1/instagram").json()["posts"]


def test_page_vide_et_nav(logged: TestClient) -> None:
    page = logged.get("/admin/instagram")
    assert page.status_code == 200
    assert "Grille manuelle, cinq places" in page.text
    assert "Ajouter un post" in page.text
    assert "5 places libres" in page.text
    assert logged.get("/api/v1/instagram").json()["posts"] == []


def test_ajout_image(logged: TestClient) -> None:
    response = _add(logged, permalien="https://www.instagram.com/p/ABC123/")
    assert response.status_code == 303
    posts = _posts(logged)
    assert len(posts) == 1
    assert posts[0]["kind"] == "image"
    assert posts[0]["src"].startswith("/medias/")
    assert posts[0]["caption"] == "Identité Vaasam"
    assert posts[0]["permalink"] == "https://www.instagram.com/p/ABC123/"
    media = Path(logged.app.state.media_dir)  # type: ignore[attr-defined]
    assert (media / posts[0]["src"].split("/")[-1]).exists()


def test_ajout_video(logged: TestClient) -> None:
    response = _add(logged, payload=MP4, name="reel.mp4", legende="Coulisses")
    assert response.status_code == 303
    posts = _posts(logged)
    assert posts[0]["kind"] == "video"
    assert posts[0]["src"].endswith(".mp4")


def test_ajout_video_plus_d_un_mega(logged: TestClient) -> None:
    """Une vraie vidéo dépasse vite 1 Mo : le garde-fou corps ne doit pas la couper."""
    grosse = MP4 + b"\x00" * (2 * 1024 * 1024)
    response = _add(logged, payload=grosse, name="reel.mp4", legende="Reel 2 Mo")
    assert response.status_code == 303, response.text
    posts = _posts(logged)
    assert len(posts) == 1
    assert posts[0]["kind"] == "video"
    media = Path(logged.app.state.media_dir)  # type: ignore[attr-defined]
    assert (media / posts[0]["src"].split("/")[-1]).stat().st_size == len(grosse)


def test_formulaire_texte_toujours_plafonne(client: TestClient) -> None:
    """Le garde-fou reste actif là où aucun fichier n'est attendu."""
    response = client.post(
        "/admin/connexion",
        content=b"password=" + b"a" * (2 * 1024 * 1024),
        headers={"content-type": "application/x-www-form-urlencoded"},
    )
    assert response.status_code == 413
    assert response.json()["detail"] == "requête trop volumineuse"


def test_fichier_refuse(logged: TestClient) -> None:
    response = _add(logged, payload=GARBAGE, name="x.png")
    assert response.status_code == 303
    flash = parse_qs(urlparse(response.headers["location"]).query).get("flash", [""])[0]
    assert "ne correspond pas au format annoncé" in flash
    assert _posts(logged) == []


def test_plafond_cinq(logged: TestClient) -> None:
    for index in range(5):
        assert _add(logged, legende=f"Post {index}").status_code == 303
    assert len(_posts(logged)) == 5
    _add(logged, legende="Sixième")
    assert len(_posts(logged)) == 5


def test_lien_non_http_ignore(logged: TestClient) -> None:
    _add(logged, permalien="javascript:alert(1)")
    assert _posts(logged)[0]["permalink"] == ""


def test_reordonner_et_supprimer(logged: TestClient) -> None:
    for index in range(3):
        _add(logged, legende=f"Post {index}")
    posts = _posts(logged)
    dernier = posts[-1]["id"]
    logged.post(
        f"/admin/instagram/{dernier}/deplacer",
        data={"csrf": _TOKEN[0], "direction": "up"},
        follow_redirects=False,
    )
    assert [post["caption"] for post in _posts(logged)] == ["Post 0", "Post 2", "Post 1"]

    supprime = posts[0]
    logged.post(
        f"/admin/instagram/{supprime['id']}/supprimer",
        data={"csrf": _TOKEN[0]},
        follow_redirects=False,
    )
    restants = _posts(logged)
    assert [post["caption"] for post in restants] == ["Post 2", "Post 1"]
    media = Path(logged.app.state.media_dir)  # type: ignore[attr-defined]
    assert not (media / supprime["src"].split("/")[-1]).exists()


def test_modifier_legende(logged: TestClient) -> None:
    _add(logged)
    post = _posts(logged)[0]
    logged.post(
        f"/admin/instagram/{post['id']}/modifier",
        data={"csrf": _TOKEN[0], "legende": "Nouvelle légende", "permalien": "", "alt": ""},
        follow_redirects=False,
    )
    assert _posts(logged)[0]["caption"] == "Nouvelle légende"
