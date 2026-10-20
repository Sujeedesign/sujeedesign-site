"""Routes de l'éditeur : état, brouillon, structure, publication, révisions, médias.

Le routeur ne connaît que le `Store` et le schéma de blocs : le site le monte
sous `/api/editor` avec son propre secret de session.
"""

from __future__ import annotations

import json
import secrets
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

from .blocks import Block, ValidationError
from .editor.project import ProjectError, migrate_project, project_to_sections, sections_to_project
from .editor.theme import SUPPORTED_SECTION_TYPES, THEME_ID, THEME_VERSION
from .store import (
    PageState,
    SectionState,
    Store,
    StoreNotReady,
    SourceConflict,
    UnknownPage,
    UnknownRevision,
    UnknownSection,
    ValidationFailed,
    VersionConflict,
)
from .tokens import (
    CSRF_HEADER,
    SESSION_COOKIE,
    SESSION_TTL,
    make_csrf,
    verify_csrf,
    verify_session,
)

ALLOWED_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".avif", ".svg", ".gif", ".pdf")
MIME_BY_EXTENSION = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
}
MAX_UPLOAD_BYTES = 8 * 1024 * 1024
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
API_PREFIX = "/api/editor"
ASSETS_PREFIX = "/assets/editor"
MAX_VISUAL_PROJECT_BYTES = 1024 * 1024


def default_page_path(page: dict[str, Any]) -> str:
    kind = str(page.get("kind") or "page")
    slug = str(page.get("slug") or "")
    if kind == "accueil":
        return "/"
    if kind == "realisation":
        return f"/realisations/{slug}"
    if kind == "service":
        return f"/services/{slug}"
    return f"/{slug}"


def build_router(
    store: Store,
    *,
    session_secret: str | Callable[[], str],
    cookie_name: str = SESSION_COOKIE,
    session_ttl: int = SESSION_TTL,
    media_dir: str | Path | None = None,
    page_path: Callable[[dict[str, Any]], str] | None = None,
    max_upload_bytes: int = MAX_UPLOAD_BYTES,
) -> APIRouter:
    """Construit le routeur de l'éditeur pour un `Store` donné.

    Le secret peut être une fonction : il est alors résolu à chaque requête, ce
    qui permet de démarrer l'application avant que l'environnement soit complet.
    """
    router = APIRouter()
    media_root = Path(media_dir) if media_dir else None
    path_for = page_path or default_page_path

    def secret() -> str:
        return session_secret() if callable(session_secret) else str(session_secret)

    def require_session(request: Request) -> str:
        token = request.cookies.get(cookie_name, "")
        if not verify_session(token, secret()):
            raise HTTPException(status_code=401, detail="session requise")
        return "sujee"

    def check_csrf(request: Request) -> None:
        if request.method in SAFE_METHODS:
            return
        if not verify_csrf(request.headers.get(CSRF_HEADER, ""), secret()):
            raise HTTPException(status_code=403, detail="jeton CSRF manquant ou invalide")

    def check_origin(request: Request) -> None:
        if request.method in SAFE_METHODS:
            return
        origin = request.headers.get("origin") or ""
        host = request.headers.get("host") or ""
        if not origin:
            return
        parsed = urlsplit(origin)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.netloc
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
            or not host
            or parsed.netloc.casefold() != host.casefold()
        ):
            raise HTTPException(status_code=403, detail="origine refusée")

    guarded = [Depends(check_origin), Depends(require_session), Depends(check_csrf)]

    def _error(status: int, rule: str, detail: str = "", field: str = "") -> HTTPException:
        return HTTPException(status_code=status, detail={"rule": rule, "detail": detail, "field": field})

    def _section_json(state: SectionState) -> dict[str, Any]:
        return state.serialize()

    def _page_json(state: PageState) -> dict[str, Any]:
        page = dict(state.page)
        return {
            "id": int(page.get("id") or 0),
            "slug": str(page.get("slug") or ""),
            "title": str(page.get("title") or ""),
            "kind": str(page.get("kind") or "page"),
            "status": str(page.get("status") or ""),
            "path": path_for(page),
        }

    def _state_payload(state: PageState) -> dict[str, Any]:
        return {
            "page": _page_json(state),
            "sections": [_section_json(section) for section in state.sections],
            "blocks": [block.serialize() for block in store.blocks.values()],
            "revisions": state.revisions,
            "csrf": make_csrf(secret()),
        }

    async def _json(request: Request) -> dict[str, Any]:
        try:
            payload = await request.json()
        except Exception:
            return {}
        return payload if isinstance(payload, dict) else {}

    def _fail(status: int, rule: str, detail: str = "", field: str = "", **extra: Any) -> JSONResponse:
        body: dict[str, Any] = {"error": {"rule": rule, "detail": detail, "field": field}}
        body.update(extra)
        return JSONResponse(status_code=status, content=body)

    def _validation_fail(exc: ValidationFailed, **extra: Any) -> JSONResponse:
        first: ValidationError = exc.errors[0] if exc.errors else ValidationError("", "invalide")
        return _fail(400, first.rule, first.detail, first.field, **extra)

    def _read(page_id: int) -> dict[str, Any]:
        conn = store.connect()
        try:
            return _state_payload(store.page_state(conn, page_id))
        except UnknownPage as exc:
            raise HTTPException(status_code=404, detail="page introuvable") from exc
        finally:
            conn.close()

    def _ensure_visual_project(conn: Any, page_id: int) -> Any:
        state = store.page_state(conn, page_id)
        row = conn.execute("SELECT * FROM visual_projects WHERE page_id = ?", (int(page_id),)).fetchone()
        if row is not None:
            if row["theme_id"] != THEME_ID:
                raise ProjectError("identifiant de thème non pris en charge")
            draft_text = str(row["draft_project_json"] or "")
            published_text = str(row["published_project_json"] or "")
            try:
                draft = json.loads(draft_text)
                published = json.loads(published_text)
                draft = migrate_project(draft)
                published = migrate_project(published)
                # Canonical typed conversion adds the data attribute required by
                # the schema panel while retaining the v1 section IDs and values.
                draft = sections_to_project(project_to_sections(draft))
                published = sections_to_project(project_to_sections(published))
            except (json.JSONDecodeError, TypeError, ProjectError) as exc:
                raise ProjectError(f"projet visuel stocké invalide : {exc}") from exc
            if int(row["theme_version"]) != THEME_VERSION or draft_text != json.dumps(draft, ensure_ascii=False, separators=(",", ":")) or published_text != json.dumps(published, ensure_ascii=False, separators=(",", ":")):
                encoded_draft = json.dumps(draft, ensure_ascii=False, separators=(",", ":"))
                encoded_published = json.dumps(published, ensure_ascii=False, separators=(",", ":"))
                conn.execute("BEGIN IMMEDIATE")
                try:
                    updated = conn.execute(
                        "UPDATE visual_projects SET draft_project_json = ?, published_project_json = ?, theme_id = ?, theme_version = ?, updated_at = datetime('now') "
                        "WHERE page_id = ? AND draft_version = ? AND theme_id = ? AND theme_version = ? AND draft_project_json = ? AND published_project_json = ?",
                        (encoded_draft, encoded_published, THEME_ID, THEME_VERSION, int(page_id), int(row["draft_version"]), row["theme_id"], int(row["theme_version"]), draft_text, published_text),
                    )
                    if updated.rowcount != 1:
                        raise ProjectError("projet visuel modifié pendant sa migration")
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
                row = conn.execute("SELECT * FROM visual_projects WHERE page_id = ?", (int(page_id),)).fetchone()
            return row
        supported = [section.serialize() for section in state.sections if section.type in SUPPORTED_SECTION_TYPES]
        project = sections_to_project(supported)
        encoded = json.dumps(project, ensure_ascii=False, separators=(",", ":"))
        conn.execute(
            "INSERT OR IGNORE INTO visual_projects "
            "(page_id, draft_project_json, published_project_json, draft_version, theme_id, theme_version) "
            "VALUES (?, ?, ?, 0, ?, ?)",
            (int(page_id), encoded, encoded, THEME_ID, THEME_VERSION),
        )
        conn.commit()
        return conn.execute("SELECT * FROM visual_projects WHERE page_id = ?", (int(page_id),)).fetchone()

    async def _visual_payload(request: Request) -> dict[str, Any]:
        content_length = request.headers.get("content-length", "")
        if content_length:
            try:
                if int(content_length) > MAX_VISUAL_PROJECT_BYTES:
                    raise HTTPException(status_code=400, detail="projet trop volumineux")
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="taille de requête invalide") from exc
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > MAX_VISUAL_PROJECT_BYTES:
                raise HTTPException(status_code=400, detail="projet trop volumineux")
        try:
            payload = json.loads(body)
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise HTTPException(status_code=400, detail="JSON invalide") from exc
        if not isinstance(payload, dict):
            raise HTTPException(status_code=400, detail="objet JSON attendu")
        return payload

    def _expected_version(payload: dict[str, Any]) -> int:
        value = payload.get("expected_version")
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise HTTPException(status_code=400, detail="version attendue invalide")
        return value

    def _check_visual_section_ids(conn: Any, page_id: int, sections: list[dict[str, Any]]) -> None:
        rows = conn.execute("SELECT id, type FROM sections WHERE page_id = ?", (int(page_id),)).fetchall()
        existing = {int(row["id"]): str(row["type"]) for row in rows}
        for section in sections:
            identifier = section.get("id")
            if identifier is None:
                continue
            current_type = existing.get(int(identifier))
            if current_type is None:
                raise ProjectError("identifiant de section étranger à cette page")
            if current_type != section.get("type"):
                raise ProjectError("type d’une section existante modifié")

    @router.get("/pages/{page_id}/visual-project")
    def read_visual_project(page_id: int, _: None = Depends(require_session)) -> Any:
        conn = store.connect()
        try:
            try:
                row = _ensure_visual_project(conn, page_id)
            except UnknownPage as exc:
                raise HTTPException(status_code=404, detail="page introuvable") from exc
            except ProjectError as exc:
                return _fail(409, "unsupported_section", str(exc))
            return {
                "project": json.loads(row["draft_project_json"]),
                "draft_version": int(row["draft_version"]),
                "theme_id": str(row["theme_id"]),
                "theme_version": int(row["theme_version"]),
                "csrf": make_csrf(secret()),
            }
        finally:
            conn.close()

    @router.put("/pages/{page_id}/visual-project")
    async def save_visual_project(page_id: int, request: Request, _: None = Depends(check_origin)) -> Any:
        require_session(request)
        check_csrf(request)
        payload = await _visual_payload(request)
        expected = _expected_version(payload)
        project = payload.get("project")
        try:
            sections = project_to_sections(project)
            project = sections_to_project(sections)
        except ProjectError as exc:
            return _fail(400, "bad_project", str(exc))
        encoded = json.dumps(project, ensure_ascii=False, separators=(",", ":"))
        if len(encoded.encode("utf-8")) > MAX_VISUAL_PROJECT_BYTES:
            return _fail(400, "too_large")
        conn = store.connect()
        try:
            try:
                row = _ensure_visual_project(conn, page_id)
            except UnknownPage as exc:
                raise HTTPException(status_code=404, detail="page introuvable") from exc
            except ProjectError as exc:
                return _fail(409, "unsupported_section", str(exc))
            try:
                _check_visual_section_ids(conn, page_id, sections)
            except ProjectError as exc:
                return _fail(400, "bad_project", str(exc))
            conn.execute("BEGIN IMMEDIATE")
            current = conn.execute("SELECT draft_version FROM visual_projects WHERE page_id = ?", (int(page_id),)).fetchone()
            if current is None:
                conn.rollback()
                raise HTTPException(status_code=404, detail="projet visuel introuvable")
            current_version = int(current["draft_version"])
            if current_version != expected:
                conn.rollback()
                return _fail(409, "version", f"version courante {current_version}", current_version=current_version)
            updated = conn.execute(
                "UPDATE visual_projects SET draft_project_json = ?, theme_id = ?, theme_version = ?, "
                "draft_version = draft_version + 1, updated_at = datetime('now') "
                "WHERE page_id = ? AND draft_version = ?",
                (encoded, THEME_ID, THEME_VERSION, int(page_id), expected),
            )
            if updated.rowcount == 0:
                conn.rollback()
                return _fail(409, "version")
            conn.commit()
            return {"ok": True, "draft_version": expected + 1}
        finally:
            conn.close()

    @router.post("/pages/{page_id}/visual-project/rebase")
    async def rebase_visual_project(page_id: int, request: Request, _: None = Depends(check_origin)) -> Any:
        require_session(request)
        check_csrf(request)
        payload = await _visual_payload(request)
        expected = _expected_version(payload)
        conn = store.connect()
        try:
            try:
                _ensure_visual_project(conn, page_id)
                return store.reset_visual_project(conn, page_id=page_id, expected_version=expected)
            except UnknownPage as exc:
                raise HTTPException(status_code=404, detail="page introuvable") from exc
            except VersionConflict as exc:
                return _fail(409, "version", f"version courante {exc.current}", current_version=exc.current)
            except StoreNotReady as exc:
                raise HTTPException(status_code=503, detail=str(exc)) from exc
        finally:
            conn.close()

    @router.post("/pages/{page_id}/visual-project/publish")
    async def publish_visual_project(page_id: int, request: Request, _: None = Depends(check_origin)) -> Any:
        require_session(request)
        check_csrf(request)
        payload = await _visual_payload(request)
        expected = _expected_version(payload)
        conn = store.connect()
        try:
            try:
                row = _ensure_visual_project(conn, page_id)
            except UnknownPage as exc:
                raise HTTPException(status_code=404, detail="page introuvable") from exc
            except ProjectError as exc:
                return _fail(409, "unsupported_section", str(exc))
            if int(row["draft_version"]) != expected:
                return _fail(409, "version", f"version courante {row['draft_version']}", current_version=int(row["draft_version"]))
            project_json = str(row["draft_project_json"])
            try:
                project = json.loads(project_json)
                sections = project_to_sections(project)
                _check_visual_section_ids(conn, page_id, sections)
                result = store.publish_visual_project(
                    conn,
                    page_id=page_id,
                    expected_version=expected,
                    project_json=project_json,
                    sections=sections,
                    theme_id=str(project["theme_id"]),
                    theme_version=int(project["theme_version"]),
                )
            except ProjectError as exc:
                return _fail(400, "bad_project", str(exc))
            except SourceConflict as exc:
                return _fail(409, "source_changed", str(exc))
            except VersionConflict as exc:
                return _fail(409, "version", f"version courante {exc.current}", current_version=exc.current)
            except UnknownSection as exc:
                return _fail(400, "bad_project", f"section inconnue : {exc}")
            except UnknownPage as exc:
                raise HTTPException(status_code=404, detail="page introuvable") from exc
            except ValidationFailed as exc:
                return _validation_fail(exc)
            except StoreNotReady as exc:
                raise HTTPException(status_code=503, detail=str(exc)) from exc
            return result
        finally:
            conn.close()

    @router.get("/pages/{page_id}/state")
    def read_state(page_id: int, _: None = Depends(require_session)) -> dict[str, Any]:
        return _read(page_id)

    @router.patch("/pages/{page_id}/sections/{section_id}")
    async def write_field(page_id: int, section_id: int, request: Request, _: None = Depends(check_origin)) -> Any:
        require_session(request)
        check_csrf(request)
        payload = await _json(request)
        expected = int(payload.get("expected_version") or 0)
        conn = store.connect()
        try:
            try:
                state = store.write_field(
                    conn,
                    section_id=section_id,
                    page_id=page_id,
                    field=str(payload.get("field") or ""),
                    value=payload.get("value"),
                    expected_version=expected,
                )
            except ValidationFailed as exc:
                return _validation_fail(exc)
            except VersionConflict as exc:
                return _fail(409, "version", f"version courante {exc.current}", "", section=_section_json(store.section(conn, section_id, page_id)))
            except UnknownSection as exc:
                raise HTTPException(status_code=404, detail="bloc introuvable") from exc
            except UnknownPage as exc:
                raise HTTPException(status_code=404, detail="page introuvable") from exc
            except StoreNotReady as exc:
                raise HTTPException(status_code=503, detail=str(exc)) from exc
            return {"section": _section_json(state), "draft_version": state.draft_version}
        finally:
            conn.close()

    @router.put("/pages/{page_id}/sections/{section_id}/draft")
    async def write_draft(page_id: int, section_id: int, request: Request, _: None = Depends(check_origin)) -> Any:
        require_session(request)
        check_csrf(request)
        payload = await _json(request)
        data = payload.get("data")
        conn = store.connect()
        try:
            try:
                state = store.write_draft(
                    conn,
                    section_id=section_id,
                    page_id=page_id,
                    data=data if isinstance(data, dict) else {},
                    expected_version=int(payload.get("expected_version") or 0),
                )
            except ValidationFailed as exc:
                return _validation_fail(exc)
            except VersionConflict as exc:
                return _fail(409, "version", f"version courante {exc.current}", "", section=_section_json(store.section(conn, section_id, page_id)))
            except UnknownSection as exc:
                raise HTTPException(status_code=404, detail="bloc introuvable") from exc
            except UnknownPage as exc:
                raise HTTPException(status_code=404, detail="page introuvable") from exc
            return {"section": _section_json(state), "draft_version": state.draft_version}
        finally:
            conn.close()

    @router.post("/pages/{page_id}/sections", status_code=201)
    async def add_section(page_id: int, request: Request, _: None = Depends(check_origin)) -> Any:
        require_session(request)
        check_csrf(request)
        payload = await _json(request)
        conn = store.connect()
        try:
            try:
                state = store.add_section(
                    conn,
                    page_id=page_id,
                    type=str(payload.get("type") or ""),
                    variant=str(payload.get("variant") or ""),
                    position=payload.get("position"),
                )
            except ValidationFailed as exc:
                return _validation_fail(exc)
            except UnknownPage as exc:
                raise HTTPException(status_code=404, detail="page introuvable") from exc
            return {"section": _section_json(state), "sections": [_section_json(item) for item in store.page_state(conn, page_id).sections]}
        finally:
            conn.close()

    def _structure_call(page_id: int, section_id: int, action: str, payload: dict[str, Any]) -> Any:
        conn = store.connect()
        try:
            try:
                if action == "move":
                    store.move_section(conn, section_id=section_id, page_id=page_id, offset=int(payload.get("offset") or 0))
                    state = store.page_state(conn, page_id)
                    return {"sections": [_section_json(item) for item in state.sections]}
                if action == "duplicate":
                    created = store.duplicate_section(conn, section_id=section_id, page_id=page_id)
                    return {"section": _section_json(created)}
                state = store.toggle_section(conn, section_id=section_id, page_id=page_id)
                return {"section": _section_json(state)}
            except ValidationFailed as exc:
                return _validation_fail(exc)
            except UnknownSection as exc:
                raise HTTPException(status_code=404, detail="bloc introuvable") from exc
            except UnknownPage as exc:
                raise HTTPException(status_code=404, detail="page introuvable") from exc
        finally:
            conn.close()

    @router.post("/pages/{page_id}/sections/{section_id}/move")
    async def move_section(page_id: int, section_id: int, request: Request, _: None = Depends(check_origin)) -> Any:
        require_session(request)
        check_csrf(request)
        return _structure_call(page_id, section_id, "move", await _json(request))

    @router.post("/pages/{page_id}/sections/{section_id}/duplicate", status_code=201)
    async def duplicate_section(page_id: int, section_id: int, request: Request, _: None = Depends(check_origin)) -> Any:
        require_session(request)
        check_csrf(request)
        return _structure_call(page_id, section_id, "duplicate", {})

    @router.post("/pages/{page_id}/sections/{section_id}/toggle")
    async def toggle_section(page_id: int, section_id: int, request: Request, _: None = Depends(check_origin)) -> Any:
        require_session(request)
        check_csrf(request)
        return _structure_call(page_id, section_id, "toggle", {})

    @router.delete("/pages/{page_id}/sections/{section_id}")
    def delete_section(page_id: int, section_id: int, request: Request, _: None = Depends(check_origin)) -> Any:
        require_session(request)
        check_csrf(request)
        conn = store.connect()
        try:
            try:
                store.delete_section(conn, section_id=section_id, page_id=page_id)
            except UnknownSection as exc:
                raise HTTPException(status_code=404, detail="bloc introuvable") from exc
            except UnknownPage as exc:
                raise HTTPException(status_code=404, detail="page introuvable") from exc
            state = store.page_state(conn, page_id)
            return {"ok": True, "sections": [_section_json(item) for item in state.sections]}
        finally:
            conn.close()

    @router.post("/pages/{page_id}/publish")
    def publish(page_id: int, request: Request, _: None = Depends(check_origin)) -> Any:
        require_session(request)
        check_csrf(request)
        conn = store.connect()
        try:
            try:
                result = store.publish(conn, page_id=page_id)
            except UnknownPage as exc:
                raise HTTPException(status_code=404, detail="page introuvable") from exc
            except VersionConflict as exc:
                return _fail(409, "version", f"version courante {exc.current}", "", sections=[
                    _section_json(item) for item in store.page_state(conn, page_id).sections
                ])
            state = store.page_state(conn, page_id)
            payload = dict(result)
            payload["sections"] = [_section_json(item) for item in state.sections]
            payload["revisions"] = state.revisions
            return payload
        finally:
            conn.close()

    @router.get("/pages/{page_id}/revisions")
    def list_revisions(page_id: int, _: None = Depends(require_session)) -> dict[str, Any]:
        state = _read(page_id)
        return {"revisions": state["revisions"]}

    @router.post("/pages/{page_id}/revisions/{revision_id}/restore")
    def restore_revision(page_id: int, revision_id: int, request: Request, _: None = Depends(check_origin)) -> Any:
        require_session(request)
        check_csrf(request)
        conn = store.connect()
        try:
            try:
                state, extras = store.restore(conn, page_id=page_id, revision_id=revision_id)
            except ValidationFailed as exc:
                # Révision héritée ou hors schéma : refusée en bloc, la page
                # reste intacte.
                return _validation_fail(exc)
            except UnknownRevision as exc:
                raise HTTPException(status_code=404, detail="révision introuvable") from exc
            except UnknownPage as exc:
                raise HTTPException(status_code=404, detail="page introuvable") from exc
            payload = _state_payload(state)
            payload["extras"] = extras
            return payload
        finally:
            conn.close()

    if media_root is not None:

        @router.get("/media")
        def list_media(request: Request) -> Any:
            require_session(request)
            conn = store.connect()
            try:
                rows = conn.execute(
                    "SELECT id, filename, path, alt, caption, credit, mime, width, height, size, created_at "
                    "FROM medias ORDER BY created_at DESC, id DESC"
                ).fetchall()
                return {"medias": [dict(row) for row in rows]}
            finally:
                conn.close()

        @router.post("/media", status_code=201)
        async def upload_media(request: Request, file: UploadFile = File(...)) -> Any:
            require_session(request)
            check_csrf(request)
            extension = Path(str(file.filename or "")).suffix.lower()
            if extension not in ALLOWED_EXTENSIONS:
                return _fail(400, "bad_extension", extension)
            data = await file.read()
            if not data:
                return _fail(400, "empty_file")
            if len(data) > max_upload_bytes:
                return _fail(400, "too_large", str(len(data)))
            media_root.mkdir(parents=True, exist_ok=True)
            filename = f"{secrets.token_hex(8)}{extension}"
            target = media_root / filename
            target.write_bytes(data)
            conn = store.connect()
            try:
                try:
                    cursor = conn.execute(
                        "INSERT INTO medias (filename, path, mime, size) VALUES (?, ?, ?, ?)",
                        (filename, f"medias/{filename}", MIME_BY_EXTENSION.get(extension, ""), len(data)),
                    )
                    conn.commit()
                except Exception:
                    conn.rollback()
                    target.unlink(missing_ok=True)
                    return _fail(400, "media_not_recorded")
                row = conn.execute("SELECT * FROM medias WHERE id = ?", (int(cursor.lastrowid or 0),)).fetchone()
                return {"media": dict(row) if row is not None else {}}
            finally:
                conn.close()

    return router
