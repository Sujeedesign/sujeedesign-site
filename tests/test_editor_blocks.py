"""Le registre typé du paquet reproduit exactement l'ancien registre du site."""

from __future__ import annotations

import pytest

from app import render as render_module
from app import sections as sections_module
from sujee_editor.blocks import DEFAULT_BLOCKS, Block, Field, Kind, get_block

LEGACY_FIELDS = {
    "hero": ["kicker", "title", "intro", "meta", "rotator", "cover", "cover_alt", "image", "image_alt",
             "image_width", "image_height", "back_label", "back_href", "dense", "wide_title", "ctas", "shader"],
    "chapter": ["kicker", "title", "body", "list", "dark"],
    "cta-final": ["kicker", "title", "title_lines", "intro", "ctas", "shader"],
    "formulaire-contact": ["label", "title", "intro", "aside_title", "columns"],
}


def test_catalogue_has_the_nineteen_legacy_types():
    assert list(DEFAULT_BLOCKS) == list(sections_module.SECTION_ORDER)
    assert len(DEFAULT_BLOCKS) == 19


@pytest.mark.parametrize("name", sorted(LEGACY_FIELDS))
def test_field_order_is_preserved(name):
    assert [f.name for f in DEFAULT_BLOCKS[name].fields] == LEGACY_FIELDS[name]


def test_legacy_registry_shape_is_unchanged():
    hero = sections_module.SECTION_TYPES["hero"]
    assert hero["label"] == "Bandeau d'ouverture"
    assert hero["variants"]["accueil"].startswith("Accueil")
    assert [f["name"] for f in hero["fields"]][:3] == ["kicker", "title", "intro"]
    assert hero["fields"][0]["type"] == "text"
    assert sections_module.SECTION_TYPES["chapter"]["fields"][3] == {
        "name": "list", "label": "Liste à puces", "type": "lines",
    }


def test_nested_fields_keep_their_shape():
    ctas = next(f for f in sections_module.SECTION_TYPES["hero"]["fields"] if f["name"] == "ctas")
    assert ctas["type"] == "items"
    assert [f["name"] for f in ctas["fields"]] == ["label", "href", "style"]
    assert ctas["fields"][2]["choices"] == ["pill", "pill--filled", "text-link"]
    galerie = next(f for f in sections_module.SECTION_TYPES["galerie"]["fields"] if f["name"] == "images")
    assert [f["name"] for f in galerie["fields"]] == ["src", "alt", "caption"]


def test_form_type_maps_rich_line_to_html():
    assert Field("title", Kind.RICH_LINE, "Titre").form_type == "html"
    assert Field("body", Kind.RICH, "Texte").form_type == "html"
    assert Field("ctas", Kind.CTAS, "Boutons").form_type == "items"
    assert Field("kicker", Kind.TEXT, "Sur-titre").form_type == "text"


def test_inplace_defaults_by_kind():
    assert Field("title", Kind.TEXT, "Titre").inplace is True
    assert Field("body", Kind.RICH, "Texte").inplace is True
    assert Field("cover", Kind.IMAGE, "Image").inplace is True
    assert Field("list", Kind.LINES, "Liste").inplace is False
    assert Field("dark", Kind.BOOL, "Fond sombre").inplace is False
    assert Field("svg", Kind.RICH, "SVG", inplace=False).inplace is False


def test_catalogue_pins_the_expected_inplace_fields():
    hero = DEFAULT_BLOCKS["hero"]
    assert {f.name for f in hero.inplace_fields} == {"kicker", "title", "intro", "back_label"}
    assert "cover" not in {f.name for f in hero.inplace_fields}
    chapter = DEFAULT_BLOCKS["chapter"]
    assert {f.name for f in chapter.inplace_fields} == {"kicker", "title", "body"}


def test_every_block_template_exists():
    for block in DEFAULT_BLOCKS.values():
        assert block.template.startswith("sections/")
        assert (render_module.TEMPLATES_DIR / block.template).is_file(), block.name


def test_get_block_and_block_lookup():
    assert get_block("hero") is DEFAULT_BLOCKS["hero"]
    assert get_block("inexistant") is None
    assert DEFAULT_BLOCKS["hero"].field("title").label == "Titre"
    assert DEFAULT_BLOCKS["hero"].field("fantome") is None


def test_block_is_frozen_and_repeatable_by_default():
    block = Block(name="essai", label="Essai", fields=(Field("t", Kind.TEXT, "T"),), template="sections/hero.html")
    assert block.repeatable is True
    with pytest.raises(Exception):
        block.name = "autre"


def test_variants_are_preserved_for_every_type():
    assert DEFAULT_BLOCKS["texte-riche"].variants == {"1": "Une colonne", "2": "Deux colonnes"}
    assert DEFAULT_BLOCKS["bloc-liens"].variants["manuel"] == "Manuel"
    assert DEFAULT_BLOCKS["manifeste"].variants == {}
