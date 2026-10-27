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
from urllib.parse import unquote, urlsplit

from jinja2 import ChoiceLoader, Environment, FileSystemLoader, select_autoescape

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
_SECTION_BACKGROUND_MODES = {"paper", "obsidian", "accent", "gradient", "hero-gradient", "custom"}
_COLOR_HEX = re.compile(r"#[0-9a-fA-F]{6}\Z")
_ROOT_OPEN_TAG = re.compile(r"<(?P<tag>[A-Za-z][A-Za-z0-9:_-]*)(?P<attrs>[^<>]*)>")
_CLASS_ATTRIBUTE = re.compile(r"(?P<prefix>\sclass\s*=\s*)(?P<quote>[\"'])(?P<value>.*?)(?P=quote)", re.IGNORECASE)
_STYLE_ATTRIBUTE = re.compile(r"(?P<prefix>\sstyle\s*=\s*)(?P<quote>[\"'])(?P<value>.*?)(?P=quote)", re.IGNORECASE)


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
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS:
            self.handle_endtag(tag)

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


def safe_href(raw: Any) -> str:
    """Lien utilisable dans une composition, limité aux schémas sûrs."""
    value = str(raw or "").strip()
    if not value:
        return ""
    if chr(92) in value:
        return ""
    try:
        parsed = urlsplit(value)
    except ValueError:
        return ""
    if parsed.scheme:
        return value if parsed.scheme.lower() in {"http", "https", "mailto"} else ""
    if parsed.netloc or value.startswith("//"):
        return ""
    return value


def safe_media_path(raw: Any) -> str:
    """Chemin d'image local uniquement, sans traversée de répertoire."""
    value = str(raw or "").strip()
    if not value:
        return ""
    try:
        parsed = urlsplit(value)
    except ValueError:
        return ""
    if parsed.scheme or parsed.netloc or chr(92) in value or value.startswith("//"):
        return ""
    path = parsed.path
    decoded_path = unquote(path)
    if chr(92) in decoded_path or any(part in {".", ".."} for part in decoded_path.split("/")):
        return ""
    if not decoded_path.startswith(("/assets/", "/medias/", "assets/", "medias/")):
        return ""
    return "/" + path.lstrip("/")


def build_env(templates_dir: Path | None = None) -> Environment:
    """Environnement Jinja du site.

    Le dossier de gabarits du paquet éditeur est ajouté après celui du site :
    `editor/head.html` et `editor/bootstrap.html` viennent du paquet, les
    gabarits de blocs restent ceux du site (le site garde la main sur son design).
    """
    from sujee_editor import EDITOR_TEMPLATES

    loaders: list[Any] = [FileSystemLoader(str(templates_dir or TEMPLATES_DIR))]
    extra = Path(EDITOR_TEMPLATES)
    if templates_dir is None and extra.is_dir():
        loaders.append(FileSystemLoader(str(extra)))
    env = Environment(
        loader=ChoiceLoader(loaders),
        autoescape=select_autoescape(["html", "xml"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.filters["safe_html"] = lambda value: sanitize_html(value) if _has_markup(value) else html_module.escape(str(value or ""), quote=False)
    env.filters["rich"] = lambda value: _mark_safe(text_to_html(value))
    env.filters["inline"] = lambda value: _mark_safe(inline_html(value))
    env.filters["svg"] = lambda value: _mark_safe(sanitize_svg(value))
    env.filters["json_array"] = lambda value: _as_list(value)
    env.filters["safe_href"] = safe_href
    env.filters["safe_media"] = safe_media_path
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


def section_context(section: sqlite3.Row | dict, *, edit: bool = False) -> dict:
    """Normalise une section (row SQLite ou dict) pour les gabarits.

    En mode édition, le brouillon remplace les données publiées ; les données
    publiées restent intactes et ne sont jamais rendues à un visiteur.
    """
    data = json_load(_get(section, "data", "{}"), {})
    if not isinstance(data, dict):
        data = {}
    if edit:
        draft = _get(section, "draft", None)
        if draft not in (None, ""):
            parsed = json_load(draft, {})
            if isinstance(parsed, dict) and parsed:
                data = parsed
    variant = data.get("_variant") or _get(section, "variant", "") or ""
    return {
        "id": _get(section, "id", 0),
        "type": _get(section, "type", ""),
        "variant": variant,
        "label": _get(section, "label", ""),
        "visible": bool(_get(section, "visible", 1)),
        "data": data,
        "position": _get(section, "position", 0),
        "version": _get(section, "draft_version", 0),
        "revised": _get(section, "draft", None) not in (None, ""),
    }


def envelope_html(section: dict) -> str:
    """Ouverture de l'enveloppe d'un bloc (fermée par `section_html`)."""
    label = html_module.escape(str(section.get("label") or ""), quote=True)
    type_ = html_module.escape(str(section.get("type") or ""), quote=True)
    return (
        f'<div class="sjd-block" data-block-id="{int(section.get("id") or 0)}"'
        f' data-block-type="{type_}" data-block-label="{label}"'
        f' data-block-position="{int(section.get("position") or 0)}"'
        f' data-block-visible="{1 if section.get("visible") else 0}"'
        f' data-block-revised="{1 if section.get("revised") else 0}">'
    )


def _contrast_foreground(color: str) -> str:
    """Choisit entre noir et blanc selon le contraste WCAG du fond hexadécimal."""
    channels = [int(color[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4 for channel in channels]
    luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
    black_contrast = (luminance + 0.05) / 0.05
    white_contrast = 1.05 / (luminance + 0.05)
    return "#000000" if black_contrast >= white_contrast else "#ffffff"


class _DirectChildClassParser(HTMLParser):
    """Collecte uniquement les classes des enfants directs du premier élément."""

    _VOID_TAGS = {
        "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root_seen = False
        self.stack: list[str] = []
        self.classes: set[str] = set()

    def _collect(self, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name.lower() == "class" and value:
                self.classes.update(value.split())

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if not self.root_seen:
            self.root_seen = True
            self.stack.append(tag.lower())
            return
        if len(self.stack) == 1:
            self._collect(attrs)
        if tag.lower() not in self._VOID_TAGS:
            self.stack.append(tag.lower())

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if not self.root_seen:
            self.root_seen = True
            self.stack.append(tag.lower())
        elif len(self.stack) == 1:
            self._collect(attrs)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index] == tag:
                del self.stack[index:]
                return


def _ensure_home_hero_layers(rendered: str) -> str:
    """Ajoute les couches réutilisables du hero d’accueil sans doublonner le gabarit."""
    root = _ROOT_OPEN_TAG.search(rendered)
    if not root:
        return rendered
    root_attrs = root.group("attrs")
    class_match = _CLASS_ATTRIBUTE.search(root_attrs)
    root_classes = set(class_match.group("value").split()) if class_match else set()
    parser = _DirectChildClassParser()
    parser.feed(rendered)
    parser.close()
    present_classes = parser.classes
    layers = (
        ("hero-bg", '<div class="hero-bg" aria-hidden="true"></div>'),
        ("hero-shader", '<canvas class="hero-shader" aria-hidden="true"></canvas>'),
        ("hero-grain", '<div class="hero-grain" aria-hidden="true"></div>'),
    )
    additions = [markup for class_name, markup in layers if class_name not in present_classes]
    if not root_classes & {"hero", "v2-hero"} and "sjd-home-hero-veil" not in present_classes:
        additions.append('<div class="sjd-home-hero-veil" aria-hidden="true"></div>')
    if not additions:
        return rendered
    return _ROOT_OPEN_TAG.sub(lambda match: match.group(0) + "".join(additions), rendered, count=1)


def _apply_section_background(rendered: str, section_type: str, data: dict) -> str:
    """Applique une variante contrôlée au premier élément racine du gabarit.

    Le projet ne fournit jamais de CSS : seules des classes prédéfinies et une
    couleur hexadécimale strictement validée peuvent être émises ici.
    """
    if section_type == "zone-libre":
        mode = data.get("background", "none")
        if mode in {"none", "image"}:
            return rendered
    else:
        mode = data.get("section_background", "default")
    if mode not in _SECTION_BACKGROUND_MODES:
        return rendered

    style_declaration = ""
    if mode == "custom":
        color = data.get("section_background_color", "")
        if not isinstance(color, str) or not _COLOR_HEX.fullmatch(color):
            return rendered
        style_declaration = (
            f"--sjd-section-background:{color.lower()};"
            f"--sjd-section-foreground:{_contrast_foreground(color)}"
        )

    class_name = f"sjd-section-background--{mode}"

    def decorate(match: re.Match[str]) -> str:
        tag = match.group("tag")
        attrs = match.group("attrs")
        class_match = _CLASS_ATTRIBUTE.search(attrs)
        if class_match:
            classes = class_match.group("value").split()
            if class_name not in classes:
                classes.append(class_name)
            replacement = (
                f"{class_match.group('prefix')}{class_match.group('quote')}"
                f"{html_module.escape(' '.join(classes), quote=True)}{class_match.group('quote')}"
            )
            attrs = attrs[:class_match.start()] + replacement + attrs[class_match.end():]
        else:
            attrs += f' class="{class_name}"'

        if style_declaration:
            style_match = _STYLE_ATTRIBUTE.search(attrs)
            if style_match:
                existing = style_match.group("value").rstrip("; ")
                value = f"{existing};{style_declaration}" if existing else style_declaration
                replacement = (
                    f"{style_match.group('prefix')}{style_match.group('quote')}"
                    f"{html_module.escape(value, quote=True)}{style_match.group('quote')}"
                )
                attrs = attrs[:style_match.start()] + replacement + attrs[style_match.end():]
            else:
                attrs += f' style="{html_module.escape(style_declaration, quote=True)}"'
        return f"<{tag}{attrs}>"

    rendered = _ROOT_OPEN_TAG.sub(decorate, rendered, count=1)
    if mode == "hero-gradient":
        rendered = _ensure_home_hero_layers(rendered)
    return rendered


def _apply_section_spacing(rendered: str, data: dict) -> str:
    """Applique uniquement les valeurs numériques de marges prévues au schéma."""
    declarations = []
    for property_name in ("padding", "margin"):
        for side in ("top", "right", "bottom", "left"):
            value = data.get(f"{property_name}_{side}")
            if isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= 240:
                declarations.append(f"{property_name}-{side}:{value}px")
    if not declarations:
        return rendered
    spacing = ";".join(declarations)

    def decorate(match: re.Match[str]) -> str:
        attrs = match.group("attrs")
        style_match = _STYLE_ATTRIBUTE.search(attrs)
        if style_match:
            existing = style_match.group("value").rstrip("; ")
            value = f"{existing};{spacing}" if existing else spacing
            replacement = (
                f"{style_match.group('prefix')}{style_match.group('quote')}"
                f"{html_module.escape(value, quote=True)}{style_match.group('quote')}"
            )
            attrs = attrs[:style_match.start()] + replacement + attrs[style_match.end():]
        else:
            attrs += f' style="{html_module.escape(spacing, quote=True)}"'
        return f"<{match.group('tag')}{attrs}>"

    return _ROOT_OPEN_TAG.sub(decorate, rendered, count=1)


def _get(obj: Any, key: str, default: Any = "") -> Any:
    if isinstance(obj, dict):
        return obj.get(key, default)
    try:
        value = obj[key]
    except (KeyError, IndexError, TypeError):
        return default
    return default if value is None else value


def section_html(env: Environment, section: sqlite3.Row | dict, ctx: dict | None = None, *, envelopes: bool = True) -> str:
    """Rend une section dans son gabarit dédié, enveloppée pour l'éditeur."""
    context = ctx or {}
    normalized = section_context(section, edit=bool(context.get("edit")))
    template_name = sections_module.template_for(normalized["type"])
    if not template_name:
        return "<!-- section inconnue -->" if context.get("debug") else ""
    try:
        template = env.get_template(template_name)
    except Exception:  # gabarit absent : on n'empêche pas la page de s'afficher
        return ""
    rendered = template.render(s=normalized, **{k: v for k, v in context.items() if k != "s"})
    rendered = _apply_section_background(rendered, normalized["type"], normalized["data"])
    rendered = _apply_section_spacing(rendered, normalized["data"])
    if not envelopes:
        return rendered
    return envelope_html(normalized) + rendered + "</div>"


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
    envelopes: bool = True,
) -> str:
    """Rend une page complète, avec cache invalidé par la révision de contenu.

    Le mode édition ne passe jamais par le cache : le brouillon doit être frais.
    """
    edit = bool(ctx.get("edit"))
    slug = _get(page, "slug", "?")
    revision = str(ctx.get("revision", "0"))
    # En mode édition, les blocs masqués sont rendus eux aussi (grisés par la
    # feuille de l'éditeur) : sinon un bloc nouvellement ajouté, qui naît masqué,
    # serait introuvable dans le canevas. Le rendu public, lui, les exclut.
    normalized = [
        section_context(section, edit=edit)
        for section in sections
        if edit or bool(_get(section, "visible", 1))
    ]
    fingerprint = hashlib.sha1(
        json.dumps(normalized, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8")
    ).hexdigest()[:16]
    # La coque de l'éditeur (« Modifier cette page », feuille de l'éditeur)
    # dépend de la session : elle fait partie de la clé de cache, sinon la page
    # mise en cache pour un admin connecté est servie au visiteur suivant, et
    # inversement.
    cache_key = (
        f"{template}:{slug}:{revision}:{fingerprint}:{int(envelopes)}:"
        f"{int(bool(ctx.get('editor_enabled')))}"
    )
    use_cache = use_cache and not edit
    if use_cache:
        with _cache_lock:
            cached = _cache.get(cache_key)
        if cached and cached[0] == revision:
            return cached[1]

    section_ctx = dict(ctx)
    section_ctx["page"] = page
    rendered_sections = [section_html(env, section, section_ctx, envelopes=envelopes) for section in normalized]
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
