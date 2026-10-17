#!/usr/bin/env python3
"""Migration du contenu du site statique legacy vers le nouveau format de seed.

Source  : /opt/data/atelier/deploy/*.html  (12 pages statiques, lecture seule)
Cible   : /opt/data/sujeedesign-site/seed/content.json  (format attendu par app/seed.py)

Le script est *déterministe* et *idempotent* : il relit les pages legacy à chaque
exécution et réécrit intégralement ``seed/content.json``. Aucune écriture n'est
faite dans /opt/data/atelier.

Principes
---------
* Le texte éditorial est repris **intégralement** (priorité absolue) : aucun texte
  n'est réformulé, résumé ou inventé. Les seules chaînes nouvelles sont les
  libellés/titres minimaux des 3 pages créées (réalisations, services, 404),
  explicitement demandées par le brief.
* Chaque page legacy (``<section class="…">``) est convertie vers le type de
  section le plus proche décrit par le brief.
* Les liens internes historiques (``contact.html``, ``projet-vaasam.html``…,
  ``assets/…``) sont réécrits vers les URL propres du nouveau site. Les
  ``redirections`` 301 restent déclarées en filet de sécurité.

Note sur la page « À propos » (écart documenté)
-----------------------------------------------
Le brief décrit les pages « contact et apropos » comme « hero variante simple +
texte-riche ». Contact suit cette consigne telle quelle. ``apropos.html`` est en
revanche structurellement identique aux pages service (``p-hero`` / ``p-banner`` /
``s-chap`` / ``gallery`` / ``p-final``) et porte sur son ``p-hero`` un ``p-meta``
de 5 valeurs (« Direction artistique », « Formation UI/UX », « Print & digital »,
« Depuis 2011 », « Paris »). Comme la conservation intégrale du texte est la
priorité absolue, la bande d'ouverture d'« À propos » utilise la variante
``page`` (qui rend kicker + méta + titre + intro — c'est la règle ``p-hero`` du
brief) et le reste du contenu est converti selon les règles générales
(chapitre, bandeau défilant, grille de réalisations, texte-riche, CTA final).
"""

from __future__ import annotations

import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

# --------------------------------------------------------------------------- #
# Chemins
# --------------------------------------------------------------------------- #

REPO_ROOT = Path(__file__).resolve().parents[1]
LEGACY_DIR = Path("/opt/data/atelier/deploy")
OUTPUT = REPO_ROOT / "seed" / "content.json"

# --------------------------------------------------------------------------- #
# URL : legacy -> nouvelle arborescence
# --------------------------------------------------------------------------- #

PAGE_ROUTES: dict[str, str] = {
    "index.html": "/",
    "realisations.html": "/realisations",
    "services.html": "/services",
    "apropos.html": "/a-propos",
    "contact.html": "/contact",
    "identite.html": "/services/identite",
    "creation-visuelle.html": "/services/creation-visuelle",
    "web.html": "/services/web",
    "marketing.html": "/services/marketing",
    "ia.html": "/services/ia",
    "projet-vaasam.html": "/realisations/vaasam-paris",
    "projet-rfa.html": "/realisations/resto-franchise-africain",
    "projet-ia.html": "/realisations/solutions-ia-automations",
    "projet-formation.html": "/realisations/formation-ui-ux-pao",
}

REDIRECTIONS: list[dict[str, Any]] = [
    {"path": f"/{legacy}", "target": target, "code": 301}
    for legacy, target in PAGE_ROUTES.items()
]

REGLAGES: dict[str, str] = {
    "site_name": "Sujee Design",
    "tagline": "Votre marque, de A à Z",
    "base_url": "https://sujeedesign.com",
    "email": "s.sujeepan.pro@gmail.com",
    "linkedin": "https://www.linkedin.com/in/sujeepan-sabesan",
    "behance": "https://www.behance.net/SujeepanSabesan",
    "city": "Paris, France",
    "legal_name": "Sujee Design — Sujeepan Sabesan",
}


def route_href(href: str) -> str:
    """Réécrit un lien interne legacy vers l'URL propre du nouveau site."""
    if not href:
        return href
    value = href.strip()
    if value.startswith(("http://", "https://", "mailto:", "tel:", "#", "data:")):
        return value
    base, _, frag = value.partition("#")
    suffix = f"#{frag}" if frag else ""
    if base in PAGE_ROUTES:
        return PAGE_ROUTES[base] + suffix
    if base.startswith("assets/"):
        return "/" + base + suffix
    return value


# --------------------------------------------------------------------------- #
# Petits utilitaires HTML
# --------------------------------------------------------------------------- #

VOID_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
}
TAG_RE = re.compile(r"<(/?)([a-zA-Z][\w:-]*)((?:\s+[^<>]*?)?)(/?)>", re.S)
ATTR_RE = re.compile(r"([\w:.-]+)\s*=\s*\"([^\"]*)\"")


class _TopLevel(HTMLParser):
    """Capture les éléments de premier niveau d'un fragment (enfants de <main>)."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.depth = 0
        self.blocks: list[dict[str, Any]] = []
        self._cur: dict[str, Any] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        raw = self.get_starttag_text() or f"<{tag}>"
        if self._cur is None:
            if self.depth == 0 and tag in ("section", "header", "div"):
                self._cur = {"tag": tag, "attrs": dict(attrs), "html": [raw]}
                self.depth = 1
                return
            if tag not in VOID_TAGS:
                self.depth += 1
            return
        self._cur["html"].append(raw)
        if tag not in VOID_TAGS:
            self.depth += 1

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        raw = self.get_starttag_text() or f"<{tag}/>"
        if self._cur is not None:
            self._cur["html"].append(raw)

    def handle_endtag(self, tag: str) -> None:
        if tag in VOID_TAGS:
            return
        self.depth -= 1
        if self._cur is not None:
            self._cur["html"].append(f"</{tag}>")
            if self.depth == 0:
                self.blocks.append(
                    {"tag": self._cur["tag"], "attrs": self._cur["attrs"], "html": "".join(self._cur["html"])}
                )
                self._cur = None

    def handle_data(self, data: str) -> None:
        if self._cur is not None:
            self._cur["html"].append(data)

    def handle_entityref(self, name: str) -> None:
        if self._cur is not None:
            self._cur["html"].append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        if self._cur is not None:
            self._cur["html"].append(f"&#{name};")


def main_inner(text: str) -> str:
    match = re.search(r"<main\b[^>]*>(.*)</main>", text, re.S)
    return match.group(1) if match else text


def top_level_blocks(fragment: str) -> list[dict[str, Any]]:
    parser = _TopLevel()
    parser.feed(fragment)
    parser.close()
    return parser.blocks


def attrs_of(raw_tag: str) -> dict[str, str]:
    return {name: value for name, value in ATTR_RE.findall(raw_tag)}


def class_of(block: dict[str, Any]) -> str:
    return block["attrs"].get("class", "") or ""


def strip_tags(fragment: str) -> str:
    return re.sub(r"<[^>]*>", "", fragment)


def collapse(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\u00a0", " ")).strip()


def text_of(fragment: str) -> str:
    """Texte brut décodé d'un fragment HTML (entités résolues, tags retirés)."""
    return collapse(html.unescape(strip_tags(fragment)))


def clean_href(href: str) -> str:
    return html.unescape(href or "").strip()


# --------------------------------------------------------------------------- #
# Décodage des entités en conservant la structure des balises
# --------------------------------------------------------------------------- #

class _EntityDecoder(HTMLParser):
    """Décode les entités des nœuds texte tout en gardant les balises telles quelles."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.parts.append(self.get_starttag_text() or f"<{tag}>")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.parts.append(self.get_starttag_text() or f"<{tag}/>")

    def handle_endtag(self, tag: str) -> None:
        self.parts.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        # convert_charrefs=True : `data` arrive déjà décodée.
        self.parts.append(data)


def preserve(html_fragment: str) -> str:
    """Entités décodées, balises conservées (pour les champs HTML passés à |rich)."""
    parser = _EntityDecoder()
    parser.feed(html_fragment or "")
    parser.close()
    return "".join(parser.parts).strip()


# --------------------------------------------------------------------------- #
# Extraction d'éléments
# --------------------------------------------------------------------------- #

def find_element(fragment: str, tag: str, attr_needle: str | None = None) -> str | None:
    """Retourne le HTML *intérieur* du premier <tag …> correspondant."""
    tag_l = tag.lower()
    for match in TAG_RE.finditer(fragment):
        if match.group(1) == "/" or match.group(2).lower() != tag_l:
            continue
        if match.group(4) == "/":
            continue
        if attr_needle and attr_needle not in match.group(3):
            continue
        depth = 0
        for inner in TAG_RE.finditer(fragment, match.start()):
            if inner.group(2).lower() != tag_l:
                continue
            if inner.group(1) == "/":
                depth -= 1
            elif inner.group(4) == "/":
                depth += 0
            else:
                depth += 1
            if depth == 0:
                return fragment[match.end():inner.start()]
    return None


def find_outer_element(fragment: str, tag: str, attr_needle: str | None = None) -> str | None:
    tag_l = tag.lower()
    for match in TAG_RE.finditer(fragment):
        if match.group(1) == "/" or match.group(2).lower() != tag_l or match.group(4) == "/":
            continue
        if attr_needle and attr_needle not in match.group(3):
            continue
        depth = 0
        for inner in TAG_RE.finditer(fragment, match.start()):
            if inner.group(2).lower() != tag_l:
                continue
            if inner.group(1) == "/":
                depth -= 1
            elif inner.group(4) == "/":
                depth += 0
            else:
                depth += 1
            if depth == 0:
                return fragment[match.start():inner.end()]
    return None


def first_match(fragment: str, pattern: str) -> str | None:
    match = re.search(pattern, fragment, re.S)
    return match.group(1) if match else None


def anchors(fragment: str) -> list[dict[str, str]]:
    """Liste des <a> d'un fragment : {label, href, style}."""
    out: list[dict[str, str]] = []
    for match in re.finditer(r"<a\b([^>]*)>(.*?)</a>", fragment, re.S):
        raw_attrs, inner = match.group(1), match.group(2)
        attrs = attrs_of(raw_attrs)
        classes = attrs.get("class", "").split()
        if "pill--filled" in classes:
            style = "pill--filled"
        elif "text-link" in classes:
            style = "text-link"
        elif "pill" in classes:
            style = "pill"
        else:
            continue
        label_html = re.sub(r"<span[^>]*>.*?</span>", "", inner, flags=re.S)
        label = text_of(label_html)
        if not label:
            continue
        out.append({"label": label, "href": route_href(clean_href(attrs.get("href", "#"))), "style": style})
    return out


def heading_lines(fragment: str) -> list[str]:
    """Lignes d'un titre « reveal-line » (retourne du HTML décodé)."""
    lines: list[str] = []
    for match in re.finditer(r'<span class="reveal-line">\s*<span>(.*?)</span>\s*</span>', fragment, re.S):
        lines.append(preserve(match.group(1)))
    if not lines:
        # Repli : un simple <span> interne.
        inner = first_match(fragment, r"<[^>]+>(.*?)</[^>]+>")
        if inner and inner.strip():
            lines = [preserve(inner)]
    return [line for line in lines if line]


# --------------------------------------------------------------------------- #
# Builders de sections
# --------------------------------------------------------------------------- #

def hero_page(block_html: str) -> dict[str, Any]:
    meta_raw = find_element(block_html, "div", 'class="p-meta"') or ""
    meta = [text_of(item) for item in re.findall(r"<span>(.*?)</span>", meta_raw, re.S)]
    return {
        "type": "hero",
        "variant": "page",
        "data": {
            "kicker": text_of(first_match(block_html, r'<p class="p-kicker"[^>]*>(.*?)</p>') or ""),
            "title": preserve(first_match(block_html, r'<h1 class="p-title"[^>]*>(.*?)</h1>') or ""),
            "meta": [item for item in meta if item],
            "intro": text_of(first_match(block_html, r'<p class="p-intro"[^>]*>(.*?)</p>') or ""),
            "ctas": anchors(find_element(block_html, "div", "hero-ctas") or ""),
        },
    }


def hero_simple(block_html: str, *, kicker_attr: str = "page-label") -> dict[str, Any]:
    kicker = first_match(block_html, rf'<p class="{kicker_attr}[^"]*"[^>]*>(.*?)</p>')
    title = first_match(block_html, r'<h1 class="page-title[^"]*"[^>]*>(.*?)</h1>')
    intro = first_match(block_html, r'<p class="page-intro[^"]*"[^>]*>(.*?)</p>')
    return {
        "type": "hero",
        "variant": "simple",
        "data": {
            "kicker": text_of(kicker or ""),
            "title": preserve(title or ""),
            "intro": text_of(intro or ""),
            "ctas": anchors(block_html),
        },
    }


def hero_accueil(block_html: str, settings_source: str) -> dict[str, Any]:
    rotator = [
        text_of(item)
        for item in re.findall(r'<span class="ht-word[^"]*">(.*?)</span>', block_html, re.S)
    ]
    photo = first_match(block_html, r'class="hero-photo"[^>]*src="([^"]*)"') or first_match(
        block_html, r'src="([^"]*)"[^>]*class="hero-photo"'
    )
    photo_alt = first_match(block_html, r'class="hero-photo"[^>]*alt="([^"]*)"') or ""
    return {
        "type": "hero",
        "variant": "accueil",
        "data": {
            "rotator": [word for word in rotator if word],
            "ctas": anchors(find_element(block_html, "div", "hero-ctas") or ""),
            "photo": route_href(clean_href(photo or "")),
            "photo_alt": html.unescape(photo_alt),
            "shader": True,
        },
    }


def banniere(block_html: str) -> dict[str, Any]:
    inner = re.sub(r"^<section\b[^>]*>", "", block_html, flags=re.S)
    inner = re.sub(r"</section>\s*$", "", inner, flags=re.S)
    return {"type": "banniere", "data": {"svg": inner.strip()}}


def chapter(block_html: str, dark: bool = False) -> dict[str, Any]:
    body = find_element(block_html, "div", 'class="chap-body"') or ""
    list_raw = ""
    ul_match = re.search(r'<ul class="chap-list">(.*?)</ul>', body, re.S)
    if ul_match:
        list_raw = ul_match.group(1)
        body = body[: ul_match.start()] + body[ul_match.end():]
    items = [text_of(item) for item in re.findall(r"<li[^>]*>(.*?)</li>", list_raw, re.S)]
    return {
        "type": "chapter",
        "data": {
            "kicker": text_of(first_match(block_html, r'<span class="type">(.*?)</span>') or ""),
            "title": preserve(first_match(block_html, r'<h2 class="chap-title">(.*?)</h2>') or ""),
            "body": preserve(body),
            "list": [item for item in items if item],
            "dark": bool(dark),
        },
    }


def cta_final(block_html: str, variant: str) -> dict[str, Any]:
    data: dict[str, Any] = {
        "kicker": text_of(
            first_match(block_html, r'<p class="p-kicker[^"]*"[^>]*>(.*?)</p>')
            or first_match(block_html, r'<p class="[^"]*contact-label[^"]*"[^>]*>(.*?)</p>')
            or first_match(block_html, r'<p class="section-label[^"]*"[^>]*>(.*?)</p>')
            or ""
        ),
        "intro": text_of(first_match(block_html, r'<p class="p-intro[^"]*"[^>]*>(.*?)</p>') or ""),
        "ctas": anchors(block_html),
        "shader": True,
    }
    if variant == "accueil":
        lines_zone = find_element(block_html, "h2", "contact-heading") or ""
        data["title_lines"] = heading_lines(lines_zone) or heading_lines(block_html)
    else:
        data["title"] = preserve(first_match(block_html, r'<h2 class="p-title[^"]*"[^>]*>(.*?)</h2>') or "")
    return {"type": "cta-final", "variant": variant, "data": data}


def bloc_liens(block_html: str) -> dict[str, Any]:
    return {
        "type": "bloc-liens",
        "variant": "services",
        "data": {"label": text_of(first_match(block_html, r'<p class="related-label">(.*?)</p>') or "")},
    }


def realisations_grid_from_gallery(block_html: str) -> dict[str, Any]:
    label = text_of(first_match(block_html, r'<p class="gallery-label">(.*?)</p>') or "")
    return {"type": "realisations-grid", "variant": "auto", "data": {"label": label}}


def marquee_from_clients(block_html: str) -> dict[str, Any]:
    """Bandeau clients de « à propos » : libellé + noms -> bloc texte (le gabarit
    marquee ne porte pas de libellé, on préserve donc le texte dans un texte-riche)."""
    label = text_of(first_match(block_html, r'<p class="related-label">(.*?)</p>') or "")
    names: list[str] = []
    for match in re.findall(r'<span class="client-word">(.*?)</span>', block_html, re.S):
        value = text_of(match)
        if value and value not in names:
            names.append(value)
    body = f"<p>{html.escape(' · '.join(names))}</p>" if names else ""
    return {"type": "texte-riche", "variant": "1", "data": {"label": label, "title": "", "body": body}}


def marquee_from_home(block_html: str) -> dict[str, Any]:
    inner = find_element(block_html, "span", 'class="mq"') or ""
    raw = strip_tags(inner)
    parts = [collapse(html.unescape(part)) for part in raw.split("·")]
    items: list[str] = []
    for part in parts:
        if part and part not in items:
            items.append(part)
    return {"type": "marquee", "data": {"items": items}}


def texte_riche(label: str, title: str, body: str, variant: str = "1") -> dict[str, Any]:
    return {
        "type": "texte-riche",
        "variant": variant,
        "data": {"label": label, "title": title, "body": body},
    }


def beh_texte_riche(block_html: str) -> dict[str, Any]:
    label = text_of(first_match(block_html, r'<p class="related-label">(.*?)</p>') or "Sur Behance")
    body_inner = find_element(block_html, "div", 'class="chap-body"') or block_html
    paragraph = text_of(first_match(body_inner, r"<p[^>]*>(.*?)</p>") or "")
    tags = [text_of(item) for item in re.findall(r'<span class="beh-tag">(.*?)</span>', body_inner, re.S)]
    tags = [tag for tag in tags if tag]
    cards_html: list[str] = []
    for match in re.finditer(r'<a class="beh-card"([^>]*)>(.*?)</a>', body_inner, re.S):
        attrs = attrs_of(match.group(1))
        inner = match.group(2)
        href = clean_href(attrs.get("href", "#"))
        date = text_of(first_match(inner, r'<span class="beh-date">(.*?)</span>') or "")
        title = text_of(first_match(inner, r'<span class="beh-title">(.*?)</span>') or "")
        href_attr = html.escape(href, quote=True)
        cards_html.append(
            f'<li><a href="{href_attr}" target="_blank" rel="noopener">{html.escape(title)}</a>'
            + (f" — <small>{html.escape(date)}</small>" if date else "")
            + "</li>"
        )
    profile = None
    for match in re.finditer(r'<a class="text-link"([^>]*)>(.*?)</a>', body_inner, re.S):
        attrs = attrs_of(match.group(1))
        profile = (clean_href(attrs.get("href", "#")), text_of(match.group(2)))
    chunks: list[str] = []
    if paragraph:
        chunks.append(f"<p>{html.escape(paragraph)}</p>")
    if tags:
        chunks.append(f"<p>{html.escape(' · '.join(tags))}</p>")
    if cards_html:
        chunks.append("<ul>" + "".join(cards_html) + "</ul>")
    if profile and profile[1]:
        chunks.append(
            f'<p><a href="{html.escape(profile[0], quote=True)}" target="_blank" rel="noopener">'
            f"{html.escape(profile[1])}</a></p>"
        )
    return texte_riche(label, "", "".join(chunks))


def li_posts_texte_riche(block_html: str) -> dict[str, Any]:
    label = text_of(first_match(block_html, r'<p class="related-label">(.*?)</p>') or "Dernières actus · LinkedIn")
    cards_html: list[str] = []
    for match in re.finditer(r'<a class="li-card"([^>]*)>(.*?)</a>', block_html, re.S):
        attrs = attrs_of(match.group(1))
        inner = match.group(2)
        href = html.escape(clean_href(attrs.get("href", "#")), quote=True)
        date = text_of(first_match(inner, r'<span class="li-date">(.*?)</span>') or "")
        kind = text_of(first_match(inner, r'<span class="li-type">(.*?)</span>') or "")
        body = text_of(first_match(inner, r'<span class="li-text">(.*?)</span>') or "")
        link_label = text_of(first_match(inner, r'<span class="li-link">(.*?)</span>') or "")
        meta_bits = [bit for bit in (date, kind) if bit]
        tail = ""
        if meta_bits:
            tail += f" — <small>{html.escape(' · '.join(meta_bits))}</small>"
        if link_label:
            tail += f" <small>{html.escape(link_label)}</small>"
        cards_html.append(
            f'<li><a href="{href}" target="_blank" rel="noopener">{html.escape(body)}</a>{tail}</li>'
        )
    body = "<ul>" + "".join(cards_html) + "</ul>" if cards_html else ""
    return texte_riche(label, "", body)


def hero_projet(block_html: str) -> dict[str, Any]:
    cover = first_match(block_html, r'class="project-cover__media"[^>]*src="([^"]*)"')
    cover_alt = first_match(block_html, r'class="project-cover__media"[^>]*alt="([^"]*)"') or ""
    return {
        "type": "hero",
        "variant": "projet",
        "data": {
            "kicker": text_of(first_match(block_html, r'<p class="p-kicker">(.*?)</p>') or ""),
            "title": preserve(first_match(block_html, r'<h1 class="p-title"[^>]*>(.*?)</h1>') or ""),
            "intro": text_of(first_match(block_html, r'<p class="p-intro">(.*?)</p>') or ""),
            "cover": route_href(clean_href(cover or "")),
            "cover_alt": html.unescape(cover_alt),
        },
    }


def etude_de_cas(block_html: str) -> dict[str, Any]:
    container = find_element(block_html, "div", 'class="container"') or block_html
    blocks: list[dict[str, Any]] = []
    # Découpe sur les <h2> : chaque h2 ouvre un bloc avec son contenu.
    parts = re.split(r"<h2>(.*?)</h2>", container, flags=re.S)
    # parts = [avant, titre1, corps1, titre2, corps2, ...]
    index = 1
    while index + 1 < len(parts) + 1 and index < len(parts):
        title = text_of(parts[index])
        body = parts[index + 1] if index + 1 < len(parts) else ""
        meta_grid = find_element(body, "div", 'class="meta-grid"')
        list_check = find_element(body, "ul", 'class="list-check"')
        if meta_grid is not None and not strip_tags(body.replace(meta_grid, "")).strip():
            pairs: list[str] = []
            for item in re.finditer(r'<div class="meta-item">\s*<div class="k">(.*?)</div>\s*<div class="v">(.*?)</div>', body, re.S):
                pairs.append(f"{text_of(item.group(1))}|{text_of(item.group(2))}")
            blocks.append({"kind": "meta", "title": title, "meta": pairs})
        elif list_check is not None and not strip_tags(body.replace(list_check, "")).strip():
            items = [text_of(item) for item in re.findall(r"<li[^>]*>(.*?)</li>", list_check, re.S)]
            blocks.append({"kind": "liste", "title": title, "items": [item for item in items if item]})
        else:
            blocks.append({"kind": "texte", "title": title, "body": preserve(body)})
        index += 2
    return {"type": "etude-de-cas", "data": {"blocks": blocks}}


def formulaire_contact(block_html: str) -> dict[str, Any]:
    columns: list[dict[str, str]] = []
    for prose in re.finditer(r'<div class="prose">(.*?)</div>\s*(?=<div class="prose">|</div>|\Z)', block_html, re.S):
        inner = prose.group(1)
        chunks = re.split(r"<h2>(.*?)</h2>", inner, flags=re.S)
        index = 1
        while index < len(chunks):
            title = text_of(chunks[index])
            body = chunks[index + 1] if index + 1 < len(chunks) else ""
            columns.append({"title": title, "body": preserve(body)})
            index += 2
    return {
        "type": "formulaire-contact",
        "data": {"label": "", "title": "", "intro": "", "columns": columns},
    }


# --------------------------------------------------------------------------- #
# Décodage par page
# --------------------------------------------------------------------------- #

SERVICE_PAGES = {
    "identite.html": {"slug": "identite", "num": 1, "position": 1},
    "creation-visuelle.html": {"slug": "creation-visuelle", "num": 2, "position": 2},
    "web.html": {"slug": "web", "num": 3, "position": 3},
    "marketing.html": {"slug": "marketing", "num": 4, "position": 4},
    "ia.html": {"slug": "ia", "num": 5, "position": 5},
}

PROJECT_PAGES = {
    "projet-vaasam.html": {"slug": "vaasam-paris", "position": 1},
    "projet-rfa.html": {"slug": "resto-franchise-africain", "position": 2},
    "projet-ia.html": {"slug": "solutions-ia-automations", "position": 3},
    "projet-formation.html": {"slug": "formation-ui-ux-pao", "position": 4},
}


def read_page(name: str) -> str:
    return (LEGACY_DIR / name).read_text(encoding="utf-8")


def head_of(text: str) -> tuple[str, str]:
    title = collapse(html.unescape(first_match(text, r"<title>(.*?)</title>") or ""))
    desc = collapse(html.unescape(first_match(text, r'<meta name="description" content="(.*?)"') or ""))
    return title, desc


def sec(label: str, section: dict[str, Any]) -> dict[str, Any]:
    section = dict(section)
    section.setdefault("label", label)
    return section


def convert_services_page(name: str) -> list[dict[str, Any]]:
    blocks = top_level_blocks(main_inner(read_page(name)))
    sections: list[dict[str, Any]] = []
    for block in blocks:
        classes = class_of(block)
        if "p-hero" in classes:
            sections.append(sec("hero", hero_page(block["html"])))
        elif "p-banner" in classes:
            sections.append(sec("banniere", banniere(block["html"])))
        elif "s-chap" in classes:
            sections.append(sec("chapter", chapter(block["html"], "dark" in classes)))
        elif "gallery" in classes:
            sections.append(sec("realisations", realisations_grid_from_gallery(block["html"])))
        elif "p-final" in classes:
            sections.append(sec("cta", cta_final(block["html"], "interne")))
        elif "related" in classes:
            sections.append(sec("liens", bloc_liens(block["html"])))
    return sections


def convert_apropos() -> list[dict[str, Any]]:
    blocks = top_level_blocks(main_inner(read_page("apropos.html")))
    sections: list[dict[str, Any]] = []
    for block in blocks:
        classes = class_of(block)
        if "p-hero" in classes:
            sections.append(sec("hero", hero_page(block["html"])))
        elif "p-banner" in classes:
            sections.append(sec("banniere", banniere(block["html"])))
        elif "s-chap" in classes:
            sections.append(sec("chapter", chapter(block["html"], "dark" in classes)))
        elif "clients" in classes:
            sections.append(sec("clients", marquee_from_clients(block["html"])))
        elif "beh" in classes:
            sections.append(sec("behance", beh_texte_riche(block["html"])))
        elif "li-posts" in classes:
            sections.append(sec("linkedin", li_posts_texte_riche(block["html"])))
        elif "gallery" in classes:
            sections.append(sec("realisations", realisations_grid_from_gallery(block["html"])))
        elif "p-final" in classes:
            sections.append(sec("cta", cta_final(block["html"], "interne")))
    return sections


def convert_home() -> list[dict[str, Any]]:
    blocks = top_level_blocks(main_inner(read_page("index.html")))
    sections: list[dict[str, Any]] = []
    for block in blocks:
        classes = class_of(block)
        identifier = block["attrs"].get("id", "")
        if block["tag"] == "header" and "hero" in classes:
            sections.append(sec("hero", hero_accueil(block["html"], "")))
        elif "marquee" in classes:
            sections.append(sec("marquee", marquee_from_home(block["html"])))
        elif identifier == "manifeste":
            inner = block["html"]
            sections.append(
                sec(
                    "manifeste",
                    {
                        "type": "manifeste",
                        "data": {
                            "label": text_of(first_match(inner, r'<p class="section-label[^"]*"[^>]*>(.*?)</p>') or ""),
                            "heading_lines": heading_lines(find_element(inner, "h2", "manifeste-heading") or ""),
                            "text": text_of(first_match(inner, r'<p class="manifeste-text"[^>]*>(.*?)</p>') or ""),
                        },
                    },
                )
            )
        elif identifier == "travaux":
            inner = block["html"]
            sections.append(
                sec(
                    "realisations",
                    {
                        "type": "realisations-grid",
                        "variant": "auto",
                        "data": {
                            "label": text_of(first_match(inner, r'<p class="section-label[^"]*"[^>]*>(.*?)</p>') or ""),
                            "heading_lines": heading_lines(find_element(inner, "h2", "travaux-heading") or ""),
                        },
                    },
                )
            )
        elif identifier == "prestations":
            inner = block["html"]
            sections.append(
                sec(
                    "prestations",
                    {
                        "type": "services-list",
                        "variant": "auto",
                        "data": {
                            "label": text_of(first_match(inner, r'<p class="section-label[^"]*"[^>]*>(.*?)</p>') or ""),
                            "title": preserve(first_match(inner, r'<h2 class="prestations-heading[^"]*"[^>]*>(.*?)</h2>') or ""),
                        },
                    },
                )
            )
        elif "p-final" in classes:
            sections.append(sec("contact", cta_final(block["html"], "accueil")))
    return sections


def convert_project(name: str) -> list[dict[str, Any]]:
    blocks = top_level_blocks(main_inner(read_page(name)))
    sections: list[dict[str, Any]] = []
    for block in blocks:
        classes = class_of(block)
        if "project-cover" in classes:
            sections.append(sec("hero", hero_projet(block["html"])))
        elif "project-content" in classes:
            sections.append(sec("etude", etude_de_cas(block["html"])))
        elif "p-final" in classes:
            sections.append(sec("cta", cta_final(block["html"], "interne")))
    return sections


def convert_contact() -> list[dict[str, Any]]:
    blocks = top_level_blocks(main_inner(read_page("contact.html")))
    sections: list[dict[str, Any]] = []
    for block in blocks:
        classes = class_of(block)
        if "page-hero" in classes:
            sections.append(sec("hero", hero_simple(block["html"])))
        elif "page-body" in classes:
            sections.append(sec("formulaire", formulaire_contact(block["html"])))
    return sections


# --------------------------------------------------------------------------- #
# Métadonnées de pages extraites du legacy
# --------------------------------------------------------------------------- #

def home_prestations() -> dict[str, dict[str, str]]:
    inner = main_inner(read_page("index.html"))
    pre = re.search(r'<section[^>]*id="prestations".*?</section>', inner, re.S)
    data: dict[str, dict[str, str]] = {}
    if not pre:
        return data
    for match in re.finditer(r'<a class="svc-row" href="([^"]*)">(.*?)</a>', pre.group(0), re.S):
        href = clean_href(match.group(1))
        body = match.group(2)
        data[href] = {
            "title": text_of(first_match(body, r'<h3 class="svc-name">(.*?)</h3>') or ""),
            "excerpt": text_of(first_match(body, r'<p class="svc-desc">(.*?)</p>') or ""),
        }
    return data


def home_workcards() -> dict[str, dict[str, Any]]:
    inner = main_inner(read_page("index.html"))
    data: dict[str, dict[str, Any]] = {}
    for match in re.finditer(r'<a class="work-card[^"]*" href="([^"]*)"[^>]*>(.*?)</a>', inner, re.S):
        href = clean_href(match.group(1))
        body = match.group(2)
        tag = text_of(first_match(body, r'<span class="work-tag">(.*?)</span>') or "")
        data[href] = {
            "title": text_of(first_match(body, r'<span class="work-title">(.*?)</span>') or ""),
            "year": text_of(first_match(body, r'<span class="work-year">(.*?)</span>') or ""),
            "categories": [bit.strip() for bit in tag.split("·") if bit.strip()],
        }
    return data


# --------------------------------------------------------------------------- #
# Assemblage du payload
# --------------------------------------------------------------------------- #

def build_pages() -> list[dict[str, Any]]:
    pages: list[dict[str, Any]] = []

    # 1. Accueil
    title, desc = head_of(read_page("index.html"))
    pages.append(
        {
            "slug": "accueil",
            "kind": "accueil",
            "title": "Sujee Design",
            "status": "publie",
            "in_menu": False,
            "seo_title": title,
            "seo_description": desc,
            "sections": convert_home(),
        }
    )

    # 2. Réalisations (page liste créée)
    pages.append(
        {
            "slug": "realisations",
            "kind": "page",
            "title": "Réalisations",
            "status": "publie",
            "in_menu": True,
            "menu_position": 10,
            "sections": [
                {
                    "type": "hero",
                    "variant": "simple",
                    "label": "hero",
                    "data": {"kicker": "Travaux", "title": "Toutes les réalisations", "intro": ""},
                },
                {
                    "type": "realisations-grid",
                    "variant": "auto",
                    "label": "realisations",
                    "data": {"heading_lines": ["Sélection", "de projets."]},
                },
            ],
        }
    )

    # 3. Services (page liste créée)
    pages.append(
        {
            "slug": "services",
            "kind": "page",
            "title": "Services",
            "status": "publie",
            "in_menu": True,
            "menu_position": 20,
            "sections": [
                {
                    "type": "hero",
                    "variant": "simple",
                    "label": "hero",
                    "data": {
                        "kicker": "Prestations",
                        "title": "Tout ce qu'une marque<br>peut avoir besoin de.",
                        "intro": "",
                    },
                },
                {
                    "type": "services-list",
                    "variant": "auto",
                    "label": "prestations",
                    "data": {},
                },
            ],
        }
    )

    # 4. À propos
    title, desc = head_of(read_page("apropos.html"))
    pages.append(
        {
            "slug": "a-propos",
            "kind": "page",
            "title": "À propos",
            "status": "publie",
            "in_menu": True,
            "menu_label": "À propos",
            "menu_position": 30,
            "seo_title": title,
            "seo_description": desc,
            "sections": convert_apropos(),
        }
    )

    # 5. Contact
    title, desc = head_of(read_page("contact.html"))
    pages.append(
        {
            "slug": "contact",
            "kind": "page",
            "title": "Contact",
            "status": "publie",
            "in_menu": True,
            "menu_label": "Contact",
            "menu_position": 40,
            "seo_title": title,
            "seo_description": desc,
            "sections": convert_contact(),
        }
    )

    # 6. 404
    pages.append(
        {
            "slug": "404",
            "kind": "page",
            "title": "Page introuvable",
            "status": "publie",
            "robots": "noindex,nofollow",
            "in_menu": False,
            "sections": [
                {
                    "type": "hero",
                    "variant": "simple",
                    "label": "hero",
                    "data": {
                        "kicker": "Erreur 404",
                        "title": "Page introuvable",
                        "intro": "La page que vous cherchez n'existe pas ou a été déplacée.",
                    },
                },
                {
                    "type": "texte-riche",
                    "variant": "1",
                    "label": "aide",
                    "data": {
                        "body": "<p>Revenez à l'accueil ou explorez les réalisations et les services depuis le menu.</p>",
                    },
                },
            ],
        }
    )

    # 7. Services (5)
    prestations = home_prestations()
    for name, meta in SERVICE_PAGES.items():
        source = f"{meta['slug']}.html"
        legacy_name = name
        title, desc = head_of(read_page(legacy_name))
        info = prestations.get(legacy_name, {})
        pages.append(
            {
                "slug": meta["slug"],
                "kind": "service",
                "title": info.get("title") or title,
                "status": "publie",
                "excerpt": info.get("excerpt", ""),
                "num": meta["num"],
                "position": meta["position"],
                "in_menu": False,
                "seo_title": title,
                "seo_description": desc,
                "sections": convert_services_page(legacy_name),
            }
        )

    # 8. Réalisations (4)
    workcards = home_workcards()
    for name, meta in PROJECT_PAGES.items():
        title, desc = head_of(read_page(name))
        info = workcards.get(name, {})
        sections = convert_project(name)
        intro = ""
        cover = ""
        cover_alt = ""
        for section in sections:
            if section["type"] == "hero":
                intro = section["data"].get("intro", "")
                cover = section["data"].get("cover", "")
                cover_alt = section["data"].get("cover_alt", "")
        year: Any = info.get("year") or ""
        try:
            year = int(year)
        except (TypeError, ValueError):
            year = ""
        pages.append(
            {
                "slug": meta["slug"],
                "kind": "realisation",
                "title": info.get("title") or title,
                "status": "publie",
                "excerpt": intro,
                "cover": cover,
                "cover_alt": cover_alt,
                "year": year,
                "categories": info.get("categories", []),
                "position": meta["position"],
                "in_menu": False,
                "seo_title": title,
                "seo_description": desc,
                "sections": sections,
            }
        )

    return pages


def build_payload() -> dict[str, Any]:
    return {
        "reglages": REGLAGES,
        "pages": build_pages(),
        "redirections": REDIRECTIONS,
    }


def main() -> int:
    payload = build_payload()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    total_sections = sum(len(page["sections"]) for page in payload["pages"])
    print(f"seed écrit : {OUTPUT}")
    print(f"  réglages    : {len(payload['reglages'])}")
    print(f"  pages       : {len(payload['pages'])}")
    print(f"  sections    : {total_sections}")
    print(f"  redirections: {len(payload['redirections'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
