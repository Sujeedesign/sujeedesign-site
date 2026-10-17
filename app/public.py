"""Routes publiques : vitrine, listes, fiches, SEO, redirections."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Any
from xml.sax.saxutils import escape as xml_escape

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, PlainTextResponse, RedirectResponse, Response

from . import repo
from . import security
from . import seo
from . import settings as settings_module
from .db import connect as db_connect
from .db import content_revision
from .render import build_env, render_page

router = APIRouter()
ENV = build_env()
rate_limiter = security.RateLimiter()


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else ""


def absolute(url: str, base: str) -> str:
    if not url:
        return ""
    if url.startswith(("http://", "https://")):
        return url
    return base.rstrip("/") + "/" + url.lstrip("/")


def build_ctx(
    request: Request,
    conn: sqlite3.Connection,
    page: sqlite3.Row | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    settings = settings_module.all_settings(conn)
    base = (settings.get("base_url") or settings_module.public_base_url()).rstrip("/")
    path = repo.page_path(page) if page is not None else request.url.path
    site_name = settings.get("site_name") or "Sujee Design"
    title = ""
    description = settings.get("site_description", "")
    og_image = settings.get("og_image", "")
    robots = "index,follow"
    if page is not None:
        raw_title = (page["title"] or "").strip()
        title = (page["seo_title"] or "").strip()
        if not title:
            title = raw_title if page["kind"] == "accueil" else f"{raw_title} — {site_name}"
        description = (page["seo_description"] or "").strip() or description
        og_image = (page["og_image"] or "").strip() or og_image
        robots = (page["robots"] or "index,follow").strip()
    ctx: dict[str, Any] = {
        "revision": content_revision(conn),
        "settings": settings,
        "menu": repo.list_menu(conn),
        "current_path": path,
        "site_name": site_name,
        "year": datetime.now(timezone.utc).year,
        "seo": {
            "title": title,
            "description": description,
            "canonical": base + ("/" if path == "/" else path),
            "og_image": absolute(og_image, base),
            "robots": robots,
            "base_url": base,
            "path": path,
        },
        "realisations": repo.cards(conn, "realisation"),
        "services": repo.cards(conn, "service"),
        "footer": {
            "tagline": settings.get("tagline", ""),
            "contact_email": settings.get("email", ""),
            "studio": settings.get("studio", ""),
            "legal_name": settings.get("legal_name", ""),
            "city": settings.get("city", ""),
            "linkedin": settings.get("linkedin", ""),
            "behance": settings.get("behance", ""),
        },
        "form_token": security.make_token("contact"),
    }
    if page is not None:
        ctx["page"] = page
    if extra:
        ctx.update(extra)
    return ctx


def serve_page(
    request: Request,
    conn: sqlite3.Connection,
    page: sqlite3.Row,
    status_code: int = 200,
    extra: dict[str, Any] | None = None,
) -> HTMLResponse:
    ctx = build_ctx(request, conn, page, extra)
    ctx["body_class"] = "project-page" if page["kind"] == "realisation" else ""
    sections = repo.sections_for(conn, int(page["id"]))
    ctx["jsonld"] = seo.jsonld_blocks(
        page=page,
        settings=ctx["settings"],
        base=ctx["seo"]["base_url"],
        path=ctx["seo"]["path"],
        sections=sections,
        services=ctx["services"],
        breadcrumb=str(ctx.get("breadcrumb") or ""),
    )
    html_out = render_page(ENV, page=page, sections=sections, ctx=ctx, template="pages/page.html")
    headers = {"Cache-Control": "no-cache"}
    if status_code == 404:
        headers["X-Robots-Tag"] = "noindex"
    response = HTMLResponse(html_out, status_code=status_code, headers=headers)
    if any((section["type"] if "type" in section.keys() else "") == "formulaire-contact" for section in sections):
        # Jeton de formulaire neuf à chaque visite : le HTML peut rester en cache.
        response.set_cookie(
            "sjd_form",
            security.make_token("contact"),
            httponly=True,
            secure=settings_module.cookie_secure(),
            samesite="lax",
            max_age=security.FORM_TTL,
        )
    return response


def not_found(request: Request, conn: sqlite3.Connection) -> HTMLResponse:
    page = repo.page_by_slug(conn, "404", published_only=False)
    if page is None:
        return HTMLResponse("<h1>404 — page introuvable</h1>", status_code=404)
    return serve_page(request, conn, page, status_code=404)


def _db(request: Request) -> sqlite3.Connection:
    return db_connect(request.app.state.db_path)


@router.get("/", response_class=HTMLResponse)
def home(request: Request) -> Response:
    conn = _db(request)
    try:
        page = repo.home_page(conn)
        if page is None:
            return not_found(request, conn)
        return serve_page(request, conn, page)
    finally:
        conn.close()


@router.get("/realisations", response_class=HTMLResponse)
def realisations_index(request: Request) -> Response:
    conn = _db(request)
    try:
        page = repo.page_by_slug(conn, "realisations")
        if page is None:
            return not_found(request, conn)
        return serve_page(request, conn, page)
    finally:
        conn.close()


@router.get("/services", response_class=HTMLResponse)
def services_index(request: Request) -> Response:
    conn = _db(request)
    try:
        page = repo.page_by_slug(conn, "services")
        if page is None:
            return not_found(request, conn)
        return serve_page(request, conn, page)
    finally:
        conn.close()


@router.get("/realisations/{slug}", response_class=HTMLResponse)
def realisation_detail(request: Request, slug: str) -> Response:
    conn = _db(request)
    try:
        page = repo.page_by_slug(conn, slug, kinds=["realisation"])
        if page is None:
            return not_found(request, conn)
        return serve_page(request, conn, page, extra={"breadcrumb": "Réalisations"})
    finally:
        conn.close()


@router.get("/services/{slug}", response_class=HTMLResponse)
def service_detail(request: Request, slug: str) -> Response:
    conn = _db(request)
    try:
        page = repo.page_by_slug(conn, slug, kinds=["service"])
        if page is None:
            return not_found(request, conn)
        return serve_page(request, conn, page, extra={"breadcrumb": "Services"})
    finally:
        conn.close()


@router.get("/robots.txt", response_class=PlainTextResponse)
def robots(request: Request) -> PlainTextResponse:
    conn = _db(request)
    try:
        settings = settings_module.all_settings(conn)
        base = (settings.get("base_url") or "https://sujeedesign.com").rstrip("/")
        body = "\n".join(
            [
                "User-agent: *",
                "Allow: /",
                "Disallow: /admin",
                "Disallow: /api/",
                "",
                f"Sitemap: {base}/sitemap.xml",
                "",
            ]
        )
        return PlainTextResponse(body, headers={"Cache-Control": "public, max-age=3600"})
    finally:
        conn.close()


@router.get("/sitemap.xml")
def sitemap(request: Request) -> Response:
    conn = _db(request)
    try:
        settings = settings_module.all_settings(conn)
        base = (settings.get("base_url") or "https://sujeedesign.com").rstrip("/")
        pages = repo.list_pages(conn, published_only=True, order="position, title")
        urls = []
        for page in pages:
            if page["robots"] and "noindex" in str(page["robots"]):
                continue
            path = repo.page_path(page)
            lastmod = str(page["updated_at"] or "")[:10]
            urls.append((base + ("/" if path == "/" else path), lastmod))
        entries = "\n".join(
            "  <url>\n"
            f"    <loc>{xml_escape(loc)}</loc>\n" + (f"    <lastmod>{lastmod}</lastmod>\n" if lastmod else "") + "  </url>"
            for loc, lastmod in urls
        )
        body = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f"{entries}\n"
            "</urlset>\n"
        )
        return Response(body, media_type="application/xml", headers={"Cache-Control": "public, max-age=600"})
    finally:
        conn.close()


@router.get("/{path:path}")
def catch_all(request: Request, path: str) -> Response:
    conn = _db(request)
    try:
        candidate = "/" + path.lstrip("/")
        redirect = repo.find_redirect(conn, candidate)
        if redirect is not None:
            repo.touch_redirect_hit(conn, candidate)
            conn.commit()
            return RedirectResponse(redirect["target"], status_code=int(redirect["code"] or 301))
        page = repo.page_by_slug(conn, path.strip("/"), kinds=["page", "libre"])
        if page is None:
            return not_found(request, conn)
        return serve_page(request, conn, page)
    finally:
        conn.close()
