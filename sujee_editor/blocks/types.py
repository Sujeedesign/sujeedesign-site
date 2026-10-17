"""Contrat de schéma d'un bloc : types, champs, validation de forme.

Ce module ne connaît ni la base du site, ni ses gabarits : c'est la règle de
dépendance du paquet (`blocks/` ne dépend que de lui-même).
"""

from __future__ import annotations

from dataclasses import dataclass, field as dataclass_field
from enum import Enum
from typing import Any


class Kind(str, Enum):
    """Nature d'un champ. Les valeurs des types simples sont celles du back office."""

    TEXT = "text"
    TEXTAREA = "textarea"
    RICH = "html"
    RICH_LINE = "html-line"
    LINES = "lines"
    ITEMS = "items"
    IMAGES = "images"
    IMAGE = "image"
    BOOL = "bool"
    NUMBER = "number"
    CHOICE = "choice"
    CTAS = "ctas"


# Type de formulaire rendu par le back office (compatibilité avec l'existant).
FORM_TYPE: dict[Kind, str] = {
    Kind.RICH: "html",
    Kind.RICH_LINE: "html",
    Kind.CTAS: "items",
    Kind.ITEMS: "items",
}

# Un champ est éditable en place quand sa valeur est un texte. Les images n'y
# sont pas : un nœud marqué qui porte une `<img>` enregistrerait son balisage
# comme chemin d'image au lieu de laisser le panneau choisir un média.
INPLACE_KINDS = frozenset({Kind.TEXT, Kind.TEXTAREA, Kind.RICH, Kind.RICH_LINE})

MISSING = object()


@dataclass(frozen=True)
class Field:
    """Un champ de bloc : un seul objet pour le panneau, la validation et l'édition en place."""

    name: str
    kind: Kind
    label: str
    required: bool = False
    max_length: int | None = None
    choices: tuple[str, ...] = ()
    fields: tuple["Field", ...] = ()
    default: Any = MISSING
    inplace: bool | None = None
    max_items: int | None = None

    def __post_init__(self) -> None:
        if self.inplace is None:
            object.__setattr__(self, "inplace", self.kind in INPLACE_KINDS)

    @property
    def form_type(self) -> str:
        return FORM_TYPE.get(self.kind, str(self.kind.value))

    @property
    def has_default(self) -> bool:
        return self.default is not MISSING

    def sub(self, name: str) -> "Field | None":
        for child in self.fields:
            if child.name == name:
                return child
        return None


@dataclass(frozen=True)
class Block:
    """Un type de bloc du thème : schéma des champs, variantes et gabarit associé."""

    name: str
    label: str
    fields: tuple[Field, ...]
    template: str
    variants: dict[str, str] = dataclass_field(default_factory=dict)
    repeatable: bool = True

    def field(self, name: str) -> Field | None:
        for item in self.fields:
            if item.name == name:
                return item
        return None

    @property
    def inplace_fields(self) -> tuple[Field, ...]:
        return tuple(item for item in self.fields if item.inplace)

    @property
    def template_name(self) -> str:
        return self.template

    def serialize(self) -> dict[str, Any]:
        """Schéma transporté au navigateur (charge utile JSON de l'éditeur)."""
        return {
            "name": self.name,
            "label": self.label,
            "variants": dict(self.variants),
            "repeatable": self.repeatable,
            "fields": [_serialize_field(item) for item in self.fields],
        }


def default_data(block: Block) -> dict[str, Any]:
    """Valeurs de départ d'un bloc neuf, dérivées du schéma (aucune donnée en dur)."""
    data: dict[str, Any] = {}
    for field in block.fields:
        data[field.name] = _default_for(field)
    if block.variants:
        data["_variant"] = next(iter(block.variants))
    return data


def _default_for(field: Field) -> Any:
    if field.has_default:
        return field.default
    if field.kind is Kind.BOOL:
        return False
    if field.kind is Kind.NUMBER:
        return 0
    if field.kind in (Kind.LINES, Kind.ITEMS, Kind.IMAGES, Kind.CTAS):
        # Une liste naît vide : rendre "" la faisait refuser par sa propre
        # validation, donc un bloc neuf portant des boutons ne pouvait pas
        # être ajouté.
        return []
    if field.kind is Kind.CHOICE:
        return field.choices[0] if field.choices else ""
    return ""


def _serialize_field(field: Field) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "name": field.name,
        "kind": str(field.kind.value),
        "form_type": field.form_type,
        "label": field.label,
        "inplace": bool(field.inplace),
        "required": bool(field.required),
    }
    if field.max_length is not None:
        payload["max_length"] = field.max_length
    if field.max_items is not None:
        payload["max_items"] = field.max_items
    if field.choices:
        payload["choices"] = list(field.choices)
    if field.fields:
        payload["fields"] = [_serialize_field(child) for child in field.fields]
    if field.has_default:
        payload["default"] = field.default
    return payload
