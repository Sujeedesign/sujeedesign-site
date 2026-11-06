"""Garde-fous de l'admin : écritures partielles et retour arrière.

Ces tests verrouillent deux protections nées d'incidents réels : un envoi
partiel qui vidait les visuels d'un projet, et une fiche écrasée sans moyen de
revenir à la version précédente.
"""

from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse

import pytest
from fastapi.testclient import TestClient

from app import catalogue, security
from app.admin import CSRF_PURPOSE, CSRF_TTL

ROOT = Path(__file__).resolve().parents[1]


def _session_csrf(client: TestClient) -> str:
    session = client.cookies.get(security.SESSION_COOKIE, "")
    return security.make_token(CSRF_PURPOSE, CSRF_TTL, key="sess:" + security.session_nonce(session))


_TOKEN: list[str] = []


@pytest.fixture()
def logged(client: TestClient) -> TestClient:
    response = client.post(
        "/admin/connexion",
        data={"password": "mot-de-passe-de-test"},
        follow_redirects=False,
    )
    assert response.status_code == 303, response.text
    _TOKEN.clear()
    _TOKEN.append(_session_csrf(client))
    return client


def _creer(client: TestClient, nom: str = "Fiche protégée") -> int:
    response = client.post(
        "/admin/projets",
        data={
            "csrf": _TOKEN[0],
            "nom": nom,
            "statut": "brouillon",
            "ton": "paper",
            "image_src": "/medias/a.jpg",
            "image_alt": "flacon",
            "image_w": "1600",
            "image_h": "1200",
        },
        follow_redirects=False,
    )
    assert response.status_code == 303, response.text[:400]
    path = urlparse(response.headers["location"]).path.rstrip("/")
    return int(path.split("/")[-1])


def _details(client: TestClient, projet_id: int) -> str:
    response = client.get(f"/admin/projets/{projet_id}")
    assert response.status_code == 200
    return response.text


def test_envoi_partiel_conserve_les_visuels(logged: TestClient, conn) -> None:
    projet_id = _creer(logged)

    logged.post(
        "/admin/projets",
        data={"csrf": _TOKEN[0], "id": str(projet_id), "nom": "Fiche renommée"},
        follow_redirects=False,
    )

    projet = catalogue.get_projet(conn, projet_id)
    assert [item["src"] for item in projet["images"]] == ["/medias/a.jpg"]


def test_marqueur_permet_de_vider_les_visuels(logged: TestClient, conn) -> None:
    projet_id = _creer(logged)

    logged.post(
        "/admin/projets",
        data={"csrf": _TOKEN[0], "id": str(projet_id), "nom": "Sans visuel", "images_present": "1"},
        follow_redirects=False,
    )

    assert catalogue.get_projet(conn, projet_id)["images"] == []


def test_gabarit_signale_les_repetiteurs() -> None:
    gabarit = (ROOT / "app/admin_templates/projet_form.html").read_text(encoding="utf-8")
    for marqueur in ("images_present", "sections_present", "results_present"):
        assert f'name="{marqueur}"' in gabarit


def test_restauration_dune_version(logged: TestClient) -> None:
    projet_id = _creer(logged, "Titre initial")
    page = _details(logged, projet_id)
    csrf = page.split('name="csrf" value="')[1].split('"')[0]

    logged.post(
        "/admin/projets",
        data={"csrf": csrf, "id": str(projet_id), "nom": "Titre modifié", "images_present": "1", "image_src": "/medias/a.jpg"},
        follow_redirects=False,
    )
    page = _details(logged, projet_id)
    assert "Titre modifié" in page
    assert "Versions enregistrées" in page

    revision_id = page.split(f"/admin/projets/{projet_id}/restaurer/")[1].split('"')[0]
    csrf = page.split('name="csrf" value="')[1].split('"')[0]
    restore = logged.post(
        f"/admin/projets/{projet_id}/restaurer/{revision_id}",
        data={"csrf": csrf},
        follow_redirects=False,
    )
    assert restore.status_code == 303
    page = _details(logged, projet_id)
    assert "Titre initial" in page


def test_images_du_site_en_lecture_seule(logged: TestClient) -> None:
    response = logged.get("/admin/medias/site")
    assert response.status_code == 200
    assert "Images du site" in response.text
    # La page ne propose aucun téléversement : elle inventorie, elle ne modifie pas.
    assert 'action="/admin/medias/site" enctype' not in response.text
    assert "/admin/medias/site" in logged.get("/admin/medias").text
