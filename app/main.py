"""Application du back office Sujee Design.

Ne sert plus la vitrine : celle-ci est un site Next.js déployé séparément.
Ce service expose l'administration (connexion, contenu, messages, médias,
réglages) et le petit API consommé par la vitrine et par le formulaire.
"""

from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from . import admin, api_admin, contact, content_routes, editor_api
from . import content as content_store
from . import settings as settings_module
from .db import connect, init_db
from .ui import templates  # noqa: F401  (initialise les filtres Jinja)

log = logging.getLogger("sujee.admin")

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "admin_static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    path = Path(app.state.db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = connect(path)
    try:
        init_db(conn)
        conn.commit()
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
    async def headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "same-origin")
        response.headers.setdefault("X-Frame-Options", "DENY")
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
    app.include_router(content_routes.router)
    app.include_router(api_admin.router)
    app.include_router(editor_api.router)
    return app


app = create_app()
