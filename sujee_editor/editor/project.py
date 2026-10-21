"""Import/export contrôlé entre les sections du site et le project JSON GrapesJS.

Le JSON d'édition n'est pas du HTML public : seule la liste blanche de
composants et de champs est convertie vers les données typées du renderer Jinja.
"""

from __future__ import annotations

import copy
import json
from collections.abc import Mapping, Sequence
from html import escape
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urlsplit

from sujee_editor.blocks import DEFAULT_BLOCKS, Field, Kind, default_data, validate_data

from .theme import (
    COMPONENT_SECTIONS,
    PILOT_SECTION_TYPES,
    PROJECT_SCHEMA_VERSION,
    RICH_TEXT_CLASSES,
    RICH_TEXT_TAGS,
    SECTION_COMPONENTS,
    SUPPORTED_SECTION_TYPES,
    THEME_ID,
    THEME_VERSION,
)


class ProjectError(ValueError):
    """Projet visuel invalide ou incompatible avec le thème actif."""


_VOID_TAGS = frozenset({"br"})
_FIELD_TAGS = {
    "chapter": {"kicker": {"p", "span"}, "title": {"h2"}, "body": {"div"}, "list": {"ul"}},
    "image-pleine-largeur": {"src": {"img"}, "caption": {"figcaption"}},
    "citation": {"quote": {"p", "blockquote"}, "author": {"cite", "span"}, "role": {"span"}},
}


def _is_safe_href(value: str) -> bool:
    parsed = urlsplit(value.strip())
    if parsed.scheme:
        return parsed.scheme.lower() in {"http", "https", "mailto"}
    return not parsed.netloc and not value.strip().startswith("//")


def _safe_media_path(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    value = value.strip()
    if not value:
        return True
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc or value.startswith("//"):
        return False
    path = parsed.path.replace("\\", "/")
    if any(segment in {".", ".."} for segment in path.split("/")):
        return False
    return path.startswith(("/medias/", "/assets/", "medias/", "assets/"))


def _text_component(value: Any, tag: str, field: str) -> dict[str, Any]:
    return {
        "tagName": tag,
        "attributes": {"data-sjd-field": field},
        "content": str(value or ""),
    }


class _MarkupToComponents(HTMLParser):
    """Parse le rich text historique en composants simples, sans styles libres."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root: list[dict[str, Any]] = []
        self.stack: list[dict[str, Any]] = []

    def _parent(self) -> list[dict[str, Any]]:
        return self.stack[-1]["components"] if self.stack else self.root

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag not in RICH_TEXT_TAGS:
            raise ProjectError(f"HTML rich non autorisé : {tag}")
        attributes: dict[str, str] = {}
        for raw_name, raw_value in attrs:
            name = raw_name.lower()
            value = raw_value or ""
            # L'import historique nettoie les styles/événements ; le JSON
            # utilisateur, lui, les refusera à l'export.
            if name == "style" or name.startswith("on"):
                continue
            if name == "class":
                allowed = [item for item in value.split() if item in RICH_TEXT_CLASSES]
                if allowed:
                    attributes["class"] = " ".join(allowed)
                continue
            if name == "href" and tag == "a" and _is_safe_href(value):
                attributes["href"] = value
        node: dict[str, Any] = {"tagName": tag}
        if attributes:
            node["attributes"] = attributes
        if tag in _VOID_TAGS:
            self._parent().append(node)
            return
        node["components"] = []
        self._parent().append(node)
        self.stack.append(node)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        if tag.lower() not in _VOID_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag: str) -> None:
        if not self.stack:
            return
        tag = tag.lower()
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index]["tagName"] == tag:
                del self.stack[index:]
                return

    def handle_data(self, data: str) -> None:
        if data:
            self._parent().append({"type": "textnode", "content": data})


def _markup_components(markup: str) -> list[dict[str, Any]]:
    parser = _MarkupToComponents()
    try:
        parser.feed(markup)
        parser.close()
    except ProjectError:
        raise
    except Exception as exc:
        raise ProjectError("HTML rich invalide") from exc
    if parser.stack:
        raise ProjectError("HTML rich incomplet")
    return parser.root


def _lines(value: Any) -> list[str]:
    if isinstance(value, (list, tuple)):
        return [item for item in value if isinstance(item, str)]
    if isinstance(value, str):
        return value.splitlines()
    return []


def _component(section_type: str, section: Mapping[str, Any], data: Mapping[str, Any]) -> dict[str, Any]:
    attributes = {
        "data-sjd-section": section_type,
        "data-sjd-visible": "1" if bool(section.get("visible", True)) else "0",
        "data-sjd-variant": str(section.get("variant") or data.get("_variant") or ""),
        "data-sjd-data": json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False),
    }
    identifier = section.get("id")
    if identifier is not None:
        if isinstance(identifier, bool) or not isinstance(identifier, int) or identifier <= 0:
            raise ProjectError("identifiant de section invalide")
        attributes["data-sjd-section-id"] = str(identifier)

    if section_type == "chapter":
        attributes["class"] = "s-chap reveal" + (" dark" if bool(data.get("dark")) else "")
        attributes["data-sjd-dark"] = "1" if bool(data.get("dark")) else "0"
        children = [{
            "tagName": "div", "attributes": {"class": "container"}, "components": [{
                "tagName": "div", "attributes": {"class": "chap"}, "components": [
                    {"tagName": "div", "attributes": {"class": "chap-head"}, "components": [
                        {**_text_component(data.get("kicker"), "span", "kicker"), "attributes": {"class": "type", "data-sjd-field": "kicker"}},
                        {**_text_component(data.get("title"), "h2", "title"), "attributes": {"class": "chap-title", "data-sjd-field": "title"}},
                    ]},
                    {"tagName": "div", "attributes": {"class": "chap-body"}, "components": [
                        {"tagName": "div", "attributes": {"class": "chap-rich", "data-sjd-field": "body"}, "components": _markup_components(str(data.get("body") or ""))},
                        {"tagName": "ul", "attributes": {"class": "chap-list", "data-sjd-field": "list"}, "components": [{"tagName": "li", "content": line} for line in _lines(data.get("list"))]},
                    ]},
                ],
            }],
        }]
    elif section_type == "image-pleine-largeur":
        attributes["class"] = "page-body reveal"
        src = str(data.get("src") or "")
        if not _safe_media_path(src):
            raise ProjectError("image hors des médias locaux autorisés")
        children = [{"tagName": "figure", "attributes": {"class": "full-bleed"}, "components": [
            {"type": "image", "tagName": "img", "attributes": {"data-sjd-field": "src", "src": src, "alt": str(data.get("alt") or "")}},
            _text_component(data.get("caption"), "figcaption", "caption"),
        ]}]
    else:
        attributes["class"] = "citation reveal"
        children = [{"tagName": "div", "attributes": {"class": "container"}, "components": [{
            "tagName": "blockquote", "attributes": {"class": "quote"}, "components": [
                _text_component(data.get("quote"), "p", "quote") | {"attributes": {"class": "quote-text", "data-sjd-field": "quote"}},
                {"tagName": "footer", "attributes": {"class": "quote-source"}, "components": [
                    _text_component(data.get("author"), "cite", "author"),
                    _text_component(data.get("role"), "span", "role") | {"attributes": {"class": "quote-role", "data-sjd-field": "role"}},
                ]},
            ],
        }]}]
    return {
        "type": SECTION_COMPONENTS[section_type],
        "tagName": "section",
        "attributes": attributes,
        "components": children,
    }


def _sanitize_typed_data(block: Any, data: Any) -> dict[str, Any]:
    """Validate typed fields and normalize rich text/media before save or publish."""
    if not isinstance(data, dict):
        raise ProjectError("données de section invalides")
    errors = validate_data(block, data)
    if errors:
        first = errors[0]
        raise ProjectError(f"validation {block.name}.{first.field}: {first.rule}")

    def clean(field: Field, value: Any) -> Any:
        if block.name == "banniere" and field.name == "svg":
            # Les bannières SVG historiques sont du HTML actif potentiel : on
            # conserve le SVG autorisé par le filtre public, sans le traiter
            # comme du rich-text éditorial classique.
            from app.render import sanitize_svg

            return sanitize_svg(value)
        if field.kind is Kind.IMAGE:
            if not _safe_media_path(value):
                raise ProjectError(f"image hors des médias locaux autorisés : {field.name}")
            return value
        if field.kind in {Kind.RICH, Kind.RICH_LINE}:
            nodes = _markup_components(value)
            return "".join(_render_rich_node(node) for node in nodes)
        if field.fields and isinstance(value, list):
            cleaned_items = []
            for item in value:
                if not isinstance(item, Mapping):
                    raise ProjectError(f"élément invalide : {field.name}")
                cleaned_items.append({
                    sub.name: clean(sub, item[sub.name])
                    for sub in field.fields
                    if sub.name in item
                })
            return cleaned_items
        return value

    normalized = dict(data)
    for key in normalized:
        if key.startswith("_") and key != "_variant":
            raise ProjectError("champ interne de section non autorisé")
    for field in block.fields:
        if field.name in normalized:
            normalized[field.name] = clean(field, normalized[field.name])
    return normalized


def sections_to_project(sections: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """Convertit sans mutation les sections supportées en projet GrapesJS versionné."""
    if not isinstance(sections, Sequence) or isinstance(sections, (str, bytes)):
        raise ProjectError("liste de sections invalide")
    ordered = sorted(sections, key=lambda item: item.get("position", 0) if isinstance(item, Mapping) else 0)
    components: list[dict[str, Any]] = []
    seen_ids: set[int] = set()
    for section in ordered:
        if not isinstance(section, Mapping):
            raise ProjectError("section invalide")
        section_type = section.get("type")
        if section_type not in SUPPORTED_SECTION_TYPES:
            raise ProjectError(f"section non prise en charge : {section_type}")
        identifier = section.get("id")
        if identifier is not None:
            if isinstance(identifier, bool) or not isinstance(identifier, int) or identifier <= 0:
                raise ProjectError("identifiant de section invalide")
            if identifier in seen_ids:
                raise ProjectError("identifiant de section dupliqué")
            seen_ids.add(identifier)
        block = DEFAULT_BLOCKS[section_type]
        source_data = section.get("effective")
        if not isinstance(source_data, Mapping):
            source_data = section.get("draft")
        if not isinstance(source_data, Mapping):
            source_data = section.get("data")
        if not isinstance(source_data, Mapping):
            source_data = {}
        data = default_data(block)
        known = {field.name for field in block.fields}
        data.update({key: value for key, value in source_data.items() if key in known or key.startswith("_")})
        variant = str(section.get("variant") or data.get("_variant") or "")
        if block.variants:
            data["_variant"] = variant or next(iter(block.variants))
        data = _sanitize_typed_data(block, data)
        components.append(_component(section_type, section, data))

    return {
        "schema_version": PROJECT_SCHEMA_VERSION,
        "theme_id": THEME_ID,
        "theme_version": THEME_VERSION,
        "project_data": {
            "pages": [
                {
                    "id": "sjd-pilot-page",
                    "frames": [{"id": "sjd-pilot-frame", "component": {"type": "wrapper", "components": components}}],
                }
            ],
            "styles": [],
            "assets": [],
        },
    }


def _walk(node: Any, depth: int = 0, count: list[int] | None = None):
    if count is None:
        count = [0]
    count[0] += 1
    if depth > 64 or count[0] > 10000:
        raise ProjectError("projet trop profond ou complexe")
    if isinstance(node, list):
        for child in node:
            yield from _walk(child, depth + 1, count)
        return
    if not isinstance(node, Mapping):
        return
    if node.get("style"):
        raise ProjectError("style libre interdit")
    attributes = node.get("attributes")
    if isinstance(attributes, Mapping):
        for name in attributes:
            name = str(name).lower()
            if name == "style" or name.startswith("on"):
                raise ProjectError("style ou événement HTML interdit")
    tag = str(node.get("tagName") or "").lower()
    if tag in {"script", "style", "iframe", "object", "embed"}:
        raise ProjectError("HTML actif interdit")
    yield node
    yield from _walk(node.get("components", []), depth + 1, count)


def _fields(component: Mapping[str, Any], section_type: str) -> dict[str, Mapping[str, Any]]:
    allowed = _FIELD_TAGS[section_type]
    found: dict[str, Mapping[str, Any]] = {}
    for node in _walk(component.get("components", [])):
        attrs = node.get("attributes")
        if not isinstance(attrs, Mapping) or "data-sjd-field" not in attrs:
            continue
        name = str(attrs["data-sjd-field"])
        if name not in allowed:
            raise ProjectError(f"champ inconnu dans {section_type} : {name}")
        if name in found:
            raise ProjectError(f"champ dupliqué dans {section_type} : {name}")
        tag = str(node.get("tagName") or "").lower()
        if tag not in allowed[name]:
            raise ProjectError(f"balise invalide pour {section_type}.{name}")
        found[name] = node
    return found


def _plain_text(node: Mapping[str, Any]) -> str:
    content = node.get("content", "")
    if not isinstance(content, str):
        raise ProjectError("contenu textuel invalide")
    parts = [content]
    children = node.get("components", [])
    if not isinstance(children, list):
        raise ProjectError("structure de contenu invalide")
    for child in children:
        if isinstance(child, str):
            parts.append(child)
        elif isinstance(child, Mapping):
            parts.append(_plain_text(child))
        else:
            raise ProjectError("nœud de contenu invalide")
    return "".join(parts)


def _render_rich_node(node: Any) -> str:
    if isinstance(node, str):
        return escape(node, quote=False)
    if not isinstance(node, Mapping):
        raise ProjectError("nœud HTML rich invalide")
    if node.get("type") == "textnode":
        return escape(str(node.get("content") or ""), quote=False)
    tag = str(node.get("tagName") or "").lower()
    if tag not in RICH_TEXT_TAGS:
        raise ProjectError(f"HTML rich non autorisé : {tag or 'sans balise'}")
    attrs = node.get("attributes") or {}
    if not isinstance(attrs, Mapping):
        raise ProjectError("attributs HTML invalides")
    rendered_attrs: list[str] = []
    for raw_name, raw_value in attrs.items():
        name = str(raw_name).lower()
        value = str(raw_value or "")
        if name == "class":
            classes = [item for item in value.split() if item in RICH_TEXT_CLASSES]
            if classes:
                rendered_attrs.append(f' class="{escape(" ".join(classes), quote=True)}"')
        elif name == "href" and tag == "a" and _is_safe_href(value):
            rendered_attrs.append(f' href="{escape(value, quote=True)}"')
        elif name == "data-sjd-field":
            continue
        else:
            raise ProjectError(f"attribut HTML rich non autorisé : {name}")
    content = node.get("content", "")
    if not isinstance(content, str):
        raise ProjectError("contenu HTML rich invalide")
    children = node.get("components", [])
    if not isinstance(children, list):
        raise ProjectError("structure HTML rich invalide")
    inner = escape(content, quote=False) + "".join(_render_rich_node(child) for child in children)
    if tag in _VOID_TAGS:
        return f"<{tag}{''.join(rendered_attrs)}>"
    return f"<{tag}{''.join(rendered_attrs)}>{inner}</{tag}>"


def _rich_value(node: Mapping[str, Any]) -> str:
    content = node.get("content", "")
    if not isinstance(content, str):
        raise ProjectError("contenu HTML rich invalide")
    children = node.get("components", [])
    if not isinstance(children, list):
        raise ProjectError("structure HTML rich invalide")
    return escape(content, quote=False) + "".join(_render_rich_node(child) for child in children)


def _get_field_value(fields: Mapping[str, Mapping[str, Any]], name: str, default: Any = "") -> Any:
    node = fields.get(name)
    if node is None:
        return default
    return _plain_text(node)


def _section_data(component: Mapping[str, Any], section_type: str) -> dict[str, Any]:
    block = DEFAULT_BLOCKS[section_type]
    data = default_data(block)
    attrs = component.get("attributes") or {}
    raw_data = attrs.get("data-sjd-data") if isinstance(attrs, Mapping) else None
    if raw_data is not None:
        if not isinstance(raw_data, str):
            raise ProjectError("données de section invalides")
        try:
            saved = json.loads(raw_data)
        except (TypeError, ValueError) as exc:
            raise ProjectError("données de section invalides") from exc
        if not isinstance(saved, dict):
            raise ProjectError("données de section invalides")
        if any(key.startswith("_") and key != "_variant" for key in saved):
            raise ProjectError("champ interne de section non autorisé")
        data.update(saved)
        return _sanitize_typed_data(block, data)
    if section_type not in {"chapter", "image-pleine-largeur", "citation"}:
        raise ProjectError("données de section absentes")
    fields = _fields(component, section_type)
    if section_type == "chapter":
        for name in ("kicker", "title"):
            data[name] = _get_field_value(fields, name, data.get(name, ""))
        body = fields.get("body")
        if body is not None:
            data["body"] = _rich_value(body)
        list_node = fields.get("list")
        if list_node is not None:
            items = list_node.get("components", [])
            if not isinstance(items, list):
                raise ProjectError("liste de chapitre invalide")
            lines: list[str] = []
            for item in items:
                if isinstance(item, Mapping) and str(item.get("tagName") or "").lower() == "li":
                    lines.append(_plain_text(item))
                elif isinstance(item, Mapping) and item.get("type") == "textnode" and str(item.get("content") or "").strip():
                    raise ProjectError("élément de liste invalide")
            data["list"] = "\n".join(lines)
        attrs = component.get("attributes") or {}
        dark = str(attrs.get("data-sjd-dark", "0")) if isinstance(attrs, Mapping) else "0"
        if dark not in {"0", "1"}:
            raise ProjectError("variante de fond invalide")
        data["dark"] = dark == "1"
    elif section_type == "image-pleine-largeur":
        image = fields.get("src")
        if image is not None:
            attrs = image.get("attributes") or {}
            src = attrs.get("src", "") if isinstance(attrs, Mapping) else ""
            alt = attrs.get("alt", "") if isinstance(attrs, Mapping) else ""
            if not _safe_media_path(src):
                raise ProjectError("image hors des médias locaux autorisés")
            if not isinstance(alt, str):
                raise ProjectError("texte alternatif d’image invalide")
            data["src"] = src
            data["alt"] = alt
        data["caption"] = _get_field_value(fields, "caption", "")
    else:
        for name in ("quote", "author", "role"):
            data[name] = _get_field_value(fields, name, data.get(name, ""))
    errors = validate_data(block, data)
    if errors:
        first = errors[0]
        raise ProjectError(f"validation {section_type}.{first.field}: {first.rule}")
    return data


def project_to_sections(project: Any) -> list[dict[str, Any]]:
    """Valide et convertit un project JSON GrapesJS en sections typées Jinja."""
    if not isinstance(project, Mapping):
        raise ProjectError("projet invalide")
    if project.get("schema_version") != PROJECT_SCHEMA_VERSION:
        raise ProjectError("version de schéma projet non prise en charge")
    if project.get("theme_id") != THEME_ID or project.get("theme_version") != THEME_VERSION:
        raise ProjectError("version de thème non prise en charge")
    project_data = project.get("project_data")
    if not isinstance(project_data, Mapping):
        raise ProjectError("project_data invalide")
    styles = project_data.get("styles", [])
    if styles not in (None, []):
        raise ProjectError("style libre interdit")
    pages = project_data.get("pages")
    if not isinstance(pages, list) or len(pages) != 1:
        raise ProjectError("le pilote accepte une seule page")
    frames = pages[0].get("frames") if isinstance(pages[0], Mapping) else None
    if not isinstance(frames, list) or len(frames) != 1 or not isinstance(frames[0], Mapping):
        raise ProjectError("frame de page invalide")
    wrapper = frames[0].get("component")
    if not isinstance(wrapper, Mapping) or wrapper.get("type") != "wrapper":
        raise ProjectError("wrapper GrapesJS invalide")
    children = wrapper.get("components")
    if not isinstance(children, list):
        raise ProjectError("sections projet invalides")
    for _ in _walk(wrapper):
        pass

    sections: list[dict[str, Any]] = []
    identifiers: set[int] = set()
    for position, component in enumerate(children):
        if not isinstance(component, Mapping):
            raise ProjectError("composant de section invalide")
        section_type = COMPONENT_SECTIONS.get(str(component.get("type") or ""))
        if section_type is None:
            raise ProjectError(f"composant GrapesJS non autorisé : {component.get('type')}")
        attrs = component.get("attributes")
        if not isinstance(attrs, Mapping) or attrs.get("data-sjd-section") != section_type:
            raise ProjectError("identifiant de composant de thème incohérent")
        identifier_raw = attrs.get("data-sjd-section-id")
        identifier: int | None = None
        if identifier_raw not in (None, ""):
            try:
                identifier = int(identifier_raw)
            except (TypeError, ValueError) as exc:
                raise ProjectError("identifiant de section invalide") from exc
            if identifier <= 0 or identifier in identifiers:
                raise ProjectError("identifiant de section invalide ou dupliqué")
            identifiers.add(identifier)
        visible_raw = str(attrs.get("data-sjd-visible", "1"))
        if visible_raw not in {"0", "1"}:
            raise ProjectError("visibilité de section invalide")
        variant = str(attrs.get("data-sjd-variant") or "")
        block = DEFAULT_BLOCKS[section_type]
        if block.variants and variant not in block.variants:
            raise ProjectError(f"variante invalide : {variant}")
        data = _section_data(component, section_type)
        if block.variants:
            data["_variant"] = variant
        sections.append(
            {
                "id": identifier,
                "type": section_type,
                "variant": variant,
                "visible": visible_raw == "1",
                "position": position,
                "data": data,
            }
        )
    return sections


def migrate_project(project: Mapping[str, Any]) -> dict[str, Any]:
    """Valide puis migre sans mutation un projet thème v1 vers la version active."""
    if not isinstance(project, Mapping):
        raise ProjectError("projet invalide")
    version = project.get("theme_version")
    if version not in {1, 2, THEME_VERSION}:
        raise ProjectError("version de thème non prise en charge")
    candidate = copy.deepcopy(dict(project))
    candidate["theme_version"] = THEME_VERSION
    # Valider l'intégralité du contenu avant de retourner la copie migrée.
    project_to_sections(candidate)
    return candidate


__all__ = ["ProjectError", "migrate_project", "project_to_sections", "sections_to_project"]
