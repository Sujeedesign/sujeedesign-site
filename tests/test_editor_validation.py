"""Validation dérivée du schéma : mêmes champs et mêmes règles que le panneau."""

from __future__ import annotations

import pytest

from sujee_editor.blocks import DEFAULT_BLOCKS, Block, Field, Kind, default_data
from sujee_editor.blocks.validate import ValidationError, validate_data, validate_field

hero = DEFAULT_BLOCKS["hero"]
chapter = DEFAULT_BLOCKS["chapter"]
faq = DEFAULT_BLOCKS["faq"]

ESSAI = Block(
    name="essai",
    label="Essai",
    template="sections/hero.html",
    fields=(
        Field("titre", Kind.TEXT, "Titre", required=True, max_length=10),
        Field("poids", Kind.NUMBER, "Poids"),
        Field("actif", Kind.BOOL, "Actif"),
        Field("style", Kind.CHOICE, "Style", choices=("a", "b")),
        Field("lignes", Kind.LINES, "Lignes"),
        Field("ctas", Kind.CTAS, "Boutons", max_items=2, fields=(Field("label", Kind.TEXT, "Libellé", max_length=5),)),
    ),
)


def rules(errors: list[ValidationError]) -> list[tuple[str, str]]:
    return [(error.field, error.rule) for error in errors]


def test_unknown_field_and_max_length():
    errors = validate_data(hero, {"title": "x" * 500, "inconnu": 1})
    assert {error.field for error in errors} == {"inconnu", "title"}
    assert {error.rule for error in errors} == {"unknown_field", "max_length"}


def test_required_and_variant():
    assert [error.rule for error in validate_data(chapter, {}) if error.field == "title"] == []
    assert [error.rule for error in validate_data(hero, {"_variant": "nope"})] == ["bad_variant"]
    assert rules(validate_data(hero, {"_variant": "page"})) == []
    assert rules(validate_data(ESSAI, {})) == [("titre", "required")]


def test_number_and_bool_rules():
    assert rules(validate_data(ESSAI, {"titre": "ok", "poids": "lourd"})) == [("poids", "not_a_number")]
    assert rules(validate_data(ESSAI, {"titre": "ok", "actif": "oui"})) == [("actif", "not_a_bool")]
    assert rules(validate_data(ESSAI, {"titre": "ok", "poids": 12, "actif": 1})) == []


def test_choice_rule():
    assert rules(validate_data(ESSAI, {"titre": "ok", "style": "c"})) == [("style", "bad_choice")]
    assert rules(validate_data(hero, {"ctas": [{"style": "bizarre"}]})) == [("ctas", "bad_item")]


def test_a_wrong_top_level_type_has_its_own_rule():
    assert rules(validate_data(ESSAI, {"titre": 12})) == [("titre", "bad_type")]
    assert validate_data(ESSAI, {"titre": 12})[0].detail == "text"


def test_too_many_items_and_nested_paths():
    errors = validate_data(ESSAI, {"titre": "ok", "ctas": [{"label": "a"}, {"label": "b"}, {"label": "c"}]})
    assert rules(errors) == [("ctas", "too_many")]
    errors = validate_data(ESSAI, {"titre": "ok", "ctas": [{"label": "a"}, {"label": "b" * 9}]})
    assert rules(errors) == [("ctas", "bad_item")]
    assert errors[0].detail == "ctas[1].label"


def test_nested_items_report_the_item_path():
    errors = validate_data(faq, {"items": [{"q": "Question", "a": "Réponse"}, {"q": 12}]})
    assert rules(errors) == [("items", "bad_item")]
    assert errors[0].detail == "items[1].q"


def test_lines_accept_a_list_or_a_string():
    assert rules(validate_data(ESSAI, {"titre": "ok", "lignes": ["a", "b"]})) == []
    assert rules(validate_data(ESSAI, {"titre": "ok", "lignes": "a\nb"})) == []
    assert rules(validate_data(ESSAI, {"titre": "ok", "lignes": ["a", 3]})) == [("lignes", "bad_item")]
    assert validate_data(ESSAI, {"titre": "ok", "lignes": ["a", 3]})[0].detail == "lignes[1]"


def test_a_block_without_variants_ignores_the_variant_key():
    assert rules(validate_data(chapter, {"_variant": "dark"})) == []
    assert rules(validate_data(hero, {"_variant": "nope"})) == [("_variant", "bad_variant")]


def test_underscore_keys_are_ignored():
    assert rules(validate_data(chapter, {"_vu": True, "_note": "interne"})) == []


def test_validate_field_checks_a_single_field():
    assert rules(validate_field(hero, "fantome", "x")) == [("fantome", "unknown_field")]
    assert rules(validate_field(hero, "kicker", "x" * 200)) == [("kicker", "max_length")]
    assert rules(validate_field(hero, "kicker", "Court")) == []


def test_validation_never_raises_on_odd_structures():
    assert rules(validate_data(faq, {"items": "pas une liste"})) == [("items", "bad_type")]
    assert rules(validate_data(hero, {"ctas": [None]})) == [("ctas", "bad_item")]


@pytest.mark.parametrize("name", sorted(DEFAULT_BLOCKS))
def test_a_block_with_no_data_has_no_error_except_required(name):
    errors = validate_data(DEFAULT_BLOCKS[name], {})
    assert all(error.rule == "required" for error in errors)


# --- Revue de branche : une image est un chemin, pas un objet -------------
# Fix [C1] : `Kind.IMAGE` n'avait aucune branche dans la validation, donc toute
# valeur d'image etait refusee : 4 des 19 types de blocs etaient inutilisables.


def test_an_image_field_accepts_a_path_and_refuses_anything_else():
    assert validate_data(hero, {"cover": "/medias/une-image.jpg"}) == []
    assert rules(validate_data(hero, {"cover": 42})) == [("cover", "bad_type")]
    assert rules(validate_data(hero, {"cover": {"src": "/medias/a.jpg"}})) == [("cover", "bad_type")]


def test_an_image_inside_a_list_is_validated_as_a_path():
    galerie = DEFAULT_BLOCKS["galerie"]
    assert validate_data(galerie, {"images": [{"src": "/medias/a.jpg", "alt": "", "caption": ""}]}) == []
    errors = validate_data(galerie, {"images": [{"src": 12}]})
    assert rules(errors) == [("images", "bad_item")]
    assert errors[0].detail == "images[0].src"


# Fix [C2] : `default_data` rendait "" pour un champ `ctas`, donc un bloc "CTA
# final" neuf etait refuse par sa propre validation, et ne pouvait jamais etre ajoute.


@pytest.mark.parametrize("name", sorted(DEFAULT_BLOCKS))
def test_every_block_accepts_its_own_defaults(name):
    block = DEFAULT_BLOCKS[name]
    assert validate_data(block, default_data(block)) == []


def test_a_cta_field_defaults_to_an_empty_list():
    cta = DEFAULT_BLOCKS["cta-final"]
    assert default_data(cta)["ctas"] == []


def test_cta_field_accepts_three_existing_buttons():
    cta = DEFAULT_BLOCKS["cta-final"]
    data = default_data(cta)
    data["ctas"] = [
        {"label": f"Bouton {index}", "href": "/contact", "style": "pill"}
        for index in range(3)
    ]

    assert validate_data(cta, data) == []


def test_free_zone_defaults_to_a_valid_two_column_layout():
    zone = DEFAULT_BLOCKS["zone-libre"]
    data = default_data(zone)
    assert data["background"] == "none"
    assert [column["span"] for column in data["columns"]] == ["6", "6"]
    assert validate_data(zone, data) == []


def test_free_zone_defaults_are_fresh_nested_values():
    zone = DEFAULT_BLOCKS["zone-libre"]
    first = default_data(zone)
    first["columns"][0]["span"] = "8"
    second = default_data(zone)
    assert [column["span"] for column in second["columns"]] == ["6", "6"]


def test_free_zone_accepts_local_background_image_and_twelve_column_grid():
    zone = DEFAULT_BLOCKS["zone-libre"]
    data = default_data(zone)
    data["background"] = "image"
    data["background_image"] = "/medias/fond-atelier.webp"
    data["columns"] = [
        {"span": "8", "align": "left", "elements": [{"type": "heading", "text": "Titre", "level": "h2", "label": "", "href": "", "role": "principal", "src": "", "alt": "", "items": []}]},
        {"span": "4", "align": "center", "elements": []},
    ]
    assert validate_data(zone, data) == []


def test_free_zone_rejects_unbalanced_columns_and_remote_backgrounds():
    zone = DEFAULT_BLOCKS["zone-libre"]
    data = default_data(zone)
    data["columns"][0]["span"] = "8"
    data["background"] = "image"
    data["background_image"] = "https://example.com/fond.jpg"
    errors = validate_data(zone, data)
    assert {error.rule for error in errors} >= {"bad_layout", "unsafe_media"}


def test_free_zone_rejects_dangerous_button_links():
    zone = DEFAULT_BLOCKS["zone-libre"]
    data = default_data(zone)
    data["columns"][0]["elements"] = [{
        "type": "button", "text": "", "level": "h2", "label": "Voir", "href": "javascript:alert(1)",
        "role": "principal", "src": "", "alt": "", "items": [],
    }]
    assert any(error.rule == "unsafe_href" for error in validate_data(zone, data))


def test_free_zone_rejects_remote_or_traversal_image_paths():
    zone = DEFAULT_BLOCKS["zone-libre"]
    data = default_data(zone)
    data["columns"][0]["elements"] = [{
        "type": "image", "text": "", "level": "h2", "label": "", "href": "",
        "role": "principal", "src": "/medias/../private.jpg", "alt": "", "items": [],
    }]
    assert any(error.rule == "unsafe_media" for error in validate_data(zone, data))
    data["columns"][0]["elements"] = []
    data["background_image"] = "/medias/%2e%2e/private.webp"
    assert any(error.rule == "unsafe_media" for error in validate_data(zone, data))


def test_free_zone_rejects_backslashes_in_links_and_media_paths():
    zone = DEFAULT_BLOCKS["zone-libre"]
    data = default_data(zone)
    data["background_image"] = "/medias/.." + chr(92) + "private.webp"
    assert any(error.rule == "unsafe_media" for error in validate_data(zone, data))
    data["background_image"] = ""
    data["columns"][0]["elements"] = [{
        "type": "button", "text": "", "level": "h2", "label": "Voir",
        "href": "https://example.com" + chr(92) + "@evil", "role": "principal",
    }]
    assert any(error.rule == "unsafe_href" for error in validate_data(zone, data))
    data["columns"][0]["elements"][0]["href"] = "http://[::1"
    assert any(error.rule == "unsafe_href" for error in validate_data(zone, data))
