"""Catalogue exposé à la vitrine : amorçage des fiches et route publique."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

from app import catalogue, db


def _seed() -> list[dict]:
    return json.loads(Path(catalogue.SEED_PATH).read_text(encoding="utf-8"))["projets"]


def _connect(tmp_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(tmp_path / "catalogue.db")
    conn.row_factory = sqlite3.Row
    db.init_db(conn)
    return conn


def test_seed_reprend_les_fiches_du_site_une_seule_fois(tmp_path: Path) -> None:
    conn = _connect(tmp_path)
    attendu = len(_seed())

    assert catalogue.seed_from_file(conn) == attendu
    assert catalogue.seed_from_file(conn) == 0
    assert conn.execute("SELECT COUNT(*) FROM projets").fetchone()[0] == attendu


def test_seed_ne_ressuscite_pas_une_fiche_supprimee(tmp_path: Path) -> None:
    conn = _connect(tmp_path)
    catalogue.seed_from_file(conn)
    conn.execute("DELETE FROM projets WHERE slug = 'dekra'")
    conn.commit()

    assert catalogue.seed_from_file(conn) == 0
    assert conn.execute("SELECT 1 FROM projets WHERE slug = 'dekra'").fetchone() is None


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
