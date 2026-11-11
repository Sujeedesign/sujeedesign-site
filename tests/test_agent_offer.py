"""Les fourchettes annoncées par l'agent existent vraiment sur le site.

`app/agent/offer.py` est la seule source de prix de l'agent de contact. Si la
grille publique bouge et que l'agent garde les anciens montants, il annonce des
prix qui n'existent plus. Ce test casse avant la mise en ligne.
"""

from __future__ import annotations

import re
from pathlib import Path

from app.agent import offer

RACINE = Path(__file__).resolve().parents[1]
GRILLE_SITE = RACINE / "web" / "lib" / "budget-identity.ts"
PAGE_PRIX = RACINE / "web" / "components" / "pages" / "GuidePrixSite.tsx"


def _normalise(texte: str) -> str:
    """« 1 500 € » -> « 1500 € », sans toucher à « A2 320 »."""
    return re.sub(r"(?<![\d\w])(\d{1,3})[\s\u00a0\u202f](\d{3})(?!\d)", r"\1\2", texte)


def _fourchettes_site() -> list[tuple[int, int]]:
    contenu = _normalise(GRILLE_SITE.read_text(encoding="utf-8"))
    paires = re.findall(r"range:\s*\{\s*low:\s*(\d+),\s*high:\s*(\d+)\s*\}", contenu)
    return [(int(a), int(b)) for a, b in paires]


def _montants_publies() -> set[int]:
    """Tous les montants en euros cités sur les deux pages publiques."""
    montants: set[int] = set()
    for chemin in (GRILLE_SITE, PAGE_PRIX):
        texte = _normalise(chemin.read_text(encoding="utf-8"))
        montants |= {int(n) for n in re.findall(r"\d+", texte)}
    return montants


def test_la_grille_du_site_est_encore_la_reference() -> None:
    paires = _fourchettes_site()
    assert len(paires) >= 7, "la grille publique a changé de forme, relire le fichier source"


def test_chaque_fourchette_publique_est_dans_le_prompt() -> None:
    """Chaque couple low/high du site se retrouve dans la grille annoncée par l'agent."""
    grille = _normalise(offer.GRILLE)
    manquantes = []
    for low, high in _fourchettes_site():
        motif = re.compile(rf"{low}\s*(?:à|-|a)\s*{high}\s*€")
        if not motif.search(grille):
            manquantes.append(f"{low} à {high} €")
    assert not manquantes, f"fourchettes absentes de offer.py : {manquantes}"


def test_les_paliers_d_identite_restent_dans_l_ordre_du_site() -> None:
    """Les 7 paliers montent du plus simple au plus complet, comme sur la page prix."""
    grille = _normalise(offer.GRILLE)
    positions = []
    for low, high in _fourchettes_site()[:7]:
        trouve = re.search(rf"{low}\s*(?:à|-|a)\s*{high}\s*€", grille)
        assert trouve, f"palier {low} à {high} € absent"
        positions.append(trouve.start())
    assert positions == sorted(positions), "les paliers ne sont plus dans l'ordre croissant"


def test_aucun_montant_invente_dans_le_prompt() -> None:
    """Tout montant >= 100 € cité par l'agent doit exister sur le site."""
    autorises = _montants_publies()
    suspects = sorted(
        {int(n) for n in re.findall(r"\d+", _normalise(offer.GRILLE)) if int(n) >= 100}
        - autorises
    )
    assert not suspects, f"montants absents des pages publiques : {suspects}"
