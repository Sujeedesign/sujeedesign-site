"""Calcule les rapports de contraste WCAG du bouton de bandeau CTA.

Usage : python3 tools/contraste_cta.py
Sert de preuve chiffrée pour l'audit 1.4.3 des pages /propositions/.
"""

from __future__ import annotations


def _canal(valeur: float) -> float:
    return valeur / 12.92 if valeur <= 0.03928 else ((valeur + 0.055) / 1.055) ** 2.4


def luminance(hexa: str) -> float:
    brut = hexa.lstrip("#")
    r, g, b = (int(brut[i : i + 2], 16) / 255 for i in (0, 2, 4))
    return 0.2126 * _canal(r) + 0.7152 * _canal(g) + 0.0722 * _canal(b)


def contraste(a: str, b: str) -> float:
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return round((la + 0.05) / (lb + 0.05), 2)


ENCRE = "#0A0A0B"
OS = "#F7F7F5"
ACCENT = "#C9340F"  # --sd-accent (état normal)
ACCENT_B = "#FF4B1F"  # --sd-accent-b (survol)
ACCENT_FONCE = "#D23810"  # variante de repli pour le survol

CAS = {
    "normal : texte os #F7F7F5 sur accent #C9340F": (OS, ACCENT),
    "avant : texte os #F7F7F5 sur accent-b #FF4B1F": (OS, ACCENT_B),
    "après : texte encre #0A0A0B sur accent-b #FF4B1F": (ENCRE, ACCENT_B),
    "repli : texte os #F7F7F5 sur #D23810": (OS, ACCENT_FONCE),
    "em accent-b #FF4B1F sur bandeau encre": (ACCENT_B, ENCRE),
}

SEUIL = 4.5

if __name__ == "__main__":
    for libelle, (texte, fond) in CAS.items():
        valeur = contraste(texte, fond)
        verdict = "OK AA" if valeur >= SEUIL else "ECHEC AA"
        print(f"{valeur:>5}:1  {verdict:<8} {libelle}")
