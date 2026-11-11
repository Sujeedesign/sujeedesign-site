"""Repères commerciaux de l'agent de contact.

Source unique des fourchettes autorisées. Les chiffres viennent des pages
publiques du site (`web/lib/budget-identity.ts`, `web/components/pages/GuidePrixSite.tsx`)
et du guide des tarifs. Le test `tests/test_agent_offer.py` vérifie que ces
montants existent toujours côté site, pour éviter la dérive silencieuse.

Règle : l'agent peut annoncer ces fourchettes comme des ordres de grandeur.
Il ne produit jamais un devis ferme, jamais une remise, jamais un délai
qui ne figure pas ici.
"""

from __future__ import annotations

GRILLE = """\
## Fourchettes publiques (ordre de grandeur, jamais un devis)
Identité de marque :
- logo seul : 800 à 1 500 €
- logo + déclinaisons : 1 100 à 1 500 €
- charte graphique complète : 1 200 à 2 500 €
- pack essentiel (logo, carte de visite, papeterie) : 1 900 à 3 000 €
- identité complète (stratégie, logo, charte, papeterie) : 2 200 à 4 000 €
- pack complet (identité + supports de lancement) : 3 200 à 5 000 €
- refonte d'une identité existante : 3 500 à 6 000 €
Supports imprimés : carte de visite 180 à 350 €, flyer 220 à 450 €,
affiche A2 320 à 500 €, plaquette 710 à 1 500 €, menu 180 à 350 €.
Réseaux sociaux : post 40 à 80 € l'unité.
Sites :
- site vitrine statique sur mesure : à partir de 2 000 €
- site WordPress : à partir de 2 750 €
- boutique Shopify : à partir de 4 000 €
- hébergement : 5 à 30 € par mois, domaine : 5 à 50 € par an,
  maintenance : 30 à 70 € par mois
Conseil et formation : 500 € la journée, 62,50 € de l'heure.
Délais habituels : identité de marque 3 à 5 semaines, direction artistique
1 à 2 semaines, site 3 à 6 semaines, après validation du périmètre.

Ce qui fait varier le prix, à expliquer honnêtement : le nombre de pistes
explorées, les déclinaisons, les supports, les allers-retours, et surtout
le périmètre. Un budget plus serré se traite en réduisant le périmètre,
jamais en bradant le travail.
"""


def build_prompt_block() -> str:
    return GRILLE
