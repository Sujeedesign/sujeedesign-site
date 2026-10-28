"""API JSON de l'éditeur visuel (édition en place sur la vitrine).

Consommée par le runtime d'édition injecté dans le site Next (`web/components/editor`),
elle permet de lire le document, d'écrire un champ isolé et de publier, sans passer
par le formulaire de l'onglet Contenu.

Authentification : session admin (`sjd_admin`) + jeton CSRF, exactement comme les
formulaires du back office. Aucun accès anonyme, aucune écriture sans CSRF.
"""

from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from . import content as content_store
from . import content_model as model
from . import repo
from .admin import check_csrf, csrf_token, current_user, get_conn, require_admin

router = APIRouter(prefix="/api/editor", tags=["editor"])

SLUG = "home"


class FieldPayload(BaseModel):
    path: str
    value: str = ""
    csrf: str = ""


class PublishPayload(BaseModel):
    csrf: str = ""


def _fields() -> dict[str, dict[str, Any]]:
    return {field["path"]: field for field in model.fields_for(SLUG)}


def _doc(conn: sqlite3.Connection) -> dict[str, Any]:
    return content_store.load_doc(conn, SLUG)


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
def session(request: Request) -> JSONResponse:
    """État de la session d'édition, document courant et schéma des champs."""
    user = current_user(request)
    if user is None:
        return JSONResponse({"ok": False, "reason": "anon"}, status_code=401)
    conn = get_conn(request)
    try:
        doc = _doc(conn)
        medias = _medias(conn)
    finally:
        conn.close()
    return JSONResponse(
        {
            "ok": True,
            "user": user,
            "csrf": csrf_token(),
            "doc": doc["data"],
            "updated_at": doc["updated_at"],
            "sections": model.form_sections(SLUG, doc["data"]),
            "medias": medias,
            "publish_ready": content_store.publish_ready(),
        }
    )


@router.post("/champ")
def champ(request: Request, payload: FieldPayload, user: str = Depends(require_admin)) -> JSONResponse:
    check_csrf(request, payload.csrf)
    fields = _fields()
    field = fields.get(payload.path)
    if field is None:
        raise HTTPException(status_code=404, detail="champ inconnu")

    conn = get_conn(request)
    try:
        current = _doc(conn)
        doc = current["data"]
        value = model._to_value(field, payload.value)
        model.set_path(doc, field["path"], value)
        try:
            model.validate(SLUG, doc)
        except model.ContentError as exc:
            return JSONResponse({"ok": False, "error": str(exc)}, status_code=422)
        content_store.save_doc(conn, SLUG, doc, author=f"editeur:{user}")
    finally:
        conn.close()
    return JSONResponse({"ok": True, "path": field["path"], "doc": doc})


@router.post("/publier")
def publier(request: Request, payload: PublishPayload, user: str = Depends(require_admin)) -> JSONResponse:
    check_csrf(request, payload.csrf)
    conn = get_conn(request)
    try:
        result = content_store.request_publish(conn, SLUG)
    finally:
        conn.close()
    status = 200 if result.get("ok") else 502
    return JSONResponse(result, status_code=status)

