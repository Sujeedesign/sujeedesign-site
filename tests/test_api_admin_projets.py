"""Écriture tokenisée du catalogue : mise à jour, création, refus, 404.

Ces tests couvrent le point d'écriture qui manquait : jusqu'ici seule la session
du formulaire HTML permettait de modifier une fiche, donc chaque correction de
contenu imposait un redéploiement et une retouche du seed (qui n'insère que les
slugs absents).
"""

from __future__ import annotations

from typing import Any

import pytest

TOKEN = "jeton-api-de-test"
AUTH = {"Authorization": f"Bearer {TOKEN}"}
ENDPOINT = "/api/v1/admin/projets"
SLUG = "american-steak-house"


@pytest.fixture()
def api(client, monkeypatch):
    monkeypatch.setenv("SITE_API_TOKEN", TOKEN)
    monkeypatch.delenv("COOLIFY_TOKEN", raising=False)
    monkeypatch.delenv("SITE_REVALIDATE_URL", raising=False)
    return client


def _catalogue(api) -> dict[str, Any]:
    response = api.get("/api/v1/catalogue")
    assert response.status_code == 200
    return {item["slug"]: item for item in response.json()["projects"]}


def _image(index: int, **extra: Any) -> dict[str, Any]:
    return {
        "src": f"/assets/img/projet/{SLUG}/{index:02d}.jpg",
        "alt": f"Texte alternatif corrigé {index}",
        "width": 2400,
        "height": 1350,
        **extra,
    }


def test_met_a_jour_une_fiche_existante(api):
    avant = _catalogue(api)[SLUG]
    total = len(avant["images"]) + 1
    images = [_image(index) for index in range(1, total + 1)]
    pitch = "Un pitch corrigé depuis l'API, sans passer par le formulaire."

    response = api.put(
        f"{ENDPOINT}/{SLUG}",
        headers={**AUTH, "X-Author": "sujee"},
        json={"pitch": pitch, "images": images},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["ok"] is True
    assert body["slug_changed"] is False
    assert body["author"] == "sujee"
    assert body["projet"]["slug"] == SLUG
    assert body["projet"]["images"] == total

    apres = _catalogue(api)[SLUG]
    assert len(apres["images"]) == total
    assert [item["alt"] for item in apres["images"]] == [item["alt"] for item in images]
    assert apres["pitch"] == pitch
    # Mise à jour partielle : les champs absents du corps restent en base.
    assert apres["name"] == avant["name"]
    assert apres["client"] == avant["client"]
    assert apres["tone"] == avant["tone"]
    assert apres["sections"] == avant["sections"]


def test_mise_a_jour_partielle_ne_touche_pas_la_galerie(api):
    avant = _catalogue(api)[SLUG]

    response = api.put(f"{ENDPOINT}/{SLUG}", headers=AUTH, json={"client": "American Steak House"})

    assert response.status_code == 200, response.text
    apres = _catalogue(api)[SLUG]
    assert apres["client"] == "American Steak House"
    assert apres["images"] == avant["images"]
    assert apres["cover"] == avant["cover"]


def test_refuse_une_image_sans_src(api):
    avant = _catalogue(api)[SLUG]

    response = api.put(
        f"{ENDPOINT}/{SLUG}",
        headers=AUTH,
        json={"images": [_image(1), {**_image(2), "src": ""}]},
    )

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "Image 2" in detail and "src" in detail
    assert _catalogue(api)[SLUG]["images"] == avant["images"]


def test_refuse_une_image_sans_dimensions(api):
    avant = _catalogue(api)[SLUG]
    incomplete = {"src": "/assets/img/projet/sans-dimensions.jpg", "alt": "Sans dimensions"}

    response = api.put(f"{ENDPOINT}/{SLUG}", headers=AUTH, json={"images": [incomplete]})

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "Image 1" in detail and "obligatoire" in detail
    assert "width" in detail or "height" in detail
    assert _catalogue(api)[SLUG]["images"] == avant["images"]


def test_refuse_une_couverture_incomplete(api):
    response = api.put(
        f"{ENDPOINT}/{SLUG}",
        headers=AUTH,
        json={"cover": {"src": "/assets/img/projet/cover.jpg", "alt": "Cover"}},
    )

    assert response.status_code == 422
    assert "Couverture" in response.json()["detail"]


def test_slug_inconnu_repond_404(api):
    response = api.put(f"{ENDPOINT}/fiche-inexistante", headers=AUTH, json={"nom": "Fantôme"})

    assert response.status_code == 404
    assert "fiche-inexistante" in response.json()["detail"]


def test_sans_jeton_repond_401(api):
    response = api.put(f"{ENDPOINT}/{SLUG}", json={"nom": "Sans jeton"})

    assert response.status_code == 401


def test_cree_une_fiche_sans_seed(api):
    payload = {
        "nom": "Fiche créée par l'API",
        "client": "Interne",
        "annee": "2026",
        "ville": "Paris",
        "pitch": "Création directe, sans redéploiement.",
        "ton": "tint",
        "statut": "publie",
        "disciplines": ["Direction artistique"],
        "tags": ["Test"],
        "images": [_image(1)],
        "sections": [
            {"k": "01", "label": "Contexte", "title": "Un titre", "paragraphs": ["Un paragraphe."]}
        ],
        "results": [{"value": "3", "label": "semaines"}],
    }

    response = api.post(ENDPOINT, headers=AUTH, json=payload)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["projet"]["slug"] == "fiche-creee-par-l-api"
    assert body["projet"]["statut"] == "publie"
    assert body["projet"]["images"] == 1

    fiche = _catalogue(api)["fiche-creee-par-l-api"]
    assert fiche["name"] == "Fiche créée par l'API"
    assert fiche["disciplines"] == ["Direction artistique"]
    assert fiche["sections"][0]["title"] == "Un titre"

    # Un second envoi du même nom dédouble le slug au lieu d'écraser la fiche.
    bis = api.post(ENDPOINT, headers=AUTH, json={"nom": "Fiche créée par l'API"})
    assert bis.status_code == 201
    assert bis.json()["projet"]["slug"] == "fiche-creee-par-l-api-2"


def test_creation_refuse_un_nom_vide(api):
    response = api.post(ENDPOINT, headers=AUTH, json={"client": "Sans nom"})

    assert response.status_code == 422
    assert "nom" in response.json()["detail"]
