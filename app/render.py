"""Rendu des pages : environnement Jinja2, nettoyage HTML, cache par révision."""

from __future__ import annotations

import hashlib
import html as html_module
import json
import re
import sqlite3
import threading
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable

from jinja2 import Environment, FileSystemLoader, select_autoescape

from . import db as db_module
from . import sections as sections_module
from . import settings as settings_module

TEMPLATES_DIR = Path(__file__).resolve().parents[1] / "theme" / "templates"

ALLOWED_TAGS = {
    "p", "br", "strong", "em", "b", "i", "u", "small", "sup", "sub", "mark",
    "a", "ul", "ol", "li", "h2", "h3", "h4", "blockquote", "span", "cite",
}
ALLOWED_ATTRS = {"a": {"href", "title", "target", "rel", "aria-label"}}
VOID_TAGS = {"br", "hr", "img"}
DROPPED_CONTENT_TAGS = {"script", "style", "iframe", "object", "embed", "template", "noscript"}

SVG_TAGS = {
    "svg", "g", "path", "circle", "rect", "line", "polyline", "polygon", "ellipse",
    "text", "tspan", "textpath", "defs", "lineargradient", "radialgradient", "stop",
    "use", "symbol", "filter", "feturbulence", "fecolormatrix", "fegaussianblur",
    "clippath", "mask", "pattern", "marker", "desc", "title",
}
SVG_ATTRS = {
    "viewbox", "xmlns", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
    "opacity", "fill-opacity", "stroke-opacity", "transform", "d", "cx", "cy", "r", "rx", "ry",
    "x", "y", "x1", "y1", "x2", "y2", "width", "height", "offset", "stop-color", "stop-opacity",
    "font-family", "font-size", "font-weight", "letter-spacing", "text-anchor", "points", "id",
    "href", "aria-label", "role", "aria-hidden", "preserveaspectratio", "gradientunits",
    "filter", "result", "basefrequency", "numoctaves", "stitchtiles", "in", "stddeviation",
    "values", "type", "class", "focusable",
}

_cache: dict[str, tuple[str, str]] = {}
_cache_lock = threading.Lock()


class _Sanitizer(HTMLParser):
    """Reconstruit un fragment HTML en ne gardant que les balises autorisées."""

    def __init__(self, allowed_tags: set[str] | None = None, allowed_attrs: dict | None = None) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.allowed_tags = allowed_tags if allowed_tags is not None else ALLOWED_TAGS
        self.allowed_attrs = allowed_attrs if allowed_attrs is not None else ALLOWED_ATTRS
        self._dropped: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in DROPPED_CONTENT_TAGS:
            self._dropped.append(tag)
            return
        if self._dropped or tag not in self.allowed_tags:
            return
        allowed = self.allowed_attrs.get(tag, set())
        rendered = []
        for name, value in attrs:
            if name not in allowed or value is None:
                continue
            if name == "href" and re.match(r"^\s*(javascript|data):", value, re.I):
                continue
            rendered.append(f'{name}="{html_module.escape(value, quote=True)}"')
        suffix = (" " + " ".join(rendered)) if rendered else ""
        self.parts.append(f"<{tag}{suffix}>")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if self._dropped or tag not in self.allowed_tags:
            return
        if tag in VOID_TAGS:
            self.parts.append(f"<{tag}>")
        else:
            self.parts.append(f"<{tag}></{tag}>")

    def handle_endtag(self, tag: str) -> None:
        if self._dropped:
            if tag == self._dropped[-1]:
                self._dropped.pop()
            return
        if tag in self.allowed_tags and tag not in VOID_TAGS:
            self.parts.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        if self._dropped:
            return
        self.parts.append(html_module.escape(data, quote=False))

    def result(self) -> str:
        return "".join(self.parts)


def sanitize_html(raw: Any) -> str:
    if raw is None:
        return ""
    text = str(raw)
    if "<" not in text:
        return html_module.escape(text, quote=False)
    parser = _Sanitizer()
    parser.feed(text)
    parser.close()
    return parser.result()


def sanitize_svg(raw: Any) -> str:
    """Nettoyage dédié aux bannières SVG fournies par le studio (pas du HTML utilisateur)."""
    if raw is None:
        return ""
    text = str(raw).strip()
    if not text:
        return ""
    parser = _Sanitizer(allowed_tags=SVG_TAGS, allowed_attrs={tag: SVG_ATTRS for tag in SVG_TAGS})
    parser.feed(text)
    parser.close()
    return parser.result()


def text_to_html(raw: Any) -> str:
    """Convertit un texte brut (paragraphes séparés par une ligne vide) en HTML."""
    if raw is None:
        return ""
    text = str(raw).strip()
    if not text:
        return ""
    if "<" in text and re.search(r"</?[a-z]", text, re.I):
        return sanitize_html(text)
    blocks = [b.strip() for b in re.split(r"\n\s*\n", text) if b.strip()]
    return "".join(f"<p>{html_module.escape(b, quote=False)}</p>" for b in blocks)


def inline_html(raw: Any) -> str:
    """Texte destiné à un titre ou un libellé : nettoyé, sans paragraphe englobant.

    `text_to_html` enveloppe chaque bloc dans un `<p>` ; placé dans un `<h1>`…`<h6>`
    ce paragraphe produit un HTML invalide (titre dans un titre). On garde le nettoyage
    des balises autorisées, sans le bloc.
    """
    if raw is None:
        return ""
    text = str(raw).strip()
    if not text:
        return ""
    return sanitize_html(text)


def build_env(templates_dir: Path | None = None) -> Environment:
    env = Environment(
        loader=FileSystemLoader(str(templates_dir or TEMPLATES_DIR)),
        autoescape=select_autoescape(["html", "xml"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.filters["safe_html"] = lambda value: sanitize_html(value) if _has_markup(value) else html_module.escape(str(value or ""), quote=False)
    env.filters["rich"] = lambda value: _mark_safe(text_to_html(value))
    env.filters["inline"] = lambda value: _mark_safe(inline_html(value))
    env.filters["svg"] = lambda value: _mark_safe(sanitize_svg(value))
    env.filters["json_array"] = lambda value: _as_list(value)
    return env


def _has_markup(value: Any) -> bool:
    return bool(re.search(r"</?[a-z]", str(value or ""), re.I))


def _mark_safe(value: str):
    from markupsafe import Markup

    return Markup(value)


def _as_list(value: Any) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        if text.startswith("["):
            try:
                parsed = json.loads(text)
                return parsed if isinstance(parsed, list) else []
            except json.JSONDecodeError:
                return [text]
    return [value]


def json_load(value: Any, default: Any = None) -> Any:
    if value in (None, ""):
        return {} if default is None else default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return {} if default is None else default


def section_context(section: sqlite3.Row | dict) -> dict:
    """Normalise une section (row SQLite ou dict) pour les gabarits."""
    data = json_load(_get(section, "data", "{}"), {})
    if not isinstance(data, dict):
        data = {}
    variant = data.get("_variant") or _get(section, "variant", "") or ""
    return {
        "id": _get(section, "id", 0),
        "type": _get(section, "type", ""),
        "variant": variant,
        "label": _get(section, "label", ""),
        "visible": bool(_get(section, "visible", 1)),
        "data": data,
        "position": _get(section, "position", 0),
    }


def _get(obj: Any, key: str, default: Any = "") -> Any:
    if isinstance(obj, dict):
        return obj.get(key, default)
    try:
        value = obj[key]
    except (KeyError, IndexError, TypeError):
        return default
    return default if value is None else value


def section_html(env: Environment, section: sqlite3.Row | dict, ctx: dict | None = None) -> str:
    """Rend une section dans son gabarit dédié."""
    normalized = section_context(section)
    template_name = sections_module.template_for(normalized["type"])
    if not template_name:
        return "<!-- section inconnue -->" if ctx and ctx.get("debug") else ""
    try:
        template = env.get_template(template_name)
    except Exception:  # gabarit absent : on n'empêche pas la page de s'afficher
        return ""
    return template.render(s=normalized, **{k: v for k, v in (ctx or {}).items() if k != "s"})


def _heading_sequence(html_text: str) -> list[int]:
    return [int(level) for level in re.findall(r"<h([1-6])[\s>]", html_text)]


def render_page(
    env: Environment,
    *,
    page: sqlite3.Row | dict,
    sections: Iterable[sqlite3.Row | dict],
    ctx: dict,
    template: str = "pages/page.html",
    use_cache: bool = True,
) -> str:
    """Rend une page complète, avec cache invalidé par la révision de contenu."""
    slug = _get(page, "slug", "?")
    revision = str(ctx.get("revision", "0"))
    normalized = [
        section_context(section)
        for section in sections
        if bool(_get(section, "visible", 1))
    ]
    fingerprint = hashlib.sha1(
        json.dumps(normalized, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8")
    ).hexdigest()[:16]
    cache_key = f"{template}:{slug}:{revision}:{fingerprint}"
    if use_cache:
        with _cache_lock:
            cached = _cache.get(cache_key)
        if cached and cached[0] == revision:
            return cached[1]

    section_ctx = dict(ctx)
    section_ctx["page"] = page
    rendered_sections = [section_html(env, section, section_ctx) for section in normalized]
    body = "\n".join(part for part in rendered_sections if part)
    html_out = env.get_template(template).render(
        page=page,
        sections_html=body,
        **{k: v for k, v in ctx.items() if k != "page"},
    )
    if use_cache:
        with _cache_lock:
            if len(_cache) > 200:
                _cache.clear()
            _cache[cache_key] = (revision, html_out)
    return html_out


def invalidate() -> None:
    with _cache_lock:
        _cache.clear()


def render_string(env: Environment, template_name: str, **context: Any) -> str:
    return env.get_template(template_name).render(**context)


def heading_levels(html_text: str) -> list[int]:
    return _heading_sequence(html_text)


def content_revision(conn: sqlite3.Connection) -> str:
    return db_module.content_revision(conn)


def site_settings(conn: sqlite3.Connection) -> dict[str, str]:
    return settings_module.all_settings(conn)
