"""Back office : connexion, tableau de bord, éditeur de pages, médias, messages."""

from __future__ import annotations

import base64
import hashlib
import hmac
import html
import io
import json
import shutil
import sqlite3
import struct
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
from markupsafe import Markup

from . import content as content_store
from . import content_model
from . import repo
from . import public as public_module
from . import security
from . import sections as sections_module
from . import settings as settings_module
from .db import connect as db_connect
from .db import content_revision
from .render import build_env, json_load, render_page, sanitize_html
from sujee_editor.blocks import DEFAULT_BLOCKS, validate_data
from sujee_editor.editor.project import ProjectError, project_to_sections
from sujee_editor.routes import MAX_VISUAL_PROJECT_BYTES
from sujee_editor.media import safe_original_filename
from sujee_editor.tokens import CSRF_HEADER, verify_csrf

router = APIRouter()
api = APIRouter()
ENV = build_env()


def login_limiter(request: Request) -> security.RateLimiter:
    """Limiteur de débit propre à l'application (donc au processus et aux tests)."""
    limiter = getattr(request.app.state, "login_limiter", None)
    if limiter is None:
        limiter = security.RateLimiter()
        request.app.state.login_limiter = limiter
    return limiter

SESSION_COOKIE = security.SESSION_COOKIE
TEMPLATES_DIR = Path(__file__).resolve().parents[1] / "theme" / "templates" / "admin"
ALLOWED_UPLOADS = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".svg", ".gif", ".pdf"}


def _conn(request: Request) -> sqlite3.Connection:
    return db_connect(request.app.state.db_path)


def media_root(request: Request) -> Path:
    root = Path(request.app.state.db_path).parent / "medias"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _admin_csrf(request: Request) -> str:
    from sujee_editor.tokens import make_csrf

    editor = getattr(request.app.state, "editor", None)
    return make_csrf(editor.session_secret) if editor is not None else ""


def current_admin(request: Request) -> str | None:
    token = request.cookies.get(SESSION_COOKIE, "")
    if token and security.verify_session(token):
        return "sujee"
    return None


def require_admin(request: Request) -> str:
    who = current_admin(request)
    if who is None:
        raise HTTPException(status_code=401, detail="authentification requise")
    return who


def check_origin(request: Request) -> None:
    """Refuse les écritures venues d'un autre site (défense CSRF simple)."""
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return
    origin = request.headers.get("origin") or ""
    header_host = request.headers.get("host") or ""
    if origin and header_host and header_host not in origin:
        raise HTTPException(status_code=403, detail="origine refusée")


api_deps = [Depends(require_admin), Depends(check_origin)]
# La vérification d'origine est portée par le routeur : elle s'exécute avant
# l'authentification, une écriture venue d'un autre site est donc refusée (403).
api.dependencies.append(Depends(check_origin))


def render_admin(request: Request, conn: sqlite3.Connection, template: str, **context: Any) -> HTMLResponse:
    context.setdefault("settings", settings_module.all_settings(conn))
    context.setdefault("counts", repo.table_counts(conn))
    context.setdefault("current_path", request.url.path)
    context.setdefault("year", datetime.now(timezone.utc).year)
    context.setdefault("messages_flash", request.cookies.get("sjd_flash", ""))
    context.setdefault("csrf", _admin_csrf(request))
    html_out = ENV.get_template(f"admin/{template}").render(**context)
    response = HTMLResponse(html_out)
    if context.get("messages_flash"):
        response.delete_cookie("sjd_flash")
    return response


def login_redirect() -> RedirectResponse:
    return RedirectResponse("/admin/connexion", status_code=303)


# ------------------------------------------------------------------ écrans


@router.get("/admin", response_class=HTMLResponse)
def dashboard(request: Request) -> Response:
    if current_admin(request) is None:
        return login_redirect()
    conn = _conn(request)
    try:
        pages = repo.list_pages(conn, published_only=False, order="updated_at DESC")
        derniers = repo.list_messages(conn, limit=5)
        return render_admin(
            request,
            conn,
            "tableau_de_bord.html",
            page=None,
            pages=pages[:8],
            messages=derniers,
            brouillons=[p for p in pages if p["status"] != repo.PUBLISHED][:8],
        )
    finally:
        conn.close()


@router.get("/admin/connexion", response_class=HTMLResponse)
def login_form(request: Request, erreur: str = "") -> Response:
    conn = _conn(request)
    try:
        return render_admin(request, conn, "connexion.html", page=None, erreur=erreur, totp=bool(settings_module.env("TOTP_SECRET")))
    finally:
        conn.close()


@router.post("/admin/connexion")
async def login_submit(request: Request) -> Response:
    form = await request.form()
    password = str(form.get("password") or "")
    code = str(form.get("code") or "").strip()
    ip = security.hash_ip(request.client.host if request.client else "0.0.0.0")
    conn = _conn(request)
    try:
        if not login_limiter(request).allow(f"login:{ip}", limit=6, window=900):
            return render_admin(request, conn, "connexion.html", page=None, erreur="Trop de tentatives. Réessaie dans quinze minutes.")
        if not security.check_password(password):
            return render_admin(request, conn, "connexion.html", page=None, erreur="Mot de passe incorrect.")
        secret = settings_module.env("TOTP_SECRET")
        if secret and not security.verify_totp(secret, code):
            return render_admin(request, conn, "connexion.html", page=None, erreur="Code de vérification invalide.", totp=True)
        response = RedirectResponse("/admin", status_code=303)
        response.set_cookie(
            SESSION_COOKIE,
            security.make_session(),
            httponly=True,
            secure=settings_module.cookie_secure(),
            samesite="lax",
            max_age=security.SESSION_TTL,
        )
        return response
    finally:
        conn.close()


@router.post("/admin/deconnexion")
def logout() -> RedirectResponse:
    response = RedirectResponse("/admin/connexion", status_code=303)
    response.delete_cookie(SESSION_COOKIE)
    return response


@router.get("/admin/pages", response_class=HTMLResponse)
def pages_list(request: Request, kind: str = "", statut: str = "", q: str = "") -> Response:
    if current_admin(request) is None:
        return login_redirect()
    conn = _conn(request)
    try:
        pages = repo.list_pages(conn, kind=kind or None, published_only=False, order="kind, position, title")
        if statut:
            pages = [page for page in pages if page["status"] == statut]
        if q:
            needle = q.lower()
            pages = [page for page in pages if needle in (page["title"] or "").lower() or needle in (page["slug"] or "").lower()]
        counts = conn.execute(
            "SELECT page_id, COUNT(*) AS c FROM sections GROUP BY page_id"
        ).fetchall()
        return render_admin(
            request,
            conn,
            "pages.html",
            page=None,
            pages=pages,
            sections_count={int(row["page_id"]): int(row["c"]) for row in counts},
            kind=kind,
            statut=statut,
            q=q,
            kinds=[
                ("", "Toutes"),
                ("accueil", "Accueil"),
                ("page", "Pages"),
                ("service", "Services"),
                ("realisation", "Réalisations"),
            ],
        )
    finally:
        conn.close()


def _page_or_404(conn: sqlite3.Connection, page_id: int) -> sqlite3.Row:
    page = repo.page_by_id(conn, page_id)
    if page is None:
        raise HTTPException(status_code=404, detail="page introuvable")
    return page


@router.get("/admin/pages/{page_id}", response_class=HTMLResponse)
def page_editor(request: Request, page_id: int) -> Response:
    if current_admin(request) is None:
        return login_redirect()
    conn = _conn(request)
    try:
        return _render_visual_page(request, conn, page_id)
    finally:
        conn.close()


@router.get("/admin/visual/{page_id}", response_class=HTMLResponse)
def visual_page_editor(request: Request, page_id: int) -> Response:
    if current_admin(request) is None:
        return login_redirect()
    conn = _conn(request)
    try:
        _page_or_404(conn, page_id)
        return RedirectResponse(f"/admin/pages/{page_id}", status_code=303)
    finally:
        conn.close()


def _render_visual_page(request: Request, conn: sqlite3.Connection, page_id: int) -> Response:
    page = _page_or_404(conn, page_id)
    editor = request.app.state.editor
    state = editor.store.page_state(conn, page_id)
    from sujee_editor.blocks import DEFAULT_BLOCKS
    from sujee_editor.editor.project import ProjectError
    from sujee_editor.editor.theme import SUPPORTED_SECTION_TYPES
    from sujee_editor.routes import ensure_visual_project

    unsupported = [section for section in state.sections if section.type not in SUPPORTED_SECTION_TYPES]
    if unsupported:
        labels = list(dict.fromkeys(section.type for section in unsupported))
        message = "Éditeur visuel indisponible : import non lossless pour ces sections : " + html.escape(", ".join(labels))
        return HTMLResponse(message + ". Les sections et le projet de la page restent inchangés.", status_code=409)

    try:
        row = ensure_visual_project(editor.store, conn, page_id)
    except ProjectError as exc:
        return HTMLResponse(f"Éditeur visuel indisponible : {html.escape(str(exc))}", status_code=409)
    config = {
        "api": "/api/editor",
        "preview_api": f"/api/admin/pages/{page_id}/visual-preview",
        "page": _page_payload(page),
        "csrf": _admin_csrf(request),
        "draft_version": int(row["draft_version"]),
        "project": json.loads(row["draft_project_json"]),
        "theme_styles": ["/assets/site.css", "/assets/site-extras.css", "/assets/site-noscript.css"],
        "blocks": {name: block.serialize() for name, block in DEFAULT_BLOCKS.items()},
    }
    config_json = json.dumps(config, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    return render_admin(
        request, conn, "visual_page.html", page=page, page_path=repo.page_path(page),
        csrf=_admin_csrf(request), config_json=config_json,
    )


@router.get("/admin/apercu/{page_id}", response_class=HTMLResponse)
def preview(request: Request, page_id: int) -> Response:
    if current_admin(request) is None:
        return login_redirect()
    conn = _conn(request)
    try:
        page = _page_or_404(conn, page_id)
        from .public import build_ctx

        ctx = build_ctx(request, conn, page, {"preview": True})
        ctx["body_class"] = "project-page" if page["kind"] == "realisation" else ""
        sections = repo.sections_for(conn, page_id)
        html_out = render_page(ENV, page=page, sections=sections, ctx=ctx, template="pages/page.html", use_cache=False)
        return HTMLResponse(html_out, headers={"X-Robots-Tag": "noindex"})
    finally:
        conn.close()


@router.get("/admin/medias", response_class=HTMLResponse)
def medias_screen(request: Request) -> HTMLResponse:
    if current_admin(request) is None:
        return login_redirect()
    conn = _conn(request)
    try:
        return render_admin(request, conn, "medias.html", page=None, medias=repo.list_medias(conn))
    finally:
        conn.close()


@router.get("/admin/messages", response_class=HTMLResponse)
def messages_screen(request: Request, statut: str = "") -> HTMLResponse:
    if current_admin(request) is None:
        return login_redirect()
    conn = _conn(request)
    try:
        return render_admin(
            request,
            conn,
            "messages.html",
            page=None,
            messages=repo.list_messages(conn, status=statut or None),
            statut=statut,
        )
    finally:
        conn.close()


@router.get("/admin/reglages", response_class=HTMLResponse)
def settings_screen(request: Request) -> HTMLResponse:
    if current_admin(request) is None:
        return login_redirect()
    conn = _conn(request)
    try:
        return render_admin(
            request,
            conn,
            "reglages.html",
            page=None,
            reglages=settings_module.all_settings(conn),
            default_settings=settings_module.DEFAULT_SETTINGS,
            redirects=repo.list_redirects(conn),
        )
    finally:
        conn.close()


# ------------------------------------------------------- contenu du site (Next)


def _flash(url: str, message: str) -> RedirectResponse:
    response = RedirectResponse(url, status_code=303)
    response.set_cookie("sjd_flash", message, max_age=90, httponly=True, samesite="lax")
    return response


def _check_form_csrf(request: Request, token: str) -> None:
    editor = getattr(request.app.state, "editor", None)
    if editor is None or not verify_csrf(token, editor.session_secret):
        raise HTTPException(status_code=403, detail="jeton CSRF invalide")


@router.get("/admin/contenu", response_class=HTMLResponse)
def content_screen(request: Request, erreur: str = "") -> Response:
    if current_admin(request) is None:
        return login_redirect()
    conn = _conn(request)
    try:
        document = content_store.load_doc(conn, "home")
        return render_admin(
            request,
            conn,
            "contenu.html",
            page=None,
            document=document,
            sections=content_model.form_sections("home", document["data"]),
            publication=content_store.last_publication(conn),
            publish_ready=content_store.publish_ready(),
            erreur=erreur,
        )
    finally:
        conn.close()


@router.post("/admin/contenu")
async def content_save(request: Request) -> Response:
    if current_admin(request) is None:
        return login_redirect()
    form = await request.form()
    _check_form_csrf(request, str(form.get("csrf") or ""))
    conn = _conn(request)
    try:
        base = content_store.load_doc(conn, "home")["data"]
        try:
            doc = content_model.from_form("home", form, base)
        except content_model.ContentError as exc:
            return _flash(f"/admin/contenu?erreur={str(exc)}", f"Rien n'a été enregistré : {exc}")
        content_store.save_doc(conn, "home", doc)
        if str(form.get("action") or "") == "publier":
            result = content_store.request_publish(conn, "home")
            if not result.get("ok"):
                return _flash("/admin/contenu", f"Contenu enregistré, mais la publication a échoué : {result.get('error')}")
            return _flash("/admin/contenu", "Contenu enregistré. Publication lancée, le site est à jour dans deux minutes environ.")
        return _flash("/admin/contenu", "Contenu enregistré.")
    finally:
        conn.close()


@router.post("/admin/contenu/publier")
def content_publish(request: Request) -> Response:
    if current_admin(request) is None:
        return login_redirect()
    conn = _conn(request)
    try:
        result = content_store.request_publish(conn, "home")
        if not result.get("ok"):
            return _flash("/admin/contenu", f"Publication impossible : {result.get('error')}")
        return _flash("/admin/contenu", "Publication lancée. Le site est à jour dans deux minutes environ.")
    finally:
        conn.close()


@router.get("/admin/sauvegarde", response_class=HTMLResponse)
def backup_screen(request: Request) -> HTMLResponse:
    if current_admin(request) is None:
        return login_redirect()
    conn = _conn(request)
    try:
        return render_admin(request, conn, "sauvegarde.html", page=None, revisions=repo.list_revisions(conn, limit=60))
    finally:
        conn.close()


# ------------------------------------------------------------------ API


@api.get("/schema")
def api_schema(_: str = Depends(require_admin)) -> dict:
    types = {}
    for name, spec in sections_module.SECTION_TYPES.items():
        types[name] = {
            "label": spec.get("label", name),
            "description": spec.get("description", ""),
            "variants": spec.get("variants", {}),
            "fields": spec.get("fields", []),
        }
    return {"types": types}


def _page_payload(page: sqlite3.Row) -> dict:
    data = {key: page[key] for key in page.keys()}
    data["categories"] = json_load(data.get("categories"), [])
    data["meta"] = json_load(data.get("meta"), {})
    data["path"] = repo.page_path(page)
    return data


@api.get("/pages")
def api_pages(request: Request, kind: str = "", statut: str = "", _: str = Depends(require_admin)) -> dict:
    conn = _conn(request)
    try:
        pages = repo.list_pages(conn, kind=kind or None, published_only=False, order="kind, position, title")
        if statut:
            pages = [page for page in pages if page["status"] == statut]
        return {"pages": [_page_payload(page) for page in pages]}
    finally:
        conn.close()


@api.get("/pages/{page_id}")
def api_page(request: Request, page_id: int, _: str = Depends(require_admin)) -> dict:
    conn = _conn(request)
    try:
        page = _page_or_404(conn, page_id)
        sections = []
        for row in repo.sections_for(conn, page_id):
            sections.append(
                {
                    "id": row["id"],
                    "position": row["position"],
                    "type": row["type"],
                    "variant": row["variant"],
                    "label": row["label"],
                    "visible": row["visible"],
                    "data": json_load(row["data"], {}),
                    "type_label": sections_module.SECTION_TYPES.get(row["type"], {}).get("label", row["type"]),
                }
            )
        return {"page": _page_payload(page), "sections": sections}
    finally:
        conn.close()


@api.post("/pages/{page_id}/visual-preview", response_class=HTMLResponse)
async def api_visual_preview(
    request: Request,
    page_id: int,
    _: str = Depends(require_admin),
    __: None = Depends(check_origin),
) -> HTMLResponse:
    """Render the unsaved visual project through the real public templates."""
    editor = getattr(request.app.state, "editor", None)
    if editor is None or not verify_csrf(request.headers.get(CSRF_HEADER, ""), editor.session_secret):
        raise HTTPException(status_code=403, detail="jeton CSRF invalide")
    raw_payload = await request.body()
    if len(raw_payload) > MAX_VISUAL_PROJECT_BYTES:
        raise HTTPException(status_code=413, detail="projet visuel trop volumineux")
    try:
        payload = json.loads(raw_payload)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="JSON invalide") from exc
    if not isinstance(payload, dict) or not isinstance(payload.get("project"), dict):
        raise HTTPException(status_code=400, detail="projet visuel manquant")
    try:
        sections = project_to_sections(payload["project"])
    except ProjectError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    conn = _conn(request)
    try:
        page = _page_or_404(conn, page_id)
        existing = {
            int(row["id"]): str(row["type"])
            for row in conn.execute("SELECT id, type FROM sections WHERE page_id = ?", (page_id,))
        }
        for section in sections:
            identifier = section.get("id")
            if identifier is not None and existing.get(int(identifier)) != section.get("type"):
                raise HTTPException(status_code=400, detail="section étrangère ou type modifié")
        extra: dict[str, Any] = {"editor_preview": True}
        if page["kind"] == "realisation":
            extra["breadcrumb"] = "Réalisations"
        ctx = public_module.build_ctx(request, conn, page, extra)
        ctx["body_class"] = "project-page" if page["kind"] == "realisation" else ""
        ctx["editor_enabled"] = False
        ctx["edit"] = False
        ctx["form_token"] = ""
        ctx["seo"]["robots"] = "noindex,nofollow"
        rendered = render_page(
            public_module.ENV,
            page=page,
            sections=sections,
            ctx=ctx,
            template="pages/page.html",
            use_cache=False,
        )
        return HTMLResponse(rendered, headers={"Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow"})
    finally:
        conn.close()


@api.post("/pages")
async def api_create_page(request: Request, _: str = Depends(require_admin), __: None = Depends(check_origin)) -> dict:
    payload = await request.json()
    conn = _conn(request)
    try:
        slug = (payload.get("slug") or "").strip() or slugify(payload.get("title") or "page")
        if repo.page_by_slug(conn, slug, published_only=False) is not None:
            raise HTTPException(status_code=409, detail=f"le slug « {slug} » existe déjà")
        page_id = repo.create_page(
            conn,
            {
                "slug": slug,
                "kind": payload.get("kind") or "page",
                "title": payload.get("title") or "Nouvelle page",
                "status": repo.DRAFT,
                "menu_label": payload.get("menu_label") or "",
                "excerpt": payload.get("excerpt") or "",
                "robots": "index,follow",
            },
        )
        repo.create_section(conn, page_id, {"type": "hero", "variant": "simple", "label": "Bandeau", "data": {"kicker": "", "title": payload.get("title") or "", "intro": ""}})
        conn.commit()
        return {"ok": True, "id": page_id, "slug": slug}
    finally:
        conn.close()


@api.delete("/pages/{page_id}")
def api_delete_page(request: Request, page_id: int, _: str = Depends(require_admin), __: None = Depends(check_origin)) -> dict:
    conn = _conn(request)
    try:
        page = _page_or_404(conn, page_id)
        if page["kind"] == "accueil":
            raise HTTPException(status_code=400, detail="la page d'accueil ne peut pas être supprimée")
        repo.save_revision(conn, "page", page_id, repo.snapshot_page(conn, page_id), "suppression")
        repo.delete_page(conn, page_id)
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@api.patch("/pages/{page_id}")
async def api_update_page(request: Request, page_id: int, _: str = Depends(require_admin), __: None = Depends(check_origin)) -> dict:
    from sujee_editor.tokens import CSRF_HEADER, verify_csrf

    editor = request.app.state.editor
    if not verify_csrf(request.headers.get(CSRF_HEADER, ""), editor.session_secret):
        raise HTTPException(status_code=403, detail="jeton CSRF invalide")
    payload = await request.json()
    conn = _conn(request)
    try:
        page = _page_or_404(conn, page_id)
        repo.save_revision(conn, "page", page_id, repo.snapshot_page(conn, page_id), "modification")
        values = dict(payload)
        if "slug" in values:
            values["slug"] = slugify(values["slug"])
            other = repo.page_by_slug(conn, values["slug"], published_only=False)
            if other is not None and int(other["id"]) != page_id:
                raise HTTPException(status_code=409, detail="ce slug est déjà utilisé")
        for key in ("title", "excerpt", "menu_label", "seo_title", "seo_description"):
            if key in values:
                values[key] = sanitize_html(values[key])
        repo.update_page(conn, page_id, values)
        conn.commit()
        updated = _page_or_404(conn, page_id)
        return {"ok": True, "page": _page_payload(updated)}
    finally:
        conn.close()


@api.post("/pages/{page_id}/dupliquer")
def api_duplicate_page(request: Request, page_id: int, _: str = Depends(require_admin), __: None = Depends(check_origin)) -> dict:
    conn = _conn(request)
    try:
        page = _page_or_404(conn, page_id)
        base_slug = f"{page['slug']}-copie"
        slug = base_slug
        counter = 2
        while repo.page_by_slug(conn, slug, published_only=False) is not None:
            slug = f"{base_slug}-{counter}"
            counter += 1
        values = {key: page[key] for key in page.keys() if key not in {"id", "created_at", "updated_at", "published_at"}}
        values.update({"slug": slug, "title": f"{page['title']} (copie)", "status": repo.DRAFT, "in_menu": 0})
        new_id = repo.create_page(conn, values)
        for row in repo.sections_for(conn, page_id):
            repo.create_section(conn, new_id, {"position": row["position"], "type": row["type"], "variant": row["variant"], "label": row["label"], "visible": row["visible"], "data": json_load(row["data"], {})})
        conn.commit()
        return {"ok": True, "id": new_id, "slug": slug}
    finally:
        conn.close()


@api.post("/pages/{page_id}/statut")
async def api_page_status(request: Request, page_id: int, _: str = Depends(require_admin), __: None = Depends(check_origin)) -> dict:
    payload = await request.json()
    status = payload.get("status")
    if status not in {repo.PUBLISHED, repo.DRAFT}:
        raise HTTPException(status_code=400, detail="statut inconnu")
    conn = _conn(request)
    try:
        _page_or_404(conn, page_id)
        repo.save_revision(conn, "page", page_id, repo.snapshot_page(conn, page_id), f"statut → {status}")
        repo.update_page(conn, page_id, {"status": status})
        conn.commit()
        return {"ok": True, "status": status}
    finally:
        conn.close()


@api.get("/pages/{page_id}/sections")
def api_sections(request: Request, page_id: int, _: str = Depends(require_admin)) -> dict:
    conn = _conn(request)
    try:
        _page_or_404(conn, page_id)
        return {
            "sections": [
                {
                    "id": row["id"],
                    "position": row["position"],
                    "type": row["type"],
                    "variant": row["variant"],
                    "label": row["label"],
                    "visible": row["visible"],
                    "data": json_load(row["data"], {}),
                }
                for row in repo.sections_for(conn, page_id)
            ]
        }
    finally:
        conn.close()


@api.post("/pages/{page_id}/sections")
async def api_create_section(request: Request, page_id: int, _: str = Depends(require_admin), __: None = Depends(check_origin)) -> dict:
    payload = await request.json()
    type_ = payload.get("type") or ""
    if type_ not in sections_module.SECTION_TYPES:
        raise HTTPException(status_code=400, detail="type de section inconnu")
    conn = _conn(request)
    try:
        _page_or_404(conn, page_id)
        spec = sections_module.SECTION_TYPES[type_]
        variant = payload.get("variant") or (next(iter(spec.get("variants", {})), "") if spec.get("variants") else "")
        data = sections_module.default_data(type_)
        section_id = repo.create_section(conn, page_id, {"type": type_, "variant": variant, "label": spec.get("label", type_), "data": data})
        conn.commit()
        return {"ok": True, "id": section_id}
    finally:
        conn.close()


@api.patch("/sections/{section_id}")
async def api_update_section(request: Request, section_id: int, _: str = Depends(require_admin), __: None = Depends(check_origin)) -> dict:
    payload = await request.json()
    conn = _conn(request)
    try:
        row = conn.execute("SELECT * FROM sections WHERE id = ?", (section_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="section introuvable")
        values: dict[str, Any] = {}
        for key in ("label", "variant", "visible", "position"):
            if key in payload:
                values[key] = payload[key]
        if "data" in payload and isinstance(payload["data"], dict):
            current = json_load(row["data"], {})
            current.update(payload["data"])
            if row["type"] == "zone-libre" and validate_data(DEFAULT_BLOCKS["zone-libre"], current):
                raise HTTPException(status_code=400, detail="données de composition invalides")
            values["data"] = current
        repo.update_section(conn, section_id, values)
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@api.delete("/sections/{section_id}")
def api_delete_section(request: Request, section_id: int, _: str = Depends(require_admin), __: None = Depends(check_origin)) -> dict:
    conn = _conn(request)
    try:
        repo.delete_section(conn, section_id)
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@api.post("/sections/{section_id}/deplacer")
async def api_move_section(request: Request, section_id: int, _: str = Depends(require_admin), __: None = Depends(check_origin)) -> dict:
    payload = await request.json()
    offset = int(payload.get("offset") or 0)
    conn = _conn(request)
    try:
        row = conn.execute("SELECT page_id FROM sections WHERE id = ?", (section_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="section introuvable")
        repo.move_section(conn, int(row["page_id"]), section_id, offset)
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@api.post("/sections/{section_id}/dupliquer")
def api_duplicate_section(request: Request, section_id: int, _: str = Depends(require_admin), __: None = Depends(check_origin)) -> dict:
    conn = _conn(request)
    try:
        new_id = repo.duplicate_section(conn, section_id)
        conn.commit()
        return {"ok": new_id is not None, "id": new_id}
    finally:
        conn.close()


@api.post("/pages/{page_id}/sections/ordonner")
async def api_reorder_sections(request: Request, page_id: int, _: str = Depends(require_admin), __: None = Depends(check_origin)) -> dict:
    payload = await request.json()
    ids = [int(value) for value in (payload.get("ids") or [])]
    conn = _conn(request)
    try:
        repo.reorder_sections(conn, page_id, ids)
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@api.get("/medias")
def api_medias(request: Request, _: str = Depends(require_admin)) -> dict:
    conn = _conn(request)
    try:
        return {
            "medias": [
                {"id": row["id"], "filename": row["filename"], "original_filename": row["original_filename"], "path": f"/medias/{row['filename']}", "alt": row["alt"], "credit": row["credit"]}
                for row in repo.list_medias(conn)
            ]
        }
    finally:
        conn.close()


@api.post("/medias")
async def api_upload(request: Request, file: UploadFile = File(...), _: str = Depends(require_admin), __: None = Depends(check_origin)) -> dict:
    original_filename = safe_original_filename(file.filename)
    extension = Path(original_filename).suffix.lower()
    if extension not in ALLOWED_UPLOADS:
        raise HTTPException(status_code=400, detail=f"extension non autorisée : {extension or 'aucune'}")
    root = media_root(request)
    target_name = security.random_filename(extension)
    target = root / target_name
    size = 0
    with target.open("wb") as handle:
        while chunk := await file.read(1024 * 256):
            size += len(chunk)
            if size > 12 * 1024 * 1024:
                handle.close()
                target.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="fichier trop volumineux (12 Mo max)")
            handle.write(chunk)
    width = height = 0
    if extension != ".svg":
        try:
            from PIL import Image

            with Image.open(target) as image:
                width, height = image.size
                image.thumbnail((2400, 2400))
                image.save(target, optimize=True)
        except Exception:
            width = height = 0
    conn = _conn(request)
    try:
        media_id = repo.register_media(
            conn,
            {
                "filename": target_name,
                "original_filename": original_filename,
                "path": f"/medias/{target_name}",
                "alt": "",
                "caption": "",
                "mime": file.content_type or "",
                "width": width,
                "height": height,
                "size": size,
            },
        )
        conn.commit()
        return {"ok": True, "id": media_id, "path": f"/medias/{target_name}", "filename": target_name, "original_filename": original_filename}
    finally:
        conn.close()


@api.delete("/medias/{media_id}")
def api_delete_media(request: Request, media_id: int, _: str = Depends(require_admin), __: None = Depends(check_origin)) -> dict:
    conn = _conn(request)
    try:
        row = repo.delete_media(conn, media_id)
        if row is not None:
            (media_root(request) / row["filename"]).unlink(missing_ok=True)
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@api.patch("/medias/{media_id}")
async def api_update_media(request: Request, media_id: int, _: str = Depends(require_admin), __: None = Depends(check_origin)) -> dict:
    payload = await request.json()
    conn = _conn(request)
    try:
        sets = []
        params: list[Any] = []
        for key in ("alt", "caption", "credit"):
            if key in payload:
                sets.append(f"{key} = ?")
                params.append(str(payload[key]))
        if sets:
            params.append(media_id)
            conn.execute(f"UPDATE medias SET {', '.join(sets)} WHERE id = ?", params)
            conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@api.get("/messages")
def api_messages(request: Request, statut: str = "", _: str = Depends(require_admin)) -> dict:
    conn = _conn(request)
    try:
        rows = repo.list_messages(conn, status=statut or None)
        return {"messages": [{key: row[key] for key in row.keys()} for row in rows]}
    finally:
        conn.close()


@api.patch("/messages/{message_id}")
async def api_update_message(request: Request, message_id: int, _: str = Depends(require_admin), __: None = Depends(check_origin)) -> dict:
    payload = await request.json()
    conn = _conn(request)
    try:
        repo.update_message(conn, message_id, {key: payload[key] for key in ("status", "note") if key in payload})
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@api.get("/reglages")
def api_settings(request: Request, _: str = Depends(require_admin)) -> dict:
    conn = _conn(request)
    try:
        return {"reglages": settings_module.all_settings(conn), "defauts": settings_module.DEFAULT_SETTINGS}
    finally:
        conn.close()


@api.post("/reglages")
async def api_save_settings(request: Request, _: str = Depends(require_admin), __: None = Depends(check_origin)) -> dict:
    payload = await request.json()
    conn = _conn(request)
    try:
        for key, value in payload.items():
            if key in settings_module.DEFAULT_SETTINGS or key in {"phone", "mentions", "analytics_id", "og_image"}:
                settings_module.set_value(conn, key, sanitize_html(value) if key in {"mentions", "tagline", "site_description"} else str(value))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@api.get("/redirections")
def api_redirects(request: Request, _: str = Depends(require_admin)) -> dict:
    conn = _conn(request)
    try:
        return {"redirections": [{key: row[key] for key in row.keys()} for row in repo.list_redirects(conn)]}
    finally:
        conn.close()


@api.post("/redirections")
async def api_add_redirect(request: Request, _: str = Depends(require_admin), __: None = Depends(check_origin)) -> dict:
    payload = await request.json()
    path = (payload.get("path") or "").strip()
    target = (payload.get("target") or "").strip()
    if not path.startswith("/") or not target.startswith("/"):
        raise HTTPException(status_code=400, detail="les chemins doivent commencer par /")
    conn = _conn(request)
    try:
        repo.add_redirect(conn, path, target, int(payload.get("code") or 301))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@api.delete("/redirections")
async def api_delete_redirect(request: Request, path: str, _: str = Depends(require_admin), __: None = Depends(check_origin)) -> dict:
    conn = _conn(request)
    try:
        conn.execute("DELETE FROM redirections WHERE path = ?", (path,))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@api.get("/revisions")
def api_revisions(request: Request, entity_type: str = "page", entity_id: int | None = None, _: str = Depends(require_admin)) -> dict:
    conn = _conn(request)
    try:
        return {"revisions": [{key: row[key] for key in row.keys()} for row in repo.list_revisions(conn, entity_type, entity_id)]}
    finally:
        conn.close()


@api.post("/revisions/{revision_id}/restaurer")
async def api_restore(request: Request, revision_id: int, _: str = Depends(require_admin), __: None = Depends(check_origin)) -> dict:
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="objet JSON attendu")
    conn = _conn(request)
    try:
        revision = conn.execute("SELECT * FROM revisions WHERE id = ?", (revision_id,)).fetchone()
        if revision is None:
            raise HTTPException(status_code=404, detail="révision introuvable")
        if revision["entity_type"] != "page":
            snapshot = json_load(revision["snapshot"], {})
            repo.save_revision(conn, revision["entity_type"], int(revision["entity_id"]), repo.snapshot_page(conn, int(revision["entity_id"])), "avant restauration")
            ok = repo.restore_snapshot(conn, int(revision["entity_id"]), snapshot)
            conn.commit()
            return {"ok": ok}

        expected = payload.get("expected_visual_version")
        confirm = payload.get("confirm_discard_draft")
        if isinstance(expected, bool) or not isinstance(expected, int) or expected < 0:
            raise HTTPException(status_code=400, detail="version visuelle attendue invalide")
        if not isinstance(confirm, bool):
            raise HTTPException(status_code=400, detail="confirmation de brouillon invalide")
        editor = request.app.state.editor
        from sujee_editor.editor.project import ProjectError, migrate_project, project_to_sections, sections_to_project
        from sujee_editor.editor.theme import PROJECT_SCHEMA_VERSION, THEME_ID, THEME_VERSION
        from sujee_editor.tokens import CSRF_HEADER, verify_csrf

        if not verify_csrf(request.headers.get(CSRF_HEADER, ""), editor.session_secret):
            raise HTTPException(status_code=403, detail="jeton CSRF invalide")
        page_id = int(revision["entity_id"])
        _page_or_404(conn, page_id)
        conn.execute("BEGIN IMMEDIATE")
        try:
            visual = conn.execute("SELECT * FROM visual_projects WHERE page_id = ?", (page_id,)).fetchone()
            if visual is None:
                state = editor.store.page_state(conn, page_id)
                project = sections_to_project([section.serialize() for section in state.sections])
                encoded = json.dumps(project, ensure_ascii=False, separators=(",", ":"))
                conn.execute(
                    "INSERT INTO visual_projects (page_id, draft_project_json, published_project_json, draft_version, theme_id, theme_version) VALUES (?, ?, ?, 0, ?, ?)",
                    (page_id, encoded, encoded, THEME_ID, THEME_VERSION),
                )
                visual = conn.execute("SELECT * FROM visual_projects WHERE page_id = ?", (page_id,)).fetchone()
            else:
                try:
                    draft = migrate_project(json.loads(visual["draft_project_json"]))
                    published = migrate_project(json.loads(visual["published_project_json"]))
                    draft = sections_to_project(project_to_sections(draft))
                    published = sections_to_project(project_to_sections(published))
                except (TypeError, ValueError, ProjectError) as exc:
                    raise HTTPException(status_code=409, detail=f"projet visuel stocké invalide : {exc}") from exc
                encoded_draft = json.dumps(draft, ensure_ascii=False, separators=(",", ":"))
                encoded_published = json.dumps(published, ensure_ascii=False, separators=(",", ":"))
                if visual["theme_id"] != THEME_ID or int(visual["theme_version"]) != THEME_VERSION or visual["draft_project_json"] != encoded_draft or visual["published_project_json"] != encoded_published:
                    conn.execute(
                        "UPDATE visual_projects SET draft_project_json = ?, published_project_json = ?, theme_id = ?, theme_version = ? WHERE page_id = ? AND draft_version = ?",
                        (encoded_draft, encoded_published, THEME_ID, THEME_VERSION, page_id, int(visual["draft_version"])),
                    )
                visual = conn.execute("SELECT * FROM visual_projects WHERE page_id = ?", (page_id,)).fetchone()
            current_version = int(visual["draft_version"])
            if current_version != expected:
                conn.rollback()
                raise HTTPException(status_code=409, detail=f"version visuelle courante : {current_version}")
            if visual["draft_project_json"] != visual["published_project_json"] and not confirm:
                conn.rollback()
                raise HTTPException(status_code=409, detail="un brouillon visuel non publié serait remplacé")

            snapshot = json_load(revision["snapshot"], {})
            repo.save_revision(conn, "page", page_id, repo.snapshot_page(conn, page_id), "avant restauration")
            if not repo.restore_snapshot(conn, page_id, snapshot):
                raise HTTPException(status_code=409, detail="révision impossible à restaurer")
            state = editor.store.page_state(conn, page_id)
            restored_project = sections_to_project([section.serialize() for section in state.sections])
            new_version = editor.store.synchronize_visual_project(
                conn, page_id=page_id, expected_version=expected, project=restored_project
            )
            conn.commit()
            return {"ok": True, "visual_draft_version": new_version, "schema_version": PROJECT_SCHEMA_VERSION}
        except Exception:
            conn.rollback()
            raise
    finally:
        conn.close()


@api.get("/export")
def api_export(request: Request, _: str = Depends(require_admin)) -> JSONResponse:
    conn = _conn(request)
    try:
        payload: dict[str, Any] = {
            "version": content_revision(conn),
            "reglages": settings_module.all_settings(conn),
            "redirections": [{key: row[key] for key in row.keys()} for row in repo.list_redirects(conn)],
            "pages": [],
        }
        for page in repo.list_pages(conn, published_only=False, order="kind, position, title"):
            entry = {key: page[key] for key in page.keys()}
            entry["categories"] = json_load(entry.get("categories"), [])
            entry["meta"] = json_load(entry.get("meta"), {})
            entry["sections"] = [
                {
                    "position": row["position"],
                    "type": row["type"],
                    "variant": row["variant"],
                    "label": row["label"],
                    "visible": row["visible"],
                    "data": json_load(row["data"], {}),
                }
                for row in repo.sections_for(conn, int(page["id"]))
            ]
            visual = conn.execute("SELECT * FROM visual_projects WHERE page_id = ?", (int(page["id"]),)).fetchone()
            if visual is not None:
                try:
                    draft_project = json.loads(visual["draft_project_json"])
                    published_project = json.loads(visual["published_project_json"])
                except (TypeError, json.JSONDecodeError) as exc:
                    raise HTTPException(status_code=409, detail=f"projet visuel invalide pour la page {page['id']}") from exc
                entry["visual_project"] = {
                    "schema_version": int(draft_project.get("schema_version", 0)),
                    "theme_id": str(visual["theme_id"]),
                    "theme_version": int(visual["theme_version"]),
                    "draft_version": int(visual["draft_version"]),
                    "draft_project": draft_project,
                    "published_project": published_project,
                }
            payload["pages"].append(entry)
        return JSONResponse(
            payload,
            headers={"Content-Disposition": 'attachment; filename="sujeedesign-contenu.json"'},
        )
    finally:
        conn.close()


@api.get("/apercu/{page_id}", response_class=HTMLResponse)
def api_preview(request: Request, page_id: int, _: str = Depends(require_admin)) -> HTMLResponse:
    return preview(request, page_id)


def slugify(value: str) -> str:
    text = (value or "").strip().lower()
    replacements = {"à": "a", "â": "a", "ä": "a", "é": "e", "è": "e", "ê": "e", "ë": "e", "î": "i", "ï": "i", "ô": "o", "ö": "o", "ù": "u", "û": "u", "ü": "u", "ç": "c", "œ": "oe", "&": "et", "'": "-", "’": "-"}
    for source, target in replacements.items():
        text = text.replace(source, target)
    import re as _re

    text = _re.sub(r"[^a-z0-9]+", "-", text)
    return _re.sub(r"-{2,}", "-", text).strip("-") or "page"
