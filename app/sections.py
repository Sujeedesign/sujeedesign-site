"""Registre des types de sections : champs éditables, variantes, gabarit."""

from __future__ import annotations

from typing import Any


def _f(name: str, label: str, type_: str = "text", **kwargs: Any) -> dict:
    field: dict[str, Any] = {"name": name, "label": label, "type": type_}
    field.update(kwargs)
    return field


CTA_ITEM = {
    "name": "ctas",
    "label": "Boutons",
    "type": "items",
    "fields": [
        _f("label", "Libellé"),
        _f("href", "Lien"),
        _f("style", "Style", "choice", choices=["pill", "pill--filled", "text-link"]),
    ],
}

HEADING_LINES = _f("heading_lines", "Titre (une ligne par élément)", "lines")
KICKER = _f("kicker", "Sur-titre")

SECTION_TYPES: dict[str, dict[str, Any]] = {
    "hero": {
        "label": "Bandeau d'ouverture",
        "variants": {
            "accueil": "Accueil (titre centré + fond animé)",
            "page": "Page interne (sur-titre, puis méta)",
            "simple": "Page simple (libellé, titre, intro)",
            "projet": "Couverture de réalisation",
        },
        "fields": [
            KICKER,
            _f("title", "Titre", "html"),
            _f("intro", "Introduction", "textarea"),
            _f("meta", "Étiquettes", "lines"),
            _f("rotator", "Mots du titre rotatif", "lines"),
            _f("cover", "Image de couverture", "image"),
            _f("cover_alt", "Texte alternatif de la couverture"),
            _f("image", "Visuel du projet (photo)", "image"),
            _f("image_alt", "Texte alternatif du visuel du projet"),
            _f("image_width", "Largeur du visuel (px)", "number"),
            _f("image_height", "Hauteur du visuel (px)", "number"),
            _f("back_label", "Libellé du retour"),
            _f("back_href", "Lien du retour"),
            _f("dense", "Espacements resserrés", "bool"),
            _f("wide_title", "Titre de page ample", "bool"),
            CTA_ITEM,
            _f("shader", "Fond animé", "bool"),
        ],
    },
    "manifeste": {
        "label": "Manifeste",
        "fields": [
            _f("label", "Libellé"),
            HEADING_LINES,
            _f("text", "Texte", "textarea"),
        ],
    },
    "realisations-grid": {
        "label": "Grille de réalisations",
        "variants": {"auto": "Automatique (les réalisations publiées)", "manuel": "Sélection manuelle"},
        "fields": [
            _f("label", "Libellé"),
            HEADING_LINES,
            _f("slugs", "Réalisations (slugs, une par ligne)", "lines"),
            _f("limit", "Nombre maximum", "number"),
            _f("all_label", "Libellé du lien vers la liste"),
        ],
    },
    "marquee": {
        "label": "Bandeau défilant",
        "fields": [_f("items", "Mots", "lines")],
    },
    "services-list": {
        "label": "Liste des services",
        "variants": {"auto": "Automatique (services publiés)", "manuel": "Sélection manuelle"},
        "fields": [
            _f("label", "Libellé"),
            _f("title", "Titre", "html"),
            _f("slugs", "Services (slugs, un par ligne)", "lines"),
        ],
    },
    "chapter": {
        "label": "Chapitre éditorial",
        "fields": [
            _f("kicker", "Sur-titre (ex. 01 · Résumé)"),
            _f("title", "Titre"),
            _f("body", "Texte", "html"),
            _f("list", "Liste à puces", "lines"),
            _f("dark", "Fond sombre", "bool"),
        ],
    },
    "texte-riche": {
        "label": "Bloc de texte",
        "variants": {"1": "Une colonne", "2": "Deux colonnes"},
        "fields": [
            _f("label", "Libellé"),
            _f("title", "Titre"),
            _f("body", "Texte", "html"),
        ],
    },
    "galerie": {
        "label": "Galerie d'images",
        "fields": [
            _f("label", "Libellé"),
            _f("images", "Images", "images", fields=[_f("src", "Fichier", "image"), _f("alt", "Texte alternatif"), _f("caption", "Légende")]),
            _f("columns", "Colonnes", "number"),
        ],
    },
    "image-pleine-largeur": {
        "label": "Image pleine largeur",
        "fields": [
            _f("src", "Fichier", "image"),
            _f("alt", "Texte alternatif"),
            _f("caption", "Légende"),
        ],
    },
    "chiffres-cles": {
        "label": "Chiffres clés",
        "fields": [
            _f("label", "Libellé"),
            _f("title", "Titre"),
            _f("items", "Chiffres", "items", fields=[_f("value", "Valeur"), _f("label", "Légende")]),
        ],
    },
    "process": {
        "label": "Étapes du process",
        "fields": [
            _f("label", "Libellé"),
            _f("title", "Titre"),
            _f("steps", "Étapes", "items", fields=[_f("title", "Titre"), _f("text", "Texte", "textarea")]),
        ],
    },
    "citation": {
        "label": "Citation",
        "fields": [
            _f("quote", "Citation", "textarea"),
            _f("author", "Auteur"),
            _f("role", "Fonction"),
        ],
    },
    "faq": {
        "label": "Questions fréquentes",
        "fields": [
            _f("label", "Libellé"),
            _f("title", "Titre"),
            _f("items", "Questions", "items", fields=[_f("q", "Question"), _f("a", "Réponse", "textarea")]),
        ],
    },
    "logos-clients": {
        "label": "Logos clients",
        "fields": [
            _f("label", "Libellé"),
            _f("logos", "Logos", "images", fields=[_f("src", "Fichier", "image"), _f("alt", "Texte alternatif")]),
        ],
    },
    "cta-final": {
        "label": "Appel à l'action final",
        "variants": {"interne": "Interne (sur-titre, titre, boutons)", "accueil": "Accueil (section sombre id=contact)"},
        "fields": [
            KICKER,
            _f("title", "Titre", "html"),
            _f("title_lines", "Titre découpé (une ligne par élément)", "lines"),
            _f("intro", "Texte", "textarea"),
            CTA_ITEM,
            _f("shader", "Fond animé", "bool"),
        ],
    },
    "formulaire-contact": {
        "label": "Formulaire de contact",
        "fields": [
            _f("label", "Libellé"),
            _f("title", "Titre"),
            _f("intro", "Introduction", "textarea"),
            _f("aside_title", "Titre de la colonne d'infos", default="Infos pratiques"),
            _f("columns", "Colonnes de texte à droite", "items", fields=[_f("title", "Titre"), _f("body", "Texte", "html")]),
        ],
    },
    "bloc-liens": {
        "label": "Bloc de liens (même rubrique)",
        "variants": {"services": "Services", "realisations": "Réalisations", "manuel": "Manuel"},
        "fields": [
            _f("label", "Libellé"),
            _f("slugs", "Slugs (une par ligne)", "lines"),
            _f("exclude_current", "Exclure la page courante", "bool"),
        ],
    },
    "etude-de-cas": {
        "label": "Étude de cas",
        "fields": [
            _f("blocks", "Blocs", "items", fields=[
                _f("kind", "Type", "choice", choices=["texte", "liste", "meta"]),
                _f("title", "Titre"),
                _f("body", "Texte", "html"),
                _f("items", "Éléments", "lines"),
                _f("meta", "Paires clé/valeur (clé|valeur)", "lines"),
            ]),
        ],
    },
    "banniere": {
        "label": "Bannière visuelle",
        "fields": [
            _f("src", "Fichier SVG ou image", "image"),
            _f("alt", "Description pour les lecteurs d'écran"),
            _f("svg", "SVG collé (HTML)", "html"),
        ],
    },
}

TEMPLATE_BY_TYPE = {name: f"sections/{name.replace('-', '_')}.html" for name in SECTION_TYPES}

# Ordre proposé dans l'interface d'ajout de section
SECTION_ORDER = list(SECTION_TYPES.keys())


def registry() -> dict[str, dict[str, Any]]:
    """Registre complet, utilisé par le back office pour générer les formulaires."""
    return SECTION_TYPES


def template_for(type_: str) -> str:
    return TEMPLATE_BY_TYPE.get(type_, "")


def default_value(field: dict[str, Any]) -> Any:
    if "default" in field:
        return field["default"]
    kind = field.get("type", "text")
    if kind == "bool":
        return field["name"] in {"shader"}
    if kind == "number":
        return field.get("value") or 0
    if kind in {"lines", "items", "images", "choices"}:
        return []
    if kind == "choice":
        choices = field.get("choices") or [""]
        return choices[0]
    return ""


def default_data(type_: str) -> dict[str, Any]:
    """Données initiales d'une section de ce type (formulaire d'ajout)."""
    spec = SECTION_TYPES.get(type_) or {}
    data = {field["name"]: default_value(field) for field in spec.get("fields", [])}
    variants = spec.get("variants") or {}
    if variants:
        data["_variant"] = next(iter(variants))
    return data


def defaults_for(type_: str) -> dict[str, Any]:
    """Valeurs par défaut d'une nouvelle section du type demandé."""
    spec = SECTION_TYPES.get(type_)
    if not spec:
        return {}
    data: dict[str, Any] = {}
    for field in spec["fields"]:
        kind = field["type"]
        if kind == "bool":
            data[field["name"]] = False
        elif kind in ("lines", "images", "items"):
            data[field["name"]] = []
        elif kind == "number":
            data[field["name"]] = field.get("default", 0)
        else:
            data[field["name"]] = ""
    if spec.get("variants"):
        data["_variant"] = next(iter(spec["variants"]))
    return data
