"""Harmonisation et accessibilité des pages publiques, vérifiées sur le rendu.

Portage de `atelier/deploy/tests/test_site_harmonisation.py` (22 tests) et de
`atelier/deploy/tests/test_project_pages.py` (6 tests). Les invariants ne sont plus
contrôlés dans des fichiers `.html` statiques (qui n'existent plus) mais dans le HTML
produit par l'application FastAPI, sur une base temporaire et un contenu minimal.

Tests legacy volontairement non portés :

- `test_public_page_inventory_is_complete` : l'inventaire n'est plus une liste de
  fichiers sur disque mais la liste des routes publiques servies ; il est adapté en
  `test_public_routes_are_served`.
- `test_shared_stylesheet_has_no_duplicate_rules` : la déduplication du CSS statique
  n'est plus un invariant de rendu (une seule feuille de thème partagée, servie par
  l'application, et non recopiée dans chaque page). L'équivalent au niveau du rendu
  est `test_pages_do_not_embed_per_page_style_blocks`.
- Les vérifications d'existence de fichiers `*.html` (galeries, projet-*.html) et de
  scripts de navigation recopiés dans chaque page tombent : une seule feuille
  `theme/assets/site.css` et un seul `theme/assets/site.js` servis par l'app.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from collections.abc import Iterator
from html.parser import HTMLParser
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import repo
from app.db import connect, init_db
from app.main import create_app

ROOT = Path(__file__).resolve().parents[1]
SITE_CSS = ROOT / "theme" / "assets" / "site.css"
SITE_JS_ROUTE = "/assets/site.js"

# Pages minimales du jeu de données, par route publique.
HOME_ROUTE = "/"
LISTING_ROUTES = ("/realisations", "/services")
CONTACT_ROUTE = "/contact"
SERVICE_DETAIL_ROUTE = "/services/identite"
# page projet -> nom du visuel SVG attendu dans /assets/projects
PROJECT_ROUTES = {
    "/realisations/vaasam-paris": "vaasam",
    "/realisations/rfa": "rfa",
}
PUBLIC_ROUTES = (HOME_ROUTE, *LISTING_ROUTES, CONTACT_ROUTE, SERVICE_DETAIL_ROUTE, *PROJECT_ROUTES)
# Routes dont la section éditoriale est un chapitre (classes s-chap / chap-title).
CHAPTER_ROUTES = (HOME_ROUTE, SERVICE_DETAIL_ROUTE)

# Variables CSS posées par les attributs style="" des gabarits, hors feuille partagée.
INLINE_VARIABLES = {"--d", "--hu-d"}


class PageParser(HTMLParser):
    """Relève la structure d'une page rendue : titres, repères, liens, images."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.headings: list[int] = []
        self.h1_count = 0
        self.h1_in_main_count = 0
        self.main_ids: list[str] = []
        self.style_blocks = 0
        self.classes: set[str] = set()
        self.stylesheets: list[str] = []
        self.links: list[str] = []
        self.images: list[dict[str, str | None]] = []
        self.skip_links: list[str] = []
        self.focusable: list[tuple[str, str]] = []
        self.nav_links: list[tuple[str, str]] = []
        self.skip_index = -1
        self.nav_index = -1
        self.cover_position = -1
        self.cover_image_position = -1
        self.cover_image: dict[str, str | None] | None = None
        self.content_position = -1
        self.menu_toggle: dict[str, str | None] | None = None
        self.menu_overlay: dict[str, str | None] | None = None
        self._index = 0
        self._in_main = False
        self._in_nav = False
        self._in_cover = False
        self._link: dict | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = {name: value for name, value in attrs}
        classes = (a.get("class") or "").split()
        self.classes.update(classes)

        if tag == "main":
            self.main_ids.append(a.get("id") or "")
            self._in_main = True
        if tag == "style":
            self.style_blocks += 1
        if tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            self.headings.append(int(tag[1]))
            if tag == "h1":
                self.h1_count += 1
                if self._in_main:
                    self.h1_in_main_count += 1
        if tag == "link" and "stylesheet" in (a.get("rel") or "").lower().split():
            self.stylesheets.append(a.get("href") or "")
        if tag == "nav":
            label = (a.get("aria-label") or "").lower()
            self._in_nav = "nav" in classes or "navigation principale" in label
            if self.nav_index < 0:
                self.nav_index = self._index
        if tag == "section" and "project-cover" in classes:
            self.cover_position = self._index
            self._in_cover = True
        if tag == "section" and "project-content" in classes:
            self.content_position = self._index
        if tag == "img":
            image = {
                "src": a.get("src") or "",
                "alt": a.get("alt"),
                "aria-hidden": a.get("aria-hidden"),
                "class": a.get("class") or "",
                "width": a.get("width"),
                "height": a.get("height"),
            }
            self.images.append(image)
            if self._in_cover:
                self.cover_image = image
                self.cover_image_position = self._index
        if tag == "a":
            href = a.get("href") or ""
            self.links.append(href)
            if a.get("tabindex") != "-1":
                self.focusable.append(("a", href))
            if href == "#main-content":
                self.skip_links.append(href)
                if self.skip_index < 0:
                    self.skip_index = self._index
            if self._in_nav:
                self._link = {"href": href, "text": []}
        elif tag in {"button", "input", "select", "textarea"} and a.get("tabindex") != "-1":
            self.focusable.append((tag, a.get("type") or ""))
        if tag == "button" and a.get("id") == "navToggle":
            self.menu_toggle = self._start_tag_attrs(a)
        if tag == "div" and a.get("id") == "menuOverlay":
            self.menu_overlay = self._start_tag_attrs(a)
        self._index += 1

    @staticmethod
    def _start_tag_attrs(a: dict[str, str | None]) -> dict[str, str | None]:
        return {
            "id": a.get("id"),
            "aria-label": a.get("aria-label"),
            "aria-expanded": a.get("aria-expanded"),
            "aria-controls": a.get("aria-controls"),
            "aria-hidden": a.get("aria-hidden"),
        }

    def handle_data(self, data: str) -> None:
        if self._link is not None:
            self._link["text"].append(data.strip())

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._link is not None:
            text = " ".join(part for part in self._link["text"] if part)
            if text:
                self.nav_links.append((text, self._link["href"]))
            self._link = None
        elif tag == "nav":
            self._in_nav = False
        elif tag == "main":
            self._in_main = False
        elif tag == "section" and self._in_cover:
            self._in_cover = False

    def token(self, name: str) -> bool:
        """Vrai si au moins un élément porte cette classe (classe entière, sans modificateur)."""
        return name in self.classes


class RenderedPage:
    """Page servie par l'application : HTML brut + structure relevée."""

    def __init__(self, route: str, html: str) -> None:
        self.route = route
        self.html = html
        self.dom = PageParser()
        self.dom.feed(html)

    @property
    def main_html(self) -> str:
        match = re.search(r"<main\b[^>]*>(.*?)</main>", self.html, re.S)
        return match.group(1) if match else ""

    @property
    def footer_html(self) -> str:
        match = re.search(r"<footer\b.*?</footer>", self.html, re.S)
        return match.group(0) if match else ""

    def section(self, page_class: str) -> str | None:
        match = re.search(
            rf'<section\b[^>]*class="[^"]*\b{re.escape(page_class)}(?![\w-])[^"]*"[^>]*>(.*?)</section>',
            self.html,
            re.S,
        )
        return match.group(1) if match else None

    def final_cta_blocks(self) -> list[str]:
        return re.findall(r'class="[^"]*\bp-final(?![\w-])', self.html)


# --------------------------------------------------------------------- fixtures


@pytest.fixture()
def site_db(tmp_path: Path) -> Path:
    return tmp_path / "site.db"


@pytest.fixture()
def client(site_db: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("SESSION_SECRET", "secret-de-test")
    monkeypatch.setenv("ADMIN_PASSWORD", "mot-de-passe-de-test")
    monkeypatch.setenv("SYNC_TOKEN", "jeton-de-test")
    application = create_app(site_db)
    with TestClient(application) as test_client:
        yield test_client


@pytest.fixture()
def seeded(site_db: Path) -> Iterator[None]:
    """Contenu minimal : accueil, deux listes, contact, un service, deux réalisations."""
    conn = connect(site_db)
    init_db(conn)

    def add(kind: str, slug: str, **kwargs) -> None:
        sections = kwargs.pop("sections", []) or []
        values = {"title": kwargs.pop("title", slug.title()), "kind": kind, "status": kwargs.pop("status", repo.PUBLISHED)}
        values.update(kwargs)
        page_id = repo.create_page(conn, {"slug": slug, **values})
        for index, section in enumerate(sections):
            repo.create_section(conn, page_id, {**section, "position": index})
        conn.commit()

    add(
        "accueil",
        "accueil",
        title="Sujee Design",
        seo_description="Designer et directeur artistique a Paris.",
        sections=[
            {
                "type": "hero",
                "variant": "accueil",
                "data": {
                    "rotator": ["Design ta marque"],
                    "ctas": [
                        {"label": "Voir les realisations", "href": "/realisations", "style": "pill--filled"},
                        {"label": "Un projet ? Parlons-en", "href": "/contact", "style": "pill"},
                    ],
                },
            },
            {
                "type": "chapter",
                "data": {
                    "kicker": "01 Portee",
                    "title": "Une marque, de A a Z",
                    "body": "<p>Identite, site web et creation visuelle.</p>",
                    "list": ["Identite de marque", "Site web"],
                },
            },
            {
                "type": "cta-final",
                "variant": "accueil",
                "data": {
                    "title_lines": ["Parlons de votre projet"],
                    "shader": True,
                    "ctas": [
                        {"label": "Ecrire un mot", "href": "/contact", "style": "pill--filled"},
                        {"label": "LinkedIn", "href": "https://www.linkedin.com/in/sujeepan-sabesan", "style": "text-link"},
                        {"label": "Revenir en haut", "href": "#hero", "style": "text-link"},
                    ],
                },
            },
        ],
    )
    add(
        "page",
        "realisations",
        title="Realisations",
        in_menu=1,
        menu_position=1,
        menu_label="Realisations",
        seo_description="Selection de projets.",
        sections=[
            {"type": "hero", "variant": "simple", "data": {"kicker": "Portfolio", "title": "Toutes les realisations"}},
            {"type": "realisations-grid", "variant": "auto", "data": {"heading_lines": ["Selection"]}},
            {
                "type": "cta-final",
                "variant": "interne",
                "data": {
                    "kicker": "Contact",
                    "title": "Un projet en tete ?",
                    "shader": True,
                    "ctas": [{"label": "Parlons-en", "href": "/contact", "style": "pill--filled"}],
                },
            },
        ],
    )
    add(
        "page",
        "services",
        title="Services",
        in_menu=1,
        menu_position=2,
        menu_label="Services",
        seo_description="Prestations de design.",
        sections=[
            {"type": "hero", "variant": "simple", "data": {"kicker": "Prestations", "title": "Ce que je fais"}},
            {"type": "services-list", "variant": "auto", "data": {"title": "Prestations"}},
            {
                "type": "cta-final",
                "variant": "interne",
                "data": {
                    "kicker": "Contact",
                    "title": "Un besoin precis ?",
                    "shader": True,
                    "ctas": [{"label": "Demander un devis", "href": "/contact", "style": "pill--filled"}],
                },
            },
        ],
    )
    add(
        "page",
        "contact",
        title="Contact",
        in_menu=1,
        menu_position=3,
        menu_label="Contact",
        seo_description="Prendre contact.",
        sections=[
            {"type": "hero", "variant": "simple", "data": {"kicker": "Contact", "title": "Parlons-en"}},
            {
                "type": "formulaire-contact",
                "data": {
                    "title": "Votre projet",
                    "aside_title": "Infos pratiques",
                    "columns": [
                        {"title": "Disponibilite", "body": "<p>Paris et visio.</p>"},
                        {"title": "Coordonnees", "body": '<ul class="list-check"><li>contact@exemple.fr</li></ul>'},
                    ],
                },
            },
        ],
    )
    add(
        "service",
        "identite",
        title="Identite de marque",
        num=1,
        excerpt="Strategie, logo et systeme visuel.",
        seo_description="Prestation d'identite de marque.",
        sections=[
            {"type": "hero", "variant": "page", "data": {"kicker": "Service", "title": "Identite de marque"}},
            {
                # Visuel distant : la règle « une image distante déclare ses
                # dimensions » reste exercée par le rendu (cf.
                # `test_remote_images_declare_intrinsic_size`).
                "type": "banniere",
                "data": {"src": "https://images.sujeedesign.com/service-identite.jpg", "alt": "Planche d'identite visuelle"},
            },
            {
                "type": "chapter",
                "data": {"kicker": "02 Methode", "title": "Comment ca se passe", "list": ["Atelier", "Pistes", "Livrables"]},
            },
            {
                "type": "cta-final",
                "variant": "interne",
                "data": {
                    "kicker": "Contact",
                    "title": "Parlons de votre marque",
                    "shader": True,
                    "ctas": [{"label": "Demander un devis", "href": "/contact", "style": "pill--filled"}],
                },
            },
        ],
    )
    for slug, title, artwork, excerpt, cta_title, hero_alt in (
        ("vaasam-paris", "Vaasam Paris", "project-vaasam.svg", "Identite et direction artistique.", "Un projet comme celui-ci ?", "Visuel du projet Vaasam Paris"),
        # Second visuel volontairement décoratif (alt vide) pour couvrir le cas autorisé.
        ("rfa", "RFA", "project-rfa.svg", "Refonte du systeme visuel.", "Une marque a relancer ?", ""),
    ):
        cover = f"/assets/projects/{artwork}"
        add(
            "realisation",
            slug,
            title=title,
            client=title,
            year=2026,
            categories=["Identite"],
            excerpt=excerpt,
            cover=cover,
            cover_alt=f"Visuel du projet {title}",
            seo_description=excerpt,
            sections=[
                {
                    "type": "hero",
                    "variant": "projet",
                    "data": {"title": title, "intro": excerpt, "cover": cover, "cover_alt": hero_alt},
                },
                {
                    "type": "etude-de-cas",
                    "data": {
                        "blocks": [
                            {"kind": "liste", "title": "Mission", "items": ["Identite", "Logo", "Systeme visuel"]},
                            {"kind": "texte", "title": "Approche", "body": "<p>Un travail de fond sur la marque.</p>"},
                        ]
                    },
                },
                {
                    "type": "cta-final",
                    "variant": "interne",
                    "data": {
                        "kicker": "Contact",
                        "title": cta_title,
                        "shader": True,
                        "ctas": [{"label": "Ecrire un mot", "href": "/contact", "style": "pill--filled"}],
                    },
                },
            ],
        )

    yield
    conn.close()


@pytest.fixture()
def rendered(client: TestClient, seeded: None) -> dict[str, RenderedPage]:
    """Rendu de toutes les routes publiques du jeu de données."""
    pages: dict[str, RenderedPage] = {}
    for route in PUBLIC_ROUTES:
        response = client.get(route)
        assert response.status_code == 200, f"{route} n'est pas servi (code {response.status_code})"
        pages[route] = RenderedPage(route, response.text)
    return pages


# ------------------------------------------------------------------ harmonisation


def test_public_routes_are_served(rendered: dict[str, RenderedPage]) -> None:
    # Ancien inventaire de fichiers .html : devenu l'inventaire des routes publiques servies.
    assert set(rendered) == set(PUBLIC_ROUTES)
    for route, page in rendered.items():
        assert "main-content" in page.html, f"coquille de page absente sur {route}"


def test_each_page_has_one_h1_and_one_main(rendered: dict[str, RenderedPage]) -> None:
    for route, page in rendered.items():
        assert page.dom.h1_count == 1, f"{route} : un seul h1 attendu"
        assert len(page.dom.main_ids) == 1, f"{route} : un seul <main> attendu"


def test_each_page_h1_is_inside_main(rendered: dict[str, RenderedPage]) -> None:
    for route, page in rendered.items():
        assert page.dom.h1_in_main_count == 1, f"{route} : le h1 doit être dans <main>"


def test_pages_do_not_embed_per_page_style_blocks(rendered: dict[str, RenderedPage]) -> None:
    # Pendant de `do_not_repeat_inline_styles` : les gabarits partagés ne recopient plus
    # de CSS dans la page (attributs style="" limités aux variables de gabarit admises).
    for route, page in rendered.items():
        assert page.dom.style_blocks == 0, f"{route} : bloc <style> embarqué dans la page"


def test_home_and_services_share_editorial_primitives(rendered: dict[str, RenderedPage]) -> None:
    for route in (HOME_ROUTE, "/services", SERVICE_DETAIL_ROUTE):
        page = rendered[route]
        assert page.dom.token("container"), f"{route} : conteneur éditorial partagé manquant"
        assert page.dom.token("pill--filled"), f"{route} : action principale partagée manquante"


def test_listing_and_contact_pages_share_accessible_shell(rendered: dict[str, RenderedPage]) -> None:
    for route in (*LISTING_ROUTES, CONTACT_ROUTE):
        page = rendered[route]
        assert "/assets/site.css" in page.dom.stylesheets, f"{route} : feuille partagée manquante"
        assert page.dom.main_ids == ["main-content"], f"{route} : identifiant du contenu principal"
        assert page.dom.h1_in_main_count == 1, f"{route} : un h1 dans le contenu principal"
        assert "#main-content" in page.dom.skip_links, f"{route} : lien d'évitement manquant"


def test_project_pages_use_shared_project_shell(rendered: dict[str, RenderedPage]) -> None:
    for route in PROJECT_ROUTES:
        page = rendered[route]
        for required in ("project-cover", "project-content", "p-final"):
            assert page.dom.token(required), f"{route} : classe {required} manquante"


def test_every_page_loads_shared_stylesheet(rendered: dict[str, RenderedPage]) -> None:
    for route, page in rendered.items():
        assert "/assets/site.css" in page.dom.stylesheets, f"{route} : /assets/site.css non chargée"


def test_primary_navigation_destinations_match(rendered: dict[str, RenderedPage]) -> None:
    expected = [("Realisations", "/realisations"), ("Services", "/services"), ("Contact", "/contact")]
    for route, page in rendered.items():
        assert page.dom.nav_links, f"{route} : la navigation principale doit contenir des liens"
        assert page.dom.nav_links == expected, f"{route} : destinations de navigation inattendues"


def test_primary_cta_uses_filled_style_on_every_page(rendered: dict[str, RenderedPage]) -> None:
    for route, page in rendered.items():
        assert page.dom.token("pill--filled"), (
            f"{route} : chaque page doit porter une action principale avec le style partagé pill--filled"
        )


# -------------------------------------------------- CTA : une seule géométrie


def test_interactive_ctas_have_square_corners() -> None:
    """Décision de recette : plus aucun coin arrondi sur un contrôle du site.

    Les jetons de rayon valent déjà 0px pour les cartes, les images et les
    champs. Les boutons et les étiquettes suivent : sans cela, le système garde
    une exception arrondie isolée.
    """
    css_text = SITE_CSS.read_text(encoding="utf-8")
    assert re.search(r"--radius-buttons:\s*0px", css_text), "boutons non carrés dans les jetons"
    assert re.search(r"--radius-tags:\s*0px", css_text), "étiquettes non carrées dans les jetons"
    assert "border-radius:75px" not in css_text, "rayon arrondi résiduel sur un contrôle"
    assert "border-radius:999px" not in css_text, "rayon arrondi résiduel sur un contrôle"


def test_cta_variants_share_one_geometry() -> None:
    """Les deux variantes de bouton partagent boîte, hauteur, padding et flèche."""
    css_text = SITE_CSS.read_text(encoding="utf-8")
    rules: dict[str, str] = {}
    for variant in ("pill", "pill--filled"):
        match = re.search(rf"\.{variant}\{{([^}}]*)\}}", css_text)
        assert match is not None, f"règle .{variant} manquante"
        rules[variant] = match.group(1).replace(" ", "")
    for variant, rule in rules.items():
        assert "display:inline-flex" in rule, f".{variant} : même boîte pour les deux variantes"
        assert "min-height:48px" in rule, f".{variant} : hauteur de contrôle unifiée"
        assert "padding:14px32px" in rule, f".{variant} : padding unifié"
        assert "font-size:16px" in rule, f".{variant} : corps de texte unifié"
        assert "font-weight:500" in rule, f".{variant} : graisse unifiée"
        assert "gap:12px" in rule, f".{variant} : écart à la flèche unifié"
        assert "border-radius:var(--radius-buttons)" in rule, f".{variant} : rayon unifié"


def test_cta_labels_use_only_the_shared_styles(rendered: dict[str, RenderedPage]) -> None:
    allowed = {"pill", "pill--filled", "text-link"}
    for route, page in rendered.items():
        for match in re.finditer(r'<a\b[^>]*class="([^"]*)"[^>]*>', page.html):
            classes = set(match.group(1).split())
            if classes & allowed:
                assert classes <= allowed, f"{route} : style de CTA hors du jeu partagé ({match.group(1)})"


def test_primary_cta_keeps_its_filled_style_on_dark_backgrounds() -> None:
    """L'action principale reste ambre, même sur les fonds animés.

    La règle « boutons pâles » cible les fonds sombres et aurait écrasé la
    variante pleine (specificité .p-final .pill > .pill--filled) : elle doit donc
    exclure explicitement `.pill--filled` (cas du bouton d'envoi du formulaire,
    qui porte les deux classes).
    """
    css_text = SITE_CSS.read_text(encoding="utf-8")
    for selector in re.findall(r"([^{}]*\.hero \.pill[^{}]*)\{", css_text):
        assert ":not(.pill--filled)" in selector, f"sélecteur trop large : {selector.strip()}"
    assert not re.search(r"\.p-final \.pill(?!:not)\{", css_text), "un fond pâle écraserait la variante pleine"


def test_seed_ctas_follow_the_shared_hierarchy() -> None:
    """Le contenu livré respecte la hiérarchie : une action principale pleine par
    section, le reste en secondaire, et un lien externe reste un lien texte."""
    payload = json.loads((ROOT / "seed" / "content.json").read_text(encoding="utf-8"))
    sections_avec_cta = 0
    for page in payload["pages"]:
        for section in page["sections"]:
            ctas = (section.get("data") or {}).get("ctas") or []
            if not ctas:
                continue
            sections_avec_cta += 1
            styles = [cta.get("style", "pill") for cta in ctas]
            assert styles.count("pill--filled") <= 1, f"{page['slug']} : deux actions principales"
            for cta, style in zip(ctas, styles):
                assert style in {"pill", "pill--filled", "text-link"}, f"style inconnu : {style}"
                if (cta.get("href") or "").startswith("http"):
                    assert style == "text-link", f"lien externe en bouton : {cta}"
    assert sections_avec_cta >= 5, "jeu de données trop pauvre pour exercer la règle"


def test_text_link_ctas_never_render_an_arrow(rendered: dict[str, RenderedPage]) -> None:
    """Un lien texte reste un lien : pas de flèche ajoutée par le conteneur."""
    for route, page in rendered.items():
        for match in re.finditer(r'<a\b[^>]*class="[^"]*\btext-link\b[^"]*"[^>]*>(.*?)</a>', page.html, re.S):
            assert "\u2192" not in match.group(1), f"{route} : un lien texte porte une flèche"


def test_final_cta_reuses_the_shared_cta_macro() -> None:
    template = (ROOT / "theme" / "templates" / "sections" / "cta_final.html").read_text(encoding="utf-8")
    assert "partials/macros.html" in template, "le CTA final doit passer par la macro partagée"
    assert "ctas(" in template, "le CTA final doit appeler la macro ctas"


# ------------------------------------------------- hero d'accueil : contenu


def test_home_hero_has_no_portrait(rendered: dict[str, RenderedPage]) -> None:
    page = rendered[HOME_ROUTE]
    # Le hero d'accueil est un <header class="hero">, pas une <section>.
    header = re.search(r'<header class="hero"[^>]*>(.*?)</header>', page.html, re.S)
    assert header is not None, "hero d'accueil absent"
    hero = header.group(1)
    assert "hero-figure" not in hero and "hero-photo" not in hero, "portrait encore rendu dans le hero"
    assert "<img" not in hero, "le hero d'accueil n'affiche plus d'image"
    assert "hero-figure" not in page.html and "hero-photo" not in page.html, "portrait encore rendu sur la page"


def test_home_hero_styles_describe_no_portrait() -> None:
    css_text = SITE_CSS.read_text(encoding="utf-8")
    assert ".hero-figure" not in css_text, "règles du portrait encore déclarées"
    assert ".hero-photo" not in css_text, "règles du portrait encore déclarées"
    assert "floaty" not in css_text, "animations du portrait encore déclarées"
    script = (ROOT / "theme" / "assets" / "site.js").read_text(encoding="utf-8")
    assert "heroFigure" not in script and "heroPhoto" not in script, "le script pilote encore un portrait"


def test_home_hero_content_is_centered() -> None:
    """Le contenu du hero d'accueil est centré à toutes les largeurs."""
    css_text = SITE_CSS.read_text(encoding="utf-8")
    rules = re.findall(r"\.hero-inner\{([^}]*)\}", css_text)
    assert rules, "règle .hero-inner absente"
    assert "text-align:center" in rules[0], "le contenu du hero doit rester centré"
    for rule in rules:
        assert "text-align:left" not in rule, "le hero est remis en colonne de gauche"
        assert "align-items:flex-start" not in rule, "le hero est remis en colonne de gauche"
    assert re.search(r"\.hero-ctas\{[^}]*justify-content:center", css_text), "actions du hero non centrées"
    assert not re.search(r"\.hero \.hero-ctas\{[^}]*justify-content:flex-start", css_text), (
        "actions du hero alignées à gauche"
    )
    assert ".hero::before" not in css_text, "voile latéral du portrait encore en place"


def test_every_page_has_a_skip_link_to_main(rendered: dict[str, RenderedPage]) -> None:
    for route, page in rendered.items():
        assert "#main-content" in page.dom.skip_links, f"{route} : lien d'évitement manquant"


def test_skip_link_is_first_focusable_control(rendered: dict[str, RenderedPage]) -> None:
    for route, page in rendered.items():
        assert page.dom.focusable, f"{route} : aucun élément focusable"
        assert page.dom.focusable[0] == ("a", "#main-content"), f"{route} : le lien d'évitement doit venir en premier"
        assert page.dom.skip_index < page.dom.nav_index, f"{route} : le lien d'évitement doit précéder la navigation"
        assert page.dom.main_ids == ["main-content"]


def test_every_page_shares_the_same_final_cta(rendered: dict[str, RenderedPage]) -> None:
    for route, page in rendered.items():
        assert 'class="page-cta"' not in page.html, f"{route} : ancien CTA de page encore présent"
        assert page.final_cta_blocks(), f"{route} : section de CTA partagée (p-final) manquante"
        assert len(page.final_cta_blocks()) == 1, f"{route} : une seule section de CTA partagée par page"


def test_mobile_menu_is_accessible_on_every_page(client: TestClient, rendered: dict[str, RenderedPage]) -> None:
    for route, page in rendered.items():
        assert re.search(r'id="menuOverlay"[^>]*aria-hidden="true"', page.html), f"{route} : menu fermé au chargement"
        toggle = page.dom.menu_toggle
        assert toggle is not None, f"{route} : bouton de menu manquant"
        assert (toggle.get("aria-label") or "").strip(), f"{route} : le bouton de menu doit porter un aria-label"
        assert toggle.get("aria-expanded") == "false", f"{route} : état du menu exposé par aria-expanded"
        assert toggle.get("aria-controls") == "menuOverlay", f"{route} : le bouton doit cibler l'overlay"
        assert page.dom.menu_overlay is not None, f"{route} : overlay de menu manquant"

    # Le comportement vit désormais dans une seule ressource partagée, servie par l'app.
    script = client.get(SITE_JS_ROUTE).text
    script_assertions = (
        ('overlay.setAttribute("aria-hidden"', "l'état du menu doit être exposé aux lecteurs d'écran"),
        ('"Fermer le menu"', "le libellé du bouton doit suivre l'état du menu"),
        ('e.key === "Escape"', "Échap doit fermer le menu"),
        ("focusables", "le focus doit rester piégé dans le menu ouvert"),
        ("toggle.focus()", "fermer le menu doit rendre le focus au bouton"),
    )
    for needle, message in script_assertions:
        assert needle in script, message


def test_heading_hierarchy_is_sequential(rendered: dict[str, RenderedPage]) -> None:
    for route, page in rendered.items():
        levels = page.dom.headings
        assert levels[0] == 1, f"{route} : la page commence par son h1"
        assert levels.count(1) == 1, f"{route} : un seul h1 par page"
        for previous, current in zip(levels, levels[1:]):
            assert current - previous <= 1, f"{route} : saut de niveau {previous} vers {current}"


def test_heading_tags_are_balanced(rendered: dict[str, RenderedPage]) -> None:
    for route, page in rendered.items():
        assert Counter(re.findall(r"<(h[1-6])\b", page.html)) == Counter(re.findall(r"</(h[1-6])>", page.html)), (
            f"{route} : balise de titre mal fermée"
        )


def test_footer_headings_share_one_level(rendered: dict[str, RenderedPage]) -> None:
    for route, page in rendered.items():
        levels = set(re.findall(r"<(h[1-6])\b", page.footer_html))
        assert levels == {"h3"}, f"{route} : les colonnes du pied de page partagent le niveau h3 (vu : {sorted(levels)})"


def test_shared_stylesheet_defines_every_token_it_uses() -> None:
    css_text = SITE_CSS.read_text(encoding="utf-8")
    defined = set(re.findall(r"(--[\w-]+)\s*:", css_text))
    used = set(re.findall(r"var\((--[\w-]+)", css_text))
    missing = used - defined - INLINE_VARIABLES
    assert missing == set(), "variables CSS utilisées mais non définies : " + ", ".join(sorted(missing))


def test_shared_stylesheet_declares_animations_once_and_plays_only_declared_ones() -> None:
    """Chaque `@keyframes` est déclaré une fois, et le nom joué existe vraiment.

    Une déclaration imbriquée par erreur (`@keyframes x{@keyframes x{…}}`) est
    ignorée par le navigateur : l'animation est morte sans le moindre message.
    Le contrôle porte donc sur les deux sens : pas de doublon, et correspondance
    exacte entre les noms joués par `animation:` et les noms déclarés.
    """
    css_text = SITE_CSS.read_text(encoding="utf-8")
    declared = re.findall(r"@keyframes\s+([\w-]+)", css_text)
    duplicates = sorted({name for name in declared if declared.count(name) > 1})
    assert duplicates == [], "animation déclarée deux fois (donc jamais jouée) : " + ", ".join(duplicates)

    played: set[str] = set()
    for raw in re.findall(r"animation:\s*([^;}]+)", css_text):
        name = (raw.strip().split() or [""])[0]
        if not name or name.startswith("none"):
            continue
        played.add(name)

    assert played - set(declared) == set(), "animation jouée mais non déclarée : " + ", ".join(sorted(played - set(declared)))
    assert set(declared) - played == set(), "animation déclarée mais jamais jouée : " + ", ".join(sorted(set(declared) - played))


def test_contact_page_puts_the_form_in_a_card_beside_a_labelled_aside(rendered: dict[str, RenderedPage]) -> None:
    """Le formulaire vit dans une carte, la colonne d'infos vient en regard.

    La colonne est un `<aside>` nommé par son titre, ses blocs sont des h3 (le
    titre de la colonne reste le h2 de la section) : la hiérarchie de titres
    reste séquentielle, ce que vérifie par ailleurs
    `test_heading_hierarchy_is_sequential`.
    """
    page = rendered[CONTACT_ROUTE]
    assert page.dom.token("contact-form-wrap"), "le formulaire doit être posé dans sa carte"
    assert page.html.index("contact-form-wrap") < page.html.index("contact-aside"), "la carte du formulaire précède la colonne d'infos"
    assert page.dom.token("contact-aside"), "la colonne d'informations pratiques doit être rendue"

    aside = re.search(r"<aside\b[^>]*>(.*?)</aside>", page.html, re.S)
    assert aside is not None, "colonne d'infos absente"
    ouvrant = page.html[: aside.start()]
    assert re.search(r'<aside[^>]*aria-labelledby="contact-aside-title"', ouvrant + page.html[aside.start() : aside.start() + 200]), (
        "la colonne doit être nommée par son titre"
    )
    assert re.search(r'<h2[^>]*id="contact-aside-title"[^>]*>\s*Infos pratiques', page.html), "titre de colonne manquant"
    blocs = re.findall(r'class="[^"]*\bcontact-aside-block\b[^"]*"', page.html)
    assert len(blocs) == 2, f"un bloc par colonne du back office attendu (vu {len(blocs)})"
    for titre in ("Disponibilite", "Coordonnees"):
        assert re.search(rf"<h3>\s*{titre}\s*</h3>", page.html), f"le titre de bloc {titre} doit être un h3"

    # Les champs qui occupent toute la largeur de la carte sont marqués dans le gabarit.
    assert page.html.count("field--wide") >= 4, "type de projet, message, consentement et envoi occupent toute la largeur"
    assert "<style" not in page.html, "aucun style embarqué : la mise en page vit dans la feuille partagée"


def test_every_animation_selector_has_a_reduced_motion_escape() -> None:
    """Aucune animation ne doit échapper à `prefers-reduced-motion`.

    Le bloc dédié neutralise toutes les animations (durée 0,01 ms, une seule
    itération) ; ce test garantit qu'il reste présent et qu'il continue de
    couvrir les sélecteurs animés par des règles ciblées.
    """
    css_text = SITE_CSS.read_text(encoding="utf-8")
    bloc = re.search(r"@media \(prefers-reduced-motion:reduce\)\{(.*?)\n\}", css_text, re.S)
    assert bloc is not None, "bloc prefers-reduced-motion manquant"
    contenu = bloc.group(1)
    assert re.search(r"\*,\*::before,\*::after\{[^}]*animation-duration:\.01ms !important", contenu), (
        "les animations ne sont pas ramenées à une durée nulle sous mouvement réduit"
    )
    for selecteur in (".project-cover__media", ".p-banner .visual", ".marquee-track", ".reveal"):
        assert selecteur in contenu, f"{selecteur} échappe au mouvement réduit"


def test_footer_links_expose_touch_targets() -> None:
    match = re.search(r"\.footer a\s*\{([^}]*)\}", SITE_CSS.read_text(encoding="utf-8"))
    assert match is not None, "les liens du pied de page doivent avoir une règle dédiée"
    assert re.search(r"min-height:\s*44px", match.group(1)), "zone de tap d'au moins 44px pour les liens du pied de page"


def test_meta_line_stays_legible_on_dark_heroes() -> None:
    match = re.search(r"\.p-meta\s*\{([^}]*)\}", SITE_CSS.read_text(encoding="utf-8"))
    assert match is not None, "règle .p-meta manquante"
    assert not re.search(r"color:\s*var\(--color-paper\)", match.group(1)), "métadonnées illisibles sur fond noir"


def test_home_hero_fits_short_phone_screens() -> None:
    """Le premier écran de l'accueil contient le titre et les actions, sans portrait.

    Sur un petit téléphone (375x667), le rythme vertical est resserré pour que
    le titre et les actions restent au-dessus de la ligne de flottaison. Le
    portrait ayant quitté le hero, il n'y a plus de hauteur d'image à plafonner.
    """
    css_text = SITE_CSS.read_text(encoding="utf-8")
    block = re.search(r"@media \(max-width:720px\) and \(max-height:760px\)\{(.*?)\n\}", css_text, re.S)
    assert block is not None, "aucune règle pour les écrans courts"
    rules = block.group(1).replace(" ", "")
    assert ".hero-figure" not in rules, "le hero n'a plus de portrait à plafonner"
    assert re.search(r"\.hero-title\{[^}]*font-size", rules), "titre du hero non resserré sur écran court"
    assert re.search(r"\.hero\.hero-ctas\{[^}]*margin-top", rules) or ".hero.hero-ctas{" in rules, (
        "actions du hero non resserrées sur écran court"
    )


def test_remote_images_declare_intrinsic_size(rendered: dict[str, RenderedPage]) -> None:
    # Le visuel distant du bandeau (jeu de données) exerce réellement la règle.
    for route, page in rendered.items():
        for image in page.dom.images:
            if not (image["src"] or "").startswith(("http://", "https://")):
                continue
            assert re.fullmatch(r"\d+", image["width"] or ""), f"{route} : image distante sans largeur ({image['src']})"
            assert re.fullmatch(r"\d+", image["height"] or ""), f"{route} : image distante sans hauteur ({image['src']})"


def test_chapter_sections_render_chapter_structure(rendered: dict[str, RenderedPage]) -> None:
    for route in CHAPTER_ROUTES:
        page = rendered[route]
        assert page.dom.token("s-chap"), f"{route} : classe de chapitre s-chap manquante"
        assert "chap-title" in page.html, f"{route} : titre de chapitre chap-title manquant"
    assert "chap-title" not in rendered["/realisations"].html, "aucun chapitre attendu sur la liste des réalisations"


def test_editorial_content_has_no_em_dash(rendered: dict[str, RenderedPage]) -> None:
    # Le tiret cadratin reste réservé aux libellés système (titre de page, pied de page, navigation).
    for route, page in rendered.items():
        assert "\u2014" not in page.main_html, f"{route} : tiret cadratin dans le contenu éditorial"


def test_seo_and_viewport_meta_are_declared(rendered: dict[str, RenderedPage]) -> None:
    for route, page in rendered.items():
        canonical = re.search(r'<link rel="canonical" href="([^"]+)"', page.html)
        assert canonical is not None and canonical.group(1).startswith("https://"), f"{route} : canonical manquante"
        description = re.search(r'<meta name="description" content="([^"]*)"', page.html)
        assert description is not None and description.group(1).strip(), f"{route} : meta description vide"
        viewport = re.search(r'<meta name="viewport" content="([^"]+)"', page.html)
        assert viewport is not None and "width=device-width" in viewport.group(1), f"{route} : meta viewport manquante"


def test_non_decorative_images_declare_alt_text(rendered: dict[str, RenderedPage]) -> None:
    for route, page in rendered.items():
        for image in page.dom.images:
            alt = image["alt"]
            assert alt is not None, f"{route} : attribut alt absent sur {image['src']}"
            if alt.strip():
                continue
            assert image["aria-hidden"] == "true", f"{route} : image décorative sans aria-hidden ({image['src']})"


def test_no_internal_link_points_to_a_html_url(rendered: dict[str, RenderedPage]) -> None:
    # Le site utilise des URLs propres : plus aucun lien interne en .html.
    for route, page in rendered.items():
        for href in page.dom.links:
            if href.startswith(("http://", "https://", "mailto:", "#")):
                continue
            assert not href.endswith(".html"), f"{route} : lien interne en .html ({href})"


# ------------------------------------------------------------------ pages projet


def test_project_pages_share_the_same_final_cta_pattern(client: TestClient, rendered: dict[str, RenderedPage]) -> None:
    script = client.get(SITE_JS_ROUTE).text
    assert "var shaderCanvases" in script, "script shader non chargé"
    for route, page in rendered.items():
        assert 'id="pFinalShader"' in page.html or 'id="contactShader"' in page.html, f"{route} : canvas shader du CTA final manquant"
        # l'accueil porte le fond iridescent via .p-final--home::before, les autres via #pFinalBg
        assert 'id="pFinalBg"' in page.html or "p-final--home" in page.html, f"{route} : fond iridescent du CTA final manquant"
        if route == CONTACT_ROUTE:
            assert "p-final--contact" in page.html, f"{route} : la page contact doit porter le fond p-final"
        else:
            assert "p-final-cta" in page.html, f"{route} : conteneur de CTA commun manquant"
        assert 'class="page-cta"' not in page.html, f"{route} : ancien CTA de page encore présent"
        assert "<h4>" not in page.html, f"{route} : pied de page en h3 partout"
        assert set(re.findall(r"<(h[1-6])\b", page.footer_html)) == {"h3"}, f"{route} : pied de page partagé en h3"
        assert len(re.findall(r"<h1\b", page.html)) == 1, f"{route} : un seul h1 par page"


def test_every_project_page_has_one_cover_and_content_in_order(rendered: dict[str, RenderedPage]) -> None:
    for route in PROJECT_ROUTES:
        dom = rendered[route].dom
        assert dom.h1_count == 1, f"{route} : une page projet doit avoir un h1 unique"
        assert dom.cover_position >= 0, f"{route} : hero plein écran manquant"
        assert dom.cover_image_position > dom.cover_position, f"{route} : le visuel doit être dans le hero"
        assert dom.content_position > dom.cover_image_position, f"{route} : le contenu doit suivre le hero"
        assert dom.cover_image is not None
        # Adapté du legacy (alt="" en dur) : le visuel d'ambiance est masqué aux technologies
        # d'assistance ; son alt éditorial vient du champ cover_alt et reste facultatif.
        assert dom.cover_image["aria-hidden"] == "true", f"{route} : le visuel d'ambiance ne doit pas être annoncé"
        assert isinstance(dom.cover_image["alt"], str), f"{route} : attribut alt attendu sur le visuel d'ambiance"


def test_each_cover_uses_its_own_fluid_artwork(client: TestClient, rendered: dict[str, RenderedPage]) -> None:
    for route, artwork in PROJECT_ROUTES.items():
        dom = rendered[route].dom
        assert dom.cover_image is not None, f"{route} : visuel plein écran introuvable"
        src = dom.cover_image["src"] or ""
        assert Path(src).name == f"project-{artwork}.svg", f"{route} : visuel attendu project-{artwork}.svg (vu {src})"
        # Le visuel référencé est bien servi par l'application, avec ses métadonnées d'accessibilité.
        response = client.get(src)
        assert response.status_code == 200, f"{route} : visuel non servi par l'application ({src})"
        svg = response.text
        assert "<title" in svg, f"{route} : visuel sans <title>"
        assert "<desc" in svg, f"{route} : visuel sans <desc>"
        assert "feTurbulence" in svg, f"{route} : le visuel doit avoir une texture fluide, pas une illustration géométrique"


def test_cover_and_content_follow_reference_tokens_and_responsive_rules() -> None:
    styles = SITE_CSS.read_text(encoding="utf-8")
    assert re.search(r"\.project-cover\s*\{[^}]*min-height:\s*100svh", styles)
    assert ".project-cover__media" in styles
    assert re.search(r"@media\s*\(max-width:\s*720px\)[\s\S]*?\.project-cover", styles)
    assert re.search(r"\.project-page\s+\.project-content\s*\{[^}]*background:var\(--project-paper\);color:var\(--project-ink\)", styles)
    assert re.search(r"@media\s*\(prefers-reduced-motion:\s*reduce\)", styles)


def test_project_pages_share_the_same_editorial_structure_and_single_cta(rendered: dict[str, RenderedPage]) -> None:
    cta_headings: set[str] = set()
    for route in PROJECT_ROUTES:
        page = rendered[route]
        cover = page.section("project-cover")
        assert cover is not None, f"{route} : hero manquant"
        assert 'class="project-back"' in cover, f"{route} : lien de retour manquant dans le hero"
        assert 'href="/realisations"' in cover, f"{route} : le retour doit mener à /realisations (URL propre)"
        assert "p-meta" not in cover, f"{route} : éviter les métadonnées répétées dans le hero"
        assert "hero-ctas" not in cover, f"{route} : un seul CTA par page"
        assert page.html.count('class="project-back"') == 1, f"{route} : un seul lien de retour"

        content = page.section("project-content")
        assert content is not None, f"{route} : contenu éditorial du projet manquant"
        assert "Mission" in content, f"{route} : bloc Mission attendu"
        assert "Approche" in content, f"{route} : bloc Approche attendu"
        intro = re.search(r'<p\b[^>]*class="p-intro"[^>]*>(.*?)</p>', cover, re.S)
        assert intro is not None, f"{route} : introduction du hero manquante"
        assert intro.group(1) not in content, f"{route} : ne pas répéter l'introduction dans le contenu"

        final = re.search(r'<section class="p-final reveal">(.*?)</section>', page.html, re.S)
        assert final is not None, f"{route} : chaque page projet doit partager la section CTA p-final"
        cta = re.search(r'<h2 class="p-title[^>]*>(.*?)</h2>', final.group(1), re.S)
        assert cta is not None, f"{route} : le CTA p-final doit porter un titre"
        heading = re.sub(r"\s+", " ", cta.group(1)).strip()
        assert heading, f"{route} : le titre du CTA ne doit pas être vide"
        cta_headings.add(heading)
        assert 'class="p-final-cta' in final.group(1), f"{route} : boutons du CTA final manquants"
        assert '<span aria-hidden="true">\u2192</span>' in final.group(1), f"{route} : pictogramme du CTA non masqué"
        assert 'class="page-cta"' not in page.html, f"{route} : l'ancien CTA de page est remplacé par p-final"
        assert "<h3>" in page.html, f"{route} : le pied de page partage la hiérarchie des titres"

    assert len(cta_headings) == len(PROJECT_ROUTES), "chaque page projet porte son propre titre de CTA"


def test_mobile_menu_updates_accessibility_and_keyboard_focus(client: TestClient, rendered: dict[str, RenderedPage]) -> None:
    script = client.get(SITE_JS_ROUTE).text
    assert 'overlay.setAttribute("aria-hidden", open ? "false" : "true")' in script
    assert 'e.key === "Escape"' in script
    assert "items[0].focus()" in script, "l'ouverture du menu doit déplacer le focus dans le menu"
    assert "})();" in script, "le script de navigation doit être syntaxiquement fermé"
    for route in PROJECT_ROUTES:
        assert re.search(r'id="menuOverlay"[^>]*aria-hidden="true"', rendered[route].html), f"{route} : menu ouvert au chargement"
