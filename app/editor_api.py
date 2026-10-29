"""API JSON de l'éditeur visuel (édition en place sur la vitrine).

Consommée par le runtime d'édition injecté dans le site Next (`web/components/editor`),
elle permet de lire le document, d'écrire un champ isolé et de publier, sans passer
par le formulaire de l'onglet Contenu.

Authentification : session admin (`sjd_admin`) + jeton CSRF, exactement comme les
formulaires du back office. Aucun accès anonyme, aucune écriture sans CSRF.
"""

from __future__ import annotations

import copy
import sqlite3
import threading
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from . import content as content_store
from . import content_model as model
from . import repo
from .admin import check_csrf, csrf_token, current_user, get_conn, require_admin

# Deux requêtes identiques peuvent partir en parallèle (Entrée + blur). Sans
# sérialisation, les deux lisent la même version et créent deux révisions.
_WRITE_LOCK = threading.Lock()

router = APIRouter(prefix="/api/editor", tags=["editor"])

SLUG = "home"


def _slug(value: str | None) -> str:
    """Slug demandé, ramené sur une page du modèle (défaut : accueil)."""
    candidate = (value or "").strip()
    return candidate if candidate in model.SCHEMAS else SLUG


class FieldPayload(BaseModel):
    path: str
    value: str = ""
    csrf: str = ""
    slug: str = SLUG


class PublishPayload(BaseModel):
    csrf: str = ""
    slug: str = SLUG


def _resolve_field(fields: dict[str, dict[str, Any]], path: str) -> dict[str, Any] | None:
    """Champ du schéma visé par un `data-field`, y compris une ligne d'un titre.

    Le front rend les titres multilignes (`hero.title`) ligne par ligne, chaque
    ligne portant `hero.title.0`, `hero.title.1`… Le schéma, lui, ne déclare que
    la liste. On accepte donc l'index d'une liste de textes et on le traite comme
    un champ simple.
    """
    field = fields.get(path)
    if field is not None:
        return field
    parent, _, index = path.rpartition(".")
    base = fields.get(parent)
    if base is None or not index.isdigit() or base.get("type") != "lines":
        return None
    return {**base, "path": path, "type": "text", "label": f"{base.get('label', parent)} {int(index) + 1}"}


def _fields(slug: str) -> dict[str, dict[str, Any]]:
    return {field["path"]: field for field in model.fields_for(slug)}


def _doc(conn: sqlite3.Connection, slug: str) -> dict[str, Any]:
    return content_store.load_doc(conn, slug)


def _medias(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = repo.list_medias(conn)
    out: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        if not str(item.get("mime", "")).startswith("image/"):
            continue
        out.append(
            {
                "id": item.get("id"),
                "path": item.get("path"),
                "alt": item.get("alt") or "",
                "width": item.get("width") or 0,
                "height": item.get("height") or 0,
            }
        )
    return out[:60]


@router.get("/session")
def session(request: Request, page: str | None = None) -> JSONResponse:
    """État de la session d'édition, document courant et schéma des champs."""
    user = current_user(request)
    if user is None:
        return JSONResponse({"ok": False, "reason": "anon"}, status_code=401)
    slug = _slug(page)
    conn = get_conn(request)
    try:
        doc = _doc(conn, slug)
        medias = _medias(conn)
        pending = content_store.has_pending_changes(conn)
    finally:
        conn.close()
    return JSONResponse(
        {
            "ok": True,
            "user": user,
            "slug": slug,
            "csrf": csrf_token(),
            "doc": doc["data"],
            "updated_at": doc["updated_at"],
            "sections": model.form_sections(slug, doc["data"]),
            "medias": medias,
            "publish_ready": content_store.publish_ready(),
            "pending": pending,
        }
    )


@router.post("/champ")
def champ(request: Request, payload: FieldPayload, user: str = Depends(require_admin)) -> JSONResponse:
    check_csrf(request, payload.csrf)
    slug = _slug(payload.slug)
    fields = _fields(slug)
    field = _resolve_field(fields, payload.path)
    if field is None:
        raise HTTPException(status_code=404, detail="champ inconnu")

    conn = get_conn(request)
    try:
        with _WRITE_LOCK:
            return _write(conn, slug, field, payload, user)
    finally:
        conn.close()


def _write(
    conn: sqlite3.Connection,
    slug: str,
    field: dict[str, Any],
    payload: "FieldPayload",
    user: str,
) -> JSONResponse:
    """Lecture, validation puis écriture, sérialisées par _WRITE_LOCK."""
    current = _doc(conn, slug)
    previous = copy.deepcopy(current["data"])
    doc = current["data"]
    value = model._to_value(field, payload.value)
    try:
        model.set_path(doc, field["path"], value)
    except (IndexError, KeyError, TypeError):
        # Index hors liste (`hero.title.9` sur une liste de 2) : le champ existe
        # au sens du schéma mais pas dans ce document.
        return JSONResponse({"ok": False, "error": "champ inconnu"}, status_code=404)
    try:
        model.validate(slug, doc)
    except model.ContentError as exc:
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=422)
    if doc == previous:
        # Valeur identique : double envoi (Entrée puis blur) ou simple focus.
        # On ne réécrit rien pour ne pas polluer l'historique des révisions.
        return JSONResponse(
            {
                "ok": True,
                "slug": slug,
                "path": field["path"],
                "doc": doc,
                "unchanged": True,
                "pending": content_store.has_pending_changes(conn),
            }
        )
    repo.save_revision(
        conn,
        "content" if slug == SLUG else f"content:{slug}",
        0,
        previous,
        f"avant édition en place ({field['path']})",
        f"editeur:{user}",
    )
    content_store.save_doc(conn, slug, doc, author=f"editeur:{user}")
    return JSONResponse(
        {
            "ok": True,
            "slug": slug,
            "path": field["path"],
            "doc": doc,
            "pending": content_store.has_pending_changes(conn),
        }
    )


@router.post("/publier")
def publier(request: Request, payload: PublishPayload, user: str = Depends(require_admin)) -> JSONResponse:
    check_csrf(request, payload.csrf)
    slug = _slug(payload.slug)
    conn = get_conn(request)
    try:
        result = content_store.request_publish(conn, slug)
        pending = content_store.has_pending_changes(conn)
    finally:
        conn.close()
    result["pending"] = pending
    status = 200 if result.get("ok") else 502
    return JSONResponse(result, status_code=status)

