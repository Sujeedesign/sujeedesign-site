"""Lance le site en local avec une base de recette, pour vérifier l'éditeur.

Usage :
    SESSION_SECRET=recette-local ADMIN_PASSWORD=recette-local \
        .venv/bin/python tools/editor_recette.py [--db chemin] [--port 8124]

La base est créée et alimentée avec le contenu du dépôt si elle est vide. Le
script refuse de démarrer sans secret : jamais de secret par défaut dans le code.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.db import connect, init_db  # noqa: E402
from app.main import create_app  # noqa: E402
from app.seed import seed_if_empty  # noqa: E402

DEFAULT_DB = ROOT / ".recette" / "site.db"


def prepare(db_path: Path) -> str:
    """Crée la base si besoin et charge le contenu du dépôt. Retourne un résumé."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = connect(db_path)
    try:
        init_db(conn)
        report = seed_if_empty(conn, ROOT / "seed" / "content.json")
        pages = int(conn.execute("SELECT COUNT(*) AS c FROM pages").fetchone()["c"])
        sections = int(conn.execute("SELECT COUNT(*) AS c FROM sections").fetchone()["c"])
    finally:
        conn.close()
    seeded = "contenu initial chargé" if report else "base conservée telle quelle"
    return f"{db_path} : {pages} pages, {sections} blocs ({seeded})"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Recette locale de l'éditeur")
    parser.add_argument("--db", default=str(DEFAULT_DB))
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8124)
    parser.add_argument("--prepare-only", action="store_true", help="prépare la base et s'arrête")
    args = parser.parse_args(argv)

    missing = [name for name in ("SESSION_SECRET", "ADMIN_PASSWORD") if not os.environ.get(name)]
    if missing:
        print("Variables manquantes : " + ", ".join(missing) + ". Rien n'est lancé.", file=sys.stderr)
        return 2

    print(prepare(Path(args.db)))
    if args.prepare_only:
        return 0

    import uvicorn

    app = create_app(Path(args.db))
    print(f"Site : http://{args.host}:{args.port}/  ·  édition : ?edit=1 après connexion sur /admin")
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
