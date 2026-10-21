"""Accès aux contenus : pages, sections, médias, messages, réglages."""

from __future__ import annotations

import json
import sqlite3
from typing import Any, Iterable, Sequence

from .db import bump_revision
from .render import json_load

PUBLISHED = "publie"
DRAFT = "brouillon"


def _rows(cursor: sqlite3.Cursor) -> list[sqlite3.Row]:
    return list(cursor.fetchall())


def _now(conn: sqlite3.Connection) -> str:
    return str(conn.execute("SELECT datetime('now') AS d").fetchone()["d"])


def touch(conn: sqlite3.Connection, table: str, row_id: int) -> None:
    conn.execute(f"UPDATE {table} SET updated_at = datetime('now') WHERE id = ?", (row_id,))
    bump_revision(conn)


def page_path(page: sqlite3.Row | dict) -> str:
    """Chemin public d'une page selon sa nature."""
    kind = (page["kind"] if isinstance(page, sqlite3.Row) else page.get("kind")) or "page"
    slug = (page["slug"] if isinstance(page, sqlite3.Row) else page.get("slug")) or ""
    if kind == "accueil":
        return "/"
    if kind == "realisation":
        return f"/realisations/{slug}"
    if kind == "service":
        return f"/services/{slug}"
    return f"/{slug}"


def page_by_slug(
    conn: sqlite3.Connection,
    slug: str,
    kinds: Sequence[str] | None = None,
    published_only: bool = True,
) -> sqlite3.Row | None:
    sql = "SELECT * FROM pages WHERE slug = ?"
    params: list[Any] = [slug]
    if kinds:
        sql += f" AND kind IN ({','.join('?' * len(kinds))})"
        params.extend(kinds)
    if published_only:
        sql += " AND status = ?"
        params.append(PUBLISHED)
    return conn.execute(sql, params).fetchone()


def page_by_id(conn: sqlite3.Connection, page_id: int) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM pages WHERE id = ?", (page_id,)).fetchone()


def home_page(conn: sqlite3.Connection, published_only: bool = True) -> sqlite3.Row | None:
    sql = "SELECT * FROM pages WHERE kind = 'accueil'"
    if published_only:
        sql += " AND status = ?"
        return conn.execute(sql, (PUBLISHED,)).fetchone()
    return conn.execute(sql).fetchone()


def list_pages(
    conn: sqlite3.Connection,
    kind: str | Sequence[str] | None = None,
    published_only: bool = False,
    order: str = "position, title",
) -> list[sqlite3.Row]:
    sql = "SELECT * FROM pages"
    params: list[Any] = []
    where: list[str] = []
    if kind:
        kinds = [kind] if isinstance(kind, str) else list(kind)
        where.append(f"kind IN ({','.join('?' * len(kinds))})")
        params.extend(kinds)
    if published_only:
        where.append("status = ?")
        params.append(PUBLISHED)
    if where:
        sql += " WHERE " + " AND ".join(where)
    safe_order = order if order in {"position, title", "updated_at DESC", "menu_position, title", "kind, position, title"} else "position, title"
    sql += f" ORDER BY {safe_order}"
    return _rows(conn.execute(sql, params))


def list_menu(conn: sqlite3.Connection) -> list[dict[str, str]]:
    rows = conn.execute(
        "SELECT slug, kind, title, menu_label FROM pages "
        "WHERE in_menu = 1 AND status = ? ORDER BY menu_position, title",
        (PUBLISHED,),
    ).fetchall()
    items = []
    for row in rows:
        label = row["menu_label"] or row["title"] or row["slug"]
        items.append({"label": label, "href": page_path(row)})
    return items


def sections_for(conn: sqlite3.Connection, page_id: int) -> list[sqlite3.Row]:
    return _rows(
        conn.execute(
            "SELECT * FROM sections WHERE page_id = ? ORDER BY position, id",
            (page_id,),
        )
    )


def sections_for_slug(conn: sqlite3.Connection, slug: str) -> list[sqlite3.Row]:
    return _rows(
        conn.execute(
            "SELECT s.* FROM sections s JOIN pages p ON p.id = s.page_id "
            "WHERE p.slug = ? ORDER BY s.position, s.id",
            (slug,),
        )
    )


def cards(conn: sqlite3.Connection, kind: str, published_only: bool = True) -> list[dict[str, Any]]:
    """Cartes de listing (réalisations ou services) prêtes pour les gabarits."""
    rows = list_pages(conn, kind=kind, published_only=published_only, order="position, title")
    out: list[dict[str, Any]] = []
    for row in rows:
        categories = json_load(row["categories"], [])
        if isinstance(categories, str):
            categories = [categories]
        out.append(
            {
                "slug": row["slug"],
                "title": row["title"],
                "href": page_path(row),
                "excerpt": row["excerpt"] or "",
                "cover": row["cover"] or "",
                "cover_alt": row["cover_alt"] if "cover_alt" in row.keys() else "",
                "year": row["year"] or "",
                "client": row["client"] or "",
                "tags": " · ".join(str(c) for c in categories),
                "categories": categories,
                "num": row["num"] if "num" in row.keys() else 0,
                "num_label": f"{row['num']:02d}" if "num" in row.keys() and row["num"] else "",
                "external_url": row["external_url"] or "",
            }
        )
    return out


def select_cards(items: Iterable[dict[str, Any]], slugs: Sequence[str], fallback_limit: int | None = None) -> list[dict[str, Any]]:
    if slugs:
        wanted = [str(s) for s in slugs]
        index = {item["slug"]: item for item in items}
        return [index[s] for s in wanted if s in index]
    items = list(items)
    return items[:fallback_limit] if fallback_limit else items


def latest_pages(conn: sqlite3.Connection, kind: str, limit: int = 3) -> list[sqlite3.Row]:
    return _rows(
        conn.execute(
            "SELECT * FROM pages WHERE kind = ? AND status = ? ORDER BY position, title LIMIT ?",
            (kind, PUBLISHED, limit),
        )
    )


# ---------------------------------------------------------------- écritures


def create_page(conn: sqlite3.Connection, values: dict[str, Any]) -> int:
    columns = [
        "slug", "kind", "title", "status", "excerpt", "cover", "cover_alt", "client", "year",
 "categories", "external_url", "featured", "position", "num", "in_menu",
 "menu_position", "menu_label", "seo_title", "seo_description", "og_image",
 "robots", "meta",
 ]
    data = {c: values.get(c, "") for c in columns}
    data["kind"] = values.get("kind") or "page"
    data["status"] = values.get("status") or DRAFT
    data["categories"] = json.dumps(values.get("categories") or [], ensure_ascii=False)
    data["meta"] = json.dumps(values.get("meta") or {}, ensure_ascii=False)
    data["in_menu"] = int(bool(values.get("in_menu")))
    data["featured"] = int(bool(values.get("featured")))
    data["position"] = int(values.get("position") or 0)
    data["menu_position"] = int(values.get("menu_position") or 0)
    data["num"] = int(values.get("num") or 0)
    data["year"] = values.get("year") or None
    placeholders = ", ".join("?" * len(columns))
    cursor = conn.execute(
        f"INSERT INTO pages ({', '.join(columns)}) VALUES ({placeholders})",
        [data[c] for c in columns],
    )
    if data["status"] == PUBLISHED:
        conn.execute("UPDATE pages SET published_at = datetime('now') WHERE id = ?", (cursor.lastrowid,))
    bump_revision(conn)
    return int(cursor.lastrowid or 0)


def update_page(conn: sqlite3.Connection, page_id: int, values: dict[str, Any]) -> None:
    allowed = {
        "slug", "kind", "title", "status", "excerpt", "cover", "cover_alt", "client", "year",
        "categories", "external_url", "featured", "position", "num", "in_menu",
        "menu_position", "menu_label", "seo_title", "seo_description", "og_image",
        "robots", "meta",
    }
    sets: list[str] = []
    params: list[Any] = []
    for key, value in values.items():
        if key not in allowed:
            continue
        if key in {"categories", "meta"}:
            value = json.dumps(value or ([] if key == "categories" else {}), ensure_ascii=False)
        if key in {"in_menu", "featured"}:
            value = int(bool(value))
        if key in {"position", "menu_position", "num"}:
            value = int(value or 0)
        if key == "year":
            value = value or None
        sets.append(f"{key} = ?")
        params.append(value)
    if not sets:
        return
    sets.append("updated_at = datetime('now')")
    params.append(page_id)
    conn.execute(f"UPDATE pages SET {', '.join(sets)} WHERE id = ?", params)
    if values.get("status") == PUBLISHED:
        conn.execute(
            "UPDATE pages SET published_at = COALESCE(published_at, datetime('now')) WHERE id = ?",
            (page_id,),
        )
    bump_revision(conn)


def delete_page(conn: sqlite3.Connection, page_id: int) -> None:
    conn.execute("DELETE FROM pages WHERE id = ?", (page_id,))
    bump_revision(conn)


def create_section(conn: sqlite3.Connection, page_id: int, values: dict[str, Any]) -> int:
    position = values.get("position")
    if position is None:
        row = conn.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 AS p FROM sections WHERE page_id = ?",
            (page_id,),
        ).fetchone()
        position = int(row["p"])
    cursor = conn.execute(
        "INSERT INTO sections (page_id, position, type, variant, label, visible, data) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            page_id,
            int(position),
            values.get("type") or "texte-riche",
            values.get("variant") or "",
            values.get("label") or "",
            int(bool(values.get("visible", 1))),
            json.dumps(values.get("data") or {}, ensure_ascii=False),
        ),
    )
    bump_revision(conn)
    return int(cursor.lastrowid or 0)


def update_section(conn: sqlite3.Connection, section_id: int, values: dict[str, Any]) -> None:
    allowed = {"position", "type", "variant", "label", "visible", "data"}
    sets: list[str] = []
    params: list[Any] = []
    for key, value in values.items():
        if key not in allowed:
            continue
        if key == "data":
            value = json.dumps(value or {}, ensure_ascii=False)
        if key == "visible":
            value = int(bool(value))
        if key == "position":
            value = int(value or 0)
        sets.append(f"{key} = ?")
        params.append(value)
    if not sets:
        return
    sets.append("updated_at = datetime('now')")
    params.append(section_id)
    conn.execute(f"UPDATE sections SET {', '.join(sets)} WHERE id = ?", params)
    bump_revision(conn)


def delete_section(conn: sqlite3.Connection, section_id: int) -> None:
    conn.execute("DELETE FROM sections WHERE id = ?", (section_id,))
    bump_revision(conn)


def move_section(conn: sqlite3.Connection, page_id: int, section_id: int, offset: int) -> None:
    rows = sections_for(conn, page_id)
    ids = [int(row["id"]) for row in rows]
    if section_id not in ids:
        return
    index = ids.index(section_id)
    target = max(0, min(len(ids) - 1, index + offset))
    if target == index:
        return
    ids.pop(index)
    ids.insert(target, section_id)
    for position, sid in enumerate(ids):
        conn.execute("UPDATE sections SET position = ? WHERE id = ?", (position, sid))
    bump_revision(conn)


def reorder_sections(conn: sqlite3.Connection, page_id: int, ordered_ids: Sequence[int]) -> None:
    current = {int(row["id"]) for row in sections_for(conn, page_id)}
    position = 0
    for sid in ordered_ids:
        if int(sid) not in current:
            continue
        conn.execute("UPDATE sections SET position = ? WHERE id = ?", (position, int(sid)))
        position += 1
    bump_revision(conn)


def duplicate_section(conn: sqlite3.Connection, section_id: int) -> int | None:
    row = conn.execute("SELECT * FROM sections WHERE id = ?", (section_id,)).fetchone()
    if row is None:
        return None
    conn.execute(
        "UPDATE sections SET position = position + 1 WHERE page_id = ? AND position > ?",
        (row["page_id"], row["position"]),
    )
    cursor = conn.execute(
        "INSERT INTO sections (page_id, position, type, variant, label, visible, data) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            row["page_id"],
            row["position"] + 1,
            row["type"],
            row["variant"],
            f"{row['label']} (copie)".strip(),
            row["visible"],
            row["data"],
        ),
    )
    bump_revision(conn)
    return int(cursor.lastrowid or 0)


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


def list_messages(conn: sqlite3.Connection, status: str | None = None, limit: int = 200) -> list[sqlite3.Row]:
    sql = "SELECT * FROM messages"
    params: list[Any] = []
    if status:
        sql += " WHERE status = ?"
        params.append(status)
    sql += " ORDER BY created_at DESC, id DESC LIMIT ?"
    params.append(int(limit))
    return _rows(conn.execute(sql, params))


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


def register_media(conn: sqlite3.Connection, values: dict[str, Any]) -> int:
    cursor = conn.execute(
        "INSERT INTO medias (filename, original_filename, path, alt, caption, credit, width, height, mime, size) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            values.get("filename", ""),
            values.get("original_filename", ""),
            values.get("path", ""),
            values.get("alt", ""),
            values.get("caption", ""),
            values.get("credit", ""),
            int(values.get("width") or 0),
            int(values.get("height") or 0),
            values.get("mime", ""),
            int(values.get("size") or 0),
        ),
    )
    return int(cursor.lastrowid or 0)


def list_medias(conn: sqlite3.Connection, limit: int = 400) -> list[sqlite3.Row]:
    return _rows(conn.execute("SELECT * FROM medias ORDER BY created_at DESC, id DESC LIMIT ?", (int(limit),)))


def delete_media(conn: sqlite3.Connection, media_id: int) -> sqlite3.Row | None:
    row = conn.execute("SELECT * FROM medias WHERE id = ?", (media_id,)).fetchone()
    if row is not None:
        conn.execute("DELETE FROM medias WHERE id = ?", (media_id,))
    return row


def add_redirect(conn: sqlite3.Connection, path: str, target: str, code: int = 301) -> None:
    conn.execute(
        "INSERT INTO redirections (path, target, code) VALUES (?, ?, ?) "
        "ON CONFLICT(path) DO UPDATE SET target = excluded.target, code = excluded.code",
        (path, target, int(code)),
    )
    bump_revision(conn)


def find_redirect(conn: sqlite3.Connection, path: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM redirections WHERE path = ?", (path,)).fetchone()


def touch_redirect_hit(conn: sqlite3.Connection, path: str) -> None:
    conn.execute("UPDATE redirections SET hits = hits + 1 WHERE path = ?", (path,))


def list_redirects(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return _rows(conn.execute("SELECT * FROM redirections ORDER BY path"))


def save_revision(conn: sqlite3.Connection, entity_type: str, entity_id: int, snapshot: Any, note: str = "", author: str = "") -> int:
    payload = snapshot if isinstance(snapshot, str) else json.dumps(snapshot, ensure_ascii=False, default=str)
    cursor = conn.execute(
        "INSERT INTO revisions (entity_type, entity_id, snapshot, note, author) VALUES (?, ?, ?, ?, ?)",
        (entity_type, int(entity_id), payload, note, author),
    )
    return int(cursor.lastrowid or 0)


def list_revisions(conn: sqlite3.Connection, entity_type: str | None = None, entity_id: int | None = None, limit: int = 50) -> list[sqlite3.Row]:
    sql = "SELECT id, entity_type, entity_id, note, author, created_at FROM revisions"
    params: list[Any] = []
    where: list[str] = []
    if entity_type:
        where.append("entity_type = ?")
        params.append(entity_type)
    if entity_id is not None:
        where.append("entity_id = ?")
        params.append(int(entity_id))
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY created_at DESC, id DESC LIMIT ?"
    params.append(int(limit))
    return _rows(conn.execute(sql, params))


def snapshot_page(conn: sqlite3.Connection, page_id: int) -> dict[str, Any]:
    page = page_by_id(conn, page_id)
    if page is None:
        return {}
    return {
        "page": {key: page[key] for key in page.keys()},
        "sections": [{key: row[key] for key in row.keys()} for row in sections_for(conn, page_id)],
    }


def restore_snapshot(conn: sqlite3.Connection, page_id: int, snapshot: dict[str, Any]) -> bool:
    if not snapshot or "page" not in snapshot:
        return False
    page = snapshot["page"]
    conn.execute("DELETE FROM sections WHERE page_id = ?", (page_id,))
    for row in snapshot.get("sections", []):
        conn.execute(
            "INSERT INTO sections (page_id, position, type, variant, label, visible, data) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                page_id,
                int(row.get("position") or 0),
                row.get("type") or "texte-riche",
                row.get("variant") or "",
                row.get("label") or "",
                int(row.get("visible", 1)),
                row.get("data") or "{}",
            ),
        )
    update_page(conn, page_id, {k: v for k, v in page.items() if k not in {"id", "created_at"}})
    return True


def table_counts(conn: sqlite3.Connection) -> dict[str, int]:
    out: dict[str, int] = {}
    for table in ("pages", "sections", "medias", "messages"):
        out[table] = int(conn.execute(f"SELECT COUNT(*) AS c FROM {table}").fetchone()["c"])
    out["messages_nouveaux"] = int(
        conn.execute("SELECT COUNT(*) AS c FROM messages WHERE status = 'nouveau'").fetchone()["c"]
    )
    out["brouillons"] = int(
        conn.execute("SELECT COUNT(*) AS c FROM pages WHERE status = 'brouillon'").fetchone()["c"]
    )
    out["realisations"] = int(
        conn.execute(
            "SELECT COUNT(*) AS c FROM pages WHERE kind = 'realisation' AND status = ?", (PUBLISHED,)
        ).fetchone()["c"]
    )
    out["services"] = int(
        conn.execute(
            "SELECT COUNT(*) AS c FROM pages WHERE kind = 'service' AND status = ?", (PUBLISHED,)
        ).fetchone()["c"]
    )
    return out
