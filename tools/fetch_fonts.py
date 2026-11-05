"""Télécharge les woff2 (sous-ensemble latin) et génère fonts.css.

Usage : python3 tools/fetch_fonts.py
Les fichiers vont dans web/public/propositions/_cta/fonts/.

Les trois pages /propositions/ et le bandeau CTA chargeaient leurs polices
chez fonts.googleapis.com : l'IP du prospect partait chez Google sur un
document commercial privé. Ce script rapatrie les fichiers une fois pour
toutes ; le runtime ne contacte plus aucun tiers.
"""

from __future__ import annotations

import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "public" / "propositions" / "_cta" / "fonts"
CDN = "https://cdn.jsdelivr.net/npm/@fontsource/{pkg}/files/{pkg}-latin-{weight}-normal.woff2"

# famille CSS -> (paquet fontsource, graisses utilisées, graisse de repli)
FAMILIES: dict[str, tuple[str, tuple[int, ...]]] = {
    "DM Sans": ("dm-sans", (400, 500, 600, 700)),
    "Space Grotesk": ("space-grotesk", (300, 400, 500, 600, 700)),
    "Archivo": ("archivo", (400, 500, 600, 700, 800)),
    "Inter": ("inter", (400, 500, 600)),
    "IBM Plex Mono": ("ibm-plex-mono", (400, 500)),
    "Space Mono": ("space-mono", (400, 700)),
    "Bricolage Grotesque": ("bricolage-grotesque", (400, 700)),
}

HEADER = """/* Polices auto-hébergées des pages /propositions/ (aucun appel à Google).
   Fichiers woff2, sous-ensemble latin, générés par tools/fetch_fonts.py.
   Ne pas éditer à la main. */

"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    blocks: list[str] = []
    downloaded = 0
    for family, (pkg, weights) in FAMILIES.items():
        for weight in weights:
            name = f"{pkg}-latin-{weight}-normal.woff2"
            target = OUT / name
            if not target.exists() or target.stat().st_size == 0:
                url = CDN.format(pkg=pkg, weight=weight)
                with urllib.request.urlopen(url, timeout=60) as response:
                    payload = response.read()
                if len(payload) < 1000:
                    raise SystemExit(f"fichier suspect pour {name}: {len(payload)} octets")
                target.write_bytes(payload)
                downloaded += 1
            blocks.append(
                "@font-face{"
                f"font-family:'{family}';"
                "font-style:normal;"
                f"font-weight:{weight};"
                "font-display:swap;"
                f"src:url('/propositions/_cta/fonts/{name}') format('woff2');"
                "unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,"
                "U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,"
                "U+2212,U+2215,U+FEFF,U+FFFD;}"
            )
    (OUT.parent / "fonts.css").write_text(HEADER + "\n".join(blocks) + "\n", encoding="utf-8")
    total = sum(p.stat().st_size for p in OUT.glob("*.woff2"))
    print(json.dumps({"telecharges": downloaded, "familles": len(FAMILIES),
                      "fichiers": len(blocks), "octets": total}, ensure_ascii=False))


if __name__ == "__main__":
    main()
