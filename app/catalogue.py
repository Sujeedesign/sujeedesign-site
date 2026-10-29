"""Catalogue du back office : projets (études de cas) et prestations.

Décision d'architecture (29/10/2026) : la base SQLite du back office devient la
source de vérité du catalogue. Les pages du site (Réalisations, Services) sont
du contenu structuré, pas du texte éditorial : elles ont besoin de champs
typés, d'images, d'un ordre et d'un état de publication. L'éditeur de contenu
par page (content_docs) reste réservé aux textes de pages ; les projets et les
prestations ont chacun leur table et leur écran d'édition.

La vitrine consomme ce catalogue via `export_site()` : la forme renvoyée est
celle de `web/content/projects.ts` (type `Project`) et de `content/services.json`.
"""

from __future__ import annotations

import json
import sqlite3
from typing import Any

from .ui import slugify

STATUTS = ("brouillon", "publie")
TONS = ("paper", "tint", "dark")

PROJET_FIELDS = (
    "slug",
    "nom",
    "client",
    "annee",
    "ville",
    "pitch",
    "scope",
    "duree",
    "ton",
    "statut",
)
PROJET_JSON = ("disciplines", "tags", "images", "sections", "results")
PRESTATION_FIELDS = ("slug", "nom", "accroche", "description", "prix", "duree", "statut")
PRESTATION_JSON = ("livrables",)


def _text(value: Any) -> str:
    return " ".join(str(value or "").split())


def _block(value: Any) -> str:
    """Texte multiligne : on garde les retours à la ligne, on compacte les espaces."""
    return "\n".join(line.strip() for line in str(value or "").replace("\r\n", "\n").split("\n")).strip()


def _lines(value: str) -> list[str]:
    return [line.strip() for line in str(value or "").replace("\r\n", "\n").split("\n") if line.strip()]


def _json(value: Any) -> Any:
    if isinstance(value, (list, dict)):
        return value
    try:
        parsed = json.loads(value or "[]")
    except (TypeError, ValueError):
        return []
    return parsed if isinstance(parsed, (list, dict)) else []


def _loads(value: Any, default: Any) -> Any:
    parsed = _json(value)
    return parsed if parsed else default


# ------------------------------------------------------------------ projets


def projet_from_row(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["disciplines"] = _loads(item.get("disciplines"), [])
    item["tags"] = _loads(item.get("tags"), [])
    item["images"] = _loads(item.get("images"), [])
    item["sections"] = _loads(item.get("sections"), [])
    item["results"] = _loads(item.get("results"), [])
    item["cover"] = item["images"][0] if item["images"] else None
    return item


def list_projets(conn: sqlite3.Connection, statut: str = "") -> list[dict[str, Any]]:
    sql = "SELECT * FROM projets"
    params: tuple[Any, ...] = ()
    if statut in STATUTS:
        sql += " WHERE statut = ?"
        params = (statut,)
    sql += " ORDER BY position ASC, id ASC"
    return [projet_from_row(row) for row in conn.execute(sql, params)]


def get_projet(conn: sqlite3.Connection, projet_id: int) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM projets WHERE id = ?", (projet_id,)).fetchone()
    return projet_from_row(row) if row else None


def next_position(conn: sqlite3.Connection, table: str) -> int:
    row = conn.execute(f"SELECT COALESCE(MAX(position), 0) + 10 AS p FROM {table}").fetchone()
    return int(row["p"])


def _unique_slug(conn: sqlite3.Connection, table: str, slug: str, current_id: int | None) -> str:
    base = slug or "sans-titre"
    candidate = base
    index = 2
    while True:
        row = conn.execute(f"SELECT id FROM {table} WHERE slug = ?", (candidate,)).fetchone()
        if row is None or row["id"] == current_id:
            return candidate
        candidate = f"{base}-{index}"
        index += 1


def save_projet(conn: sqlite3.Connection, form: dict[str, Any], projet_id: int | None = None) -> int:
    nom = _text(form.get("nom")) or "Projet sans titre"
    slug = _unique_slug(conn, "projets", slugify(form.get("slug") or nom), projet_id)
    ton = form.get("ton") if form.get("ton") in TONS else "paper"
    statut = form.get("statut") if form.get("statut") in STATUTS else "brouillon"

    images: list[dict[str, Any]] = []
    for src, alt, width, height in form.get("images", []):
        if not _text(src):
            continue
        try:
            w = int(width or 0)
        except (TypeError, ValueError):
            w = 0
        try:
            h = int(height or 0)
        except (TypeError, ValueError):
            h = 0
        images.append({"src": _text(src), "alt": _text(alt), "width": w, "height": h})

    sections: list[dict[str, Any]] = []
    for k, label, title, paragraphs, bullets in form.get("sections", []):
        item = {
            "k": _text(k) or str(len(sections) + 1).zfill(2),
            "label": _text(label),
            "title": _text(title),
            "paragraphs": _lines(paragraphs),
        }
        points = _lines(bullets)
        if points:
            item["bullets"] = points
        if item["title"] or item["paragraphs"]:
            sections.append(item)

    results: list[dict[str, str]] = []
    for value, label in form.get("results", []):
        if _text(value) or _text(label):
            results.append({"value": _text(value), "label": _text(label)})

    payload = {
        "slug": slug,
        "nom": nom,
        "client": _text(form.get("client")),
        "annee": _text(form.get("annee")),
        "ville": _text(form.get("ville")),
        "pitch": _block(form.get("pitch")),
        "scope": _block(form.get("scope")),
        "duree": _text(form.get("duree")),
        "ton": ton,
        "statut": statut,
        "disciplines": json.dumps(_lines(form.get("disciplines", "")), ensure_ascii=False),
        "tags": json.dumps(_lines(form.get("tags", "")), ensure_ascii=False),
        "images": json.dumps(images, ensure_ascii=False),
        "sections": json.dumps(sections, ensure_ascii=False),
        "results": json.dumps(results, ensure_ascii=False),
    }

    if projet_id:
        sets = ", ".join(f"{key} = ?" for key in payload)
        conn.execute(
            f"UPDATE projets SET {sets}, updated_at = datetime('now') WHERE id = ?",
            (*payload.values(), projet_id),
        )
        conn.commit()
        return projet_id

    position = form.get("position")
    payload["position"] = int(position) if str(position or "").strip().isdigit() else next_position(conn, "projets")
    columns = ", ".join(payload)
    marks = ", ".join("?" for _ in payload)
    cur = conn.execute(f"INSERT INTO projets ({columns}) VALUES ({marks})", tuple(payload.values()))
    conn.commit()
    return int(cur.lastrowid)


def delete_projet(conn: sqlite3.Connection, projet_id: int) -> None:
    conn.execute("DELETE FROM projets WHERE id = ?", (projet_id,))
    conn.commit()


def set_projet_statut(conn: sqlite3.Connection, projet_id: int, statut: str) -> None:
    if statut not in STATUTS:
        return
    conn.execute(
        "UPDATE projets SET statut = ?, updated_at = datetime('now') WHERE id = ?",
        (statut, projet_id),
    )
    conn.commit()


def move_projet(conn: sqlite3.Connection, projet_id: int, direction: int) -> None:
    rows = conn.execute("SELECT id, position FROM projets ORDER BY position ASC, id ASC").fetchall()
    ids = [row["id"] for row in rows]
    if projet_id not in ids:
        return
    index = ids.index(projet_id)
    target = index + direction
    if target < 0 or target >= len(ids):
        return
    ids[index], ids[target] = ids[target], ids[index]
    for offset, row_id in enumerate(ids):
        conn.execute("UPDATE projets SET position = ? WHERE id = ?", ((offset + 1) * 10, row_id))
    conn.commit()


# -------------------------------------------------------------- prestations


def prestation_from_row(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["livrables"] = _loads(item.get("livrables"), [])
    return item


def list_prestations(conn: sqlite3.Connection, statut: str = "") -> list[dict[str, Any]]:
    sql = "SELECT * FROM prestations"
    params: tuple[Any, ...] = ()
    if statut in STATUTS:
        sql += " WHERE statut = ?"
        params = (statut,)
    sql += " ORDER BY position ASC, id ASC"
    return [prestation_from_row(row) for row in conn.execute(sql, params)]


def get_prestation(conn: sqlite3.Connection, prestation_id: int) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM prestations WHERE id = ?", (prestation_id,)).fetchone()
    return prestation_from_row(row) if row else None


def save_prestation(conn: sqlite3.Connection, form: dict[str, Any], prestation_id: int | None = None) -> int:
    nom = _text(form.get("nom")) or "Prestation sans titre"
    slug = _unique_slug(conn, "prestations", slugify(form.get("slug") or nom), prestation_id)
    statut = form.get("statut") if form.get("statut") in STATUTS else "brouillon"
    payload = {
        "slug": slug,
        "nom": nom,
        "accroche": _block(form.get("accroche")),
        "description": _block(form.get("description")),
        "prix": _text(form.get("prix")),
        "duree": _text(form.get("duree")),
        "statut": statut,
        "livrables": json.dumps(_lines(form.get("livrables", "")), ensure_ascii=False),
    }
    if prestation_id:
        sets = ", ".join(f"{key} = ?" for key in payload)
        conn.execute(
            f"UPDATE prestations SET {sets}, updated_at = datetime('now') WHERE id = ?",
            (*payload.values(), prestation_id),
        )
        conn.commit()
        return prestation_id
    position = form.get("position")
    payload["position"] = int(position) if str(position or "").strip().isdigit() else next_position(conn, "prestations")
    columns = ", ".join(payload)
    marks = ", ".join("?" for _ in payload)
    cur = conn.execute(f"INSERT INTO prestations ({columns}) VALUES ({marks})", tuple(payload.values()))
    conn.commit()
    return int(cur.lastrowid)


def delete_prestation(conn: sqlite3.Connection, prestation_id: int) -> None:
    conn.execute("DELETE FROM prestations WHERE id = ?", (prestation_id,))
    conn.commit()


def set_prestation_statut(conn: sqlite3.Connection, prestation_id: int, statut: str) -> None:
    if statut not in STATUTS:
        return
    conn.execute(
        "UPDATE prestations SET statut = ?, updated_at = datetime('now') WHERE id = ?",
        (statut, prestation_id),
    )
    conn.commit()


def move_prestation(conn: sqlite3.Connection, prestation_id: int, direction: int) -> None:
    rows = conn.execute("SELECT id, position FROM prestations ORDER BY position ASC, id ASC").fetchall()
    ids = [row["id"] for row in rows]
    if prestation_id not in ids:
        return
    index = ids.index(prestation_id)
    target = index + direction
    if target < 0 or target >= len(ids):
        return
    ids[index], ids[target] = ids[target], ids[index]
    for offset, row_id in enumerate(ids):
        conn.execute("UPDATE prestations SET position = ? WHERE id = ?", ((offset + 1) * 10, row_id))
    conn.commit()


# ------------------------------------------------------------------ export


def export_site(conn: sqlite3.Connection) -> dict[str, Any]:
    """Catalogue publié, à la forme attendue par la vitrine Next."""
    projets = []
    for index, item in enumerate(list_projets(conn, "publie"), start=1):
        projet: dict[str, Any] = {
            "slug": item["slug"],
            "index": str(index).zfill(2),
            "name": item["nom"],
            "client": item["client"],
            "disciplines": item["disciplines"],
            "pitch": item["pitch"],
            "scope": item["scope"],
            "sections": item["sections"],
            "images": item["images"],
            "tags": item["tags"],
            "tone": item["ton"],
        }
        for source, target in (("annee", "year"), ("ville", "city"), ("duree", "duration")):
            if item[source]:
                projet[target] = item[source]
        if item["results"]:
            projet["results"] = item["results"]
        if item["images"]:
            projet["cover"] = item["images"][0]
        projets.append(projet)

    services = []
    for item in list_prestations(conn, "publie"):
        service: dict[str, Any] = {
            "slug": item["slug"],
            "name": item["nom"],
            "pitch": item["accroche"],
            "description": item["description"],
            "deliverables": item["livrables"],
        }
        for source, target in (("prix", "price"), ("duree", "duration")):
            if item[source]:
                service[target] = item[source]
        services.append(service)

    return {"projects": projets, "services": services}


def export_json(conn: sqlite3.Connection) -> str:
    return json.dumps(export_site(conn), ensure_ascii=False, indent=2)
