"""Application FastAPI du site sujeedesign.com : vitrine, back office, contact."""

from __future__ import annotations

import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Iterator

from fastapi import Depends, FastAPI, Request
from fastapi.staticfiles import StaticFiles

from . import db as db_module
from . import public as public_module
from . import render as render_module
from . import settings as settings_module
from .settings import VERSION

THEME_ASSETS = Path(__file__).resolve().parents[1] / "theme" / "assets"


def create_app(db_path: str | Path | None = None) -> FastAPI:
    """Construit l'application. `db_path` permet d'isoler les tests."""
    resolved = Path(db_path) if db_path is not None else settings_module.db_path()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        conn = db_module.connect(resolved)
        try:
            db_module.init_db(conn)
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

    def get_db(request: Request) -> Iterator[sqlite3.Connection]:
        conn = db_module.connect(request.app.state.db_path)
        try:
            yield conn
        finally:
            conn.close()

    app.state.get_db = get_db
    app.state.render_env = render_module.build_env()
    app.mount("/assets", StaticFiles(directory=str(THEME_ASSETS)), name="assets")
    media_root = resolved.parent / "medias"
    media_root.mkdir(parents=True, exist_ok=True)
    app.mount("/medias", StaticFiles(directory=str(media_root)), name="medias")

    @app.get("/api/health")
    def health(conn: sqlite3.Connection = Depends(get_db)) -> dict:
        revision = db_module.content_revision(conn)
        return {"ok": True, "version": VERSION, "revision": revision}

    app.include_router(public_module.router)

    return app


app = create_app()
