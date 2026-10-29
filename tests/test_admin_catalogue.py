"""Écrans catalogue de l'admin : projets et prestations.

Couvre la liste, la création, l'édition, la bascule de statut, le
réordonnancement, la suppression et l'export JSON consommé par la vitrine.
"""

from __future__ import annotations

import json
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from app.admin import csrf_token


@pytest.fixture()
def logged(client: TestClient) -> TestClient:
    response = client.post(
        "/admin/connexion",
        data={"password": "mot-de-passe-de-test"},
        follow_redirects=False,
    )
    assert response.status_code == 303, response.text
    return client


def _form(nom: str, **extra: object) -> dict[str, object]:
    data: dict[str, object] = {"csrf": csrf_token(), "nom": nom, "statut": "brouillon", "ton": "paper"}
    data.update(extra)
    return data


def test_nav_groupes_et_pages_catalogue(logged: TestClient) -> None:
    for path in ("/admin", "/admin/projets", "/admin/prestations"):
        response = logged.get(path)
        assert response.status_code == 200, (path, response.text[:400])
        assert "Sujee Design" in response.text
        assert "nav-link" in response.text
    dashboard = logged.get("/admin").text
    assert "Catalogue" in dashboard
    assert "/admin/projets" in dashboard
    assert "/admin/prestations" in dashboard
    assert "/admin/apercu" not in dashboard


def test_apercu_supprime(logged: TestClient) -> None:
    assert logged.get("/admin/apercu").status_code == 404


def test_static_admin_monte(logged: TestClient) -> None:
    css = logged.get("/static-admin/admin.css")
    assert css.status_code == 200
    assert "--accent" in css.text
    js = logged.get("/static-admin/admin.js")
    assert js.status_code == 200
    assert "data-repeat" in js.text


def test_cycle_projet(logged: TestClient) -> None:
    create = logged.post(
        "/admin/projets",
        data=_form(
            "Identité Vaasam",
            client="Vaasam Paris",
            annee="2026",
            ville="Paris",
            pitch="Une maison qui respire.",
            scope="Direction artistique, packaging",
            disciplinaire="",
            disciplines="Identité\nPackaging",
            tags="retail\nparfum",
            image_src="/medias/a.jpg",
            image_alt="flacon",
            image_w="1600",
            image_h="1200",
            image_src2="",
            section_k="01",
            section_label="Contexte",
            section_title="Repartir du geste",
            section_body="Premier paragraphe.\n\nSecond paragraphe.",
            section_bullets="Audit\nTerrain",
            result_value="+35 %",
            result_label="trafic organique",
        ),
        follow_redirects=False,
    )
    assert create.status_code == 303, create.text[:500]
    location = create.headers["location"]
    projet_id = int(urlparse(location).path.rstrip("/").split("/")[-1])

    detail = logged.get(location)
    assert detail.status_code == 200
    assert "Identité Vaasam" in detail.text
    assert "Repartir du geste" in detail.text

    listing = logged.get("/admin/projets")
    assert "Identité Vaasam" in listing.text
    assert "brouillon" in listing.text

    publish = logged.post(
        f"/admin/projets/{projet_id}/statut",
        data={"csrf": csrf_token(), "statut": "publie"},
        follow_redirects=False,
    )
    assert publish.status_code == 303

    published = logged.get("/admin/projets?statut=publie")
    assert "Identité Vaasam" in published.text

    export = logged.get("/admin/catalogue/export.json")
    assert export.status_code == 200
    payload = export.json()
    assert any(item["slug"] for item in payload["projects"])
    assert payload["projects"][0]["name"] == "Identité Vaasam"
    assert payload["projects"][0]["tone"] == "paper"

    move = logged.post(
        f"/admin/projets/{projet_id}/position",
        data={"csrf": csrf_token(), "dir": "down"},
        follow_redirects=False,
    )
    assert move.status_code == 303

    delete = logged.post(
        f"/admin/projets/{projet_id}/supprimer",
        data={"csrf": csrf_token()},
        follow_redirects=False,
    )
    assert delete.status_code == 303
    assert "Identité Vaasam" not in logged.get("/admin/projets").text


def test_cycle_prestation(logged: TestClient) -> None:
    create = logged.post(
        "/admin/prestations",
        data=_form(
            "Identité visuelle",
            accroche="Une marque qui tient debout",
            description="Direction artistique complète.",
            prix="2 200 €",
            duree="6 semaines",
            livrables="Logo\nCharte\nDéclinaisons",
        ),
        follow_redirects=False,
    )
    assert create.status_code == 303, create.text[:500]
    prestation_id = int(urlparse(create.headers["location"]).path.rstrip("/").split("/")[-1])

    detail = logged.get(f"/admin/prestations/{prestation_id}")
    assert detail.status_code == 200
    assert "Identité visuelle" in detail.text

    listing = logged.get("/admin/prestations")
    assert "Identité visuelle" in listing.text
    assert "2 200 €" in listing.text

    logged.post(
        f"/admin/prestations/{prestation_id}/statut",
        data={"csrf": csrf_token(), "statut": "publie"},
        follow_redirects=False,
    )
    export = logged.get("/admin/catalogue/export.json").json()
    assert any(item["name"] == "Identité visuelle" for item in export["services"])

    deleted = logged.post(
        f"/admin/prestations/{prestation_id}/supprimer",
        data={"csrf": csrf_token()},
        follow_redirects=False,
    )
    assert deleted.status_code == 303
    assert "Identité visuelle" not in logged.get("/admin/prestations").text


def test_formulaires_vierges(logged: TestClient) -> None:
    projet = logged.get("/admin/projets/nouveau")
    assert projet.status_code == 200
    assert 'name="image_src"' in projet.text
    assert "data-repeat" in projet.text

    prestation = logged.get("/admin/prestations/nouveau")
    assert prestation.status_code == 200
    assert 'name="livrables"' in prestation.text
