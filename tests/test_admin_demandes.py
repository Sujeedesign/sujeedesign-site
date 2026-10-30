"""Back office : liste et suppression des demandes du chat agent."""

from __future__ import annotations

import re
import sqlite3

from fastapi.testclient import TestClient

PASSWORD = "mot-de-passe-de-test"


def _login(client: TestClient) -> TestClient:
    response = client.post("/admin/connexion", data={"password": PASSWORD}, follow_redirects=False)
    assert response.status_code == 303, response.text
    return client


def _csrf(client: TestClient, path: str) -> str:
    html = client.get(path).text
    match = re.search(r'name="csrf" value="([^"]+)"', html)
    assert match, f"aucun jeton CSRF sur {path}"
    return match.group(1)


def _lead(conn: sqlite3.Connection, reference: str = "DEM-2026-0001") -> int:
    cursor = conn.execute(
        """
        INSERT INTO agent_leads (reference, session_id, name, email, phone, fields, summary, status, event_id, slot_start)
        VALUES (?, 'sid', 'Camille Roy', 'camille@exemple.fr', '0600000000',
                '{"project_type": "refonte identité", "deadline": "mars"}',
                'Refonte d''identité pour un studio de yoga.', 'qualifie', 'evt1', '2026-11-02T09:00:00+01:00')
        """,
        (reference,),
    )
    conn.execute(
        "INSERT INTO agent_bookings (slot_start, session_id, event_id, email) VALUES (?, 'sid', 'evt1', 'camille@exemple.fr')",
        ("2026-11-02T09:00:00+01:00",),
    )
    conn.commit()
    assert cursor.lastrowid is not None
    return int(cursor.lastrowid)


def test_demandes_est_protege(client: TestClient) -> None:
    response = client.get("/admin/demandes", follow_redirects=False)
    assert response.status_code == 303
    assert "/admin/connexion" in response.headers["location"]


def test_demandes_liste_les_leads(client: TestClient, conn: sqlite3.Connection) -> None:
    _lead(conn)
    _login(client)

    html = client.get("/admin/demandes").text

    assert "Camille Roy" in html
    assert "camille@exemple.fr" in html
    assert "DEM-2026-0001" in html
    assert "Refonte d&#39;identité pour un studio de yoga." in html or "Refonte d'identité" in html
    assert "nature du projet" in html
    assert "lundi 2 novembre à 09:00" in html


def test_supprimer_une_demande_libere_le_creneau(client: TestClient, conn: sqlite3.Connection) -> None:
    lead_id = _lead(conn)
    _login(client)
    token = _csrf(client, "/admin/demandes")

    response = client.post(
        f"/admin/demandes/{lead_id}/supprimer", data={"csrf": token}, follow_redirects=False
    )

    assert response.status_code == 303
    assert response.headers["location"].startswith("/admin/demandes")
    assert conn.execute("SELECT COUNT(*) AS n FROM agent_leads").fetchone()["n"] == 0
    assert conn.execute("SELECT COUNT(*) AS n FROM agent_bookings").fetchone()["n"] == 0
