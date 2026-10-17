"""Registre des sections du site : adaptateur du registre typé de `sujee_editor`.

Le back office et le moteur de rendu consomment depuis toujours un registre de
dictionnaires (`SECTION_TYPES`). L'éditeur introduit le registre typé du paquet.
Ce module est la seule passerelle entre les deux : il projette `DEFAULT_BLOCKS`
dans la forme historique, sans rien y ajouter.
"""

from __future__ import annotations

from typing import Any

from sujee_editor.blocks import DEFAULT_BLOCKS, Block, Field


def _legacy_field(field: Field) -> dict[str, Any]:
    out: dict[str, Any] = {"name": field.name, "label": field.label, "type": field.form_type}
    if field.fields:
        out["fields"] = [_legacy_field(child) for child in field.fields]
    if field.choices:
        out["choices"] = list(field.choices)
    if field.has_default:
        out["default"] = field.default
    return out


def _legacy_block(block: Block) -> dict[str, Any]:
    out: dict[str, Any] = {"label": block.label}
    if block.variants:
        out["variants"] = dict(block.variants)
    out["fields"] = [_legacy_field(field) for field in block.fields]
    return out


SECTION_TYPES: dict[str, dict[str, Any]] = {name: _legacy_block(block) for name, block in DEFAULT_BLOCKS.items()}

TEMPLATE_BY_TYPE = {name: block.template for name, block in DEFAULT_BLOCKS.items()}

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
