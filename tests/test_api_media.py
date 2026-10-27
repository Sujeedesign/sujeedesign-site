"""Médiathèque par API : import d'images avec jeton porteur."""

from __future__ import annotations

import io

from typing import Any

import pytest
from fastapi.testclient import TestClient

TOKEN = "jeton-api-de-test"
AUTH = {"Authorization": f"Bearer {TOKEN}"}

# Plus petit PNG valide (1x1, transparent).
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
)


@pytest.fixture()
def api(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("SITE_API_TOKEN", TOKEN)
    return client


def _upload(api: TestClient, filename: str, **data: Any) -> Any:
    files = {"fichier": ("photo.png", io.BytesIO(PNG), "image/png")}
    payload = {"filename": filename, **data}
    return api.post("/api/v1/admin/media", files=files, data=payload, headers=AUTH)


def test_import_refuse_sans_jeton(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SITE_API_TOKEN", TOKEN)
    files = {"fichier": ("photo.png", io.BytesIO(PNG), "image/png")}
    response = client.post("/api/v1/admin/media", files=files)
    assert response.status_code == 401


def test_importe_une_image_et_la_liste(api: TestClient) -> None:
    response = _upload(api, "elerya-01", alt="Sac Elerya en cuir cognac")
    assert response.status_code == 201
    body = response.json()
    assert body["created"] is True
    assert body["media"]["filename"] == "elerya-01.png"
    assert body["media"]["path"] == "/medias/elerya-01.png"
    assert body["media"]["alt"] == "Sac Elerya en cuir cognac"

    media_file = api.app.state.media_dir / "elerya-01.png"
    assert media_file.exists()
    assert media_file.read_bytes() == PNG

    listing = api.get("/api/v1/admin/media", headers=AUTH)
    assert listing.status_code == 200
    payload = listing.json()
    assert payload["total"] == 1
    assert payload["items"][0]["filename"] == "elerya-01.png"


def test_nom_de_fichier_normalise(api: TestClient) -> None:
    response = _upload(api, "Élerya — Vue studio 01")
    assert response.status_code == 201
    assert response.json()["media"]["filename"] == "elerya-vue-studio-01.png"


def test_refuse_le_doublon_sans_ecrasement(api: TestClient) -> None:
    assert _upload(api, "dekra-01", alt="Diapositive DEKRA").status_code == 201
    duplicate = _upload(api, "dekra-01", alt="Autre texte")
    assert duplicate.status_code == 409


def test_ecrase_et_met_a_jour_la_fiche(api: TestClient) -> None:
    assert _upload(api, "dekra-01", alt="Ancien texte").status_code == 201
    updated = _upload(api, "dekra-01", alt="Diapositive DEKRA, contexte", overwrite=True)
    assert updated.status_code == 200
    assert updated.json()["created"] is False

    payload = api.get("/api/v1/admin/media", headers=AUTH).json()
    assert payload["total"] == 1
    assert payload["items"][0]["alt"] == "Diapositive DEKRA, contexte"


def test_refuse_un_format_non_image(api: TestClient) -> None:
    files = {"fichier": ("script.js", io.BytesIO(b"alert(1)"), "text/javascript")}
    response = api.post("/api/v1/admin/media", files=files, headers=AUTH)
    assert response.status_code == 415
