"""Nettoyage HTML, rendu des sections et cache de page."""

from __future__ import annotations

from pathlib import Path

import pytest

from app import render as render_module
from app import sections as sections_module

ENV = render_module.build_env()

PAGE = {
    "id": 1,
    "slug": "accueil",
    "title": "Sujee Design",
    "kind": "accueil",
    "seo_title": "Sujee Design — Votre marque, de A à Z",
    "seo_description": "Designer & directeur artistique à Paris.",
    "og_image": "",
    "robots": "index,follow",
}

CTX = {
    "revision": "1",
    "settings": {"site_name": "Sujee Design", "email": "a@b.fr", "tagline": "Votre marque, de A à Z"},
    "menu": [{"label": "Réalisations", "href": "/realisations"}],
    "current_path": "/",
    "seo": {"title": "Sujee Design", "description": "Description", "canonical": "https://sujeedesign.com/"},
    "realisations": [],
    "services": [],
    "year": 2026,
}


def sample_value(field: dict):
    kind = field["type"]
    if kind == "bool":
        return True
    if kind == "number":
        return 3
    if kind == "lines":
        return ["Première ligne", "Seconde ligne"]
    if kind == "images":
        return [{"src": "/medias/exemple.svg", "alt": "Description", "caption": "Légende"}]
    if kind == "items":
        item = {}
        for sub in field.get("fields", []):
            if sub["type"] == "choice":
                item[sub["name"]] = sub.get("choices", ["a"])[0]
            elif sub["type"] == "lines":
                item[sub["name"]] = ["Élément un"]
            elif sub["type"] == "textarea":
                item[sub["name"]] = "Texte du bloc"
            elif sub["type"] == "html":
                item[sub["name"]] = "<p>Texte du bloc</p>"
            else:
                item[sub["name"]] = "Valeur"
        return [item]
    if kind == "html":
        return "<p>Un paragraphe de test.</p>"
    if kind == "choice":
        return field.get("choices", [""])[0]
    return "Valeur de test"


def build_section(type_: str, variant: str | None = None) -> dict:
    spec = sections_module.SECTION_TYPES[type_]
    data = {}
    for field in spec["fields"]:
        data[field["name"]] = sample_value(field)
    if spec.get("variants"):
        data["_variant"] = variant or next(iter(spec["variants"]))
    return {
        "id": 1,
        "page_id": 1,
        "position": 0,
        "type": type_,
        "variant": data.get("_variant", ""),
        "label": "Libellé",
        "visible": 1,
        "data": data,
    }


def test_sanitize_strips_scripts_and_handlers() -> None:
    raw = '<p onclick="alert(1)">Coucou<script>alert(2)</script></p><iframe src="x"></iframe>'
    cleaned = render_module.sanitize_html(raw)
    assert "<script" not in cleaned
    assert "onclick" not in cleaned
    assert "<iframe" not in cleaned
    assert "Coucou" in cleaned


def test_sanitize_blocks_javascript_urls() -> None:
    cleaned = render_module.sanitize_html('<a href="javascript:alert(1)">lien</a>')
    assert "javascript:" not in cleaned
    assert "lien" in cleaned


def test_text_to_html_wraps_paragraphs() -> None:
    assert render_module.text_to_html("Bonjour\n\nLe monde") == "<p>Bonjour</p><p>Le monde</p>"


@pytest.mark.parametrize("type_", sorted(sections_module.SECTION_TYPES))
def test_every_section_type_renders(type_: str) -> None:
    section = build_section(type_)
    html = render_module.section_html(ENV, section, CTX)
    assert html.strip(), f"aucun rendu pour {type_}"
    assert "{{" not in html
    if type_ not in ("marquee", "citation", "manifeste"):
        assert "Valeur" in html or "Première ligne" in html or "Un paragraphe de test." in html or "Description" in html


def test_unknown_section_type_is_ignored() -> None:
    html = render_module.section_html(ENV, {"id": 1, "type": "inconnu", "data": {}, "visible": 1}, CTX)
    assert html == ""


def test_invisible_section_is_skipped() -> None:
    section = build_section("chapter")
    section["visible"] = 0
    html = render_module.render_page(ENV, page=PAGE, sections=[section], ctx=CTX, template="pages/page.html")
    assert "chap-title" not in html


def test_render_page_has_single_h1_and_sequential_headings() -> None:
    sections = [
        build_section("hero", "page"),
        build_section("chapter"),
        build_section("texte-riche"),
    ]
    html = render_module.render_page(ENV, page=PAGE, sections=sections, ctx=CTX, template="pages/page.html")
    levels = render_module.heading_levels(html)
    assert levels.count(1) == 1
    assert levels[0] == 1
    for previous, current in zip(levels, levels[1:]):
        assert current - previous <= 1, f"saut de niveau : {previous} → {current}"


def test_render_page_escapes_user_text() -> None:
    section = build_section("chapter")
    section["data"]["title"] = "<script>alert(1)</script>Titre"
    html = render_module.render_page(ENV, page=PAGE, sections=[section], ctx=CTX, template="pages/page.html")
    assert "alert(1)" not in html
    assert "Titre" in html


def test_cache_uses_revision() -> None:
    sections = [build_section("chapter")]
    first = render_module.render_page(ENV, page=PAGE, sections=sections, ctx=CTX, template="pages/page.html")
    second = render_module.render_page(ENV, page=PAGE, sections=sections, ctx=CTX, template="pages/page.html")
    assert first == second
    ctx2 = dict(CTX, revision="2")
    sections2 = [build_section("texte-riche")]
    third = render_module.render_page(ENV, page=PAGE, sections=sections2, ctx=ctx2, template="pages/page.html")
    assert third != first


def test_templates_directory_exists() -> None:
    assert (Path(render_module.TEMPLATES_DIR) / "base.html").is_file()
    for type_, template in sections_module.TEMPLATE_BY_TYPE.items():
        assert (Path(render_module.TEMPLATES_DIR) / template).is_file(), f"gabarit manquant : {type_}"
