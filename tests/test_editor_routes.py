"""API de l'éditeur : session, CSRF, origine, écritures, erreurs, médias."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import db as db_module
from sujee_editor.blocks import DEFAULT_BLOCKS
from sujee_editor.routes import build_router
from sujee_editor.store import Store
from sujee_editor.tokens import make_csrf, make_session

SECRET = "secret-de-test"
COOKIE = "sjd_admin"
BASE = "/api/editor"


def make_api(db_file: Path, media_dir: Path | None = None) -> FastAPI:
    store = Store(db_file, DEFAULT_BLOCKS)
    connection = store.connect()
    db_module.init_db(connection)
    connection.close()
    api = FastAPI()
    api.include_router(
        build_router(store, session_secret=SECRET, media_dir=media_dir),
        prefix=BASE,
    )
    return api


def seed(db_file: Path) -> tuple[int, int, int]:
    """Page de test : un chapitre et une citation."""
    connection = db_module.connect(db_file)
    try:
        page = connection.execute(
            "INSERT INTO pages (slug, kind, title, status) VALUES ('a-propos','page','À propos','publie')"
        )
        page_id = int(page.lastrowid or 0)
        first = connection.execute(
            "INSERT INTO sections (page_id, position, type, data) VALUES (?, 0, 'chapter', ?)",
            (page_id, json.dumps({"title": "Titre publié", "body": "<p>Texte publié</p>", "dark": False})),
        )
        second = connection.execute(
            "INSERT INTO sections (page_id, position, type, data) VALUES (?, 1, 'citation', ?)",
            (page_id, json.dumps({"quote": "Deuxième bloc", "author": "", "role": ""})),
        )
        connection.commit()
        return page_id, int(first.lastrowid or 0), int(second.lastrowid or 0)
    finally:
        connection.close()


def auth(secret: str = SECRET, session: bool = True, session_secret: str | None = None) -> tuple[dict, dict]:
    cookies = {COOKIE: make_session(session_secret or secret)} if session else {}
    headers = {"X-SJD-CSRF": make_csrf(secret), "Origin": "http://testserver"}
    return cookies, headers


@pytest.fixture()
def api(db_file: Path) -> FastAPI:
    return make_api(db_file)


@pytest.fixture()
def client(api: FastAPI) -> TestClient:
    with TestClient(api) as test_client:
        yield test_client


@pytest.fixture()
def site(db_file: Path) -> tuple[int, int, int]:
    return seed(db_file)


# ------------------------------------------------------------------ accès


def test_writes_require_a_session(client: TestClient, site: tuple[int, int, int]) -> None:
    page_id, section_id, _ = site
    _, headers = auth()
    assert client.get(f"{BASE}/pages/{page_id}/state").status_code == 401
    assert client.patch(f"{BASE}/pages/{page_id}/sections/{section_id}", json={"field": "title", "value": "x", "expected_version": 0}, headers=headers).status_code == 401
    assert client.post(f"{BASE}/pages/{page_id}/publish", headers=headers).status_code == 401
    assert client.post(f"{BASE}/pages/{page_id}/sections", json={"type": "citation"}, headers=headers).status_code == 401
    assert client.delete(f"{BASE}/pages/{page_id}/sections/{section_id}", headers=headers).status_code == 401


def test_a_write_without_csrf_is_refused(client: TestClient, site: tuple[int, int, int]) -> None:
    page_id, section_id, _ = site
    cookies, _ = auth()
    session_cookies = {COOKIE: make_session(SECRET)}
    response = client.patch(
        f"{BASE}/pages/{page_id}/sections/{section_id}",
        json={"field": "title", "value": "x", "expected_version": 0},
        cookies=session_cookies,
        headers={"Origin": "http://testserver"},
    )
    assert response.status_code == 403
    assert cookies  # le cookie existe, seul le jeton manque


def test_a_csrf_from_another_secret_is_refused(client: TestClient, site: tuple[int, int, int]) -> None:
    page_id, section_id, _ = site
    cookies, headers = auth(secret="autre-secret", session_secret=SECRET)
    response = client.patch(
        f"{BASE}/pages/{page_id}/sections/{section_id}",
        json={"field": "title", "value": "x", "expected_version": 0},
        cookies=cookies,
        headers=headers,
    )
    assert response.status_code == 403


def test_a_foreign_origin_is_refused(client: TestClient, site: tuple[int, int, int]) -> None:
    page_id, section_id, _ = site
    cookies, headers = auth()
    headers = dict(headers, Origin="https://evil.example")
    response = client.patch(
        f"{BASE}/pages/{page_id}/sections/{section_id}",
        json={"field": "title", "value": "x", "expected_version": 0},
        cookies=cookies,
        headers=headers,
    )
    assert response.status_code == 403


# ------------------------------------------------------------------ état et écritures


def test_state_carries_the_schema_the_sections_and_a_csrf(client: TestClient, site: tuple[int, int, int]) -> None:
    page_id, section_id, _ = site
    cookies, headers = auth()
    response = client.get(f"{BASE}/pages/{page_id}/state", cookies=cookies, headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["blocks"]) == 20
    assert {block["name"] for block in payload["blocks"]} >= {"hero", "chapter", "citation"}
    chapter = next(block for block in payload["blocks"] if block["name"] == "chapter")
    assert [field["name"] for field in chapter["fields"]][:3] == ["kicker", "title", "body"]
    assert payload["page"]["slug"] == "a-propos"
    assert [section["type"] for section in payload["sections"]] == ["chapter", "citation"]
    first = payload["sections"][0]
    assert first["id"] == section_id
    assert first["draft_version"] == 0
    assert first["revised"] is False
    assert first["effective"]["title"] == "Titre publié"
    assert payload["revisions"] == []
    assert payload["csrf"]


def test_patch_writes_the_draft_and_returns_the_new_version(client: TestClient, site: tuple[int, int, int]) -> None:
    page_id, section_id, _ = site
    cookies, headers = auth()
    response = client.patch(
        f"{BASE}/pages/{page_id}/sections/{section_id}",
        json={"field": "title", "value": "Titre en brouillon", "expected_version": 0},
        cookies=cookies,
        headers=headers,
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["section"]["effective"]["title"] == "Titre en brouillon"
    assert payload["section"]["revised"] is True
    assert payload["draft_version"] == 1
    state = client.get(f"{BASE}/pages/{page_id}/state", cookies=cookies, headers=headers).json()
    assert state["sections"][0]["data"]["title"] == "Titre publié"


def test_a_stale_version_returns_409_without_writing(client: TestClient, site: tuple[int, int, int]) -> None:
    page_id, section_id, _ = site
    cookies, headers = auth()
    first = client.patch(
        f"{BASE}/pages/{page_id}/sections/{section_id}",
        json={"field": "title", "value": "Premier", "expected_version": 0},
        cookies=cookies,
        headers=headers,
    )
    assert first.status_code == 200
    stale = client.patch(
        f"{BASE}/pages/{page_id}/sections/{section_id}",
        json={"field": "title", "value": "Écrasé", "expected_version": 0},
        cookies=cookies,
        headers=headers,
    )
    assert stale.status_code == 409
    body = stale.json()
    assert body["error"]["rule"] == "version"
    assert body["section"]["draft_version"] == 1
    state = client.get(f"{BASE}/pages/{page_id}/state", cookies=cookies, headers=headers).json()
    assert state["sections"][0]["draft"]["title"] == "Premier"


def test_an_invalid_field_returns_400_and_writes_nothing(client: TestClient, site: tuple[int, int, int]) -> None:
    page_id, section_id, _ = site
    cookies, headers = auth()
    too_long = client.patch(
        f"{BASE}/pages/{page_id}/sections/{section_id}",
        json={"field": "title", "value": "x" * 400, "expected_version": 0},
        cookies=cookies,
        headers=headers,
    )
    assert too_long.status_code == 400
    assert too_long.json()["error"]["rule"] == "max_length"
    assert too_long.json()["error"]["field"] == "title"
    unknown = client.patch(
        f"{BASE}/pages/{page_id}/sections/{section_id}",
        json={"field": "fantome", "value": "x", "expected_version": 0},
        cookies=cookies,
        headers=headers,
    )
    assert unknown.status_code == 400
    assert unknown.json()["error"]["rule"] == "unknown_field"
    state = client.get(f"{BASE}/pages/{page_id}/state", cookies=cookies, headers=headers).json()
    assert state["sections"][0]["draft_version"] == 0
    assert state["sections"][0]["draft"] is None


def test_unknown_ids_and_cross_page_access_are_404(client: TestClient, site: tuple[int, int, int], db_file: Path) -> None:
    page_id, section_id, _ = site
    connection = db_module.connect(db_file)
    try:
        other = int(connection.execute("INSERT INTO pages (slug, title, status) VALUES ('contact','Contact','publie')").lastrowid or 0)
        connection.commit()
    finally:
        connection.close()
    cookies, headers = auth()
    body = {"field": "title", "value": "x", "expected_version": 0}
    assert client.patch(f"{BASE}/pages/{page_id}/sections/9999", json=body, cookies=cookies, headers=headers).status_code == 404
    assert client.patch(f"{BASE}/pages/{other}/sections/{section_id}", json=body, cookies=cookies, headers=headers).status_code == 404
    assert client.patch(f"{BASE}/pages/9999/sections/{section_id}", json=body, cookies=cookies, headers=headers).status_code == 404
    assert client.get(f"{BASE}/pages/9999/state", cookies=cookies, headers=headers).status_code == 404
    assert client.patch(f"{BASE}/pages/{page_id}/sections/abc", json=body, cookies=cookies, headers=headers).status_code == 422


# ------------------------------------------------------------------ structure, publication, médias


def test_structure_routes(client: TestClient, site: tuple[int, int, int]) -> None:
    page_id, section_id, second_id = site
    cookies, headers = auth()
    moved = client.post(f"{BASE}/pages/{page_id}/sections/{second_id}/move", json={"offset": -1}, cookies=cookies, headers=headers)
    assert moved.status_code == 200
    assert [section["type"] for section in moved.json()["sections"]] == ["citation", "chapter"]
    added = client.post(
        f"{BASE}/pages/{page_id}/sections",
        json={"type": "chapter", "position": 0, "variant": ""},
        cookies=cookies,
        headers=headers,
    )
    assert added.status_code == 201
    assert added.json()["section"]["visible"] is False
    new_id = added.json()["section"]["id"]
    duplicated = client.post(f"{BASE}/pages/{page_id}/sections/{section_id}/duplicate", cookies=cookies, headers=headers)
    assert duplicated.status_code == 201
    assert duplicated.json()["section"]["visible"] is False
    toggled = client.post(f"{BASE}/pages/{page_id}/sections/{second_id}/toggle", cookies=cookies, headers=headers)
    assert toggled.json()["section"]["visible"] is False
    deleted = client.delete(f"{BASE}/pages/{page_id}/sections/{new_id}", cookies=cookies, headers=headers)
    assert deleted.status_code == 200
    state = client.get(f"{BASE}/pages/{page_id}/state", cookies=cookies, headers=headers).json()
    assert new_id not in [section["id"] for section in state["sections"]]


def test_write_a_whole_draft_and_get_a_400_on_a_bad_list(client: TestClient, site: tuple[int, int, int]) -> None:
    page_id, section_id, _ = site
    cookies, headers = auth()
    ok = client.put(
        f"{BASE}/pages/{page_id}/sections/{section_id}/draft",
        json={"data": {"list": ["Une", "Deux"]}, "expected_version": 0},
        cookies=cookies,
        headers=headers,
    )
    assert ok.status_code == 200
    assert ok.json()["section"]["effective"]["list"] == ["Une", "Deux"]
    bad = client.put(
        f"{BASE}/pages/{page_id}/sections/{section_id}/draft",
        json={"data": {"list": ["Une", 3]}, "expected_version": 1},
        cookies=cookies,
        headers=headers,
    )
    assert bad.status_code == 400
    assert bad.json()["error"]["rule"] == "bad_item"


def test_publish_and_restore(client: TestClient, site: tuple[int, int, int]) -> None:
    page_id, section_id, _ = site
    cookies, headers = auth()
    client.patch(
        f"{BASE}/pages/{page_id}/sections/{section_id}",
        json={"field": "title", "value": "Publié depuis l'éditeur", "expected_version": 0},
        cookies=cookies,
        headers=headers,
    )
    published = client.post(f"{BASE}/pages/{page_id}/publish", cookies=cookies, headers=headers)
    assert published.status_code == 200
    body = published.json()
    assert body["revision_id"] > 0
    assert body["published_at"]
    state = client.get(f"{BASE}/pages/{page_id}/state", cookies=cookies, headers=headers).json()
    assert state["sections"][0]["data"]["title"] == "Publié depuis l'éditeur"
    assert state["sections"][0]["draft"] is None
    assert state["sections"][0]["draft_version"] == 2
    assert len(state["revisions"]) == 1
    revision_id = body["revision_id"]
    restored = client.post(f"{BASE}/pages/{page_id}/revisions/{revision_id}/restore", cookies=cookies, headers=headers)
    assert restored.status_code == 200
    assert restored.json()["sections"][0]["effective"]["title"] == "Titre publié"
    assert restored.json()["extras"] == []
    assert client.post(f"{BASE}/pages/{page_id}/revisions/999/restore", cookies=cookies, headers=headers).status_code == 404


def test_media_routes(db_file: Path, tmp_path: Path) -> None:
    api = make_api(db_file, media_dir=tmp_path / "medias")
    seed(db_file)
    with TestClient(api) as client:
        cookies, headers = auth()
        assert client.get(f"{BASE}/media", cookies=cookies, headers=headers).json()["medias"] == []
        upload = client.post(
            f"{BASE}/media",
            files={"file": ("visuel.png", b"\x89PNG\r\n\x1a\n" + b"0" * 32, "image/png")},
            cookies=cookies,
            headers=headers,
        )
        assert upload.status_code == 201
        name = upload.json()["media"]["filename"]
        assert name.endswith(".png")
        assert "visuel" not in name
        assert (tmp_path / "medias" / name).is_file()
        listing = client.get(f"{BASE}/media", cookies=cookies, headers=headers).json()["medias"]
        assert [media["filename"] for media in listing] == [name]
        refused = client.post(
            f"{BASE}/media",
            files={"file": ("virus.exe", b"MZ", "application/octet-stream")},
            cookies=cookies,
            headers=headers,
        )
        assert refused.status_code == 400
        assert client.post(f"{BASE}/media", files={"file": ("a.png", b"x", "image/png")}).status_code == 401


def test_media_routes_are_absent_without_a_media_dir(db_file: Path) -> None:
    api = make_api(db_file, media_dir=None)
    with TestClient(api) as client:
        cookies, headers = auth()
        assert client.get(f"{BASE}/media", cookies=cookies, headers=headers).status_code == 404


# --- Revue de branche : refus sur la restauration et chemins pointes --------


def make_api_with_seed(db_file, media_dir=None):
    api = make_api(db_file, media_dir)
    page_id, first, second = seed(db_file)
    return api, page_id, first, second


def test_a_dotted_path_is_refused_and_writes_nothing(tmp_path: Path) -> None:
    """Fix [I1] : le panneau envoyait `images.0.src`, que l'API refuse. Cote serveur,
    le refus reste explicite (400 unknown_field) et rien n'est ecrit."""
    db_file = tmp_path / "site.db"
    api, page_id, _, second = make_api_with_seed(db_file)
    with TestClient(api) as client:
        cookies, headers = auth()
        response = client.patch(
            f"{BASE}/pages/{page_id}/sections/{second}",
            json={"field": "images.0.src", "value": "/medias/a.jpg", "expected_version": 0},
            cookies=cookies,
            headers=headers,
        )
    assert response.status_code == 400
    assert response.json()["error"]["rule"] == "unknown_field"

    connection = db_module.connect(db_file)
    try:
        row = connection.execute("SELECT draft FROM sections WHERE id = ?", (second,)).fetchone()
        assert row["draft"] is None
    finally:
        connection.close()


def test_restoring_a_revision_outside_the_schema_is_refused(tmp_path: Path) -> None:
    """Fix [I3] : la route repond 400, pas 500, et la page reste intacte."""
    db_file = tmp_path / "site.db"
    api, page_id, _, _ = make_api_with_seed(db_file)
    with TestClient(api) as client:
        cookies, headers = auth()
        published = client.post(f"{BASE}/pages/{page_id}/publish", cookies=cookies, headers=headers)
        assert published.status_code == 200
        revision_id = published.json()["revision_id"]

    connection = db_module.connect(db_file)
    try:
        row = connection.execute("SELECT snapshot FROM revisions WHERE id = ?", (revision_id,)).fetchone()
        snapshot = json.loads(row["snapshot"])
        snapshot["sections"][0]["data"] = json.dumps({"title": 42})
        before = [tuple(r) for r in connection.execute("SELECT id, data, draft FROM sections WHERE page_id = ? ORDER BY id", (page_id,))]
        connection.execute("UPDATE revisions SET snapshot = ? WHERE id = ?", (json.dumps(snapshot), revision_id))
        connection.commit()
    finally:
        connection.close()

    with TestClient(api) as client:
        cookies, headers = auth()
        response = client.post(f"{BASE}/pages/{page_id}/revisions/{revision_id}/restore", cookies=cookies, headers=headers)
    assert response.status_code == 400
    assert response.json()["error"]["rule"] == "bad_type"

    connection = db_module.connect(db_file)
    try:
        after = [tuple(r) for r in connection.execute("SELECT id, data, draft FROM sections WHERE page_id = ? ORDER BY id", (page_id,))]
    finally:
        connection.close()
    assert after == before
