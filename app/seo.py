"""Données structurées JSON-LD, alignées sur les URLs canoniques des pages.

Un bloc par entité (`Person`, `ProfessionalService`, `Service`, `CreativeWork`,
`BreadcrumbList`, `FAQPage`), rendu par `theme/templates/partials/jsonld.html`.
Les valeurs viennent du contenu réel : rien n'est inventé ici.
"""

from __future__ import annotations

import html as html_module
import re
from collections.abc import Iterable, Sequence
from typing import Any

from .render import json_load, section_context

SCHEMA = "https://schema.org"

# Nature de page -> (libellé du fil d'Ariane, chemin de la liste parente)
FICHE_BREADCRUMB: dict[str, tuple[str, str]] = {
    "service": ("Services", "/services"),
    "realisation": ("Réalisations", "/realisations"),
}

_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}")
_TAG = re.compile(r"<[^>]+>")


def _get(obj: Any, key: str, default: Any = "") -> Any:
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    try:
        value = obj[key]
    except (KeyError, IndexError, TypeError):
        return default
    return default if value is None else value


def _text(value: Any) -> str:
    return str(value or "").strip()


def _absolute(url: str, base: str) -> str:
    if not url:
        return ""
    if url.startswith(("http://", "https://")):
        return url
    return base.rstrip("/") + "/" + url.lstrip("/")


def plain_text(value: Any) -> str:
    """Texte brut pour les données structurées : balises retirées, entités décodées."""
    without_tags = _TAG.sub(" ", _text(value))
    return re.sub(r"\s+", " ", html_module.unescape(without_tags)).strip()


def categories(page: Any) -> list[str]:
    raw = json_load(_get(page, "categories", ""), [])
    if isinstance(raw, str):
        raw = [raw]
    if not isinstance(raw, list):
        return []
    return [str(item).strip() for item in raw if str(item).strip()]


def postal_address(settings: dict[str, str]) -> dict[str, str] | None:
    city = _text(settings.get("city"))
    if not city:
        return None
    parts = [part.strip() for part in city.split(",") if part.strip()]
    node = {"@type": "PostalAddress", "addressLocality": parts[0]}
    if len(parts) > 1:
        node["addressCountry"] = parts[-1]
    return node


def person_name(settings: dict[str, str]) -> str:
    return (
        _text(settings.get("person_name"))
        or _text(settings.get("legal_name"))
        or _text(settings.get("site_name"))
        or "Sujeepan Sabesan"
    )


def studio_name(settings: dict[str, str]) -> str:
    return _text(settings.get("studio")) or _text(settings.get("site_name")) or "Sujee Design"


def _same_as(settings: dict[str, str]) -> list[str]:
    return [url for url in (_text(settings.get("linkedin")), _text(settings.get("behance"))) if url]


def person_node(settings: dict[str, str], base: str) -> dict[str, Any]:
    node: dict[str, Any] = {
        "@context": SCHEMA,
        "@type": "Person",
        "name": person_name(settings),
        "jobTitle": _text(settings.get("job_title")) or "Designer et directeur artistique",
        "url": _absolute("/", base),
        "inLanguage": "fr-FR",
    }
    email = _text(settings.get("email"))
    if email:
        node["email"] = email
    if _same_as(settings):
        node["sameAs"] = _same_as(settings)
    address = postal_address(settings)
    if address:
        node["address"] = address
    return node


def _offer_catalog(services: Iterable[dict[str, Any]], base: str) -> dict[str, Any] | None:
    offers = []
    for index, service in enumerate(services, start=1):
        name = plain_text(service.get("title"))
        if not name:
            continue
        offer: dict[str, Any] = {
            "@type": "Offer",
            "position": index,
            "itemOffered": {"@type": "Service", "name": name, "url": _absolute(_text(service.get("href")), base)},
        }
        if service.get("excerpt"):
            offer["itemOffered"]["description"] = plain_text(service.get("excerpt"))
        offers.append(offer)
    if not offers:
        return None
    return {"@type": "OfferCatalog", "name": "Prestations", "itemListElement": offers}


def professional_service_node(
    settings: dict[str, str],
    base: str,
    *,
    path: str = "/",
    services: Iterable[dict[str, Any]] = (),
) -> dict[str, Any]:
    node: dict[str, Any] = {
        "@context": SCHEMA,
        "@type": "ProfessionalService",
        "name": studio_name(settings),
        "url": _absolute(path, base),
        "founder": {"@type": "Person", "name": person_name(settings)},
        "inLanguage": "fr-FR",
        "areaServed": {"@type": "Country", "name": "France"},
    }
    description = plain_text(settings.get("site_description"))
    if description:
        node["description"] = description
    email = _text(settings.get("email"))
    if email:
        node["email"] = email
    address = postal_address(settings)
    if address:
        node["address"] = address
    if _same_as(settings):
        node["sameAs"] = _same_as(settings)
    catalog = _offer_catalog(services, base)
    if catalog:
        node["hasOfferCatalog"] = catalog
    return node


def service_node(page: Any, settings: dict[str, str], base: str, path: str) -> dict[str, Any]:
    title = plain_text(_get(page, "title"))
    node: dict[str, Any] = {
        "@context": SCHEMA,
        "@type": "Service",
        "name": title,
        "url": _absolute(path, base),
        "provider": {
            "@type": "ProfessionalService",
            "name": studio_name(settings),
            "url": _absolute("/", base),
        },
        "inLanguage": "fr-FR",
        "areaServed": {"@type": "Country", "name": "France"},
    }
    description = plain_text(_get(page, "seo_description")) or plain_text(_get(page, "excerpt"))
    if description:
        node["description"] = description
    if title:
        node["serviceType"] = title
    return node


def creative_work_node(page: Any, settings: dict[str, str], base: str, path: str) -> dict[str, Any]:
    title = plain_text(_get(page, "title"))
    node: dict[str, Any] = {
        "@context": SCHEMA,
        "@type": "CreativeWork",
        "name": title,
        "headline": title,
        "url": _absolute(path, base),
        "creator": {"@type": "Person", "name": person_name(settings)},
        "inLanguage": "fr-FR",
    }
    description = plain_text(_get(page, "seo_description")) or plain_text(_get(page, "excerpt"))
    if description:
        node["description"] = description
    client = plain_text(_get(page, "client"))
    if client:
        node["sourceOrganization"] = {"@type": "Organization", "name": client}
    keywords = categories(page)
    if keywords:
        node["keywords"] = keywords
    cover = _text(_get(page, "cover"))
    if cover:
        node["image"] = _absolute(cover, base)
    year = _text(_get(page, "year"))
    if _ISO_DATE.match(year):
        node["dateCreated"] = year
    elif year.isdigit() and len(year) == 4:
        node["copyrightYear"] = int(year)
    return node


def breadcrumb_node(trail: Sequence[tuple[str, str]], base: str) -> dict[str, Any]:
    return {
        "@context": SCHEMA,
        "@type": "BreadcrumbList",
        "inLanguage": "fr-FR",
        "itemListElement": [
            {"@type": "ListItem", "position": index, "name": plain_text(name), "item": _absolute(path, base)}
            for index, (name, path) in enumerate(trail, start=1)
        ],
    }


def faq_items(sections: Iterable[Any]) -> list[dict[str, str]]:
    """Questions/réponses des sections FAQ publiées, en texte brut."""
    items: list[dict[str, str]] = []
    for section in sections:
        normalized = section_context(section)
        if normalized["type"] != "faq" or not normalized["visible"]:
            continue
        for item in normalized["data"].get("items", []) or []:
            if not isinstance(item, dict):
                continue
            question = plain_text(item.get("q"))
            answer = plain_text(item.get("a"))
            if question and answer:
                items.append({"q": question, "a": answer})
    return items


def faq_node(items: Sequence[dict[str, str]]) -> dict[str, Any]:
    return {
        "@context": SCHEMA,
        "@type": "FAQPage",
        "inLanguage": "fr-FR",
        "mainEntity": [
            {
                "@type": "Question",
                "name": item["q"],
                "acceptedAnswer": {"@type": "Answer", "text": item["a"]},
            }
            for item in items
        ],
    }


def breadcrumb_trail(page: Any, *, kind: str, path: str, label: str = "") -> list[tuple[str, str]]:
    """Accueil > [liste] > page courante. Vide pour l'accueil et pour la page 404."""
    slug = _text(_get(page, "slug", ""))
    if kind == "accueil" or slug == "404":
        return []
    title = plain_text(_get(page, "title")) or slug
    if kind in FICHE_BREADCRUMB:
        fallback, listing_path = FICHE_BREADCRUMB[kind]
        return [("Accueil", "/"), (label or fallback, listing_path), (title, path)]
    return [("Accueil", "/"), (title, path)]


def jsonld_blocks(
    *,
    page: Any,
    settings: dict[str, str],
    base: str,
    path: str,
    sections: Iterable[Any] = (),
    services: Iterable[dict[str, Any]] = (),
    breadcrumb: str = "",
) -> list[dict[str, Any]]:
    """Blocs JSON-LD d'une page, selon sa famille."""
    kind = _text(_get(page, "kind", "page"))
    slug = _text(_get(page, "slug", ""))
    blocks: list[dict[str, Any]] = []
    if kind == "accueil":
        blocks.append(professional_service_node(settings, base, path=path, services=services))
        blocks.append(person_node(settings, base))
    elif kind == "contact" or slug == "contact":
        blocks.append(person_node(settings, base))
        blocks.append(professional_service_node(settings, base, path=path, services=services))
    elif kind == "service":
        blocks.append(service_node(page, settings, base, path))
    elif kind == "realisation":
        blocks.append(creative_work_node(page, settings, base, path))
    trail = breadcrumb_trail(page, kind=kind, path=path, label=breadcrumb)
    if trail:
        blocks.append(breadcrumb_node(trail, base))
    items = faq_items(sections)
    if items:
        blocks.append(faq_node(items))
    return blocks
