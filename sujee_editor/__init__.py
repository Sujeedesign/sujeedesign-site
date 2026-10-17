"""Éditeur de blocs Sujee : paquet réutilisable pour les sites de la stack Sujee.

Un site fournit ses jetons de design, ses gabarits de blocs et la liste des
blocs activés. Il n'écrit jamais l'éditeur, le stockage, les révisions, la
session ni la validation.
"""

from __future__ import annotations

from . import blocks
from .blocks import DEFAULT_BLOCKS, Block, Field, Kind, get_block

__all__ = ["blocks", "Block", "Field", "Kind", "DEFAULT_BLOCKS", "get_block"]
__version__ = "0.1.0"
