"""Fixtures de rendu des blocs : données pleines et données vides.

Sert au test de contrat (chaque champ éditable en place est bien marqué dans le
gabarit) et aux tests de non-régression du rendu.
"""

from __future__ import annotations

import re
from typing import Any

from app import render as render_module
from sujee_editor.blocks import DEFAULT_BLOCKS, Block, Field, Kind, default_data


def sample_value(field: Field) -> Any:
    """Une valeur réaliste et non vide pour un champ, selon sa nature."""
    if field.kind is Kind.COLOR:
        return field.default or "#f2f2f4"
    if field.kind is Kind.BOOL:
        return True
    if field.kind is Kind.NUMBER:
        return 3
    if field.kind is Kind.CHOICE:
        return field.choices[0] if field.choices else ""
    if field.kind is Kind.IMAGE:
        return "/medias/sample.svg"
    if field.kind in (Kind.LINES,):
        return ["Première ligne", "Deuxième ligne"]
    if field.kind in (Kind.ITEMS, Kind.IMAGES, Kind.CTAS):
        return [sample_item(field)]
    if field.name == "svg":
        return '<svg viewbox="0 0 10 10"><path d="M0 0h10v10z"></path></svg>'
    if field.kind is Kind.RICH:
        return "<p>Un paragraphe de test.</p>"
    if field.kind is Kind.RICH_LINE:
        return "Un <em>titre</em> de test"
    return "Valeur de test"


def sample_item(field: Field) -> dict[str, Any]:
    return {child.name: sample_value(child) for child in field.fields}


def sample_data(block: Block) -> dict[str, Any]:
    data = {field.name: sample_value(field) for field in block.fields}
    if block.name == "zone-libre":
        data["columns"][0]["span"] = "12"
    if block.variants:
        data["_variant"] = next(iter(block.variants))
    return data


def empty_data(block: Block) -> dict[str, Any]:
    """Toutes les valeurs vides : le marquage des champs doit tenir quand même."""
    return default_data(block)


def render_section(name: str, data: dict[str, Any]) -> str:
    block = DEFAULT_BLOCKS[name]
    section = {
        "id": 1,
        "type": name,
        "variant": str(data.get("_variant") or ""),
        "label": block.label,
        "visible": 1,
        "data": data,
    }
    return render_module.section_html(render_module.build_env(), section)


def data_fields(html_text: str) -> set[str]:
    return set(re.findall(r'data-field="([^"]+)"', html_text))
