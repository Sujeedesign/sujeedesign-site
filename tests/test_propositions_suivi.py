"""Les pages de proposition doivent prévenir le suivi.

Une proposition est un fichier statique dans `web/public/propositions/<slug>/`.
Deux oublis silencieux l'ont déjà privée de statistiques : la balise absente de
la page, et un slug inconnu du serveur (404 à l'envoi). Ce test vérifie les deux
côtés pour chaque proposition livrée.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from app import tracking

RACINE = Path(__file__).resolve().parents[1] / "web" / "public" / "propositions"
SLUG_RE = re.compile(r'var\s+slug\s*=\s*"([^"]+)"')


def _pages() -> list[Path]:
    return sorted(p for p in RACINE.glob("*/index.html") if not p.parent.name.startswith("_"))


@pytest.mark.parametrize("page", _pages(), ids=lambda p: p.parent.name)
def test_balise_de_suivi_presente(page: Path) -> None:
    html = page.read_text(encoding="utf-8")
    assert 'id="sj-suivi"' in html, f"{page.parent.name} : balise de suivi absente"
    assert "/api/track/vue" in html, f"{page.parent.name} : balise sans appel à /api/track/vue"


@pytest.mark.parametrize("page", _pages(), ids=lambda p: p.parent.name)
def test_slug_declare_cote_serveur(page: Path) -> None:
    html = page.read_text(encoding="utf-8")
    trouve = SLUG_RE.search(html)
    assert trouve, f"{page.parent.name} : slug introuvable dans la balise"
    slug = trouve.group(1)
    assert slug in tracking.SLUGS, (
        f"{page.parent.name} : le slug « {slug} » n'est pas déclaré dans tracking.SLUGS,"
        " le serveur répondrait 404 et aucune vue ne serait comptée"
    )


def test_admin_et_suivi_partagent_la_meme_liste() -> None:
    """Une proposition doit apparaître dans l'admin comme dans le suivi.

    La liste était dupliquée : une proposition ouverte au suivi mais absente de
    l'admin n'affichait aucune carte, donc aucune vue, même en cas de trafic.
    """
    from app import admin

    assert admin.PROPOSITIONS == tracking.SLUGS
