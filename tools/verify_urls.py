"""Vérifie que le site répond correctement sur toutes ses URL publiques.

    python tools/verify_urls.py --base https://sujeedesign.com
    python tools/verify_urls.py --base http://127.0.0.1:8131 --json

Codes attendus : 200 pour les pages, 301 pour les anciennes adresses `.html`,
303 pour la redirection du back office vers la connexion. Le script sort en
erreur (code 1) dès qu'une vérification échoue, ce qui le rend utilisable dans
un déploiement.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request

PAGES = [
    "/",
    "/realisations",
    "/services",
    "/contact",
    "/a-propos",
    "/mentions-legales",
    "/services/identite",
    "/services/creation-visuelle",
    "/services/web",
    "/services/marketing",
    "/services/ia",
    "/realisations/vaasam-paris",
    "/realisations/resto-franchise-africain",
    "/realisations/solutions-ia-automations",
    "/realisations/formation-ui-ux-pao",
    "/sitemap.xml",
    "/robots.txt",
    "/api/health",
]

REDIRECTIONS = {
    "/index.html": 301,
    "/web.html": 301,
    "/projet-vaasam.html": 301,
    "/contact/": 301,
}

AUTRES = {"/admin": 303}


def statut(base: str, chemin: str, suivre: bool = False) -> int:
    request = urllib.request.Request(base.rstrip("/") + chemin, method="GET")
    opener = urllib.request.build_opener() if suivre else urllib.request.build_opener(NoRedirect)
    try:
        with opener.open(request, timeout=25) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code
    except Exception as error:  # réseau, DNS, proxy
        return f"ERREUR ({type(error).__name__})"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        return None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Contrôle des URL publiques du site.")
    parser.add_argument("--base", required=True, help="URL de base, ex. https://sujeedesign.com")
    parser.add_argument("--json", action="store_true", help="Sortie JSON")
    args = parser.parse_args(argv)

    resultats = []
    for chemin in PAGES:
        resultats.append((chemin, 200, statut(args.base, chemin)))
    for chemin, attendu in REDIRECTIONS.items():
        resultats.append((chemin, attendu, statut(args.base, chemin)))
    for chemin, attendu in AUTRES.items():
        resultats.append((chemin, attendu, statut(args.base, chemin)))

    echecs = [r for r in resultats if r[1] != r[2]]
    if args.json:
        print(json.dumps({"base": args.base, "total": len(resultats),
                          "echecs": [{"chemin": c, "attendu": a, "obtenu": o} for c, a, o in echecs]},
                         ensure_ascii=False, indent=2))
    else:
        for chemin, attendu, obtenu in resultats:
            marque = "ok  " if attendu == obtenu else "ECHEC"
            print(f"{marque} {chemin:<42} attendu {attendu} obtenu {obtenu}")
        print(f"\n{len(resultats) - len(echecs)}/{len(resultats)} conformes")
    return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main())
