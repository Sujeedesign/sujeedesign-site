"""Contrat versionné des thèmes pris en charge par l’éditeur visuel."""

from __future__ import annotations

from sujee_editor.blocks import DEFAULT_BLOCKS

THEME_ID = "sujee-site"
THEME_VERSION = 5
PROJECT_SCHEMA_VERSION = 1

# Identifiants stables enregistrés dans le project JSON GrapesJS. Les trois
# identifiants du pilote restent inchangés pour préserver les projets stockés.
SECTION_COMPONENTS: dict[str, str] = {
    name: (
        f"sjd-section-{name}"
    )
    for name in DEFAULT_BLOCKS
}
COMPONENT_SECTIONS = {component: section for section, component in SECTION_COMPONENTS.items()}
SUPPORTED_SECTION_TYPES = tuple(DEFAULT_BLOCKS)
# Alias temporaire pour les routes/store qui basculeront dans le Task 3.
PILOT_SECTION_TYPES = SUPPORTED_SECTION_TYPES

# Classes existantes nécessaires au contenu éditorial du thème. Les classes
# arbitraires et les styles en ligne ne sont jamais importés dans un projet.
RICH_TEXT_CLASSES = frozenset(
    {"timeline", "reveal", "tl-yr", "tl-role", "tl-firme", "tl-desc"}
)
# Balises autorisées pour le rich text : reprend le sanitizer public. `div`
# reste permis pour préserver les listes de parcours historiques.
RICH_TEXT_TAGS = frozenset(
    {
        "a", "b", "blockquote", "br", "cite", "div", "em", "h2", "h3", "h4",
        "i", "li", "mark", "ol", "p", "small", "span", "strong", "sub", "sup", "u", "ul",
    }
)

__all__ = [
    "THEME_ID",
    "THEME_VERSION",
    "PROJECT_SCHEMA_VERSION",
    "SECTION_COMPONENTS",
    "COMPONENT_SECTIONS",
    "PILOT_SECTION_TYPES",
    "SUPPORTED_SECTION_TYPES",
    "RICH_TEXT_CLASSES",
    "RICH_TEXT_TAGS",
]
