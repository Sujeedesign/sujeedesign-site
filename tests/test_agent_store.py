"""Tests de la persistance de l'agent."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta

from app.agent import store


def test_session_et_messages(conn: sqlite3.Connection) -> None:
    session_id = store.new_session(conn, ip_hash="abc")
    row = store.get_session(conn, session_id)
    assert row is not None
    assert row["step"] == "accueil"
    store.add_message(conn, session_id, "user", "Bonjour")
    store.add_message(conn, session_id, "assistant", "Bonjour, parlons de votre projet")
    history = store.messages(conn, session_id)
    assert [item["role"] for item in history] == ["user", "assistant"]
    assert store.get_session(conn, "inconnu") is None


def test_fusion_champs_et_manquants(conn: sqlite3.Connection) -> None:
    session_id = store.new_session(conn)
    fields = store.merge_fields(
        conn,
        session_id,
        {"project_type": "Identité visuelle", "budget": "  ", "inconnu": "x"},
    )
    assert fields == {"project_type": "Identité visuelle"}
    assert store.missing_fields(fields) == [key for key in store.FIELDS if key != "project_type"]

    fields = store.merge_fields(conn, session_id, {"project_type": "Refonte de site", "context": "PME"})
    assert fields["project_type"] == "Refonte de site"
    assert fields["context"] == "PME"

    row = store.get_session(conn, session_id)
    assert store.session_fields(row)["context"] == "PME"


def test_reference_incrementale(conn: sqlite3.Connection) -> None:
    session_id = store.new_session(conn)
    day = datetime(2026, 10, 30)
    first = store.create_lead(conn, session_id, {"project_type": "Site"}, name="A", email="a@b.co")
    second = store.create_lead(conn, session_id, {"project_type": "Site"}, name="B", email="b@b.co")
    assert first["reference"] == "DEM-2026-0001"
    assert second["reference"] == "DEM-2026-0002"
    assert store.next_reference(conn, day.date()) == "DEM-2026-0003"


def test_reservation_idempotente(conn: sqlite3.Connection) -> None:
    assert store.reserve_slot(conn, "2026-11-02T09:00:00+01:00", "s1", "a@b.co") is True
    assert store.reserve_slot(conn, "2026-11-02T09:00:00+01:00", "s2", "c@d.co") is False
    assert store.bookings_per_day(conn) == {"2026-11-02": 1}
    store.release_slot(conn, "2026-11-02T09:00:00+01:00")
    assert store.bookings_per_day(conn) == {}


def test_mise_a_jour_lead(conn: sqlite3.Connection) -> None:
    session_id = store.new_session(conn)
    lead = store.create_lead(conn, session_id, {}, name="Sujee", email="S@Example.COM")
    assert lead["reference"].startswith("DEM-")
    row = store.get_lead(conn, lead["id"])
    assert row is not None and row["email"] == "s@example.com"
    store.update_lead(conn, lead["id"], status="rdv", event_id="evt", slot_start="2026-11-02T09:00:00+01:00")
    row = store.get_lead(conn, lead["id"])
    assert row is not None
    assert row["status"] == "rdv" and row["event_id"] == "evt"

    assert len(store.list_leads(conn, status="rdv")) == 1
    assert store.list_leads(conn, status="a_trier") == []


def test_purge_conserve_les_rdv(conn: sqlite3.Connection) -> None:
    old = (datetime.now() - timedelta(days=120)).strftime("%Y-%m-%d %H:%M:%S")
    stale = store.new_session(conn)
    booked = store.new_session(conn)
    store.add_message(conn, stale, "user", "vieux message")
    conn.execute("UPDATE agent_sessions SET updated_at = ? WHERE id IN (?, ?)", (old, stale, booked))
    conn.execute("UPDATE agent_sessions SET status = 'rdv' WHERE id = ?", (booked,))
    conn.commit()

    result = store.purge_old(conn, days=90)
    assert result["sessions"] == 1
    assert store.get_session(conn, stale) is None
    assert store.messages(conn, stale) == []
    assert store.get_session(conn, booked) is not None
