"""Application FastAPI du site sujeedesign.com : vitrine, back office, contact."""

from __future__ import annotations

import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Iterator

from fastapi import Depends, FastAPI, Request
from fastapi.staticfiles import StaticFiles

from . import admin as admin_module
from . import contact as contact_module
from . import db as db_module
from . import public as public_module
from . import render as render_module
from . import repo as repo_module
from . import seed as seed_module
from . import security as security_module
from . import settings as settings_module
from .settings import VERSION

import sujee_editor

THEME_ASSETS = Path(__file__).resolve().parents[1] / "theme" / "assets"


def create_app(db_path: str | Path | None = None) -> FastAPI:
    """Construit l'application. `db_path` permet d'isoler les tests.

    Quand un chemin de base est fourni (tests, outils), l'application ne touche
    pas au contenu : le chargement du contenu initial ne concerne que le
    démarrage réel du site sur un volume vide.
    """
    explicit_db = db_path is not None
    resolved = Path(db_path) if db_path is not None else settings_module.db_path()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        conn = db_module.connect(resolved)
        try:
            db_module.init_db(conn)
            if not explicit_db:
                # Premier démarrage réel sur un volume vide : contenu initial.
                seed_module.seed_if_empty(conn, Path(__file__).resolve().parents[1] / "seed" / "content.json")
        finally:
            conn.close()
        yield

    app = FastAPI(
        title="Sujee Design",
        version=VERSION,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        lifespan=lifespan,
    )
    app.state.db_path = resolved
    app.state.login_limiter = security_module.RateLimiter()
    app.state.contact_limiter = security_module.RateLimiter()

    def get_db(request: Request) -> Iterator[sqlite3.Connection]:
        conn = db_module.connect(request.app.state.db_path)
        try:
            yield conn
        finally:
            conn.close()

    app.state.get_db = get_db
    app.state.render_env = render_module.build_env()
    media_root = resolved.parent / "medias"
    media_root.mkdir(parents=True, exist_ok=True)
    # L'éditeur est monté AVANT /assets : les routes sont évaluées dans l'ordre,
    # sinon le montage parent répondrait pour /assets/editor/*.
    sujee_editor.Editor(
        db_path=resolved,
        session_secret=security_module.session_secret,
        media_dir=str(media_root),
        page_path=repo_module.page_path,
    ).mount(app)
    app.mount("/assets", StaticFiles(directory=str(THEME_ASSETS)), name="assets")
    app.mount("/medias", StaticFiles(directory=str(media_root)), name="medias")

    @app.get("/api/health")
    def health(conn: sqlite3.Connection = Depends(get_db)) -> dict:
        revision = db_module.content_revision(conn)
        return {"ok": True, "version": VERSION, "revision": revision}

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        """En-têtes de durcissement communs à toutes les réponses."""
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if request.url.scheme == "https":
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response

    app.include_router(admin_module.router)
    app.include_router(admin_module.api, prefix="/api/admin")
    app.include_router(contact_module.router)
    app.include_router(contact_module.sync)
    app.include_router(public_module.router)

    return app


app = create_app()
