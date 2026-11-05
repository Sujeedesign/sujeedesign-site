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


# ------------------------------------------------------------------ instagram
#
# Grille de cinq posts de l'accueil. Le contenu est 100 % manuel : Sujee importe
# lui-même le visuel ou la vidéo et le texte. Aucun appel à Instagram.

INSTAGRAM_SLOTS = 5

INSTAGRAM_FIELDS = ("kind", "src", "poster", "caption", "permalink", "alt")


def list_instagram_posts(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return list(
        conn.execute(
            "SELECT * FROM instagram_posts ORDER BY position ASC, id ASC LIMIT ?",
            (INSTAGRAM_SLOTS,),
        )
    )


def get_instagram_post(conn: sqlite3.Connection, post_id: int) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM instagram_posts WHERE id = ?", (post_id,)).fetchone()


def add_instagram_post(conn: sqlite3.Connection, values: dict[str, Any]) -> int | None:
    """Ajoute un post en fin de grille. Renvoie None si les cinq places sont prises."""
    total = int(conn.execute("SELECT COUNT(*) FROM instagram_posts").fetchone()[0])
    if total >= INSTAGRAM_SLOTS:
        return None
    next_position = int(
        conn.execute("SELECT COALESCE(MAX(position), -1) + 1 FROM instagram_posts").fetchone()[0]
    )
    columns = ", ".join(("position",) + INSTAGRAM_FIELDS)
    placeholders = ", ".join("?" for _ in range(len(INSTAGRAM_FIELDS) + 1))
    cursor = conn.execute(
        f"INSERT INTO instagram_posts ({columns}) VALUES ({placeholders})",
        (next_position,) + tuple(str(values.get(key, "") or "") for key in INSTAGRAM_FIELDS),
    )
    return int(cursor.lastrowid) if cursor.lastrowid is not None else None


def update_instagram_post(conn: sqlite3.Connection, post_id: int, values: dict[str, Any]) -> None:
    assignments = ", ".join(f"{key} = ?" for key in INSTAGRAM_FIELDS)
    conn.execute(
        f"UPDATE instagram_posts SET {assignments} WHERE id = ?",
        tuple(str(values.get(key, "") or "") for key in INSTAGRAM_FIELDS) + (post_id,),
    )


def delete_instagram_post(conn: sqlite3.Connection, post_id: int) -> sqlite3.Row | None:
    row = get_instagram_post(conn, post_id)
    if row is None:
        return None
    conn.execute("DELETE FROM instagram_posts WHERE id = ?", (post_id,))
    _compact_instagram(conn)
    return row


def move_instagram_post(conn: sqlite3.Connection, post_id: int, direction: str) -> bool:
    """Échange un post avec son voisin. `direction` vaut `up` ou `down`."""
    rows = list(conn.execute("SELECT id, position FROM instagram_posts ORDER BY position, id"))
    index = next((i for i, row in enumerate(rows) if int(row["id"]) == post_id), None)
    if index is None:
        return False
    target = index - 1 if direction == "up" else index + 1
    if target < 0 or target >= len(rows):
        return False
    rows[index], rows[target] = rows[target], rows[index]
    for position, row in enumerate(rows):
        conn.execute(
            "UPDATE instagram_posts SET position = ? WHERE id = ?", (position, int(row["id"]))
        )
    return True


def _compact_instagram(conn: sqlite3.Connection) -> None:
    for position, row in enumerate(
        conn.execute("SELECT id FROM instagram_posts ORDER BY position, id").fetchall()
    ):
        conn.execute("UPDATE instagram_posts SET position = ? WHERE id = ?", (position, row["id"]))


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
