"""Validation dérivée du schéma : mêmes champs et mêmes règles que le panneau."""

from __future__ import annotations

import pytest

from sujee_editor.blocks import DEFAULT_BLOCKS, Block, Field, Kind
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
