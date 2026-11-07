"""Catalogue exposé à la vitrine : amorçage des fiches et route publique."""

from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from fastapi.testclient import TestClient
import pytest

from app import catalogue, db


def _seed() -> list[dict]:
    return json.loads(Path(catalogue.SEED_PATH).read_text(encoding="utf-8"))["projets"]


def _seed_prestations() -> list[dict]:
    return json.loads(Path(catalogue.SEED_PATH).read_text(encoding="utf-8"))["prestations"]


def _connect(tmp_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(tmp_path / "catalogue.db")
    conn.row_factory = sqlite3.Row
    db.init_db(conn)
    return conn


def test_seed_reprend_les_fiches_du_site_une_seule_fois(tmp_path: Path) -> None:
    conn = _connect(tmp_path)
    attendu = len(_seed()) + len(_seed_prestations())

    assert catalogue.seed_from_file(conn) == attendu
    assert catalogue.seed_from_file(conn) == 0
    assert conn.execute("SELECT COUNT(*) FROM projets").fetchone()[0] == len(_seed())
    assert conn.execute("SELECT COUNT(*) FROM prestations").fetchone()[0] == len(
        _seed_prestations()
    )


def test_seed_ne_ressuscite_pas_une_fiche_supprimee(tmp_path: Path) -> None:
    conn = _connect(tmp_path)
    catalogue.seed_from_file(conn)
    conn.execute("DELETE FROM projets WHERE slug = 'dekra'")
    conn.commit()

    assert catalogue.seed_from_file(conn) == 0
    assert conn.execute("SELECT 1 FROM projets WHERE slug = 'dekra'").fetchone() is None


def test_seed_reprend_les_prestations_du_site(tmp_path: Path) -> None:
    conn = _connect(tmp_path)
    catalogue.seed_from_file(conn)

    lignes = {
        row["slug"]: row
        for row in conn.execute("SELECT slug, nom, duree, livrables, statut FROM prestations")
    }
    source = {p["slug"]: p for p in _seed_prestations()}

    assert set(lignes) == set(source)
    assert lignes["identite-de-marque"]["nom"] == "Identité de marque"
    assert lignes["identite-de-marque"]["statut"] == "publie"
    assert json.loads(lignes["agents-ia"]["livrables"]) == source["agents-ia"]["livrables"]

    # Même règle que les fiches : une prestation supprimée ne revient pas.
    conn.execute("DELETE FROM prestations WHERE slug = 'agents-ia'")
    conn.commit()
    assert catalogue.seed_from_file(conn) == 0
    assert conn.execute("SELECT 1 FROM prestations WHERE slug = 'agents-ia'").fetchone() is None


def test_export_garde_la_couverture_separee_de_la_galerie(tmp_path: Path) -> None:
    conn = _connect(tmp_path)
    catalogue.seed_from_file(conn)

    projets = {p["slug"]: p for p in catalogue.export_site(conn)["projects"]}
    club_med = projets["club-med"]
    source = next(p for p in _seed() if p["slug"] == "club-med")

    assert club_med["cover"] == source["cover"]
    assert club_med["images"] == source["images"]
    assert all(image["src"] != club_med["cover"]["src"] for image in club_med["images"])

    # Sans couverture propre, on retombe sur la première image, comme le site.
    logofolio = projets["logofolio"]
    assert logofolio["cover"] == logofolio["images"][0]


def test_portrait_mobile_optionnel_dans_le_catalogue(tmp_path: Path) -> None:
    """Sans portrait, la fiche reste paysage ; avec, la vitrine reçoit la clé."""
    conn = _connect(tmp_path)
    catalogue.seed_from_file(conn)
    projets = {p["slug"]: p for p in catalogue.export_site(conn)["projects"]}

    # Le catalogue historique n'a aucun portrait : aucune clé émise.
    assert "coverPortrait" not in projets["club-med"]

    projet_id = catalogue.save_projet(
        conn,
        {
            "nom": "Projet portrait",
            "slug": "projet-portrait",
            "statut": "publie",
            "ton": "paper",
            "cover_portrait_src": "/medias/projet-portrait-cover-portrait.jpg",
            "cover_portrait_alt": "Affiche verticale du projet",
            "cover_portrait_w": "1080",
            "cover_portrait_h": "1920",
        },
    )

    attendu = {
        "src": "/medias/projet-portrait-cover-portrait.jpg",
        "alt": "Affiche verticale du projet",
        "width": 1080,
        "height": 1920,
    }
    fiche = catalogue.get_projet(conn, projet_id)
    assert fiche is not None and fiche["coverPortrait"] == attendu
    servis = {p["slug"]: p for p in catalogue.export_site(conn)["projects"]}
    assert servis["projet-portrait"]["coverPortrait"] == attendu
    # La couverture paysage n'est pas inventée pour autant.
    assert "cover" not in servis["projet-portrait"]


def test_portrait_incomplet_est_refuse(tmp_path: Path) -> None:
    conn = _connect(tmp_path)

    for extra in (
        {},
        {"cover_portrait_w": "1080"},
        {"cover_portrait_h": "1920"},
    ):
        form = {
            "nom": "Portrait incomplet",
            "slug": "portrait-incomplet",
            "cover_portrait_src": "/medias/portrait.jpg",
        }
        form.update(extra)
        with pytest.raises(ValueError, match="largeur et hauteur"):
            catalogue.save_projet(conn, form)

    assert conn.execute("SELECT COUNT(*) FROM projets").fetchone()[0] == 0


def test_mise_a_jour_sans_champ_portrait_conserve_le_portrait(tmp_path: Path) -> None:
    conn = _connect(tmp_path)
    projet_id = catalogue.save_projet(
        conn,
        {
            "nom": "Projet portrait",
            "slug": "projet-portrait",
            "cover_portrait_src": "/medias/portrait.jpg",
            "cover_portrait_w": "1080",
            "cover_portrait_h": "1920",
        },
    )

    # Le formulaire d'édition sans les champs portrait ne doit pas l'effacer.
    catalogue.save_projet(conn, {"nom": "Projet renommé"}, projet_id)

    fiche = catalogue.get_projet(conn, projet_id)
    assert fiche is not None
    portrait = fiche["coverPortrait"]
    assert portrait and portrait["src"] == "/medias/portrait.jpg"
    assert portrait["width"] == 1080 and portrait["height"] == 1920


def test_route_catalogue_sert_le_catalogue_publie(client: TestClient) -> None:
    response = client.get("/api/v1/catalogue")

    assert response.status_code == 200
    assert response.headers["cache-control"].startswith("public, max-age=60")
    payload = response.json()
    assert {p["slug"] for p in payload["projects"]} >= {"club-med", "logofolio"}
    assert payload["projects"][0]["index"] == "01"


def test_route_catalogue_repond_304_sur_etag_identique(client: TestClient) -> None:
    first = client.get("/api/v1/catalogue")
    etag = first.headers["etag"]

    second = client.get("/api/v1/catalogue", headers={"If-None-Match": etag})

    assert second.status_code == 304
    assert second.content == b""


def test_route_catalogue_ignore_les_brouillons(client: TestClient, db_file: Path) -> None:
    conn = sqlite3.connect(db_file)
    conn.row_factory = sqlite3.Row
    catalogue.save_projet(
        conn,
        {
            "nom": "Projet caché",
            "slug": "projet-cache",
            "statut": "brouillon",
            "ton": "paper",
        },
    )
    conn.commit()
    conn.close()

    slugs = [p["slug"] for p in client.get("/api/v1/catalogue").json()["projects"]]

    assert "projet-cache" not in slugs


def test_route_catalogue_sert_le_portrait_et_replie_sur_le_paysage(
    client: TestClient, db_file: Path
) -> None:
    """La vitrine reçoit `coverPortrait` s'il existe, rien sinon (repli paysage)."""
    conn = sqlite3.connect(db_file)
    conn.row_factory = sqlite3.Row
    catalogue.save_projet(
        conn,
        {
            "nom": "Projet portrait publié",
            "slug": "projet-portrait-publie",
            "statut": "publie",
            "ton": "paper",
            "cover_portrait_src": "/medias/projet-portrait-publie-cover-portrait.jpg",
            "cover_portrait_alt": "Affiche verticale du projet",
            "cover_portrait_w": "1080",
            "cover_portrait_h": "1920",
        },
    )
    conn.commit()
    conn.close()

    projets = {p["slug"]: p for p in client.get("/api/v1/catalogue").json()["projects"]}

    assert projets["projet-portrait-publie"]["coverPortrait"] == {
        "src": "/medias/projet-portrait-publie-cover-portrait.jpg",
        "alt": "Affiche verticale du projet",
        "width": 1080,
        "height": 1920,
    }
    # Fiche sans portrait (American Steak House) : aucune clé, donc repli paysage.
    assert "american-steak-house" in projets
    assert "coverPortrait" not in projets["american-steak-house"]
    assert projets["american-steak-house"]["cover"]["src"].endswith("cover.jpg")


def test_route_catalogue_expose_updated_at_pour_le_plan_de_site(client: TestClient) -> None:
    """Le `lastmod` des fiches dépend de cette clé : jour ISO, un par projet."""
    reponse = client.get("/api/v1/catalogue")

    assert reponse.status_code == 200
    projets = reponse.json()["projects"]
    assert projets
    for projet in projets:
        assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", projet.get("updated_at") or ""), projet["slug"]


def test_updated_at_suit_une_edition_de_fiche(tmp_path: Path) -> None:
    """Une modification enregistrée dans l'admin doit dater la fiche à ce jour."""
    conn = _connect(tmp_path)
    catalogue.seed_from_file(conn)
    conn.execute("UPDATE projets SET updated_at = '2026-10-01 08:30:00' WHERE slug = 'club-med'")
    conn.commit()

    avant = catalogue.get_projet_by_slug(conn, "club-med")
    assert avant is not None
    avant_dekra = {p["slug"]: p for p in catalogue.export_site(conn)["projects"]}["dekra"]["updated_at"]
    assert avant["updated_at"].startswith("2026-10-01")

    catalogue.save_projet(
        conn,
        {
            "nom": avant["nom"],
            "slug": avant["slug"],
            "client": avant["client"],
            "annee": avant["annee"],
            "ville": avant["ville"],
            "pitch": "Présentation réécrite dans l'admin, sans changer le reste.",
            "scope": avant["scope"],
            "duree": avant["duree"],
            "ton": avant["ton"],
            "statut": avant["statut"],
            "disciplines": "\n".join(avant["disciplines"]),
            "tags": "\n".join(avant["tags"]),
            "images": avant["images"],
        },
        int(avant["id"]),
    )

    projets = {p["slug"]: p for p in catalogue.export_site(conn)["projects"]}
    aujourdhui = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # La fiche éditée bouge, les autres gardent leur date.
    assert projets["club-med"]["updated_at"] == aujourdhui
    assert projets["dekra"]["updated_at"] == avant_dekra
