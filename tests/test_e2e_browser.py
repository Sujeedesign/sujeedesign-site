"""Parcours de bout en bout sur une instance vivante (recette ou production).

Ces tests ne tournent pas par défaut : ils écrivent réellement des données
(un message de contact, une section de page) sur l'instance visée et exigent
donc son adresse ainsi que les identifiants d'administration.

    SITE_E2E_URL=http://instance-vivante \
    SITE_E2E_PASSWORD=... SITE_E2E_SYNC_TOKEN=... \
    .venv/bin/python -m pytest tests/test_e2e_browser.py -q -m e2e

Sans `SITE_E2E_URL`, tout est ignoré : la suite ordinaire reste hermétique.
Les tests unitaires (`tests/test_public.py`, `test_admin.py`, `test_contact.py`)
vérifient la même logique hors réseau ; ici on contrôle la chaîne complète :
proxy, cookies, redirections, cache de rendu et publication.
"""

from __future__ import annotations

import json
import os
import re
import time
import uuid
from pathlib import Path

import httpx
import pytest

from app import repo
from app.security import SESSION_COOKIE

pytestmark = pytest.mark.e2e

ROOT = Path(__file__).resolve().parents[1]
SEED_FILE = ROOT / "seed" / "content.json"
MIN_FORM_AGE = 3.5  # le formulaire refuse un envoi de moins de 3 secondes
PUBLIC_PATHS = ["/", "/realisations", "/services", "/a-propos", "/contact", "/mentions-legales"]
HREF_RE = re.compile(r'href="(/realisations/[^"#?]+)"')
TOKEN_RE = re.compile(r'name="form_token" value="([^"]*)"')


def _seed_redirections() -> list[dict]:
    return json.loads(SEED_FILE.read_text(encoding="utf-8")).get("redirections", [])


@pytest.fixture(scope="module")
def base_url() -> str:
    url = (os.environ.get("SITE_E2E_URL") or "").rstrip("/")
    if not url:
        pytest.skip("SITE_E2E_URL absent : parcours de bout en bout non demandé")
    return url


@pytest.fixture(scope="module")
def client(base_url: str):
    with httpx.Client(
        base_url=base_url,
        timeout=30.0,
        follow_redirects=False,
        # `check_origin` du back office exige que l'origine contienne l'hôte.
        headers={"Origin": base_url, "User-Agent": "sujeedesign-e2e/1.0"},
    ) as http:
        yield http


@pytest.fixture(scope="module")
def admin(client: httpx.Client):
    password = os.environ.get("SITE_E2E_PASSWORD") or ""
    if not password:
        pytest.skip("SITE_E2E_PASSWORD absent : parcours back office non demandé")
    response = client.post("/admin/connexion", data={"password": password})
    assert response.status_code == 303, f"connexion refusée ({response.status_code})"
    assert SESSION_COOKIE in client.cookies, "aucune session posée par la connexion"
    return client


def test_public_pages_and_legacy_urls(client: httpx.Client) -> None:
    for path in PUBLIC_PATHS:
        response = client.get(path)
        assert response.status_code == 200, f"{path} -> {response.status_code}"
        assert "<h1" in response.text, f"{path} sans titre h1"
        assert "<noscript>" in response.text, f"{path} sans repli sans JavaScript"

    fallback = client.get("/assets/site-noscript.css")
    assert fallback.status_code == 200, "feuille de repli sans JavaScript non servie"
    assert "opacity: 1" in fallback.text

    listing = client.get("/realisations")
    slugs = sorted(set(HREF_RE.findall(listing.text)))
    assert slugs, "aucune fiche réalisation liée depuis la liste"
    detail = client.get(slugs[0])
    assert detail.status_code == 200, f"{slugs[0]} -> {detail.status_code}"

    for rule in _seed_redirections():
        response = client.get(rule["path"])
        assert response.status_code == rule["code"], f"{rule['path']} -> {response.status_code}"
        target = rule["target"].split("?")[0].rstrip("/") or "/"
        location = response.headers.get("location", "")
        assert location.split("?")[0].rstrip("/").endswith(target), f"{rule['path']} -> {location}"


def test_sitemap_and_health_are_served(client: httpx.Client) -> None:
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json().get("ok") is True

    sitemap = client.get("/sitemap.xml")
    assert sitemap.status_code == 200
    for path in ("/realisations", "/services", "/contact"):
        assert path in sitemap.text, f"{path} absent du sitemap"

    robots = client.get("/robots.txt")
    assert robots.status_code == 200
    assert "sitemap" in robots.text.lower()


def test_contact_message_reaches_its_readers(client: httpx.Client) -> None:
    marker = "E2E-" + uuid.uuid4().hex[:10]
    page = client.get("/contact")
    assert page.status_code == 200
    assert "sjd_form" in client.cookies, "aucun jeton de formulaire posé sur /contact"
    field_token = (TOKEN_RE.search(page.text) or [None, ""])[1]

    time.sleep(MIN_FORM_AGE)  # un envoi instantané est refusé comme robot
    posted = client.post(
        "/api/contact",
        data={
            "name": "Recette automatique",
            "email": "recette@sujeedesign.com",
            "message": f"Message de contrôle du parcours de bout en bout {marker}",
            "consent": "1",
            "source_path": "/contact",
            "form_token": field_token,
            "website": "",
        },
    )
    assert posted.status_code == 200, f"envoi refusé : {posted.status_code} {posted.text[:200]}"
    body = posted.json()
    assert body.get("ok") is True and body.get("reference"), "aucune référence renvoyée"

    token = os.environ.get("SITE_E2E_SYNC_TOKEN") or ""
    if token:
        synced = client.get("/api/sync/messages", headers={"x-sync-token": token})
        assert synced.status_code == 200, "synchronisation refusée"
        assert marker in json.dumps(synced.json(), ensure_ascii=False), "message absent de la synchronisation"


def test_back_office_edit_publishes_and_cleans_up(admin: httpx.Client) -> None:
    listing = admin.get("/api/admin/pages")
    assert listing.status_code == 200, "liste des pages inaccessible"
    pages = listing.json()["pages"]
    page = next((item for item in pages if item["slug"] == "a-propos"), None)
    assert page is not None, "page a-propos absente du back office"
    page_id = page["id"]
    original_status = page["status"]

    marker = "E2E-" + uuid.uuid4().hex[:10]
    created = admin.post(f"/api/admin/pages/{page_id}/sections", json={"type": "texte-riche"})
    assert created.status_code == 200, f"ajout de section refusé : {created.text[:200]}"
    section_id = created.json()["id"]

    try:
        updated = admin.patch(
            f"/api/admin/sections/{section_id}",
            json={"data": {"title": marker, "body": f"<p>Bloc de recette {marker}</p>"}},
        )
        assert updated.status_code == 200, f"mise à jour refusée : {updated.text[:200]}"
        published = admin.post(f"/api/admin/pages/{page_id}/statut", json={"status": repo.PUBLISHED})
        assert published.status_code == 200, f"publication refusée : {published.text[:200]}"

        rendered = admin.get("/a-propos")
        assert rendered.status_code == 200
        assert marker in rendered.text, "le contenu publié depuis le back office n'apparaît pas en public"
    finally:
        admin.delete(f"/api/admin/sections/{section_id}")
        admin.post(f"/api/admin/pages/{page_id}/statut", json={"status": original_status})

    after = admin.get("/a-propos")
    assert marker not in after.text, "la section supprimée reste visible en public"
