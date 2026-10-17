"""Applique les métadonnées SEO rédigées à la main (docs/seo/metadonnees.json).

Deux cibles :

    --seed   écrit seo_title / seo_description dans seed/content.json
    --db     met à jour les pages d'une base SQLite existante

Les deux peuvent être combinés. Le fichier de métadonnées vient du travail
éditorial (profil Sita) : `{"<slug>": {"seo_title": "...", "seo_description": "..."}}`.

    .venv/bin/python tools/apply_seo.py --seed
    .venv/bin/python tools/apply_seo.py --db /data/site.db
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SEED = ROOT / "seed" / "content.json"
DEFAULT_SEO = ROOT / "docs" / "seo" / "metadonnees.json"


def load_metadata(path: Path) -> dict[str, dict[str, str]]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    clean: dict[str, dict[str, str]] = {}
    for slug, values in payload.items():
        title = str(values.get("seo_title") or "").strip()
        description = str(values.get("seo_description") or "").strip()
        if title or description:
            clean[str(slug)] = {"seo_title": title, "seo_description": description}
    return clean


def apply_to_seed(seed_path: Path, metadata: dict[str, dict[str, str]]) -> int:
    payload = json.loads(Path(seed_path).read_text(encoding="utf-8"))
    touched = 0
    for page in payload.get("pages", []):
        values = metadata.get(page.get("slug", ""))
        if not values:
            continue
        page["seo_title"] = values["seo_title"]
        page["seo_description"] = values["seo_description"]
        touched += 1
    Path(seed_path).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return touched


def apply_to_db(db_path: Path, metadata: dict[str, dict[str, str]]) -> int:
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        touched = 0
        for slug, values in metadata.items():
            cursor = conn.execute(
                "UPDATE pages SET seo_title = ?, seo_description = ? WHERE slug = ?",
                (values["seo_title"], values["seo_description"], slug),
            )
            touched += cursor.rowcount
        if touched:
            if str(ROOT) not in sys.path:
                sys.path.insert(0, str(ROOT))
            from app.db import bump_revision  # import tardif : l'outil reste utilisable seul

            bump_revision(conn)
        conn.commit()
        return touched
    finally:
        conn.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Applique les métadonnées SEO au contenu.")
    parser.add_argument("--seo", type=Path, default=DEFAULT_SEO, help="fichier de métadonnées")
    parser.add_argument("--seed", type=Path, nargs="?", const=DEFAULT_SEED, help="seed/content.json à mettre à jour")
    parser.add_argument("--db", type=Path, help="base SQLite à mettre à jour")
    args = parser.parse_args(argv)

    if args.seed is None and args.db is None:
        parser.error("indique --seed et/ou --db")

    metadata = load_metadata(args.seo)
    print(f"{len(metadata)} pages dans {args.seo}")
    if args.seed is not None:
        print(f"seed mis à jour : {apply_to_seed(args.seed, metadata)} pages")
    if args.db is not None:
        print(f"base mise à jour : {apply_to_db(args.db, metadata)} pages")
    return 0


if __name__ == "__main__":
    sys.exit(main())
