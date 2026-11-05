"""Vérifie la syntaxe JS des scripts `sj-suivi` des pages propositions.

Usage : python3 tools/check_suivi_js.py  (nécessite `node` dans le PATH)
"""

from __future__ import annotations

import pathlib
import re
import subprocess
import sys
import tempfile

BASE = pathlib.Path(__file__).resolve().parents[1] / "web" / "public" / "propositions"
PAGES = ["n2e/index.html", "dimension-nouvelle/index.html", "polyresine/index.html"]


def main() -> int:
    echecs = 0
    for page in PAGES:
        texte = (BASE / page).read_text(encoding="utf-8")
        trouve = re.search(r'<script id="sj-suivi">(.*?)</script>', texte, re.S)
        if not trouve:
            print(f"ECHEC {page}: script sj-suivi introuvable")
            echecs += 1
            continue
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as tmp:
            tmp.write(trouve.group(1))
            chemin = tmp.name
        resultat = subprocess.run(["node", "--check", chemin], capture_output=True, text=True)
        if resultat.returncode != 0:
            print(f"ECHEC {page}: {resultat.stderr.strip().splitlines()[:3]}")
            echecs += 1
        else:
            print(f"OK    {page}")
    return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main())
