"""Nœuds marqués laissés vides : ils ne doivent rien réserver à l'écran.

Les gabarits rendent désormais toujours les nœuds éditables en place. Quand la
valeur est vide, ces nœuds ne doivent laisser ni marge ni réserve : la règle
`[data-field]:empty` de `theme/assets/site-extras.css` les masque, mais elle ne
sait masquer que des nœuds **strictement** vides (aucun texte, même blanc,
aucun enfant). Un nœud marqué qui garderait de l'espace ou un enfant rendrait
donc sa marge sur la page publique, sans que rien ne le signale.
"""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path

import pytest

from app import render as render_module
from sujee_editor.blocks import DEFAULT_BLOCKS, Kind

from editor_fixtures import empty_data, render_section

VOID_ELEMENTS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "source",
    "track",
    "wbr",
}


class MarkedNodes(HTMLParser):
    """Relève les nœuds porteurs de `data-field` qui contiennent quelque chose."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.stack: list[dict] = []
        self.filled: list[str] = []

    def _mark_parents(self) -> None:
        for node in self.stack:
            node["content"] = True

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag not in VOID_ELEMENTS:
            self._mark_parents()
            self.stack.append({"tag": tag, "field": dict(attrs).get("data-field"), "content": False})
        # Les éléments vides par nature (img, br, input) ne portent pas de
        # marge : la règle `:empty` les masque déjà, rien à surveiller ici.

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._mark_parents()

    def handle_data(self, data: str) -> None:
        self._mark_parents()

    def handle_entityref(self, name: str) -> None:
        self._mark_parents()

    def handle_charref(self, name: str) -> None:
        self._mark_parents()

    def handle_endtag(self, tag: str) -> None:
        while self.stack:
            node = self.stack.pop()
            if node["field"] and node["content"]:
                self.filled.append(f"{tag}[data-field={node['field']}]")
            if node["tag"] == tag:
                break


def audit(html_text: str) -> list[str]:
    parser = MarkedNodes()
    parser.feed(html_text)
    parser.close()
    for node in parser.stack:
        if node["field"] and node["content"]:
            parser.filled.append(f"{node['tag']}[data-field={node['field']}]")
    return parser.filled


def variants_of(block) -> list[str]:
    return list(block.variants) or [""]


def truly_empty(block) -> dict:
    """Valeurs réellement vides, par nature de champ.

    `default_data` remplit les valeurs par défaut du schéma (un titre de colonne
    peut en porter une) : ce n'est pas ce qu'on veut mesurer ici, on veut le
    rendu quand l'auteur a vidé ses champs.
    """
    EMPTY = {
        Kind.TEXT: "",
        Kind.TEXTAREA: "",
        Kind.RICH: "",
        Kind.RICH_LINE: "",
        Kind.LINES: [],
        Kind.ITEMS: [],
        Kind.IMAGES: [],
        Kind.CTAS: [],
        Kind.IMAGE: "",
        Kind.BOOL: False,
        Kind.NUMBER: 0,
        Kind.CHOICE: "",
    }
    data = {field.name: EMPTY[field.kind] for field in block.fields}
    if block.variants:
        data["_variant"] = next(iter(block.variants))
    return data


@pytest.mark.parametrize("name", sorted(DEFAULT_BLOCKS))
def test_an_empty_block_leaves_every_marked_node_strictly_empty(name: str) -> None:
    block = DEFAULT_BLOCKS[name]
    data = truly_empty(block)
    for variant in variants_of(block):
        payload = dict(data)
        if block.variants:
            payload["_variant"] = variant
        html = render_section(name, payload)
        assert audit(html) == [], (
            f"{name} ({variant or 'sans variante'}) : nœuds marqués non vides au rendu vide, "
            "la règle [data-field]:empty ne peut pas les masquer"
        )


def test_the_empty_rule_follows_the_field_markers() -> None:
    css = (Path(render_module.TEMPLATES_DIR).parents[0] / "assets" / "site-extras.css").read_text(encoding="utf-8")
    assert "[data-field]:empty" in css, "la règle de masquage doit suivre les marqueurs, pas une liste de classes"
    assert "figcaption:empty" in css, "les légendes non marquées restent masquées quand elles sont vides"
