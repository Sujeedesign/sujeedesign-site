"""Accessibilité des pages publiques, vérifiée sur le rendu réel du site.

Comme `tests/test_seo.py`, ces tests tournent sur le contenu du dépôt
(`seed/content.json`) : ce sont les pages réellement publiées qui sont auditées.
"""

from __future__ import annotations

import re
from html.parser import HTMLParser
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import repo
from app.db import connect, init_db
from app.seed import load_seed_file

ROOT = Path(__file__).resolve().parents[1]
SEED_FILE = ROOT / "seed" / "content.json"

ERROR_PAGE = "/404"
NOT_FOUND_SLUG = "404"
HEADING_RE = re.compile(r"^h([1-6])$")
FORM_CONTROLS = {"input", "select", "textarea"}
# Éléments de flux qui n'ont rien à faire dans un titre (HTML invalide).
BLOCK_LEVEL = {
    "address", "article", "aside", "blockquote", "dd", "details", "div", "dl", "dt",
    "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5",
    "h6", "header", "hr", "li", "main", "nav", "ol", "p", "pre", "section", "table", "ul",
}


class PageAudit(HTMLParser):
    """Relève les invariants d'accessibilité d'une page."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.lang = ""
        self.viewport = ""
        self.headings: list[dict] = []
        self.main_ids: list[str] = []
        self.images: list[dict] = []
        self.controls: list[dict] = []
        self.label_targets: set[str] = set()
        self.focusables: list[dict] = []
        self.canvases: list[dict] = []
        self._open_headings: list[int] = []
        self._main_depth = 0
        self._label_depth = 0
        self._text_targets: list[dict] = []

    @staticmethod
    def _attrs(attrs: list[tuple[str, str | None]]) -> dict[str, str]:
        return {name: (value if value is not None else "") for name, value in attrs}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = self._attrs(attrs)
        if tag == "html":
            self.lang = attributes.get("lang", "")
        elif tag == "meta" and attributes.get("name") == "viewport":
            self.viewport = attributes.get("content", "")

        if tag == "main":
            self._main_depth += 1
            self.main_ids.append(attributes.get("id", ""))

        # Un élément de flux ouvert pendant qu'un titre est ouvert = titre imbriqué.
        if self._open_headings and tag in BLOCK_LEVEL:
            self.headings[-1]["nested"].append(tag)

        if HEADING_RE.match(tag):
            self._open_headings.append(int(tag[1]))
            self.headings.append({"level": int(tag[1]), "in_main": self._main_depth > 0, "nested": []})

        if tag == "img":
            self.images.append(
                {
                    "src": attributes.get("src", ""),
                    "alt": attributes.get("alt"),
                    "aria_hidden": attributes.get("aria-hidden", ""),
                    "role": attributes.get("role", ""),
                }
            )
        if tag == "canvas":
            self.canvases.append({"id": attributes.get("id", ""), "aria_hidden": attributes.get("aria-hidden", "")})
        if tag == "label":
            self._label_depth += 1
            if attributes.get("for"):
                self.label_targets.add(attributes["for"])
        if tag in FORM_CONTROLS:
            self.controls.append(
                {
                    "tag": tag,
                    "id": attributes.get("id", ""),
                    "type": attributes.get("type", ""),
                    "aria_label": attributes.get("aria-label", ""),
                    "aria_labelledby": attributes.get("aria-labelledby", ""),
                    "aria_describedby": attributes.get("aria-describedby", ""),
                    "required": "required" in attributes,
                    "in_label": self._label_depth > 0,
                }
            )
        if tag in ("a", "button") or (tag in FORM_CONTROLS and attributes.get("type") != "hidden"):
            entry = {
                "tag": tag,
                "href": attributes.get("href", ""),
                "aria_label": attributes.get("aria-label", ""),
                "aria_expanded": attributes.get("aria-expanded", ""),
                "aria_controls": attributes.get("aria-controls", ""),
                "class": attributes.get("class", ""),
                "text": "",
            }
            self.focusables.append(entry)
        if tag in ("a", "button"):
            self._text_targets.append(self.focusables[-1])

    def handle_data(self, data: str) -> None:
        for target in self._text_targets:
            target["text"] += data

    def handle_endtag(self, tag: str) -> None:
        if tag in ("a", "button") and self._text_targets:
            self._text_targets.pop()
        elif tag == "label" and self._label_depth:
            self._label_depth -= 1
        elif tag == "main" and self._main_depth:
            self._main_depth -= 1
        elif HEADING_RE.match(tag) and self._open_headings:
            self._open_headings.pop()

    # ---------------------------------------------------------------- commodités
    def content_headings(self) -> list[dict]:
        return [heading for heading in self.headings if heading["in_main"]]

    def accessible_name(self, entry: dict) -> str:
        return (entry["aria_label"] or entry["text"]).strip()


@pytest.fixture()
def site(client: TestClient, db_file: Path) -> TestClient:
    conn = connect(db_file)
    try:
        init_db(conn)
        report = load_seed_file(conn, SEED_FILE)
    finally:
        conn.close()
    assert report["erreurs"] == [], report["erreurs"]
    return client


def public_paths(db_file: Path) -> list[str]:
    conn = connect(db_file)
    try:
        return [repo.page_path(row) for row in repo.list_pages(conn, published_only=True, order="position, title")]
    finally:
        conn.close()


@pytest.fixture()
def audited(site: TestClient, db_file: Path) -> dict[str, PageAudit]:
    pages: dict[str, PageAudit] = {}
    for path in public_paths(db_file):
        audit = PageAudit()
        audit.feed(site.get(path).text)
        pages[path] = audit
    assert len(pages) >= 15
    return pages


# ---------------------------------------------------------------------- structure


def test_each_page_has_exactly_one_h1(audited: dict[str, PageAudit]) -> None:
    for path, audit in audited.items():
        h1 = [heading for heading in audit.headings if heading["level"] == 1]
        assert len(h1) == 1, f"{path} : {len(h1)} h1"


def test_the_h1_is_inside_the_main_landmark(audited: dict[str, PageAudit]) -> None:
    for path, audit in audited.items():
        h1 = [heading for heading in audit.headings if heading["level"] == 1][0]
        assert h1["in_main"], f"{path} : le h1 doit être dans <main>"


def test_every_page_has_one_main_landmark(audited: dict[str, PageAudit]) -> None:
    for path, audit in audited.items():
        assert audit.main_ids == ["main-content"], f"{path} : <main id=main-content> attendu"


def test_heading_levels_do_not_skip_in_the_content(audited: dict[str, PageAudit]) -> None:
    """Le contenu ne saute jamais un niveau (hors pied de page, qui porte ses h3 de charte)."""
    for path, audit in audited.items():
        headings = audit.content_headings()
        assert headings[0]["level"] == 1, f"{path} : le contenu doit commencer par un h1"
        for previous, current in zip(headings, headings[1:]):
            assert current["level"] <= previous["level"] + 1, (
                f"{path} : saut de h{previous['level']} à h{current['level']}"
            )


def test_heading_levels_do_not_skip_across_the_document(audited: dict[str, PageAudit]) -> None:
    """Contrôle d'ordre sur tout le document, pied de page compris.

    La page 404 est hors de ce contrôle : son contenu de secours ne comporte qu'un h1,
    le premier titre rencontré ensuite est un h3 de pied de page. Corriger cet écart
    demande d'ajouter un intertitre au contenu de la page 404.
    """
    for path, audit in audited.items():
        if path == ERROR_PAGE:
            continue
        levels = [heading["level"] for heading in audit.headings]
        assert levels[0] == 1, path
        for previous, current in zip(levels, levels[1:]):
            assert current <= previous + 1, f"{path} : saut de h{previous} à h{current}"


def test_no_block_element_is_nested_inside_a_heading(audited: dict[str, PageAudit]) -> None:
    for path, audit in audited.items():
        for heading in audit.headings:
            assert not heading["nested"], f"{path} : <h{heading['level']}> contient {heading['nested']}"


# ------------------------------------------------------------------------ images


def test_images_declare_alt_or_are_hidden_from_assistive_tech(audited: dict[str, PageAudit]) -> None:
    for path, audit in audited.items():
        for image in audit.images:
            assert image["alt"] is not None, f"{path} : <img> sans attribut alt ({image['src']})"
            if image["alt"].strip():
                continue
            hidden = image["aria_hidden"] == "true" or image["role"] == "presentation"
            assert hidden, f"{path} : image décorative sans aria-hidden ({image['src']})"


def test_editorial_images_have_a_non_empty_alt(audited: dict[str, PageAudit]) -> None:
    """Toute image exposée aux technologies d'assistance porte un texte de remplacement."""
    checked = 0
    for path, audit in audited.items():
        for image in audit.images:
            if image["aria_hidden"] == "true":
                continue
            assert image["alt"].strip(), f"{path} : alt vide sur une image annoncée ({image['src']})"
            checked += 1
    assert checked >= len(audited), "chaque page doit exposer au moins son logo"


# ---------------------------------------------------------------------- formulaire


def test_form_controls_have_an_associated_label(audited: dict[str, PageAudit]) -> None:
    controls = [control for audit in audited.values() for control in audit.controls if control["type"] != "hidden"]
    assert controls, "le formulaire de contact doit être présent"
    names = set()
    for audit in audited.values():
        names |= audit.label_targets
    for control in controls:
        identifier = control["id"]
        assert identifier, f"champ {control['tag']} sans id, donc sans label associé"
        labelled = (
            identifier in names
            or bool(control["aria_label"])
            or bool(control["aria_labelledby"])
            or control["in_label"]
        )
        assert labelled, f"champ {identifier} sans label associé"


def test_contact_form_is_complete_and_signals_errors(audited: dict[str, PageAudit]) -> None:
    audit = audited["/contact"]
    by_id = {control["id"]: control for control in audit.controls}
    assert {"cf-name", "cf-email", "cf-message", "cf-consent"} <= set(by_id)
    for identifier in ("cf-name", "cf-email", "cf-message"):
        control = by_id[identifier]
        assert control["required"], f"{identifier} doit être requis"
        # L'erreur de chaque champ requis est reliée au champ lui-même.
        assert control["aria_describedby"] == f"{identifier}-error", identifier
    assert by_id["cf-consent"]["type"] == "checkbox"
    assert by_id["cf-consent"]["required"]


# ------------------------------------------------------------------------ repères


def test_skip_link_is_the_first_focusable_control_and_targets_main(audited: dict[str, PageAudit]) -> None:
    for path, audit in audited.items():
        first = audit.focusables[0]
        assert first["tag"] == "a" and first["href"] == "#main-content", f"{path} : lien d'évitement absent"
        assert audit.accessible_name(first), f"{path} : lien d'évitement sans libellé"
        assert "main-content" in audit.main_ids


def test_links_and_buttons_have_an_accessible_name(audited: dict[str, PageAudit]) -> None:
    for path, audit in audited.items():
        for entry in audit.focusables:
            if entry["tag"] in FORM_CONTROLS:
                continue  # les champs sont couverts par le test des labels
            assert audit.accessible_name(entry), f"{path} : {entry['tag']} sans intitulé"


def test_document_language_and_viewport_are_declared(audited: dict[str, PageAudit]) -> None:
    for path, audit in audited.items():
        assert audit.lang == "fr", f"{path} : lang={audit.lang!r}"
        assert "width=device-width" in audit.viewport, f"{path} : meta viewport manquante"
        assert "initial-scale=1" in audit.viewport, f"{path} : viewport sans initial-scale"


def test_primary_navigation_exposes_aria_state(audited: dict[str, PageAudit], site: TestClient) -> None:
    for path, audit in audited.items():
        toggle = [entry for entry in audit.focusables if "nav-toggle" in entry["class"]]
        assert len(toggle) == 1, f"{path} : bouton de menu introuvable"
        assert toggle[0]["aria_expanded"] in {"true", "false"}, path
        assert toggle[0]["aria_controls"] == "menuOverlay", path
        assert audit.accessible_name(toggle[0]), path

    nav = site.get("/").text
    assert 'aria-label="Navigation principale"' in nav
    assert 'aria-hidden="true"' in nav


def test_decorative_canvases_are_hidden_from_assistive_tech(audited: dict[str, PageAudit]) -> None:
    checked = 0
    for path, audit in audited.items():
        for canvas in audit.canvases:
            assert canvas["aria_hidden"] == "true", f"{path} : canvas {canvas['id']} annoncé"
            checked += 1
    assert checked, "les fonds animés doivent rester présents mais masqués"


def test_content_is_readable_without_javascript(audited: dict[str, PageAudit], site: TestClient) -> None:
    """Sans JavaScript, les animations d'entrée ne doivent pas masquer le contenu.

    `.hu` (titre du hero) et `.reveal` (sections) partent à opacité 0 et ne
    deviennent visibles que par script : sans filet `noscript`, un visiteur avec
    JavaScript désactivé (ou un script qui ne charge pas) voit une page vide.
    Le filet est une feuille dédiée, chargée uniquement dans `noscript`, pour ne
    pas réintroduire de bloc `<style>` embarqué.
    """
    for path in ("/", "/services", "/contact"):
        html = site.get(path).text
        assert '<noscript><link rel="stylesheet" href="/assets/site-noscript.css"></noscript>' in html, path

    sheet = ROOT / "theme" / "assets" / "site-noscript.css"
    assert sheet.is_file(), "feuille de repli absente du thème"
    rules = sheet.read_text(encoding="utf-8").replace(" ", "")
    for selector in (".hu", ".reveal", ".reveal-line>span", ".mw"):
        assert selector in rules, f"{selector} reste masqué sans JavaScript"
    assert "opacity:1!important" in rules
    assert "transform:none!important" in rules
    assert site.get("/assets/site-noscript.css").status_code == 200


def test_footer_links_to_the_legal_notice_page(site: TestClient, audited: dict[str, PageAudit]) -> None:
    for path in audited:
        assert 'href="/mentions-legales"' in site.get(path).text, path
    assert site.get("/mentions-legales").status_code == 200
