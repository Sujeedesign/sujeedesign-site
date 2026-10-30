"""Persistance de l'agent : sessions, messages, leads, réservations."""

from __future__ import annotations

import json
import secrets
import sqlite3
from datetime import date, datetime, timedelta
from typing import Any

FIELDS: tuple[str, ...] = (
    "project_type",
    "context",
    "objective",
    "scope",
    "deadline",
    "decision_maker",
)
FIELD_LABELS = {
    "project_type": "nature du projet",
    "context": "contexte et activité",
    "objective": "objectif",
    "scope": "périmètre et livrables",
    "deadline": "échéance",
    "decision_maker": "décideur et validation",
}
STEPS = ("accueil", "qualification", "recap", "coordonnees", "creneaux", "confirme")
STATUS_OPEN = "ouverte"
STATUS_QUALIFIED = "qualifiee"
STATUS_BOOKED = "rdv"
STATUS_REVIEW = "a_trier"
STATUS_FORM = "formulaire"
STATUS_DROPPED = "abandonnee"

MAX_MESSAGE = 4000


def json_loads(raw: str | None, default: Any) -> Any:
    try:
        value = json.loads(raw or "")
    except (TypeError, ValueError):
        return default
    return value if isinstance(value, type(default)) else default


def new_session(conn: sqlite3.Connection, ip_hash: str = "", now: datetime | None = None) -> str:
    session_id = secrets.token_urlsafe(24)
    stamp = (now or datetime.now()).strftime("%Y-%m-%d %H:%M:%S")
    conn.execute(
        "INSERT INTO agent_sessions (id, ip_hash, created_at, updated_at) VALUES (?, ?, ?, ?)",
        (session_id, ip_hash, stamp, stamp),
    )
    conn.commit()
    return session_id


def get_session(conn: sqlite3.Connection, session_id: str) -> sqlite3.Row | None:
    if not session_id:
        return None
    return conn.execute("SELECT * FROM agent_sessions WHERE id = ?", (session_id,)).fetchone()


def touch(conn: sqlite3.Connection, session_id: str, **values: Any) -> None:
    allowed = {
        "step",
        "status",
        "fields",
        "recap",
        "recap_ok",
        "proposals",
        "consent",
        "turns",
        "tokens",
        "reference",
        "lead_id",
    }
    updates = {key: value for key, value in values.items() if key in allowed}
    updates["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    assignments = ", ".join(f"{key} = ?" for key in updates)
    conn.execute(
        f"UPDATE agent_sessions SET {assignments} WHERE id = ?",
        (*updates.values(), session_id),
    )
    conn.commit()


def session_fields(session: sqlite3.Row | dict[str, Any] | None) -> dict[str, str]:
    if session is None:
        return {}
    raw = session["fields"] if isinstance(session, sqlite3.Row) else session.get("fields", "{}")

    data = json_loads(raw, {})
    return {key: str(value).strip() for key, value in data.items() if str(value).strip()}


def missing_fields(fields: dict[str, str]) -> list[str]:
    return [key for key in FIELDS if not fields.get(key)]


def session_proposals(session: sqlite3.Row | dict[str, Any] | None) -> list[str]:
    if session is None:
        return []
    raw = session["proposals"] if isinstance(session, sqlite3.Row) else session.get("proposals", "[]")
    data = json_loads(raw, [])
    return [str(item) for item in data if str(item).strip()]


def set_proposals(conn: sqlite3.Connection, session_id: str, starts: list[str]) -> None:
    touch(conn, session_id, proposals=json.dumps(list(starts), ensure_ascii=False))


def merge_fields(conn: sqlite3.Connection, session_id: str, learned: dict[str, Any]) -> dict[str, str]:
    """Fusionne les champs appris. Les valeurs vides n'écrasent rien."""
    row = get_session(conn, session_id)
    current = session_fields(row) if row else {}
    for key, value in (learned or {}).items():
        if key not in FIELDS:
            continue
        text = " ".join(str(value or "").split())[:600]
        if text:
            current[key] = text
    touch(conn, session_id, fields=json.dumps(current, ensure_ascii=False))
    return current


def add_message(conn: sqlite3.Connection, session_id: str, role: str, content: str) -> None:
    conn.execute(
        "INSERT INTO agent_messages (session_id, role, content) VALUES (?, ?, ?)",
        (session_id, role, (content or "")[:MAX_MESSAGE]),
    )
    conn.commit()


def messages(conn: sqlite3.Connection, session_id: str, limit: int = 60) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT role, content, created_at FROM agent_messages WHERE session_id = ? "
        "ORDER BY id DESC LIMIT ?",
        (session_id, limit),
    ).fetchall()
    return [dict(row) for row in reversed(rows)]


def next_reference(conn: sqlite3.Connection, today: date | None = None) -> str:
    year = (today or date.today()).year
    prefix = f"DEM-{year}-"
    row = conn.execute(
        "SELECT reference FROM agent_leads WHERE reference LIKE ? ORDER BY reference DESC LIMIT 1",
        (prefix + "%",),
    ).fetchone()
    last = 0
    if row:
        try:
            last = int(str(row["reference"]).rsplit("-", 1)[1])
        except (IndexError, ValueError):
            last = 0
    return f"{prefix}{last + 1:04d}"


def create_lead(
    conn: sqlite3.Connection,
    session_id: str,
    fields: dict[str, str],
    name: str = "",
    email: str = "",
    phone: str = "",
    summary: str = "",
    status: str = STATUS_QUALIFIED,
    ip_hash: str = "",
) -> dict[str, Any]:
    reference = next_reference(conn)
    cursor = conn.execute(
        "INSERT INTO agent_leads (reference, session_id, name, email, phone, fields, summary, status, ip_hash) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            reference,
            session_id,
            name[:120],
            email[:180].lower(),
            phone[:40],
            json.dumps(fields, ensure_ascii=False),
            summary[:4000],
            status,
            ip_hash,
        ),
    )
    conn.commit()
    return {"id": int(cursor.lastrowid or 0), "reference": reference}


def update_lead(conn: sqlite3.Connection, lead_id: int, **values: Any) -> None:
    allowed = {"status", "event_id", "slot_start", "notified_at", "summary", "name", "email", "phone"}
    updates = {key: value for key, value in values.items() if key in allowed}
    if not updates:
        return
    assignments = ", ".join(f"{key} = ?" for key in updates)
    conn.execute(f"UPDATE agent_leads SET {assignments} WHERE id = ?", (*updates.values(), lead_id))
    conn.commit()


def get_lead(conn: sqlite3.Connection, lead_id: int) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM agent_leads WHERE id = ?", (lead_id,)).fetchone()


def list_leads(conn: sqlite3.Connection, status: str = "", limit: int = 200) -> list[sqlite3.Row]:
    sql = "SELECT * FROM agent_leads"
    params: list[Any] = []
    if status:
        sql += " WHERE status = ?"
        params.append(status)
    sql += " ORDER BY created_at DESC, id DESC LIMIT ?"
    params.append(limit)
    return conn.execute(sql, params).fetchall()


def reserve_slot(
    conn: sqlite3.Connection,
    slot_start: str,
    session_id: str,
    email: str = "",
    event_id: str = "",
) -> bool:
    """Réserve un créneau. False si déjà pris (idempotent par créneau)."""
    cursor = conn.execute(
        "INSERT OR IGNORE INTO agent_bookings (slot_start, session_id, email, event_id) "
        "VALUES (?, ?, ?, ?)",
        (slot_start, session_id, email, event_id),
    )
    conn.commit()
    return cursor.rowcount == 1


def release_slot(conn: sqlite3.Connection, slot_start: str) -> None:
    conn.execute("DELETE FROM agent_bookings WHERE slot_start = ?", (slot_start,))
    conn.commit()


def bookings_per_day(conn: sqlite3.Connection, horizon_days: int = 15) -> dict[str, int]:
    from . import slots as slots_module

    counts: dict[str, int] = {}
    for row in conn.execute("SELECT slot_start FROM agent_bookings"):
        parsed = slots_module.parse_slot(str(row["slot_start"]))
        if not parsed:
            continue
        key = slots_module.day_key(parsed)
        counts[key] = counts.get(key, 0) + 1
    return counts


def purge_old(conn: sqlite3.Connection, days: int = 90, now: datetime | None = None) -> dict[str, int]:
    cutoff = ((now or datetime.now()) - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")
    stale = [
        row["id"]
        for row in conn.execute(
            "SELECT id FROM agent_sessions WHERE updated_at < ? AND status != ?",
            (cutoff, STATUS_BOOKED),
        )
    ]
    removed_messages = 0
    for session_id in stale:
        cursor = conn.execute("DELETE FROM agent_messages WHERE session_id = ?", (session_id,))
        removed_messages += cursor.rowcount or 0
        conn.execute("DELETE FROM agent_sessions WHERE id = ?", (session_id,))
    conn.commit()
    return {"sessions": len(stale), "messages": removed_messages}
