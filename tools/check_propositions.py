"""Contrôles rapides des pages /propositions/ avant commit.

Vérifie : polices auto-hébergées, chrono cumulé, mention de conservation,
bandeau CTA présent, balises HTML équilibrées (comptage grossier).
"""

from __future__ import annotations

import pathlib
import sys

BASE = pathlib.Path(__file__).resolve().parents[1] / "web" / "public" / "propositions"
PAGES = ["index.html", "n2e/index.html", "dimension-nouvelle/index.html", "polyresine/index.html"]

ATTENDUS = {
    "fonts.css": 'href="/propositions/_cta/fonts.css"',
    "aucun google": None,
}


def main() -> int:
    erreurs: list[str] = []
    for page in PAGES:
        chemin = BASE / page
        texte = chemin.read_text(encoding="utf-8")
        if 'href="/propositions/_cta/fonts.css"' not in texte:
            erreurs.append(f"{page}: fonts.css absent")
        for interdit in ("fonts.googleapis.com", "fonts.gstatic.com"):
            if interdit in texte:
                erreurs.append(f"{page}: appel tiers {interdit}")
        if page != "index.html":
            if "sj-suivi" not in texte:
                erreurs.append(f"{page}: balise sj-suivi absente")
            if "function accumuler()" not in texte:
                erreurs.append(f"{page}: chrono non cumulatif")
            if "addEventListener(\"pagehide\"" not in texte:
                erreurs.append(f"{page}: fermeture pagehide absente")
            if "données conservées 12 mois" not in texte:
                erreurs.append(f"{page}: mention de conservation absente")
            if 'cta.js' not in texte:
                erreurs.append(f"{page}: bandeau CTA absent")
        ouvertures = texte.count("<footer")
        fermetures = texte.count("</footer>")
        if ouvertures != fermetures:
            erreurs.append(f"{page}: footer déséquilibré ({ouvertures}/{fermetures})")
        if texte.count("<html") != 1 or texte.count("</html>") != 1:
            erreurs.append(f"{page}: html racine inattendu")

    for message in erreurs:
        print("ECHEC", message)
    print("OK" if not erreurs else f"{len(erreurs)} problème(s)")
    return 1 if erreurs else 0


if __name__ == "__main__":
    sys.exit(main())
