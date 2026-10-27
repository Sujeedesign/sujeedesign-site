"""Détecte les mots collés (concaténations) dans le HTML Next par rapport au v5.

La comparaison texte classique remplace chaque balise par une espace, ce qui masque les mots
collés quand deux éléments inline se suivent. Ici on supprime les balises sans espace : toute
concaténation ressort comme un « mot » anormalement long.
"""

import html
import re
import urllib.request

PAIRS = [
    ("/", "index.html"),
    ("/realisations", "realisations.html"),
    ("/realisations/vaasam", "projet.html"),
    ("/services", "services.html"),
    ("/services/identite-de-marque", "service-identite.html"),
    ("/services/direction-artistique", "service-direction-artistique.html"),
    ("/services/site-ecommerce", "service-site-ecommerce.html"),
    ("/services/contenu-reseaux", "service-contenu.html"),
    ("/a-propos", "a-propos.html"),
    ("/agents-ia", "agents-ia.html"),
    ("/mentions-legales", "mentions-legales.html"),
]

MAIN_RE = re.compile(r"<main[^>]*id=\"main\"[^>]*>(.*?)</main>", re.S | re.I)
LONG_WORD = re.compile(r"\S{23,}")


def fetch(url: str) -> str:
    with urllib.request.urlopen(url, timeout=30) as resp:
        return resp.read().decode("utf-8", "replace")


def flat(page: str) -> str:
    block = MAIN_RE.search(page)
    if not block:
        return ""
    body = block.group(1)
    body = re.sub(r"<(script|style|template|svg)\b.*?</\1>", " ", body, flags=re.S | re.I)
    body = re.sub(r"<[^>]+>", "", body)  # pas d'espace : on veut voir les collages
    body = html.unescape(body).replace("\u00a0", " ")
    return re.sub(r"\s+", " ", body).strip()


def main() -> int:
    total = 0
    for next_path, v5_file in PAIRS:
        new = set(LONG_WORD.findall(flat(fetch(f"http://127.0.0.1:3123{next_path}"))))
        old = set(LONG_WORD.findall(flat(fetch(f"http://127.0.0.1:3124/{v5_file}"))))
        suspect = sorted(w for w in new - old)
        if suspect:
            total += len(suspect)
            print(f"[COLLÉ]  {next_path}")
            for w in suspect[:10]:
                print(f"          {w[:120]}")
        else:
            print(f"[OK]     {next_path}")
    print(f"\n{total} mot(s) concaténé(s) détecté(s)")
    return 1 if total else 0


if __name__ == "__main__":
    raise SystemExit(main())
