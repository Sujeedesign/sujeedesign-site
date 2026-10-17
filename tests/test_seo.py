"""SEO technique : inventaire public, sitemap, robots, canonical, Open Graph, JSON-LD.

Contrairement aux autres suites, ces tests tournent sur le contenu réel du dépôt
(`seed/content.json`) : ce sont les URLs publiées qui doivent être exactes.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from xml.etree import ElementTree

import pytest
from fastapi.testclient import TestClient

from app import repo
from app.db import connect, init_db
from app.seed import load_seed_file

ROOT = Path(__file__).resolve().parents[1]
SEED_FILE = ROOT / "seed" / "content.json"

# base_url du contenu : c'est elle qui doit apparaître dans canonical, sitemap, robots.
BASE = "https://sujeedesign.com"
SITEMAP_NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
LD_JSON_BLOCK = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)
NOT_FOUND_SLUG = "404"


@pytest.fixture()
def site(client: TestClient, db_file: Path) -> TestClient:
    """Client branché sur le contenu réel du dépôt."""
    conn = connect(db_file)
    try:
        init_db(conn)
        report = load_seed_file(conn, SEED_FILE)
    finally:
        conn.close()
    assert report["erreurs"] == [], report["erreurs"]
    assert report["pages_crees"], "le seed doit créer les pages de la base de test"
    return client


def published_pages(db_file: Path) -> list[dict[str, str]]:
    """Pages publiées en base : chemin, slug, nature, robots."""
    conn = connect(db_file)
    try:
        return [
            {
                "path": repo.page_path(row),
                "slug": str(row["slug"]),
                "kind": str(row["kind"]),
                "robots": str(row["robots"] or ""),
            }
            for row in repo.list_pages(conn, published_only=True, order="position, title")
        ]
    finally:
        conn.close()


def indexable_pages(db_file: Path) -> list[dict[str, str]]:
    return [page for page in published_pages(db_file) if "noindex" not in page["robots"]]


def ld_blocks(html: str) -> list[dict]:
    """Blocs JSON-LD d'une page, désérialisés."""
    return [json.loads(block) for block in LD_JSON_BLOCK.findall(html)]


def block_of_type(blocks: list[dict], type_name: str) -> dict:
    matching = [block for block in blocks if block.get("@type") == type_name]
    assert matching, f"aucun bloc JSON-LD {type_name} dans {[b.get('@type') for b in blocks]}"
    return matching[0]


# ------------------------------------------------------------- inventaire public


def test_every_published_page_is_served(site: TestClient, db_file: Path) -> None:
    pages = published_pages(db_file)
    assert len(pages) >= 15
    for page in pages:
        response = site.get(page["path"], follow_redirects=False)
        assert response.status_code == 200, f"{page['path']} -> {response.status_code}"


def test_noindex_page_is_not_indexable(site: TestClient, db_file: Path) -> None:
    hidden = [page for page in published_pages(db_file) if "noindex" in page["robots"]]
    assert hidden, "la page 404 doit rester en noindex"
    for page in hidden:
        assert page["slug"] == NOT_FOUND_SLUG
        assert page["path"] not in site.get("/sitemap.xml").text
    # Une URL inconnue sert le contenu de la page 404 avec le bon code et l'entête noindex.
    unknown = site.get("/cette-page-nexiste-pas", follow_redirects=False)
    assert unknown.status_code == 404
    assert unknown.headers.get("x-robots-tag") == "noindex"
    assert "Page introuvable" in unknown.text


def test_mentions_legales_page_is_reachable_indexable_and_linked(site: TestClient) -> None:
    response = site.get("/mentions-legales")
    assert response.status_code == 200
    assert "<h1" in response.text and "Mentions légales" in response.text
    # Le pied de page de toutes les pages pointe vers elle : elle ne doit pas être un 404.
    for path in ("/", "/realisations", "/contact"):
        assert 'href="/mentions-legales"' in site.get(path).text, path
    assert f"<loc>{BASE}/mentions-legales</loc>" in site.get("/sitemap.xml").text


# ------------------------------------------------------------------ sitemap / robots


def test_sitemap_lists_exactly_the_indexable_pages(site: TestClient, db_file: Path) -> None:
    body = site.get("/sitemap.xml").text
    assert body.startswith('<?xml version="1.0" encoding="UTF-8"?>')
    tree = ElementTree.fromstring(body)
    locations = [node.text for node in tree.findall("sm:url/sm:loc", SITEMAP_NS)]
    expected = {f"{BASE}{'/' if page['path'] == '/' else page['path']}" for page in indexable_pages(db_file)}
    assert set(locations) == expected
    assert f"{BASE}/" in locations


def test_sitemap_has_no_duplicate_url(site: TestClient) -> None:
    body = site.get("/sitemap.xml").text
    locations = [node.text for node in ElementTree.fromstring(body).findall("sm:url/sm:loc", SITEMAP_NS)]
    duplicates = {url for url in locations if locations.count(url) > 1}
    assert not duplicates, f"URLs en double dans le sitemap : {duplicates}"


def test_sitemap_urls_are_absolute_and_canonical(site: TestClient) -> None:
    body = site.get("/sitemap.xml").text
    for node in ElementTree.fromstring(body).findall("sm:url", SITEMAP_NS):
        loc = node.findtext("sm:loc", default="", namespaces=SITEMAP_NS)
        assert loc.startswith(f"{BASE}/"), loc
        assert not loc.endswith(".html"), loc


def test_robots_txt_is_consistent_with_the_sitemap(site: TestClient) -> None:
    response = site.get("/robots.txt")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    body = response.text
    assert "User-agent: *" in body
    assert "Disallow: /admin" in body
    assert "Disallow: /api/" in body
    assert f"Sitemap: {BASE}/sitemap.xml" in body
    assert site.get("/sitemap.xml").status_code == 200


# ------------------------------------------------------------------ canonical / head


def test_canonical_is_unique_absolute_and_matches_the_page(site: TestClient, db_file: Path) -> None:
    seen: dict[str, str] = {}
    for page in indexable_pages(db_file):
        html = site.get(page["path"]).text
        canonicals = re.findall(r'<link rel="canonical" href="([^"]*)"', html)
        assert len(canonicals) == 1, f"{page['path']} : {len(canonicals)} canonical"
        expected = f"{BASE}{'/' if page['path'] == '/' else page['path']}"
        assert canonicals[0] == expected, f"{page['path']} : canonical {canonicals[0]}"
        assert canonicals[0] not in seen, f"canonical partagée par {page['path']} et {seen[canonicals[0]]}"
        seen[canonicals[0]] = page["path"]


def test_titles_are_unique_and_non_empty(site: TestClient, db_file: Path) -> None:
    titles: dict[str, str] = {}
    for page in indexable_pages(db_file):
        html = site.get(page["path"]).text
        match = re.search(r"<title>(.*?)</title>", html, re.S)
        assert match is not None, f"{page['path']} : pas de <title>"
        title = match.group(1).strip()
        assert title, f"{page['path']} : title vide"
        assert title not in titles, f"title partagé par {page['path']} et {titles[title]}"
        titles[title] = page["path"]


def test_meta_description_is_present_on_every_indexable_page(site: TestClient, db_file: Path) -> None:
    for page in indexable_pages(db_file):
        html = site.get(page["path"]).text
        match = re.search(r'<meta name="description" content="([^"]*)"', html)
        assert match is not None, f"{page['path']} : pas de meta description"
        description = match.group(1).strip()
        assert len(description) >= 40, f"{page['path']} : description trop courte ({description!r})"


def test_open_graph_and_twitter_card_are_complete(site: TestClient, db_file: Path) -> None:
    for page in indexable_pages(db_file):
        html = site.get(page["path"]).text
        canonical_match = re.search(r'<link rel="canonical" href="([^"]*)"', html)
        assert canonical_match is not None, f"{page['path']} : canonical absente"
        canonical = canonical_match.group(1)
        for pattern in (
            r'<meta property="og:type" content="[^"]+"',
            r'<meta property="og:site_name" content="[^"]+"',
            r'<meta property="og:title" content="[^"]+"',
            r'<meta property="og:description" content="[^"]+"',
            r'<meta name="twitter:card" content="[^"]+"',
        ):
            assert re.search(pattern, html), f"{page['path']} : {pattern} manquant"
        assert re.search(rf'<meta property="og:url" content="{re.escape(canonical)}"', html), page["path"]


# ------------------------------------------------------------------------- JSON-LD


def test_jsonld_blocks_are_valid_on_every_indexable_page(site: TestClient, db_file: Path) -> None:
    for page in indexable_pages(db_file):
        html = site.get(page["path"]).text
        blocks = ld_blocks(html)
        assert blocks, f"{page['path']} : aucun bloc JSON-LD"
        for block in blocks:
            assert isinstance(block, dict)
            assert block.get("@context") == "https://schema.org", page["path"]
            assert block.get("@type"), page["path"]


def test_jsonld_types_match_each_page_family(site: TestClient, db_file: Path) -> None:
    families = {
        "": {"ProfessionalService", "Person"},
        "/contact": {"Person", "ProfessionalService"},
    }
    for path, expected in families.items():
        types = {block["@type"] for block in ld_blocks(site.get(path).text)}
        assert expected <= types, f"{path} : {types}"
    for page in indexable_pages(db_file):
        if page["kind"] == "service":
            assert "Service" in {block["@type"] for block in ld_blocks(site.get(page["path"]).text)}
        if page["kind"] == "realisation":
            assert "CreativeWork" in {block["@type"] for block in ld_blocks(site.get(page["path"]).text)}


def test_home_declares_the_studio_and_the_person(site: TestClient) -> None:
    blocks = ld_blocks(site.get("/").text)
    studio = block_of_type(blocks, "ProfessionalService")
    person = block_of_type(blocks, "Person")
    assert studio["url"] == f"{BASE}/"
    assert studio["name"]
    assert person["name"] and person["url"].startswith(BASE)
    assert person["sameAs"], "le profil Person doit exposer les profils publics"
    assert studio["founder"]["name"] == person["name"]
    assert studio["hasOfferCatalog"]["itemListElement"], "les prestations doivent être listées"
    for offer in studio["hasOfferCatalog"]["itemListElement"]:
        assert offer["itemOffered"]["url"].startswith(f"{BASE}/services/")
        assert offer["position"] >= 1


def test_contact_page_declares_the_person_and_the_service(site: TestClient) -> None:
    blocks = ld_blocks(site.get("/contact").text)
    assert block_of_type(blocks, "Person")["email"]
    studio = block_of_type(blocks, "ProfessionalService")
    assert studio["url"] == f"{BASE}/contact"
    assert studio["address"]["addressLocality"] == "Paris"


def test_service_pages_declare_service_and_breadcrumb(site: TestClient, db_file: Path) -> None:
    for page in indexable_pages(db_file):
        if page["kind"] != "service":
            continue
        blocks = ld_blocks(site.get(page["path"]).text)
        service = block_of_type(blocks, "Service")
        assert service["url"] == f"{BASE}{page['path']}"
        assert service["name"], page["path"]
        assert service["provider"]["@type"] == "ProfessionalService"
        crumbs = block_of_type(blocks, "BreadcrumbList")["itemListElement"]
        assert [crumb["position"] for crumb in crumbs] == [1, 2, 3]
        assert crumbs[1]["item"] == f"{BASE}/services"
        assert crumbs[2]["item"] == f"{BASE}{page['path']}"


def test_realisation_pages_declare_creative_work_and_breadcrumb(site: TestClient, db_file: Path) -> None:
    for page in indexable_pages(db_file):
        if page["kind"] != "realisation":
            continue
        blocks = ld_blocks(site.get(page["path"]).text)
        work = block_of_type(blocks, "CreativeWork")
        assert work["url"] == f"{BASE}{page['path']}"
        assert work["name"] and work["creator"]["@type"] == "Person"
        assert work["image"].startswith(f"{BASE}/")
        crumbs = block_of_type(blocks, "BreadcrumbList")["itemListElement"]
        assert crumbs[0]["item"] == f"{BASE}/"
        assert crumbs[1]["item"] == f"{BASE}/realisations"


def test_breadcrumb_ends_on_the_canonical_url_of_each_page(site: TestClient, db_file: Path) -> None:
    checked = 0
    for page in indexable_pages(db_file):
        if page["kind"] == "accueil":
            continue
        blocks = ld_blocks(site.get(page["path"]).text)
        crumbs = block_of_type(blocks, "BreadcrumbList")["itemListElement"]
        expected = f"{BASE}{'/' if page['path'] == '/' else page['path']}"
        assert crumbs[-1]["item"] == expected, page["path"]
        assert crumbs[0]["name"] == "Accueil"
        checked += 1
    assert checked >= 10


def test_faq_page_is_declared_only_where_a_faq_is_published(site: TestClient, db_file: Path) -> None:
    before = ld_blocks(site.get("/services/identite").text)
    assert not [block for block in before if block.get("@type") == "FAQPage"]

    conn = connect(db_file)
    try:
        page = repo.page_by_slug(conn, "identite")
        assert page is not None
        repo.create_section(
            conn,
            int(page["id"]),
            {
                "type": "faq",
                "data": {
                    "title": "Questions fréquentes",
                    "items": [
                        {"q": "Combien de temps ?", "a": "<p>Comptez quatre semaines.</p>"},
                        {"q": "Et le budget ?", "a": "Sur devis, après cadrage."},
                    ],
                },
            },
        )
        conn.commit()
    finally:
        conn.close()

    blocks = ld_blocks(site.get("/services/identite").text)
    faq = block_of_type(blocks, "FAQPage")
    assert [question["name"] for question in faq["mainEntity"]] == ["Combien de temps ?", "Et le budget ?"]
    assert faq["mainEntity"][0]["acceptedAnswer"]["text"] == "Comptez quatre semaines."
    assert faq["mainEntity"][1]["acceptedAnswer"]["text"] == "Sur devis, après cadrage."
    # Les autres pages ne déclarent pas de FAQ.
    assert not [block for block in ld_blocks(site.get("/realisations").text) if block.get("@type") == "FAQPage"]


def test_jsonld_is_escaped_against_script_injection(site: TestClient, db_file: Path) -> None:
    payload = "</script><script>window.pwned=1</script>"
    conn = connect(db_file)
    try:
        page = repo.page_by_slug(conn, "mentions-legales")
        assert page is not None
        repo.create_section(
            conn,
            int(page["id"]),
            {"type": "faq", "data": {"items": [{"q": "Question piégée", "a": f"<p>{payload}</p>"}]}},
        )
        conn.commit()
    finally:
        conn.close()

    html = site.get("/mentions-legales").text
    blocks = ld_blocks(html)
    faq = block_of_type(blocks, "FAQPage")
    assert "window.pwned" in faq["mainEntity"][0]["acceptedAnswer"]["text"]
    assert "<script>window.pwned=1" not in html, "la charge utile ne doit pas sortir du bloc JSON-LD"
    # Les deux blocs de la page restent parsables : la charge utile n'a pas fermé le script.
    assert {block["@type"] for block in blocks} == {"BreadcrumbList", "FAQPage"}
    assert "<h1" in html
