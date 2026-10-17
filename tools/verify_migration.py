#!/usr/bin/env python3
"""Vérification de la migration de contenu legacy -> seed/content.json.

Trois niveaux de contrôle :

1. Structure du seed : réglages, pages (slugs, kinds, statuts, menus), redirections,
   types de sections et champs attendus.
2. Chargement : le seed est chargé dans une base SQLite temporaire via app.seed
   (aucune erreur attendue).
3. Parité de texte : chaque bloc éditorial du site legacy doit se retrouver dans
   le rendu de la page correspondante de la nouvelle application (via TestClient).

Sortie : rapport lisible, code de sortie 1 si au moins un contrôle échoue.
Aucune dépendance externe (stdlib + l'application du dépôt).
"""

from __future__ import annotations

import html
import json
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
LEGACY_DIR = Path("/opt/data/atelier/deploy")
SEED_FILE = ROOT / "seed" / "content.json"

sys.path.insert(0, str(ROOT))

# ---------------------------------------------------------------- sortie lisible

class Report:
    def __init__(self) -> None:
        self.ok: list[str] = []
        self.fail: list[str] = []

    def check(self, condition: bool, label: str) -> bool:
        (self.ok if condition else self.fail).append(label)
        return bool(condition)

    def equal(self, got: Any, expected: Any, label: str) -> bool:
        return self.check(got == expected, f"{label} (attendu {expected!r}, obtenu {got!r})")

    def dump(self) -> int:
        for line in self.ok:
            print(f"  OK   {line}")
        for line in self.fail:
            print(f"  FAIL {line}")
        print()
        print(f"{len(self.ok)} contrôle(s) réussi(s), {len(self.fail)} échec(s).")
        return 1 if self.fail else 0


# ---------------------------------------------------------------- outils de texte

DECOR_SYMBOLS = "↓↑→←↗·•"


def norm(text: str) -> str:
    """Texte comparable : entités décodées, balises et symboles décoratifs neutralisés."""
    text = html.unescape(text)
    text = text.replace("\u00a0", " ")
    text = re.sub(r"<[^>]+>", " ", text)
    for symbol in DECOR_SYMBOLS:
        text = text.replace(symbol, " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


BLOCK_INNER_TAGS = ("h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "blockquote", "span", "a", "small", "strong", "em")


def remove_element(text: str, tag: str, class_token: str) -> str:
    """Retire du HTML l'élément `tag` portant `class_token` (contenu généré, non éditorial)."""
    start = re.search(
        r"<" + tag + r"\b[^>]*class=\"[^\"]*\b" + re.escape(class_token) + r"\b[^\"]*\"[^>]*>",
        text,
        re.I,
    )
    if not start:
        return text
    depth = 0
    for match in re.finditer(r"</?" + tag + r"\b[^>]*>", text[start.start():], re.I):
        depth += -1 if match.group(0).startswith("</") else 1
        if depth == 0:
            return text[: start.start()] + " " + text[start.start() + match.end():]
    return text


def main_inner(text: str) -> str:
    match = re.search(r"<main[^>]*>(.*)</main>", text, re.S)
    return match.group(1) if match else ""


def legacy_chunks(main_html: str) -> list[str]:
    """Blocs éditoriaux d'une page legacy (hors SVG, scripts et listes générées).

    On découpe le contenu de chaque élément en « segments » de texte : un segment
    par portion de texte entre balises. Chaque segment est vérifié isolément, ce qui
    rend le contrôle insensible à la mise en forme en ligne (strong/em/br) et aux
    icônes décoratives placées dans des <span aria-hidden> du legacy.
    """
    text = re.sub(r"<!--.*?-->", " ", main_html, flags=re.S)
    text = re.sub(r"<(script|style|svg|canvas|noscript)\b.*?</\1>", " ", text, flags=re.S | re.I)
    text = remove_element(text, "div", "related-grid")          # liens régénérés depuis les services
    text = remove_element(text, "a", "project-cover__scroll")   # affordance de défilement
    text = remove_element(text, "div", "work-grid")             # cartes régénérées depuis les réalisations

    tags = ("div",) + BLOCK_INNER_TAGS
    chunks: list[str] = []
    for tag in tags:
        for match in re.finditer(r"<" + tag + r"\b[^>]*>(.*?)</" + tag + r">", text, re.S | re.I):
            for run in re.split(r"<[^>]+>", match.group(1)):
                value = norm(run)
                if value and len(value) >= 3 and any(ch.isalpha() for ch in value):
                    chunks.append(value)

    seen: set[str] = set()
    ordered: list[str] = []
    for chunk in chunks:
        if chunk not in seen:
            seen.add(chunk)
            ordered.append(chunk)
    return ordered


# ---------------------------------------------------------------- tables de référence

PAGE_ROUTES = {
    "index.html": "/",
    "apropos.html": "/a-propos",
    "contact.html": "/contact",
    "identite.html": "/services/identite",
    "creation-visuelle.html": "/services/creation-visuelle",
    "web.html": "/services/web",
    "marketing.html": "/services/marketing",
    "ia.html": "/services/ia",
    "projet-vaasam.html": "/realisations/vaasam-paris",
    "projet-rfa.html": "/realisations/resto-franchise-africain",
    "projet-ia.html": "/realisations/solutions-ia-automations",
    "projet-formation.html": "/realisations/formation-ui-ux-pao",
}

EXPECTED_REGLAGES = {
    "site_name": "Sujee Design",
    "tagline": "Votre marque, de A à Z",
    "base_url": "https://sujeedesign.com",
    "email": "s.sujeepan.pro@gmail.com",
    "linkedin": "https://www.linkedin.com/in/sujeepan-sabesan",
    "behance": "https://www.behance.net/SujeepanSabesan",
    "city": "Paris, France",
    "legal_name": "Sujee Design — Sujeepan Sabesan",
}

EXPECTED_REDIRECTIONS = {
    "/index.html": "/",
    "/realisations.html": "/realisations",
    "/services.html": "/services",
    "/apropos.html": "/a-propos",
    "/contact.html": "/contact",
    "/identite.html": "/services/identite",
    "/creation-visuelle.html": "/services/creation-visuelle",
    "/web.html": "/services/web",
    "/marketing.html": "/services/marketing",
    "/ia.html": "/services/ia",
    "/projet-vaasam.html": "/realisations/vaasam-paris",
    "/projet-rfa.html": "/realisations/resto-franchise-africain",
    "/projet-ia.html": "/realisations/solutions-ia-automations",
    "/projet-formation.html": "/realisations/formation-ui-ux-pao",
}

SERVICES = ["identite", "creation-visuelle", "web", "marketing", "ia"]
REALISATIONS = ["vaasam-paris", "resto-franchise-africain", "solutions-ia-automations", "formation-ui-ux-pao"]


# ---------------------------------------------------------------- contrôles

def check_seed_structure(report: Report, payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    from app import sections as sections_module

    report.check(set(payload) >= {"reglages", "pages", "redirections"}, "clés de premier niveau présentes")
    report.equal(payload.get("reglages"), EXPECTED_REGLAGES, "réglages exacts")

    pages = {page["slug"]: page for page in payload.get("pages", [])}
    report.equal(len(payload.get("pages", [])), 15, "15 pages")
    report.equal(len(pages), 15, "slugs uniques")

    for slug, page in pages.items():
        report.check(bool(page.get("sections")), f"{slug}: au moins une section")
        first_type = page["sections"][0]["type"] if page.get("sections") else None
        report.equal(first_type, "hero", f"{slug}: première section = hero")
        for index, section in enumerate(page.get("sections", [])):
            report.check(
                section.get("type") in sections_module.SECTION_TYPES,
                f"{slug}: section {index} type « {section.get('type')} » connu",
            )

    # kinds / statuts
    report.equal(pages["accueil"]["kind"], "accueil", "accueil: kind")
    report.equal(pages["accueil"].get("in_menu", False), False, "accueil: hors menu")
    for slug in ("realisations", "services", "a-propos", "contact", "404"):
        report.equal(pages[slug]["kind"], "page", f"{slug}: kind page")
        report.equal(pages[slug]["status"], "publie", f"{slug}: statut publié")
    report.equal(pages["404"].get("robots"), "noindex,nofollow", "404: robots noindex")
    report.equal(pages["404"]["title"], "Page introuvable", "404: titre")

    # menu
    menu = sorted(
        ((page.get("menu_position"), page["slug"], page.get("menu_label") or page["title"]) for page in pages.values() if page.get("in_menu")),
    )
    report.equal(
        menu,
        [(10, "realisations", "Réalisations"), (20, "services", "Services"), (30, "a-propos", "À propos"), (40, "contact", "Contact")],
        "menu principal (positions et libellés)",
    )

    # services
    for index, slug in enumerate(SERVICES, start=1):
        page = pages[slug]
        report.equal(page["kind"], "service", f"service {slug}: kind")
        report.equal(page.get("num"), index, f"service {slug}: num")
        report.equal(page.get("position"), index, f"service {slug}: position")
        report.equal(page["status"], "publie", f"service {slug}: statut")
        report.check(bool(page.get("excerpt")), f"service {slug}: accroche")

    # réalisations
    for index, slug in enumerate(REALISATIONS, start=1):
        page = pages[slug]
        report.equal(page["kind"], "realisation", f"réalisation {slug}: kind")
        report.equal(page.get("position"), index, f"réalisation {slug}: position")
        report.equal(page["status"], "publie", f"réalisation {slug}: statut")
        report.check(bool(page.get("excerpt")), f"réalisation {slug}: accroche")
        report.check(bool(page.get("cover")), f"réalisation {slug}: visuel")
        report.check(isinstance(page.get("categories"), list) and bool(page["categories"]), f"réalisation {slug}: catégories")

    redirects = {item["path"]: item["target"] for item in payload.get("redirections", [])}
    report.equal(redirects, EXPECTED_REDIRECTIONS, "redirections 301")
    report.check(all(item.get("code", 301) == 301 for item in payload.get("redirections", [])), "redirections en 301")
    return pages


def check_render(report: Report, payload: dict[str, Any]) -> None:
    os.environ.setdefault("SESSION_SECRET", "verification-secret")
    os.environ.setdefault("ADMIN_PASSWORD", "verification-password")
    os.environ.setdefault("SYNC_TOKEN", "verification-token")

    from fastapi.testclient import TestClient

    from app.db import connect, init_db
    from app.main import create_app
    from app.seed import load_seed_file

    tmp = Path(tempfile.mkdtemp(prefix="sujeedesign-verify-"))
    db_file = tmp / "site.db"
    conn = connect(db_file)
    init_db(conn)
    seeded = load_seed_file(conn, SEED_FILE)
    conn.close()

    report.equal(seeded["erreurs"], [], "chargement du seed sans erreur")
    report.equal(len(seeded["pages_crees"]), 15, "15 pages chargées")
    report.equal(seeded["redirections"], 14, "14 redirections chargées")

    app = create_app(db_file)
    with TestClient(app) as client:
        # toutes les routes répondent
        for slug in ("", "realisations", "services", "a-propos", "contact", "404"):
            response = client.get("/" + slug)
            report.equal(response.status_code, 200, f"GET /{slug} -> 200")
        for slug in SERVICES:
            report.equal(client.get(f"/services/{slug}").status_code, 200, f"GET /services/{slug} -> 200")
        for slug in REALISATIONS:
            report.equal(client.get(f"/realisations/{slug}").status_code, 200, f"GET /realisations/{slug} -> 200")

        # redirections
        for path, target in EXPECTED_REDIRECTIONS.items():
            response = client.get(path, follow_redirects=False)
            report.equal(response.status_code, 301, f"redirection {path} -> 301")
            if response.status_code == 301:
                report.equal(response.headers.get("location"), target, f"redirection {path} cible")

        # sitemap : 404 exclue, réalisations et services inclus
        sitemap = client.get("/sitemap.xml").text
        report.check("https://sujeedesign.com/realisations/vaasam-paris" in sitemap, "sitemap: réalisation présente")
        report.check("https://sujeedesign.com/services/identite" in sitemap, "sitemap: service présent")
        report.check("https://sujeedesign.com/404" not in sitemap, "sitemap: page 404 exclue")

        # parité de texte legacy -> rendu
        total_chunks = 0
        missing: list[str] = []
        for legacy_name, path in PAGE_ROUTES.items():
            source = LEGACY_DIR / legacy_name
            report.check(source.is_file(), f"source legacy {legacy_name} présente")
            if not source.is_file():
                continue
            chunks = legacy_chunks(main_inner(source.read_text(encoding="utf-8")))
            total_chunks += len(chunks)
            rendered = norm(client.get(path).text)
            for chunk in chunks:
                if chunk not in rendered:
                    missing.append(f"{legacy_name} ({path}) : « {chunk[:90]} »")
        report.check(total_chunks >= 300, f"volume de texte legacy contrôlé ({total_chunks} blocs)")
        report.check(not missing, f"parité de texte legacy -> nouveau site ({len(missing)} manquant(s))")
        for item in missing[:25]:
            print(f"        - {item}")


def main() -> int:
    print(f"Vérification de {SEED_FILE}")
    print(f"Source legacy  : {LEGACY_DIR}")
    print()
    if not SEED_FILE.is_file():
        print(f"  FAIL seed introuvable : {SEED_FILE}")
        return 1
    payload = json.loads(SEED_FILE.read_text(encoding="utf-8"))

    report = Report()
    check_seed_structure(report, payload)
    check_render(report, payload)
    return report.dump()


if __name__ == "__main__":
    raise SystemExit(main())
