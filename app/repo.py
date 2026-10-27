"""Accès aux données du back office : messages, médias, révisions, compteurs.

Rien de l'ancien site n'est conservé ici (pages, sections, blocs visuels,
redirections) : la vitrine Next est la seule source de vérité du rendu public.
"""

from __future__ import annotations

import json
import sqlite3
import time
from typing import Any

# ------------------------------------------------------------------ messages


def create_message(conn: sqlite3.Connection, values: dict[str, Any]) -> int:
    cursor = conn.execute(
        "INSERT INTO messages (name, email, phone, project_type, budget, message, source, "
        "reference, status, spam_score, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)",
        (
            values.get("name", ""),
            values.get("email", ""),
            values.get("phone", ""),
            values.get("project_type", ""),
            values.get("budget", ""),
            values.get("message", ""),
            values.get("source", ""),
            values.get("status", "nouveau"),
            int(values.get("spam_score") or 0),
            values.get("ip", ""),
            values.get("user_agent", ""),
        ),
    )
    message_id = int(cursor.lastrowid or 0)
    conn.execute(
        "UPDATE messages SET reference = ? WHERE id = ?",
        (message_reference(conn, message_id), message_id),
    )
    return message_id


def message_reference(conn: sqlite3.Connection, message_id: int) -> str:
    return f"MSG-{message_id:05d}"


def list_messages(
    conn: sqlite3.Connection, status: str | None = None, limit: int = 300
) -> list[sqlite3.Row]:
    sql = "SELECT * FROM messages"
    params: list[Any] = []
    if status:
        sql += " WHERE status = ?"
        params.append(status)
    sql += " ORDER BY created_at DESC, id DESC LIMIT ?"
    params.append(limit)
    return list(conn.execute(sql, params))


def get_message(conn: sqlite3.Connection, message_id: int) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM messages WHERE id = ?", (message_id,)).fetchone()


def update_message(conn: sqlite3.Connection, message_id: int, values: dict[str, Any]) -> None:
    allowed = {"status", "note", "notified_at", "spam_score", "assigned_to"}
    sets: list[str] = []
    params: list[Any] = []
    for key, value in values.items():
        if key in allowed:
            sets.append(f"{key} = ?")
            params.append(value)
    if not sets:
        return
    params.append(message_id)
    conn.execute(f"UPDATE messages SET {', '.join(sets)} WHERE id = ?", params)


def delete_message(conn: sqlite3.Connection, message_id: int) -> None:
    conn.execute("DELETE FROM messages WHERE id = ?", (message_id,))


def message_counts(conn: sqlite3.Connection) -> dict[str, int]:
    counts = {"total": 0, "nouveau": 0, "en cours": 0, "traite": 0}
    for row in conn.execute("SELECT status, COUNT(*) AS total FROM messages GROUP BY status"):
        counts[str(row["status"])] = int(row["total"])
        counts["total"] += int(row["total"])
    return counts


# -------------------------------------------------------------------- médias


def register_media(conn: sqlite3.Connection, keys: dict[str, Any]) -> int:
    cursor = conn.execute(
        "INSERT INTO medias (filename, original_filename, path, alt, caption, credit, mime, "
        "width, height, size, variants) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            keys.get("filename", ""),
            keys.get("original_filename", ""),
            keys.get("path", ""),
            keys.get("alt", ""),
            keys.get("caption", ""),
            keys.get("credit", ""),
            keys.get("mime", ""),
            int(keys.get("width") or 0),
            int(keys.get("height") or 0),
            int(keys.get("size") or 0),
            json.dumps(keys.get("variants") or {}, ensure_ascii=False),
        ),
    )
    return int(cursor.lastrowid or 0)


def list_medias(conn: sqlite3.Connection, limit: int = 400) -> list[sqlite3.Row]:
    return list(
        conn.execute("SELECT * FROM medias ORDER BY created_at DESC, id DESC LIMIT ?", (limit,))
    )


def get_media(conn: sqlite3.Connection, media_id: int) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM medias WHERE id = ?", (media_id,)).fetchone()


def get_media_by_filename(conn: sqlite3.Connection, filename: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM medias WHERE filename = ?", (filename,)).fetchone()


def update_media(conn: sqlite3.Connection, media_id: int, keys: dict[str, Any]) -> None:
    allowed = ("original_filename", "path", "alt", "caption", "credit", "mime", "width", "height", "size")
    fields = {k: keys[k] for k in allowed if k in keys}
    if not fields:
        return
    assignments = ", ".join(f"{name} = ?" for name in fields)
    conn.execute(f"UPDATE medias SET {assignments} WHERE id = ?", (*fields.values(), media_id))


def delete_media(conn: sqlite3.Connection, media_id: int) -> sqlite3.Row | None:
    row = get_media(conn, media_id)
    if row is not None:
        conn.execute("DELETE FROM medias WHERE id = ?", (media_id,))
    return row


# ---------------------------------------------------------------- révisions


def save_revision(
    conn: sqlite3.Connection,
    entity_type: str,
    entity_id: int,
    snapshot: Any,
    note: str = "",
    author: str = "admin",
) -> None:
    conn.execute(
        "INSERT INTO revisions (entity_type, entity_id, snapshot, note, author) VALUES (?, ?, ?, ?, ?)",
        (entity_type, int(entity_id), json.dumps(snapshot, ensure_ascii=False), note[:200], author),
    )


def list_revisions(
    conn: sqlite3.Connection, entity_type: str = "content", limit: int = 20
) -> list[sqlite3.Row]:
    return list(
        conn.execute(
            "SELECT * FROM revisions WHERE entity_type = ? ORDER BY id DESC LIMIT ?",
            (entity_type, limit),
        )
    )


def revision_snapshot(row: sqlite3.Row) -> Any:
    try:
        return json.loads(row["snapshot"])
    except (TypeError, ValueError, KeyError):
        return {}


# ------------------------------------------------------------------ compteurs


def table_counts(conn: sqlite3.Connection) -> dict[str, int]:
    result: dict[str, int] = {}
    for table in ("messages", "medias", "content_docs", "revisions", "publications"):
        try:
            result[table] = int(conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])
        except sqlite3.Error:
            result[table] = 0
    return result


def stamp() -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S")
