"""Back office : tableau de bord, contenu de la vitrine, messages, médias, réglages.

Un seul rôle, une seule base : ce module ne rend aucune page publique. L'aperçu
pointe vers la vitrine Next réellement déployée (iframe), il ne reconstruit plus
un site parallèle.
"""

from __future__ import annotations

import json
import mimetypes
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
from fastapi.templating import Jinja2Templates

from . import content as content_store
from . import content_model
from . import repo
from . import security
from . import settings as settings_module
from .db import connect
from .ui import templates

router = APIRouter()

CSRF_PURPOSE = "admin-csrf"
CSRF_TTL = 8 * 60 * 60
MAX_UPLOAD = 15 * 1024 * 1024
ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
}
STATUTS = ("nouveau", "en cours", "traite")
CONTENT_SLUG = "home"
NAV = (
    ("tableau_de_bord", "Tableau de bord", "/admin"),
    ("contenu", "Contenu du site", "/admin/contenu"),
    ("messages", "Messages", "/admin/messages"),
    ("medias", "Médias", "/admin/medias"),
    ("apercu", "Aperçu", "/admin/apercu"),
    ("reglages", "Réglages", "/admin/reglages"),
    ("sauvegarde", "Sauvegarde", "/admin/sauvegarde"),
)


# ------------------------------------------------------------------- session


def db_path(request: Request) -> Path:
    return Path(request.app.state.db_path)


def get_conn(request: Request) -> sqlite3.Connection:
    return connect(db_path(request))


def current_user(request: Request) -> str | None:
    token = request.cookies.get(security.SESSION_COOKIE, "")
    return "admin" if token and security.verify_session(token) else None


def csrf_token() -> str:
    return security.make_token(CSRF_PURPOSE, CSRF_TTL)


def _allowed_hosts(request: Request) -> set[str]:
    """Hôtes légitimes pour la vérification d'origine.

    Derrière le proxy Next (rewrites /admin et /api/editor), le `Host` reçu
    n'est pas forcément celui du navigateur : on accepte donc aussi
    `X-Forwarded-Host` et le domaine public configuré.
    """
    hosts: set[str] = set()
    for header in ("host", "x-forwarded-host"):
        raw = request.headers.get(header, "")
        if raw:
            hosts.add(raw.split(",")[0].strip().lower())
    public = urlparse(settings_module.public_base_url()).netloc.lower()
    if public:
        hosts.add(public)
    return {h for h in hosts if h}


def check_csrf(request: Request, token: str) -> None:
    supplied_origin = request.headers.get("origin") or request.headers.get("referer") or ""
    if supplied_origin:
        hosts = _allowed_hosts(request)
        origin_host = urlparse(supplied_origin).netloc.lower()
        if hosts and origin_host and origin_host not in hosts:
            raise HTTPException(status_code=403, detail="origine refusée")
    if not security.verify_token(CSRF_PURPOSE, token or "", CSRF_TTL):
        raise HTTPException(status_code=403, detail="formulaire expiré, recharge la page")


def require_admin(request: Request) -> str:
    user = current_user(request)
    if user is None:
        raise HTTPException(status_code=303, headers={"location": "/admin/connexion"})
    return user


def back(url: str, message: str = "", kind: str = "ok") -> RedirectResponse:
    if message:
        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}flash={quote(message)}&kind={kind}"
    return RedirectResponse(url, status_code=303)


def render(request: Request, template: str, **context: Any) -> HTMLResponse:
    user = current_user(request)
    base = {
        "request": request,
        "user": user,
        "nav": NAV,
        "active": request.url.path,
        "csrf": csrf_token(),
        "flash": request.query_params.get("flash", ""),
        "flash_kind": request.query_params.get("kind", "ok"),
        "public_url": settings_module.public_base_url(),
        "now": datetime.now(),
    }
    base.update(context)
    return templates.TemplateResponse(request, template, base)


# ----------------------------------------------------------------- connexion


@router.get("/admin/connexion", response_class=HTMLResponse)
def connexion_form(request: Request) -> Response:
    if current_user(request):
        return RedirectResponse("/admin", status_code=303)
    return render(request, "connexion.html", error="")


@router.post("/admin/connexion")
def connexion(request: Request, password: str = Form("")) -> Response:
    limiter = _limiter(request)
    ip = request.client.host if request.client else "0.0.0.0"
    if not limiter.allow("login:" + security.hash_ip(ip), limit=8, window=900):
        return render(request, "connexion.html", error="Trop de tentatives. Réessaie dans 15 minutes.")
    try:
        valid = security.check_password(password)
    except RuntimeError:
        return render(request, "connexion.html", error="ADMIN_PASSWORD n'est pas configuré sur le serveur.")
    if not valid:
        return render(request, "connexion.html", error="Mot de passe incorrect.")
    response = RedirectResponse("/admin", status_code=303)
    response.set_cookie(
        security.SESSION_COOKIE,
        security.make_session(),
        max_age=security.SESSION_TTL,
        httponly=True,
        samesite="lax",
        secure=settings_module.cookie_secure(),
        path="/",
    )
    # Repère lisible par le JavaScript de la vitrine : la session existe, le
    # runtime d'édition peut tenter /api/editor/session. HttpOnly reste actif
    # pour le cookie de session lui-même.
    response.set_cookie(
        security.EDIT_MARKER_COOKIE,
        "1",
        max_age=security.SESSION_TTL,
        httponly=False,
        samesite="lax",
        secure=settings_module.cookie_secure(),
        path="/",
    )
    limiter.reset()
    return response


@router.post("/admin/deconnexion")
def deconnexion(request: Request, csrf: str = Form("")) -> Response:
    check_csrf(request, csrf)
    response = RedirectResponse("/admin/connexion", status_code=303)
    response.delete_cookie(security.SESSION_COOKIE, path="/")
    response.delete_cookie(security.EDIT_MARKER_COOKIE, path="/")
    return response


def _limiter(request: Request) -> security.RateLimiter:
    limiter = getattr(request.app.state, "admin_limiter", None)
    if limiter is None:
        limiter = security.RateLimiter()
        request.app.state.admin_limiter = limiter
    return limiter


# ---------------------------------------------------------- tableau de bord


@router.get("/admin", response_class=HTMLResponse)
def tableau_de_bord(request: Request, user: str = Depends(require_admin)) -> Response:
    conn = get_conn(request)
    try:
        counts = repo.message_counts(conn)
        medias = repo.table_counts(conn)["medias"]
        doc = content_store.load_doc(conn, CONTENT_SLUG)
        publication = content_store.last_publication(conn)
        recents = repo.list_messages(conn, limit=5)
        revisions = repo.list_revisions(conn, limit=4)
    finally:
        conn.close()
    return render(
        request,
        "tableau_de_bord.html",
        counts=counts,
        medias=medias,
        doc=doc,
        publication=publication,
        recents=recents,
        revisions=revisions,
        publish_ready=content_store.publish_ready(),
    )


# ------------------------------------------------------------------- contenu


@router.get("/admin/contenu", response_class=HTMLResponse)
def contenu(request: Request, user: str = Depends(require_admin)) -> Response:
    conn = get_conn(request)
    try:
        doc = content_store.load_doc(conn, CONTENT_SLUG)
        publication = content_store.last_publication(conn)
        revisions = repo.list_revisions(conn, limit=8)
    finally:
        conn.close()
    sections = content_model.form_sections(CONTENT_SLUG, doc["data"])
    return render(
        request,
        "contenu.html",
        doc=doc,
        sections=sections,
        publication=publication,
        revisions=revisions,
        publish_ready=content_store.publish_ready(),
        error="",
    )


@router.post("/admin/contenu")
async def contenu_save(request: Request, user: str = Depends(require_admin)) -> Response:
    form = await request.form()
    check_csrf(request, str(form.get("csrf") or ""))
    publish = str(form.get("action") or "save") == "publier"
    conn = get_conn(request)
    try:
        current = content_store.load_doc(conn, CONTENT_SLUG)
        try:
            doc = content_model.from_form(CONTENT_SLUG, form, current["data"])
        except content_model.ContentError as exc:
            # On réaffiche la saisie refusée pour ne pas la perdre, sans l'enregistrer.
            try:
                draft = content_model.from_form(CONTENT_SLUG, form, current["data"], validate_doc=False)
            except content_model.ContentError:
                draft = current["data"]
            sections = content_model.form_sections(CONTENT_SLUG, draft)
            publication = content_store.last_publication(conn)
            revisions = repo.list_revisions(conn, limit=8)
            return render(
                request,
                "contenu.html",
                doc=current,
                sections=sections,
                publication=publication,
                revisions=revisions,
                publish_ready=content_store.publish_ready(),
                error=f"Contenu refusé, rien n'a été enregistré : {exc}",
            )
        repo.save_revision(conn, "content", 0, current["data"], "avant enregistrement", user)
        content_store.save_doc(conn, CONTENT_SLUG, doc, author=user)
    finally:
        conn.close()
    if not publish:
        return back("/admin/contenu", "Contenu enregistré. La vitrine sera mise à jour à la prochaine publication.")
    conn = get_conn(request)
    try:
        result = content_store.request_publish(conn, CONTENT_SLUG)
    finally:
        conn.close()
    if not result.get("ok"):
        return back(
            "/admin/contenu",
            "Contenu enregistré, mais la publication a échoué : " + str(result.get("error", "")),
            "error",
        )
    return back("/admin/contenu", "Contenu enregistré, publication lancée.")


@router.post("/admin/contenu/publier")
def contenu_publier(request: Request, csrf: str = Form("")) -> Response:
    check_csrf(request, csrf)
    conn = get_conn(request)
    try:
        result = content_store.request_publish(conn, CONTENT_SLUG)
    finally:
        conn.close()
    if not result.get("ok"):
        return back("/admin/contenu", "Publication impossible : " + str(result.get("error", "")), "error")
    return back("/admin/contenu", "Publication lancée. La vitrine redéploie dans une minute environ.")


@router.post("/admin/contenu/restaurer/{revision_id}")
def contenu_restaurer(request: Request, revision_id: int, csrf: str = Form("")) -> Response:
    check_csrf(request, csrf)
    conn = get_conn(request)
    try:
        row = conn.execute(
            "SELECT * FROM revisions WHERE id = ? AND entity_type = 'content'", (revision_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="révision introuvable")
        snapshot = repo.revision_snapshot(row)
        current = content_store.load_doc(conn, CONTENT_SLUG)
        repo.save_revision(conn, "content", 0, current["data"], "avant restauration", "admin")
        content_store.save_doc(conn, CONTENT_SLUG, snapshot, author="admin")
    finally:
        conn.close()
    return back("/admin/contenu", "Version restaurée. Publie pour l'envoyer sur la vitrine.")


# ------------------------------------------------------------------ messages


@router.get("/admin/messages", response_class=HTMLResponse)
def messages(request: Request, statut: str = "", user: str = Depends(require_admin)) -> Response:
    filtre = statut if statut in STATUTS else None
    conn = get_conn(request)
    try:
        rows = repo.list_messages(conn, status=filtre)
        counts = repo.message_counts(conn)
    finally:
        conn.close()
    return render(request, "messages.html", messages=rows, counts=counts, statut=filtre or "")


@router.post("/admin/messages/{message_id}/statut")
def message_statut(
    request: Request, message_id: int, statut: str = Form(""), note: str = Form(""), csrf: str = Form("")
) -> Response:
    check_csrf(request, csrf)
    conn = get_conn(request)
    try:
        values: dict[str, Any] = {}
        if statut in STATUTS:
            values["status"] = statut
        if note.strip():
            values["note"] = note.strip()[:2000]
        repo.update_message(conn, message_id, values)
        conn.commit()
    finally:
        conn.close()
    return back("/admin/messages", "Message mis à jour.")


@router.post("/admin/messages/{message_id}/supprimer")
def message_supprimer(request: Request, message_id: int, csrf: str = Form("")) -> Response:
    check_csrf(request, csrf)
    conn = get_conn(request)
    try:
        repo.delete_message(conn, message_id)
        conn.commit()
    finally:
        conn.close()
    return back("/admin/messages", "Message supprimé.")


# -------------------------------------------------------------------- médias


@router.get("/admin/medias", response_class=HTMLResponse)
def medias(request: Request, user: str = Depends(require_admin)) -> Response:
    conn = get_conn(request)
    try:
        rows = repo.list_medias(conn)
    finally:
        conn.close()
    return render(request, "medias.html", medias=rows)


@router.post("/admin/medias")
async def medias_upload(
    request: Request,
    fichier: UploadFile = File(...),
    alt: str = Form(""),
    caption: str = Form(""),
    credit: str = Form(""),
    csrf: str = Form(""),
    user: str = Depends(require_admin),
) -> Response:
    check_csrf(request, csrf)
    mime = (fichier.content_type or "").lower()
    extension = ALLOWED_TYPES.get(mime)
    if extension is None:
        guessed = mimetypes.guess_type(fichier.filename or "")[0] or ""
        extension = ALLOWED_TYPES.get(guessed)
    if extension is None:
        return back("/admin/medias", "Format refusé. Utilise JPG, PNG, WebP, AVIF, GIF ou PDF.", "error")

    payload = await fichier.read()
    if not payload:
        return back("/admin/medias", "Fichier vide.", "error")
    if len(payload) > MAX_UPLOAD:
        return back("/admin/medias", "Fichier trop lourd (15 Mo maximum).", "error")

    folder = Path(request.app.state.media_dir)
    folder.mkdir(parents=True, exist_ok=True)
    filename = security.random_filename(extension)
    (folder / filename).write_bytes(payload)

    width = height = 0
    try:  # optionnel : les dimensions ne bloquent jamais l'import
        from PIL import Image  # type: ignore

        with Image.open(folder / filename) as image:
            width, height = image.size
    except Exception:
        pass

    conn = get_conn(request)
    try:
        repo.register_media(
            conn,
            {
                "filename": filename,
                "original_filename": (fichier.filename or "")[:200],
                "path": f"/medias/{filename}",
                "alt": alt.strip()[:300],
                "caption": caption.strip()[:300],
                "credit": credit.strip()[:200],
                "mime": mime or "",
                "width": width,
                "height": height,
                "size": len(payload),
            },
        )
        conn.commit()
    finally:
        conn.close()
    return back("/admin/medias", "Média importé.")


@router.post("/admin/medias/{media_id}/supprimer")
def media_supprimer(request: Request, media_id: int, csrf: str = Form("")) -> Response:
    check_csrf(request, csrf)
    conn = get_conn(request)
    try:
        row = repo.delete_media(conn, media_id)
        conn.commit()
    finally:
        conn.close()
    if row is not None:
        target = Path(request.app.state.media_dir) / row["filename"]
        try:
            target.unlink(missing_ok=True)
        except OSError:
            pass
    return back("/admin/medias", "Média supprimé.")


# ------------------------------------------------------------------ reglages


@router.get("/admin/reglages", response_class=HTMLResponse)
def reglages(request: Request, user: str = Depends(require_admin)) -> Response:
    conn = get_conn(request)
    try:
        values = settings_module.all_settings(conn)
        publication = content_store.last_publication(conn)
    finally:
        conn.close()
    return render(
        request,
        "reglages.html",
        values=values,
        publication=publication,
        publish_ready=content_store.publish_ready(),
        fields=(
            ("site_name", "Nom du site", "text"),
            ("tagline", "Accroche", "text"),
            ("email", "Email de contact", "email"),
            ("phone", "Téléphone", "tel"),
            ("site_url", "Adresse de la vitrine", "url"),
            ("linkedin", "LinkedIn", "url"),
            ("behance", "Behance", "url"),
            ("city", "Ville", "text"),
        ),
    )


@router.post("/admin/reglages")
async def reglages_save(request: Request, user: str = Depends(require_admin)) -> Response:
    form = await request.form()
    check_csrf(request, str(form.get("csrf") or ""))
    conn = get_conn(request)
    try:
        for key in settings_module.DEFAULT_SETTINGS:
            if f"f_{key}" in form:
                settings_module.set_value(conn, key, str(form.get(f"f_{key}") or "").strip())
        settings_module.set_value(conn, "site_url", str(form.get("f_site_url") or "").strip())
        conn.commit()
    finally:
        conn.close()
    return back("/admin/reglages", "Réglages enregistrés.")


# -------------------------------------------------------------------- aperçu


@router.get("/admin/apercu", response_class=HTMLResponse)
def apercu(request: Request, user: str = Depends(require_admin)) -> Response:
    conn = get_conn(request)
    try:
        values = settings_module.all_settings(conn)
        doc = content_store.load_doc(conn, CONTENT_SLUG)
        publication = content_store.last_publication(conn)
    finally:
        conn.close()
    site = (values.get("site_url") or settings_module.public_base_url()).rstrip("/")
    return render(
        request,
        "apercu.html",
        site=site,
        publication=publication,
        doc=doc,
        publish_ready=content_store.publish_ready(),
    )


# ------------------------------------------------------------------ sauvegarde


@router.get("/admin/sauvegarde", response_class=HTMLResponse)
def sauvegarde(request: Request, user: str = Depends(require_admin)) -> Response:
    conn = get_conn(request)
    try:
        counts = repo.table_counts(conn)
    finally:
        conn.close()
    path = db_path(request)
    size = path.stat().st_size if path.exists() else 0
    return render(request, "sauvegarde.html", counts=counts, size=size, path=str(path))


@router.get("/admin/sauvegarde/export.json")
def sauvegarde_export(request: Request, user: str = Depends(require_admin)) -> Response:
    conn = get_conn(request)
    try:
        doc = content_store.load_doc(conn, CONTENT_SLUG)
        rows = [dict(row) for row in repo.list_messages(conn)]
        values = settings_module.all_settings(conn)
    finally:
        conn.close()
    payload = {
        "exported_at": datetime.now().isoformat(timespec="seconds"),
        "content": doc["data"],
        "messages": rows,
        "settings": values,
    }
    body = json.dumps(payload, ensure_ascii=False, indent=2, default=str)
    filename = f"sujee-design-{datetime.now():%Y-%m-%d}.json"
    return Response(
        body,
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/api/admin/etat")
def etat(request: Request, user: str = Depends(require_admin)) -> JSONResponse:
    conn = get_conn(request)
    try:
        return JSONResponse(
            {
                "ok": True,
                "messages": repo.message_counts(conn),
                "counts": repo.table_counts(conn),
                "publication": content_store.last_publication(conn),
            }
        )
    finally:
        conn.close()
