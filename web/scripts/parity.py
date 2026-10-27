"""Comparaison de parité texte entre le v5 statique (3124) et le build Next (3123).

On compare uniquement le contenu de <main id="main">, le chrome étant vérifié à part.
Les espaces insécables sont normalisés pour ne pas noyer les vrais écarts.
"""

import difflib
import html
import re
import sys
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


def fetch(url: str) -> str:
    with urllib.request.urlopen(url, timeout=30) as resp:
        return resp.read().decode("utf-8", "replace")


def main_text(page: str) -> str:
    block = MAIN_RE.search(page)
    if not block:
        return ""
    body = block.group(1)
    body = re.sub(r"<(script|style|template)\b.*?</\1>", " ", body, flags=re.S | re.I)
    body = re.sub(r"<[^>]+>", " ", body)
    body = html.unescape(body).replace("\u00a0", " ")
    return re.sub(r"\s+", " ", body).strip()


def tokens(text: str) -> list[str]:
    return text.split(" ")


def main() -> int:
    failures = 0
    for next_path, v5_file in PAIRS:
        try:
            new = main_text(fetch(f"http://127.0.0.1:3123{next_path}"))
            old = main_text(fetch(f"http://127.0.0.1:3124/{v5_file}"))
        except Exception as exc:  # réseau, 404, etc.
            print(f"[ERREUR] {next_path}: {exc}")
            failures += 1
            continue

        if new == old:
            print(f"[OK]     {next_path:<34} {len(new):>6} car.")
            continue

        failures += 1
        diff = list(difflib.unified_diff(tokens(old), tokens(new), lineterm="", n=0))
        print(f"[DIFF]   {next_path:<34} v5={len(old)} next={len(new)} car. ({len(diff)} lignes de diff)")
        for line in diff[:24]:
            if line.startswith(("---", "+++", "@@")):
                continue
            print("         ", line[:200])

    print(f"\n{len(PAIRS) - failures}/{len(PAIRS)} pages identiques au v5")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
