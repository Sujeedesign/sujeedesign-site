"""Chargement du contenu initial : fichier JSON -> base.

Usage :
    python -m app.seed --file seed/content.json [--db data/site.db] [--replace]

Le chargement est idempotent : sans `--replace`, les pages déjà présentes
(slug existant) sont ignorées. `--replace` écrase la page existante et
remplace ses sections.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from typing import Any

from . import repo
from . import sections as sections_module
from . import settings as settings_module
from .db import bump_revision, connect, init_db

PAGE_FIELDS = (
    "slug", "kind", "title", "status", "excerpt", "cover", "cover_alt", "client", "year",
    "categories", "external_url", "featured", "position", "num", "in_menu", "menu_position",
    "menu_label", "seo_title", "seo_description", "og_image", "robots", "meta",
)


def _page_values(raw: dict[str, Any]) -> dict[str, Any]:
    return {key: raw[key] for key in PAGE_FIELDS if key in raw}


def load_seed(conn: sqlite3.Connection, payload: dict[str, Any], *, replace: bool = False) -> dict[str, Any]:
    """Insère réglages, pages, sections et redirections. Retourne un rapport."""
    report: dict[str, Any] = {"reglages": 0, "pages_crees": [], "pages_ignorees": [], "sections": 0, "redirections": 0, "erreurs": []}

    for key, value in (payload.get("reglages") or {}).items():
        settings_module.set_value(conn, key, "" if value is None else str(value))
        report["reglages"] += 1

    for raw in payload.get("pages") or []:
        slug = (raw.get("slug") or "").strip()
        if not slug:
            report["erreurs"].append("page sans slug, ignorée")
            continue
        existing = repo.page_by_slug(conn, slug, published_only=False)
        if existing is not None and not replace:
            report["pages_ignorees"].append(slug)
            continue
        if existing is not None:
            page_id = int(existing["id"])
            repo.update_page(conn, page_id, _page_values(raw))
            conn.execute("DELETE FROM sections WHERE page_id = ?", (page_id,))
        else:
            page_id = repo.create_page(conn, _page_values(raw))
            report["pages_crees"].append(slug)
        for index, section in enumerate(raw.get("sections") or []):
            type_ = (section.get("type") or "").strip()
            if type_ not in sections_module.SECTION_TYPES:
                report["erreurs"].append(f"{slug}: type de section inconnu « {type_} »")
                continue
            repo.create_section(
                conn,
                page_id,
                {
                    "position": section.get("position", index),
                    "type": type_,
                    "variant": section.get("variant", ""),
                    "label": section.get("label", ""),
                    "visible": section.get("visible", 1),
                    "data": section.get("data") or {},
                },
            )
            report["sections"] += 1

    for redirect in payload.get("redirections") or []:
        path = (redirect.get("path") or "").strip()
        target = (redirect.get("target") or "").strip()
        if path and target:
            repo.add_redirect(conn, path, target, int(redirect.get("code") or 301))
            report["redirections"] += 1

    bump_revision(conn)
    conn.commit()
    return report


def load_seed_file(conn: sqlite3.Connection, path: str | Path, *, replace: bool = False) -> dict[str, Any]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    return load_seed(conn, payload, replace=replace)


def needs_seed(conn: sqlite3.Connection) -> bool:
    row = conn.execute("SELECT COUNT(*) AS c FROM pages").fetchone()
    return int(row["c"]) == 0


def seed_if_empty(conn: sqlite3.Connection, path: str | Path) -> dict[str, Any] | None:
    if not needs_seed(conn):
        return None
    target = Path(path)
    if not target.is_file():
        return None
    return load_seed_file(conn, target)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Chargement du contenu initial du site.")
    parser.add_argument("--file", required=True, help="Fichier JSON de contenu")
    parser.add_argument("--db", default=None, help="Chemin de la base SQLite")
    parser.add_argument("--replace", action="store_true", help="Écraser les pages existantes")
    args = parser.parse_args(argv)

    db_file = Path(args.db) if args.db else settings_module.db_path()
    conn = connect(db_file)
    try:
        init_db(conn)
        report = load_seed_file(conn, args.file, replace=args.replace)
    finally:
        conn.close()
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if not report["erreurs"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
