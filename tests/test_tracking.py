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


def test_suppression_d_une_consultation(client: TestClient, conn: sqlite3.Connection) -> None:
    import re

    client.post("/admin/connexion", data={"password": "mot-de-passe-de-test"})
    client.post("/api/track/vue", json={"slug": "n2e", "evenement": "ouverture", "session": "y"})
    page = client.get("/admin/propositions").text
    vue_id = conn.execute("SELECT id FROM proposition_vues").fetchone()[0]
    csrf = re.search(r'name="csrf" value="([^"]+)"', page).group(1)
    response = client.post(f"/admin/propositions/{vue_id}/supprimer", data={"csrf": csrf})
    assert response.status_code in (200, 303)
    assert conn.execute("SELECT COUNT(*) FROM proposition_vues").fetchone()[0] == 0


# ------------------------------------------------------------------ garde-fous


def test_limiteur_refuse_au_dela_de_120_appels_par_heure(client: TestClient) -> None:
    """La limite de 120 événements/h/IP est réellement appliquée (429 au 121e)."""
    for index in range(120):
        reponse = client.post(
            "/api/track/vue",
            json={"slug": "n2e", "evenement": "ouverture", "session": f"limite-{index}"},
        )
        assert reponse.status_code == 200
    refus = client.post(
        "/api/track/vue",
        json={"slug": "n2e", "evenement": "ouverture", "session": "limite-120"},
    )
    assert refus.status_code == 429
    assert refus.json()["ok"] is False


def test_page_propositions_exige_une_session(client: TestClient) -> None:
    """Sans session : redirection vers la connexion, aucune donnée dans la réponse."""
    reponse = client.get("/admin/propositions", follow_redirects=False)
    assert reponse.status_code == 303
    assert reponse.headers["location"] == "/admin/connexion"
    assert "N2E" not in reponse.text
    assert "proposition_vues" not in reponse.text


def test_suppression_sans_csrf_refusee(client: TestClient, conn: sqlite3.Connection) -> None:
    """Une consultation ne se supprime pas sans jeton anti-CSRF valide."""
    client.post("/admin/connexion", data={"password": "mot-de-passe-de-test"})
    client.post("/api/track/vue", json={"slug": "n2e", "evenement": "ouverture", "session": "z"})
    vue_id = conn.execute("SELECT id FROM proposition_vues").fetchone()[0]

    sans_jeton = client.post(f"/admin/propositions/{vue_id}/supprimer", data={})
    assert sans_jeton.status_code == 403

    faux_jeton = client.post(f"/admin/propositions/{vue_id}/supprimer", data={"csrf": "faux"})
    assert faux_jeton.status_code == 403

    assert conn.execute("SELECT COUNT(*) FROM proposition_vues").fetchone()[0] == 1


def test_suppression_sans_session_refusee(client: TestClient, conn: sqlite3.Connection) -> None:
    """Même avec un jeton, aucune écriture sans cookie de session admin."""
    client.post("/api/track/vue", json={"slug": "n2e", "evenement": "ouverture", "session": "w"})
    vue_id = conn.execute("SELECT id FROM proposition_vues").fetchone()[0]
    reponse = client.post(f"/admin/propositions/{vue_id}/supprimer", data={"csrf": "peu-importe"})
    assert reponse.status_code == 403
    assert conn.execute("SELECT COUNT(*) FROM proposition_vues").fetchone()[0] == 1


# ---------------------------------------------------------------------- purge


def test_purge_supprime_les_vues_de_plus_de_12_mois(conn: sqlite3.Connection) -> None:
    from app import tracking

    for session in ("ancienne-1", "ancienne-2"):
        conn.execute(
            "INSERT INTO proposition_vues (slug, session, evenement, created_at)"
            " VALUES ('n2e', ?, 'ouverture', datetime('now', '-13 months'))",
            (session,),
        )
    conn.execute(
        "INSERT INTO proposition_vues (slug, session, evenement, created_at)"
        " VALUES ('n2e', 'recente', 'ouverture', datetime('now', '-11 months'))"
    )
    conn.commit()

    supprimees = tracking.purger_vues(conn, aujourdhui="2026-11-05")
    assert supprimees == 2
    restantes = conn.execute("SELECT session FROM proposition_vues").fetchall()
    assert [row["session"] for row in restantes] == ["recente"]

    # Une seule passe par jour : la seconde ne touche plus à rien.
    assert tracking.purger_vues(conn, aujourdhui="2026-11-05") == 0
    # Le lendemain, la purge repart (et ne trouve plus rien à supprimer).
    assert tracking.purger_vues(conn, aujourdhui="2026-11-06") == 0


def test_aucune_police_chargee_chez_google() -> None:
    """Les pages propositions ne contactent plus fonts.googleapis.com."""
    from pathlib import Path

    dossier = Path(__file__).resolve().parents[1] / "web" / "public" / "propositions"
    coupables = [
        str(fichier.relative_to(dossier))
        for fichier in dossier.rglob("*")
        if fichier.is_file() and fichier.suffix in {".html", ".js", ".css"}
        and "fonts.googleapis.com" in fichier.read_text(encoding="utf-8", errors="ignore")
    ]
    assert coupables == []

