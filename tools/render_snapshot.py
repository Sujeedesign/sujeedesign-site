"""Capture le HTML public des pages du contenu du dépôt, pour comparer deux versions.

Usage :
    SESSION_SECRET=... ADMIN_PASSWORD=... .venv/bin/python tools/render_snapshot.py --out capture.json --db base.db

Sert au contrôle de non-régression du rendu : on capture avant et après une
modification de gabarits, puis on compare le HTML hors attributs d'éditeur.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from app.db import connect, init_db  # noqa: E402
from app.main import create_app  # noqa: E402
from app.seed import load_seed_file  # noqa: E402

FIXED_PATHS = ("/", "/realisations", "/services", "/a-propos", "/contact", "/mentions-legales", "/404")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Capture du HTML public")
    parser.add_argument("--out", required=True)
    parser.add_argument("--db", required=True)
    args = parser.parse_args(argv)

    db_path = Path(args.db)
    if db_path.exists():
        db_path.unlink()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = connect(db_path)
    try:
        init_db(connection)
        load_seed_file(connection, ROOT / "seed" / "content.json", replace=True)
        slugs = [
            row["slug"]
            for row in connection.execute("SELECT slug FROM pages WHERE status = 'publie' ORDER BY slug")
        ]
    finally:
        connection.close()

    app = create_app(db_path)
    captured: dict[str, str] = {}
    with TestClient(app) as client:
        for path in FIXED_PATHS:
            captured[path] = client.get(path).text
        for slug in slugs:
            path = f"/{slug}"
            captured[path] = client.get(path).text

    Path(args.out).write_text(json.dumps(captured, ensure_ascii=False), encoding="utf-8")
    print(f"{len(captured)} pages capturées dans {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
