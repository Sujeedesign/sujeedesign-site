"""Suivi de consultation des propositions clients."""

from __future__ import annotations

import sqlite3

from fastapi.testclient import TestClient


def test_ouverture_et_fermeture_sont_enregistrees(client: TestClient, conn: sqlite3.Connection) -> None:
    ouverture = client.post(
        "/api/track/vue",
        json={"slug": "n2e", "evenement": "ouverture", "session": "abc123"},
    )
    assert ouverture.status_code == 200
    assert ouverture.json() == {"ok": True}

    fermeture = client.post(
        "/api/track/vue",
        json={"slug": "n2e", "evenement": "fermeture", "session": "abc123", "secondes": 142},
    )
    assert fermeture.status_code == 200

    rows = conn.execute("SELECT slug, session, secondes FROM proposition_vues").fetchall()
    assert len(rows) == 1
    assert rows[0]["slug"] == "n2e"
    assert rows[0]["secondes"] == 142


def test_slug_inconnu_refuse(client: TestClient, conn: sqlite3.Connection) -> None:
    response = client.post("/api/track/vue", json={"slug": "inconnue", "evenement": "ouverture"})
    assert response.status_code == 404
    assert conn.execute("SELECT COUNT(*) FROM proposition_vues").fetchone()[0] == 0


def test_evenement_inconnu_refuse(client: TestClient) -> None:
    response = client.post("/api/track/vue", json={"slug": "n2e", "evenement": "clic"})
    assert response.status_code == 400


def test_secondes_plafonnees(client: TestClient, conn: sqlite3.Connection) -> None:
    client.post("/api/track/vue", json={"slug": "polyresine", "evenement": "ouverture", "session": "s1"})
    client.post(
        "/api/track/vue",
        json={"slug": "polyresine", "evenement": "fermeture", "session": "s1", "secondes": 999999},
    )
    assert conn.execute("SELECT secondes FROM proposition_vues").fetchone()[0] == 7200


def test_fermeture_sans_ouverture_n_cree_rien(client: TestClient, conn: sqlite3.Connection) -> None:
    client.post(
        "/api/track/vue",
        json={"slug": "n2e", "evenement": "fermeture", "session": "jamais-vu", "secondes": 30},
    )
    assert conn.execute("SELECT COUNT(*) FROM proposition_vues").fetchone()[0] == 0


def test_la_page_admin_liste_les_trois_propositions(client: TestClient) -> None:
    login = client.post("/admin/connexion", data={"password": "mot-de-passe-de-test"})
    assert login.status_code in (200, 303)
    client.post("/api/track/vue", json={"slug": "n2e", "evenement": "ouverture", "session": "x"})
    page = client.get("/admin/propositions")
    assert page.status_code == 200
    assert "N2E Échafaudages" in page.text
    assert "Dimension Nouvelle" in page.text
    assert "Polyrésine" in page.text
