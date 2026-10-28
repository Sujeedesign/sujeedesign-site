"""Modèle de contenu éditable du site public (Next).

Le site vitrine lit `web/content/home.json`. Le back office lit
`web/content/home.default.json` pour connaître les valeurs par défaut, et propose un formulaire dont
les champs écrivent dans la table `content_docs`. Au build, le front tire ce
document via `/api/v1/content/home` : une publication suffit à mettre le site à
jour, sans redéploiement de code.

Un seul contenu pour l'instant : l'accueil. Le modèle est déclaratif, donc
ajouter une page consiste à décrire ses champs ici (pas de formulaire à écrire
à la main).
"""

from __future__ import annotations

import copy
import json
import logging
import os
from pathlib import Path
from typing import Any, Iterable

LOGGER = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[1]


def defaults_path() -> Path:
    """Fichier de référence des valeurs par défaut (jamais réécrit par un build).

    `home.json` est le contenu publié, réécrit par `scripts/pull-content.mjs` ;
    `home.default.json` reste la structure de référence du code. Les séparer
    évite que le contenu publié devienne ses propres défauts (et qu'un retour
    en arrière efface les textes d'origine).
    """
    override = os.environ.get("CONTENT_DEFAULTS", "").strip()
    if override:
        return Path(override)
    primary = ROOT / "web" / "content" / "home.default.json"
    if primary.exists():
        return primary
    # Image du back office sans le dossier web : copie embarquée du référentiel.
    return Path(__file__).resolve().parent / "content_defaults" / "home.default.json"


def load_defaults() -> dict[str, Any]:
    """Contenu de référence ; vide si le fichier manque (image incomplète).

    Un conteneur sans ce fichier ne doit pas casser l'API : le document
    enregistré reste servi, et `pull-content.mjs` conserve alors son JSON local.
    """
    path = defaults_path()
    try:
        with path.open(encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        LOGGER.warning("valeurs par défaut absentes : %s", path)
        return {}


# --------------------------------------------------------------- lecture/écriture de chemins


def get_path(data: Any, path: str, default: Any = "") -> Any:
    node = data
    for part in path.split("."):
        if isinstance(node, list):
            try:
                node = node[int(part)]
            except (ValueError, IndexError):
                return default
        elif isinstance(node, dict):
            if part not in node:
                return default
            node = node[part]
        else:
            return default
    return node


def set_path(data: Any, path: str, value: Any) -> None:
    parts = path.split(".")
    node = data
    for part in parts[:-1]:
        if isinstance(node, list):
            node = node[int(part)]
        else:
            node = node.setdefault(part, {})
    last = parts[-1]
    if isinstance(node, list):
        node[int(last)] = value
    else:
        node[last] = value


def _field(path: str, label: str, kind: str = "text", hint: str = "", choices: Iterable[str] = ()) -> dict[str, Any]:
    return {"path": path, "label": label, "type": kind, "hint": hint, "choices": list(choices)}


def _block(label: str, *fields: dict[str, Any]) -> dict[str, Any]:
    return {"label": label, "fields": list(fields)}


def _links(path: str, label: str) -> dict[str, Any]:
    return _block(label, _field(f"{path}.label", "Libellé"), _field(f"{path}.href", "Lien", hint="Adresse interne (/realisations) ou mailto:..."))


def schema_home() -> list[dict[str, Any]]:
    """Description du formulaire, dans l'ordre d'affichage."""
    return [
        {
            "key": "hero",
            "label": "En-tête",
            "hint": "Premier écran de l'accueil.",
            "blocks": [
                _block(
                    "Accroche",
                    _field("hero.kicker", "Sur-titre", hint="Petite ligne au-dessus du titre"),
                    _field("hero.title.first", "Titre, premier mot"),
                    _field("hero.title.highlight", "Titre, mot accentué"),
                    _field("hero.title.last", "Titre, fin"),
                    _field("hero.lead.text", "Introduction", "long"),
                    _field("hero.lead.strong", "Introduction, passage en gras", "long"),
                    _field("hero.tag", "Étiquette du projet", hint="Affichée sous le bouton"),
                ),
                _links("hero.cta", "Bouton"),
            ],
        },
        {
            "key": "studio",
            "label": "Studio",
            "hint": "Bloc de présentation et chiffres.",
            "blocks": [
                _block(
                    "Présentation",
                    _field("studio.title", "Titre (une ligne par ligne)", "lines"),
                    _field("studio.intro", "Texte", "long"),
                    _field("studio.aside", "Mention latérale"),
                    _field("studio.statement.text", "Phrase forte", "long"),
                    _field("studio.statement.emphasis", "Phrase forte, accent", "long"),
                ),
                *[
                    _block(
                        f"Chiffre {index + 1}",
                        _field(f"studio.stats.{index}.value", "Valeur"),
                        _field(f"studio.stats.{index}.label", "Étiquette"),
                        _field(f"studio.stats.{index}.text", "Détail", "long"),
                    )
                    for index in range(4)
                ],
            ],
        },
        {
            "key": "cases",
            "label": "Projets",
            "hint": "Trois études de cas de l'accueil.",
            "blocks": [
                _block(
                    "Introduction",
                    _field("cases.title", "Titre (une ligne par ligne)", "lines"),
                    _field("cases.intro", "Texte", "long"),
                ),
                _links("cases.aside", "Lien vers les réalisations"),
                *[
                    _block(
                        f"Projet {index + 1}",
                        _field(f"cases.items.{index}.index", "Surtitre", hint="Ex. 01 / Identité · Packaging"),
                        _field(f"cases.items.{index}.title", "Nom"),
                        _field(f"cases.items.{index}.meta", "Mentions (une par ligne, 3 attendues)", "lines"),
                        _field(f"cases.items.{index}.tags", "Mots-clés (un par ligne, 2 minimum)", "lines"),
                        _field(f"cases.items.{index}.barLabel", "Bandeau"),
                        _field(f"cases.items.{index}.ghost", "Numéro fantôme", hint="Deux caractères"),
                        _field(f"cases.items.{index}.href", "Lien"),
                        _field(
                            f"cases.items.{index}.visual",
                            "Visuel",
                            "select",
                            choices=("pack", "sign", "ui"),
                        ),
                        _field(
                            f"cases.items.{index}.tone",
                            "Ambiance",
                            "select",
                            choices=("paper", "signal", "ui"),
                        ),
                    )
                    for index in range(3)
                ],
            ],
        },
        {
            "key": "method",
            "label": "Méthode",
            "hint": "Les trois temps du déroulé.",
            "blocks": [
                _block(
                    "Introduction",
                    _field("method.title", "Titre"),
                    _field("method.intro", "Texte", "long"),
                    _field("method.aside", "Mention latérale"),
                ),
                *[
                    _block(
                        f"Étape {index + 1}",
                        _field(f"method.steps.{index}.step", "Étiquette"),
                        _field(f"method.steps.{index}.duration", "Durée"),
                        _field(f"method.steps.{index}.title", "Titre"),
                        _field(f"method.steps.{index}.text", "Texte", "long"),
                    )
                    for index in range(3)
                ],
            ],
        },
        {
            "key": "services",
            "label": "Services",
            "hint": "Les cinq métiers listés sur l'accueil.",
            "blocks": [
                _block(
                    "Introduction",
                    _field("services.title", "Titre (une ligne par ligne)", "lines"),
                    _field("services.intro", "Texte", "long"),
                    _field("services.aside", "Mention latérale"),
                ),
                *[
                    _block(
                        f"Service {index + 1}",
                        _field(f"services.items.{index}.number", "Numéro"),
                        _field(f"services.items.{index}.title", "Titre"),
                        _field(f"services.items.{index}.summary", "Résumé", "long"),
                        _field(f"services.items.{index}.href", "Lien"),
                    )
                    for index in range(5)
                ],
            ],
        },
        {
            "key": "cta",
            "label": "Appel final",
            "hint": "Dernière relance avant le contact.",
            "blocks": [
                _block("Texte", _field("cta.text", "Phrase", "long")),
                _links("cta.action", "Bouton"),
            ],
        },
    ]


def _f(path: str, label: str, kind: str = "text") -> dict[str, Any]:
    return {"path": path, "label": label, "type": kind}


def schema_page(slug: str, title_lines: int, *, kicker: str = "", lead: str = "", extra: str = "") -> list[dict[str, Any]]:
    """Gabarit commun aux pages secondaires : sur-titre, titre, chapô.

    Les titres multi-lignes sont exposés ligne par ligne (et non en bloc) pour
    rester éditables en place : le runtime écrit `page.hero.title.0`, `.1`, etc.
    """
    fields: list[dict[str, Any]] = []
    if kicker:
        fields.append(_f("hero.kicker", kicker))
    for index in range(title_lines):
        fields.append(_f(f"hero.title.{index}", f"Titre, ligne {index + 1}"))
    if lead:
        fields.append(_f("hero.lead", lead, "long"))
    if extra:
        fields.append(_f("hero.lead2", extra, "long"))
    return [
        {
            "key": "hero",
            "label": "Bandeau de tête",
            "hint": "Le premier écran de la page. Reste court : c'est ce qu'on lit avant de défiler.",
            "blocks": [{"label": slug, "fields": fields}],
        }
    ]


PAGE_DEFAULTS: dict[str, dict[str, Any]] = {
    "services": {
        "hero": {
            "kicker": "Services · Périmètre écrit",
            "title": ["Cinq métiers,", "un seul interlocuteur."],
            "lead": "Le périmètre est écrit avant de commencer. Les allers-retours sont inclus, et vous repartez avec les sources et les accès à votre nom.",
        }
    },
    "realisations": {
        "hero": {
            "kicker": "Réalisations · 2013 — 2026",
            "lead": "Identité, packaging, site, interface, édition, jeu web. Tout est livré, en ligne ou en rayon.",
            "lead2": "Rien n’est une maquette de concours.",
        }
    },
    "a-propos": {
        "hero": {
            "kicker": "À propos · Sujeepan Sabesan",
            "title": ["Je dessine,", "je cadre,", "j'enseigne."],
            "lead": "Treize ans de studio entre Cergy et Paris, à faire la même chose sous des formes différentes : donner une allure juste à des marques qui n'ont pas les moyens d'une agence. Identités, sites, images, emballages. Et depuis huit ans, des classes entières à qui je transmets la méthode.",
            "lead2": "Vous parlez à la personne qui dessine, qui code quand il faut, qui cadre le shooting et qui répond.",
        }
    },
    "agents-ia": {
        "hero": {
            "kicker": "Service · Agents IA",
            "title": ["Un agent qui fait le travail.", "Pas une démo."],
            "lead": "Vous avez testé ChatGPT, trouvé ça impressionnant, et rien n'a changé dans votre semaine. Normal : un modèle seul ne connaît ni vos clients, ni vos fichiers, ni vos règles. Un agent, si.",
        }
    },
}


def defaults_for(slug: str) -> dict[str, Any]:
    if slug == "home":
        return load_defaults()
    return copy.deepcopy(PAGE_DEFAULTS.get(slug, {}))


SCHEMAS: dict[str, list[dict[str, Any]]] = {
    "home": schema_home(),
    "services": schema_page("services", 2, kicker="Sur-titre", lead="Chapô"),
    "realisations": schema_page("realisations", 0, kicker="Sur-titre", lead="Chapô", extra="Phrase en gras"),
    "a-propos": schema_page("a-propos", 3, kicker="Sur-titre", lead="Chapô", extra="Deuxième paragraphe"),
    "agents-ia": schema_page("agents-ia", 2, kicker="Sur-titre", lead="Chapô"),
}


def schema_for(slug: str) -> list[dict[str, Any]]:
    return SCHEMAS.get(slug, [])


def fields_for(slug: str) -> list[dict[str, Any]]:
    return [field for section in schema_for(slug) for block in section["blocks"] for field in block["fields"]]


def form_sections(slug: str, data: dict[str, Any]) -> list[dict[str, Any]]:
    """Schéma enrichi des valeurs courantes, prêt pour le gabarit."""
    sections = copy.deepcopy(schema_for(slug))
    for section in sections:
        for block in section["blocks"]:
            for field in block["fields"]:
                value = get_path(data, field["path"], "")
                if field["type"] == "lines":
                    field["value"] = "\n".join(str(item) for item in value) if isinstance(value, list) else str(value or "")
                else:
                    field["value"] = "" if value is None else str(value)
    return sections


class ContentError(ValueError):
    """Contenu refusé : message destiné à l'écran d'édition."""


def _to_value(field: dict[str, Any], raw: str) -> Any:
    text = raw.replace("\r\n", "\n")
    if field["type"] == "lines":
        return [line.strip() for line in text.split("\n") if line.strip()]
    value = text.strip()
    if field["type"] == "select":
        if value not in field["choices"]:
            raise ContentError(f"« {field['label']} » : valeur hors liste.")
        return value
    return value


def from_form(slug: str, form: Any, base: dict[str, Any], validate_doc: bool = True) -> dict[str, Any]:
    """Reconstruit le document complet à partir du formulaire.

    Le formulaire envoie tous les champs du modèle : on part donc des valeurs
    par défaut comme filet, et on remplace champ par champ. Un champ absent du
    formulaire garde sa valeur, ce qui évite de vider le site sur un navigateur
    qui n'enverrait pas tout.
    """
    doc = copy.deepcopy(base)
    for field in fields_for(slug):
        name = f"f_{field['path']}"
        if name not in form:
            continue
        set_path(doc, field["path"], _to_value(field, str(form.get(name) or "")))
    if validate_doc:
        validate(slug, doc)
    return doc


def validate(slug: str, doc: dict[str, Any]) -> None:
    """Garde-fous alignés sur le schéma zod du front.

    Sans ça, un champ vidé par erreur casserait le build Next (le schéma zod
    refuse les chaînes vides). Mieux vaut refuser l'enregistrement.
    """
    for field in fields_for(slug):
        value = get_path(doc, field["path"], None)
        if field["type"] == "lines":
            minimum = 2 if field["path"] in {"studio.title", "cases.title", "services.title"} else 1
            if not isinstance(value, list) or len(value) < minimum:
                raise ContentError(f"« {field['label']} » : il faut au moins {minimum} ligne(s).")
            if field["path"].endswith(".meta") and len(value) != 3:
                raise ContentError(f"« {field['label']} » : trois mentions exactement.")
            if any(not str(item).strip() for item in value):
                raise ContentError(f"« {field['label']} » : une ligne est vide.")
        elif not str(value or "").strip():
            raise ContentError(f"« {field['label']} » ne peut pas être vide.")

    if slug != "home":
        return

    ghost = get_path(doc, "cases.items.0.ghost", "")
    for index in range(3):
        ghost = get_path(doc, f"cases.items.{index}.ghost", "")
        if len(ghost) != 2:
            raise ContentError("Le numéro fantôme d'un projet doit faire deux caractères.")
    for index in range(5):
        number = get_path(doc, f"services.items.{index}.number", "")
        if len(number) != 2:
            raise ContentError("Le numéro d'un service doit faire deux caractères.")
