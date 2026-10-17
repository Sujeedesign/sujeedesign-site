"""Éditeur de blocs Sujee : paquet réutilisable pour les sites de la stack Sujee.

Un site fournit ses jetons de design, ses gabarits de blocs et les blocs qu'il
active. Il n'écrit jamais l'éditeur : il le monte.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable, Mapping

from .blocks import DEFAULT_BLOCKS, Block, Field, Kind, default_data, get_block
from .routes import API_PREFIX, ASSETS_PREFIX, build_router, default_page_path
from .store import PageState, SectionState, Store
from .tokens import CSRF_HEADER, SESSION_COOKIE, SESSION_TTL, make_csrf, make_session, verify_session

PACKAGE_ROOT = Path(__file__).resolve().parent
EDITOR_TEMPLATES = PACKAGE_ROOT / "editor" / "templates"
EDITOR_ASSETS = PACKAGE_ROOT / "editor" / "static"


class Editor:
    """Assemble le store, l'API et les ressources de l'éditeur."""

    def __init__(
        self,
        *,
        db_path: str | Path,
        session_secret: str | Callable[[], str],
        blocks: Mapping[str, Block] | None = None,
        media_dir: str | Path | None = None,
        page_path: Callable[[dict[str, Any]], str] | None = None,
        cookie_name: str = SESSION_COOKIE,
        session_ttl: int = SESSION_TTL,
    ) -> None:
        self.blocks: dict[str, Block] = dict(blocks or DEFAULT_BLOCKS)
        self.store = Store(db_path, self.blocks)
        self._secret = session_secret
        self.cookie_name = cookie_name
        self.media_dir = Path(media_dir) if media_dir else None
        self.page_path = page_path or default_page_path
        self.templates_dir = EDITOR_TEMPLATES
        self.assets_dir = EDITOR_ASSETS
        self.router = build_router(
            self.store,
            session_secret=session_secret,
            cookie_name=cookie_name,
            session_ttl=session_ttl,
            media_dir=self.media_dir,
            page_path=self.page_path,
        )

    @property
    def session_secret(self) -> str:
        """Secret de signature, résolu à l'usage (une fonction est appelée)."""
        return self._secret() if callable(self._secret) else str(self._secret)

    def mount(self, app: Any) -> None:
        """Branche l'API et les ressources de l'éditeur sur une application FastAPI.

        Les ressources sont montées avant tout montage parent de `/assets`.
        """
        from fastapi.staticfiles import StaticFiles

        app.include_router(self.router, prefix=API_PREFIX)
        app.mount(ASSETS_PREFIX, StaticFiles(directory=str(self.assets_dir)), name="editor-assets")
        app.state.editor = self

    def page_payload(self, conn: Any, page_id: int) -> dict[str, Any]:
        """État complet d'une page, injecté dans la page pour le canevas."""
        state = self.store.page_state(conn, page_id)
        page = dict(state.page)
        return {
            "api": API_PREFIX,
            "assets": ASSETS_PREFIX,
            "csrf": make_csrf(self.session_secret),
            "page": {
                "id": int(page.get("id") or 0),
                "slug": str(page.get("slug") or ""),
                "title": str(page.get("title") or ""),
                "kind": str(page.get("kind") or "page"),
                "status": str(page.get("status") or ""),
                "path": self.page_path(page),
            },
            "sections": [section.serialize() for section in state.sections],
            "blocks": [block.serialize() for block in self.blocks.values()],
            "revisions": state.revisions,
        }


__all__ = [
    "ASSETS_PREFIX",
    "API_PREFIX",
    "Block",
    "CSRF_HEADER",
    "DEFAULT_BLOCKS",
    "Editor",
    "Field",
    "Kind",
    "PageState",
    "SectionState",
    "Store",
    "default_data",
    "get_block",
    "make_csrf",
    "make_session",
    "verify_session",
]
