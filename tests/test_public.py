"""Routes publiques : vitrine, listes, fiches, SEO, redirections, 404."""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator, Callable

import pytest
from fastapi.testclient import TestClient

from app import repo
from app.db import connect, init_db


@pytest.fixture()
def seeded(db_file) -> Iterator[Callable[..., int]]:
    conn = connect(db_file)
    init_db(conn)

    def add(kind: str, slug: str, **kwargs) -> int:
        values = {"title": kwargs.pop("title", slug.title()), "kind": kind, "status": kwargs.pop("status", repo.PUBLISHED)}
        values.update(kwargs)
        page_id = repo.create_page(conn, {"slug": slug, **values})
        for index, section in enumerate(kwargs.pop("sections", []) or []):
            repo.create_section(conn, page_id, {**section, "position": index})
        conn.commit()
        return page_id

    add("accueil", "accueil", title="Sujee Design", sections=[
        {"type": "hero", "variant": "accueil", "data": {"rotator": ["Design ta marque"], "ctas": [], "shader": False}},
    ])
    add("page", "realisations", title="Réalisations", sections=[
        {"type": "hero", "variant": "simple", "data": {"kicker": "Portfolio", "title": "Toutes les réalisations"}},
        {"type": "realisations-grid", "variant": "auto", "data": {"heading_lines": ["Sélection"]}},
    ])
    add("page", "services", title="Services", sections=[
        {"type": "hero", "variant": "simple", "data": {"kicker": "Prestations", "title": "Ce que je fais"}},
        {"type": "services-list", "variant": "auto", "data": {"title": "Prestations"}},
    ])
    add("page", "contact", title="Contact", sections=[
        {"type": "hero", "variant": "simple", "data": {"kicker": "Contact", "title": "Parlons-en"}},
        {"type": "formulaire-contact", "data": {"title": "Formulaire", "columns": []}},
    ])
    add("realisation", "vaasam-paris", title="Vaasam Paris", client="Vaasam", year=2026,
        categories=["Identité"], excerpt="Identité et direction artistique.", sections=[
            {"type": "hero", "variant": "projet", "data": {"title": "Vaasam Paris", "intro": "Identité"}},
        ])
    add("service", "identite", title="Identité de marque", num=1, excerpt="Stratégie, logo, système visuel.",
        sections=[{"type": "hero", "variant": "page", "data": {"kicker": "Service", "title": "Identité de marque"}}])
    add("page", "brouillon-interne", title="Brouillon", status=repo.DRAFT)
    add("page", "page-cachee", title="Cachée", robots="noindex,nofollow")
    add("page", "404", title="Page introuvable")
    repo.add_redirect(conn, "/projet-vaasam.html", "/realisations/vaasam-paris")
    repo.add_redirect(conn, "/index.html", "/")
    conn.commit()
    yield add
    conn.close()


def test_home_renders(seeded, client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "hero" in response.text
    assert "canonical" in response.text


def test_trailing_slash_is_normalised(seeded, client: TestClient) -> None:
    """Une barre oblique finale renvoie 301 vers l'adresse canonique."""
    response = client.get("/realisations/", follow_redirects=False)
    assert response.status_code == 301
    assert response.headers["location"] == "/realisations"
    assert client.get("/services/", follow_redirects=False).headers["location"] == "/services"


def test_listing_pages(seeded, client: TestClient) -> None:
    assert client.get("/realisations").status_code == 200
    assert client.get("/services").status_code == 200
    assert "Vaasam Paris" in client.get("/realisations").text
    assert "Identité de marque" in client.get("/services").text


def test_detail_pages(seeded, client: TestClient) -> None:
    realisation = client.get("/realisations/vaasam-paris")
    assert realisation.status_code == 200
    assert "project-page" in realisation.text
    service = client.get("/services/identite")
    assert service.status_code == 200
    assert "Identité de marque" in service.text


def test_contact_page_has_form(seeded, client: TestClient) -> None:
    response = client.get("/contact")
    assert response.status_code == 200
    assert 'id="contactForm"' in response.text
    assert 'method="post"' in response.text


def test_old_urls_are_redirected_with_301(seeded, client: TestClient) -> None:
    response = client.get("/projet-vaasam.html", follow_redirects=False)
    assert response.status_code == 301
    assert response.headers["location"] == "/realisations/vaasam-paris"
    assert client.get("/index.html", follow_redirects=False).headers["location"] == "/"


def test_unknown_path_returns_404_with_noindex(seeded, client: TestClient) -> None:
    response = client.get("/pas-de-page")
    assert response.status_code == 404
    assert response.headers.get("x-robots-tag") == "noindex"


def test_draft_is_not_public(seeded, client: TestClient) -> None:
    assert client.get("/brouillon-interne").status_code == 404
    assert "brouillon-interne" not in client.get("/sitemap.xml").text


def test_sitemap_lists_published_pages_and_skips_noindex(seeded, client: TestClient) -> None:
    body = client.get("/sitemap.xml").text
    assert "<loc>https://sujeedesign.com/</loc>" in body
    assert "https://sujeedesign.com/realisations/vaasam-paris" in body
    assert "page-cachee" not in body


def test_robots_disallows_admin(seeded, client: TestClient) -> None:
    body = client.get("/robots.txt").text
    assert "Disallow: /admin" in body
    assert "Sitemap:" in body


def test_assets_are_served(client: TestClient) -> None:
    response = client.get("/assets/site.css")
    assert response.status_code == 200
    assert "text/css" in response.headers["content-type"]
    assert client.get("/assets/site-extras.css").status_code == 200


def test_unknown_section_type_does_not_break_page(seeded, client: TestClient, db_file) -> None:
    conn = connect(db_file)
    try:
        page_id = repo.page_by_slug(conn, "contact", published_only=False)["id"]
        repo.create_section(conn, int(page_id), {"type": "section-inexistante", "data": {}})
        conn.commit()
    finally:
        conn.close()
    response = client.get("/contact")
    assert response.status_code == 200
    assert "section inconnue" not in response.text
