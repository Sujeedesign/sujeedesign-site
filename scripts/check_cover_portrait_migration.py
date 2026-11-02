"""Vérifie la migration `cover_portrait` sur une copie jetable d'une base.

Usage : python scripts/check_cover_portrait_migration.py [base.sqlite3]
La base n'est jamais modifiée : l'outil travaille sur une copie temporaire et
affiche la version, la présence de la colonne et les compteurs avant/après.
"""

from __future__ import annotations

import sqlite3
import sys
import tempfile
from pathlib import Path

from app import db

DEFAULT_DB = Path(__file__).resolve().parents[1] / "data" / "site.db"


def _count(conn: sqlite3.Connection, sql: str) -> object:
    """Compte via SQL, ou 'n/a' si la colonne n'existe pas encore."""
    try:
        return conn.execute(sql).fetchone()[0]
    except sqlite3.OperationalError:
        return "n/a"


def main(source: Path) -> int:
    if not source.exists():
        print(f"base introuvable : {source}")
        return 1

    with tempfile.TemporaryDirectory() as tmp:
        copie = Path(tmp) / "site.db"
        copie.write_bytes(source.read_bytes())

        raw = sqlite3.connect(copie)
        raw.row_factory = sqlite3.Row
        avant_version = db.get_meta(raw, "schema_version")
        avant_cols = {r["name"] for r in raw.execute("PRAGMA table_info(projets)")}
        avant_projets = _count(raw, "SELECT COUNT(*) FROM projets")
        avant_covers = _count(raw, "SELECT COUNT(*) FROM projets WHERE COALESCE(cover,'') <> ''")
        raw.close()

        conn = db.connect(copie)
        db.init_db(conn)
        apres_version = db.get_meta(conn, "schema_version")
        apres_cols = {r["name"] for r in conn.execute("PRAGMA table_info(projets)")}
        apres_projets = _count(conn, "SELECT COUNT(*) FROM projets")
        apres_covers = _count(conn, "SELECT COUNT(*) FROM projets WHERE COALESCE(cover,'') <> ''")
        portraits = _count(conn, "SELECT COUNT(*) FROM projets WHERE COALESCE(cover_portrait,'') <> ''")

        print(f"source           : {source}")
        print(f"version          : {avant_version} -> {apres_version}")
        print(f"cover_portrait   : {'presente' if 'cover_portrait' in avant_cols else 'absente'} -> "
              f"{'presente' if 'cover_portrait' in apres_cols else 'absente'}")
        print(f"projets          : {avant_projets} -> {apres_projets}")
        print(f"couvertures paysage : {avant_covers} -> {apres_covers}")
        print(f"couvertures portrait: {portraits}")

        db.init_db(conn)
        print(f"relance idempotente, version {db.get_meta(conn, 'schema_version')}")
        conn.close()

    return 0


if __name__ == "__main__":
    cible = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else DEFAULT_DB
    raise SystemExit(main(cible))
