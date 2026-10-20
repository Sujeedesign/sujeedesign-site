"""Validation des données d'un bloc, dérivée de son schéma.

Les mêmes règles servent le panneau, l'API et le store : un champ déclaré et
absent du gabarit ne peut pas être écrit, une valeur refusée n'est jamais
enregistrée à moitié. La validation ne lève jamais d'exception : elle retourne
la liste complète des erreurs.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import unquote, urlsplit

from .types import Block, Field, Kind

TEXT_KINDS = (Kind.TEXT, Kind.TEXTAREA, Kind.RICH, Kind.RICH_LINE)
ITEM_KINDS = (Kind.ITEMS, Kind.IMAGES, Kind.CTAS)


@dataclass(frozen=True)
class ValidationError:
    field: str
    rule: str
    detail: str = ""


def is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, (list, tuple, dict)):
        return len(value) == 0
    return False


def validate_data(block: Block, data: Any) -> list[ValidationError]:
    """Toutes les erreurs d'un jeu de données pour ce type de bloc."""
    if not isinstance(data, dict):
        return [ValidationError("", "bad_type", "data")]
    errors: list[ValidationError] = []
    variant = data.get("_variant")
    if block.variants and variant is not None and str(variant) not in block.variants:
        errors.append(ValidationError("_variant", "bad_variant", str(variant)))
    for key in data:
        if key.startswith("_"):
            continue
        if block.field(key) is None:
            errors.append(ValidationError(key, "unknown_field"))
    for field in block.fields:
        if field.name not in data:
            if field.required:
                errors.append(ValidationError(field.name, "required"))
            continue
        if field.required and is_empty(data[field.name]):
            errors.append(ValidationError(field.name, "required"))
            continue
        errors.extend(_top_errors(field, data[field.name]))
    if block.name == "zone-libre":
        errors.extend(_free_zone_errors(data))
    return errors


def validate_field(block: Block, name: str, value: Any) -> list[ValidationError]:
    """Erreurs d'un seul champ, tel que l'éditeur l'écrit au coup par coup."""
    field = block.field(name)
    if field is None:
        if name.startswith("_"):
            return []
        return [ValidationError(name, "unknown_field")]
    if field.required and is_empty(value):
        return [ValidationError(name, "required")]
    if is_empty(value):
        return []
    return _top_errors(field, value)


def _top_errors(field: Field, value: Any) -> list[ValidationError]:
    if field.kind in ITEM_KINDS:
        return _item_errors(field, value, field.name)
    return _errors_for(field, value, field.name)


def _errors_for(field: Field, value: Any, path: str) -> list[ValidationError]:
    kind = field.kind
    if kind in ITEM_KINDS:
        return _item_errors(field, value, path)
    if kind is Kind.IMAGE:
        # Une image est un chemin (média du site ou URL), jamais un objet : le
        # panneau choisit le fichier, le champ ne porte que son adresse. Sans
        # cette branche, toute image était refusée et les 4 types de blocs qui
        # en portent une (hero, banniere, galerie, image pleine largeur) étaient
        # impossibles à ajouter comme à remplir.
        if isinstance(value, str):
            return []
        return [ValidationError(path, "bad_type", "image")]
    if kind in TEXT_KINDS:
        if not isinstance(value, str):
            return [ValidationError(path, "bad_type", str(kind.value))]
        if field.max_length is not None and len(value) > field.max_length:
            return [ValidationError(path, "max_length", str(field.max_length))]
        return []
    if kind is Kind.NUMBER:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return [ValidationError(path, "not_a_number", "")]
        return []
    if kind is Kind.BOOL:
        if isinstance(value, bool) or (isinstance(value, int) and value in (0, 1)):
            return []
        return [ValidationError(path, "not_a_bool", "")]
    if kind is Kind.CHOICE:
        if isinstance(value, str) and value in field.choices:
            return []
        return [ValidationError(path, "bad_choice", "|".join(field.choices))]
    if kind is Kind.LINES:
        if isinstance(value, str):
            return []
        if not isinstance(value, (list, tuple)):
            return [ValidationError(path, "bad_type", "lines")]
        return [
            ValidationError(path, "bad_item", f"{path}[{index}]")
            for index, item in enumerate(value)
            if not isinstance(item, str)
        ]
    return [ValidationError(path, "bad_type", str(kind.value))]


def _item_errors(field: Field, value: Any, base_path: str | None = None) -> list[ValidationError]:
    """Valide récursivement les listes, en gardant le chemin de chaque sous-champ."""
    path_prefix = base_path or field.name
    if not isinstance(value, (list, tuple)):
        return [ValidationError(field.name, "bad_type", str(field.kind.value))]
    if field.max_items is not None and len(value) > field.max_items:
        return [ValidationError(field.name, "too_many", str(field.max_items))]
    errors: list[ValidationError] = []
    for index, item in enumerate(value):
        item_path = f"{path_prefix}[{index}]"
        if not isinstance(item, dict):
            errors.append(ValidationError(field.name, "bad_item", item_path))
            continue
        for key in item:
            if field.sub(key) is None:
                errors.append(ValidationError(field.name, "bad_item", f"{item_path}.{key}"))
        for sub in field.fields:
            if sub.name not in item or is_empty(item[sub.name]):
                continue
            sub_path = f"{item_path}.{sub.name}"
            if _errors_for(sub, item[sub.name], sub_path):
                errors.append(ValidationError(field.name, "bad_item", sub_path))
    return errors


def _safe_local_image(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    value = value.strip()
    if not value:
        return True
    try:
        parsed = urlsplit(value)
    except ValueError:
        return False
    if parsed.scheme or parsed.netloc or chr(92) in value or value.startswith("//"):
        return False
    path = unquote(parsed.path)
    if chr(92) in path or any(segment in {".", ".."} for segment in path.split("/")):
        return False
    return path.startswith(("/assets/", "/medias/", "assets/", "medias/"))


def _safe_layout_href(value: str) -> bool:
    value = value.strip()
    if chr(92) in value:
        return False
    try:
        parsed = urlsplit(value)
    except ValueError:
        return False
    if parsed.scheme:
        return parsed.scheme.lower() in {"http", "https", "mailto"}
    return not parsed.netloc and not value.startswith("//")


def _free_zone_errors(data: dict[str, Any]) -> list[ValidationError]:
    errors: list[ValidationError] = []
    columns = data.get("columns")
    if isinstance(columns, (list, tuple)):
        if not 1 <= len(columns) <= 3:
            errors.append(ValidationError("columns", "bad_layout", "1 à 3 colonnes requises"))
        spans: list[int] = []
        for column_index, column in enumerate(columns):
            if not isinstance(column, dict):
                continue
            span_value = column.get("span")
            try:
                if isinstance(span_value, bool) or not isinstance(span_value, (str, int)):
                    continue
                spans.append(int(span_value))
            except (TypeError, ValueError):
                continue
            elements = column.get("elements", [])
            for element in elements if isinstance(elements, list) else []:
                if not isinstance(element, dict):
                    continue
                path = f"columns[{column_index}].elements"
                if element.get("type") == "button":
                    href = element.get("href")
                    if href and (not isinstance(href, str) or not _safe_layout_href(href)):
                        errors.append(ValidationError("columns", "unsafe_href", path))
                if element.get("type") == "image" and not _safe_local_image(element.get("src", "")):
                    errors.append(ValidationError("columns", "unsafe_media", path))
        if len(spans) == len(columns) and (any(span < 2 for span in spans) or sum(spans) != 12):
            errors.append(ValidationError("columns", "bad_layout", "les largeurs doivent totaliser 12"))
    background_image = data.get("background_image", "")
    if background_image and not _safe_local_image(background_image):
        errors.append(ValidationError("background_image", "unsafe_media"))
    return errors
