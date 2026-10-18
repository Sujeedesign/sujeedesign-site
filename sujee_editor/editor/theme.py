"""Contrat versionné des thèmes pris en charge par l’éditeur visuel."""

from __future__ import annotations

THEME_ID = "sujee-site"
THEME_VERSION = 1
PROJECT_SCHEMA_VERSION = 1

# Identifiants stables enregistrés dans le project JSON GrapesJS.
SECTION_COMPONENTS: dict[str, str] = {
    "chapter": "sjd-section-chapter",
    "image-pleine-largeur": "sjd-section-image-pleine-largeur",
    "citation": "sjd-section-citation",
}
COMPONENT_SECTIONS = {component: section for section, component in SECTION_COMPONENTS.items()}
PILOT_SECTION_TYPES = tuple(SECTION_COMPONENTS)

# Classes existantes nécessaires au contenu éditorial du thème. Les classes
# arbitraires et les styles en ligne ne sont jamais importés dans un projet.
RICH_TEXT_CLASSES = frozenset(
    {"timeline", "reveal", "tl-yr", "tl-role", "tl-firme", "tl-desc"}
)
RICH_TEXT_TAGS = frozenset(
    {"a", "b", "blockquote", "br", "div", "em", "h3", "i", "li", "ol", "p", "span", "strong", "ul"}
)

__all__ = [
    "THEME_ID",
    "THEME_VERSION",
    "PROJECT_SCHEMA_VERSION",
    "SECTION_COMPONENTS",
    "COMPONENT_SECTIONS",
    "PILOT_SECTION_TYPES",
    "RICH_TEXT_CLASSES",
    "RICH_TEXT_TAGS",
]
