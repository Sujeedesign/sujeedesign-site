"""Application du back office Sujee Design.

Ne sert plus la vitrine : celle-ci est un site Next.js déployé séparément.
Ce service expose l'administration (connexion, contenu, messages, médias,
réglages) et le petit API consommé par la vitrine et par le formulaire.
"""

from __future__ import annotations

import json
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from . import admin, api_admin, contact, content_routes, editor_api
from . import agent as agent_module
from . import catalogue
from . import content as content_store
from . import security
from . import settings as settings_module
from .db import connect, init_db
from .ui import templates  # noqa: F401  (initialise les filtres Jinja)

log = logging.getLogger("sujee.admin")

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "admin_static"

# Plafonds du corps de requête, avec une marge pour l'enveloppe multipart.
TEXT_BODY_LIMIT = 1024 * 1024
MEDIA_BODY_LIMIT = admin.MAX_UPLOAD + 1024 * 1024
INSTAGRAM_BODY_LIMIT = admin.INSTAGRAM_VIDEO_MAX + 4 * 1024 * 1024


def body_limit(path: str) -> int:
    """Plafond de corps autorisé pour un chemin donné.

    Les formulaires texte restent à 1 Mo ; seuls les écrans qui acceptent un
    fichier montent plus haut, selon le plafond de leur propre route.
    """
    if path in ("/admin/medias", "/api/v1/admin/media"):
        return MEDIA_BODY_LIMIT
    if path == "/admin/instagram/ajouter" or (
        path.startswith("/admin/instagram/") and path.endswith("/modifier")
    ):
        return INSTAGRAM_BODY_LIMIT
    return TEXT_BODY_LIMIT


@asynccontextmanager
async def lifespan(app: FastAPI):
    path = Path(app.state.db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = connect(path)
    try:
        init_db(conn)
        conn.commit()
        # Fiches historiques du site, insérées une seule fois (slugs absents).
        added = catalogue.seed_from_file(conn)
        if added:
            log.info("catalogue amorcé : %s fiche(s) reprise(s) du site", added)
    finally:
        conn.close()
    Path(app.state.media_dir).mkdir(parents=True, exist_ok=True)
    log.info("back office prêt · base %s", path)
    yield


def create_app(db_file: Path | None = None) -> FastAPI:
    app = FastAPI(
        title="Sujee Design · back office",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        lifespan=lifespan,
    )
    app.state.db_path = Path(db_file) if db_file else settings_module.db_path()
    app.state.media_dir = (
        Path(db_file).parent / "medias" if db_file else settings_module.media_dir()
    )
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    app.mount("/static-admin", StaticFiles(directory=str(STATIC_DIR)), name="static-admin")

    media_dir = Path(app.state.media_dir)
    media_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/medias", StaticFiles(directory=str(media_dir)), name="medias")

    @app.middleware("http")
    async def body_limit_middleware(request: Request, call_next):
        # Garde-fou anti-saturation : les formulaires texte n'ont aucune raison
        # de dépasser 1 Mo ; les écrans d'import ont leur plafond à eux.
        raw = request.headers.get("content-length")
        if raw and raw.isdigit() and int(raw) > body_limit(request.url.path):
            return JSONResponse({"detail": "requête trop volumineuse"}, status_code=413)
        return await call_next(request)

    @app.middleware("http")
    async def headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "same-origin")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Strict-Transport-Security", "max-age=15552000")
        response.headers.setdefault(
            "Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()"
        )
        if request.url.path.startswith("/medias/"):
            # Fichiers déposés par l'admin : jamais interprétés comme du document,
            # même si un SVG ou un HTML se glissait dans le dossier.
            response.headers.setdefault("Content-Security-Policy", "default-src 'none'; sandbox")
        if request.url.path.startswith("/admin") or request.url.path.startswith("/api/"):
            response.headers.setdefault("Cache-Control", "no-store")
            # Tout ce conteneur est un back office : on interdit l'indexation au
            # niveau de la réponse, en plus du robots.txt du domaine public.
            response.headers.setdefault("X-Robots-Tag", "noindex, nofollow")
            response.headers.setdefault(
                "Content-Security-Policy",
                "default-src 'self'; img-src 'self' data: blob: "
                "https://sujeedesign.com https://admin-sujeedesign.145.241.167.66.sslip.io; "
                "style-src 'self' 'unsafe-inline'; script-src 'self'; "
                "frame-src https://sujeedesign.com https://www.sujeedesign.com; "
                "form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
            )
        return response

    @app.middleware("http")
    async def session_glissante(request: Request, call_next):
        """Prolonge la session admin tant qu'elle sert.

        Une session de plus d'un jour est réémise à chaque requête de lecture :
        même nonce, nouvelle échéance. L'écran de connexion ne revient donc que
        si l'utilisateur s'est déconnecté, ou après sept jours sans visite.
        """
        response = await call_next(request)
        if request.method not in ("GET", "HEAD"):
            return response
        # Une réponse qui pose déjà un cookie (connexion, déconnexion) fait foi.
        if response.status_code >= 400 or "set-cookie" in response.headers:
            return response
        token = request.cookies.get(security.SESSION_COOKIE, "")
        if not token:
            return response
        issued = security.token_issued_at(token)
        if issued is None or int(time.time()) - issued < security.SESSION_RENEW_AFTER:
            return response
        renewed = security.renew_session(token)
        if renewed is None:
            return response
        secure = settings_module.cookie_secure()
        response.set_cookie(
            security.SESSION_COOKIE,
            renewed,
            max_age=security.SESSION_TTL,
            httponly=True,
            samesite="lax",
            secure=secure,
            path="/",
        )
        response.set_cookie(
            security.UI_MARKER_COOKIE,
            "1",
            max_age=security.SESSION_TTL,
            httponly=False,
            samesite="lax",
            secure=secure,
            path="/",
        )
        return response

    @app.get("/")
    def racine() -> RedirectResponse:
        return RedirectResponse("/admin", status_code=303)

    @app.get("/sante")
    @app.get("/api/health")  # compatibilité du healthcheck Coolify existant
    def sante() -> JSONResponse:
        # `publication` expose seulement l'état du mode rapide, jamais les secrets.
        return JSONResponse(
            {
                "ok": True,
                "service": "back office Sujee Design",
                "publication": {"rapide": content_store.fast_publish_ready(), "deploiement": content_store.publish_ready()},
            }
        )

    app.include_router(admin.router)
    app.include_router(contact.router)
    app.include_router(contact.sync)
    app.include_router(agent_module.routes)
    app.include_router(agent_module.sync)
    app.include_router(content_routes.router)
    app.include_router(api_admin.router)
    app.include_router(editor_api.router)
    return app


app = create_app()
