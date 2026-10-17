"""Contrat de schéma : un champ éditable en place est marqué dans son gabarit.

Le contrat est vérifié **par variante** : un bloc peut n'afficher qu'une partie
de ses champs selon sa variante (le hero d'accueil montre un titre rotatif, pas
un sur-titre). Ce qui est exigé, c'est qu'aucun gabarit n'invente de marqueur et
que chaque champ déclaré soit marquable dans au moins une variante.
"""

from __future__ import annotations

import pytest

from sujee_editor.blocks import DEFAULT_BLOCKS, Block

from editor_fixtures import data_fields, empty_data, render_section, sample_data


def variants_of(block: Block) -> list[str]:
    return list(block.variants) or [""]


def render_variant(name: str, block: Block, data: dict, variant: str) -> str:
    payload = dict(data)
    if block.variants:
        payload["_variant"] = variant
    return render_section(name, payload)


@pytest.mark.parametrize("name", sorted(DEFAULT_BLOCKS))
def test_declared_inplace_fields_are_marked_in_at_least_one_variant(name: str) -> None:
    block = DEFAULT_BLOCKS[name]
    expected = {field.name for field in block.inplace_fields}
    marked_union: set[str] = set()
    for variant in variants_of(block):
        marked = data_fields(render_variant(name, block, sample_data(block), variant))
        assert marked <= expected, f"{name} ({variant or 'sans variante'}) : marqueurs non déclarés {sorted(marked - expected)}"
        marked_union |= marked
    assert marked_union == expected, f"{name} : jamais marqués {sorted(expected - marked_union)}"


@pytest.mark.parametrize("name", sorted(DEFAULT_BLOCKS))
def test_an_empty_field_makes_no_node_appear(name: str) -> None:
    """Valeurs vides : aucun marqueur inventé, et rien qui échoue au rendu."""
    block = DEFAULT_BLOCKS[name]
    expected = {field.name for field in block.inplace_fields}
    for variant in variants_of(block):
        html = render_variant(name, block, empty_data(block), variant)
        marked = data_fields(html)
        assert marked <= expected, f"{name} ({variant or 'sans variante'}) : marqueurs non déclarés {sorted(marked - expected)}"
        assert html.strip(), f"{name} : rien n'est rendu"


@pytest.mark.parametrize("name", sorted(DEFAULT_BLOCKS))
def test_each_marked_field_is_marked_once_per_variant(name: str) -> None:
    block = DEFAULT_BLOCKS[name]
    for variant in variants_of(block):
        html = render_variant(name, block, sample_data(block), variant)
        for field in block.inplace_fields:
            count = html.count(f'data-field="{field.name}"')
            assert count <= 1, f"{name} ({variant or 'sans variante'}) : {field.name} marqué {count} fois"


def test_a_block_without_inplace_field_has_no_marker() -> None:
    for name in ("banniere", "marquee", "etude-de-cas"):
        block = DEFAULT_BLOCKS[name]
        for variant in variants_of(block):
            assert data_fields(render_variant(name, block, sample_data(block), variant)) == set()


def test_every_block_renders_something() -> None:
    for name, block in DEFAULT_BLOCKS.items():
        for variant in variants_of(block):
            html = render_variant(name, block, sample_data(block), variant)
            assert html.strip(), f"{name} ({variant}) : aucun rendu"
            assert "{{" not in html, f"{name} : gabarit non rendu"
