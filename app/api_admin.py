"""API d'écriture du contenu, réservée aux agents autorisés.

Le back office HTML reste la voie de Sujee (session + CSRF). Cette API sert aux
automatisations et aux profils Hermes qui doivent éditer le contenu sans cookie :
authentification par jeton porteur, sur le même stockage et les mêmes garde-fous
que le formulaire (`content_model.validate`, révision avant écriture).
"""

from __future__ import annotations

import hmac
import json
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from . import content as content_store
from . import content_model
from . import repo
from .settings import env

router = APIRouter(prefix="/api/v1/admin", tags=["admin-api"])

SLUGS = {"home"}


def _token() -> str:
    return env("SITE_API_TOKEN")


def require_token(request: Request) -> str:
    """Jeton porteur `Authorization: Bearer <SITE_API_TOKEN>`.

    Renvoie le nom de l'auteur déclaré (en-tête `X-Author`), utile dans les
    révisions pour savoir qui a écrit quoi.
    """
    expected = _token()
    if not expected:
        raise HTTPException(status_code=503, detail="API désactivée : SITE_API_TOKEN absent")
    header = request.headers.get("authorization", "")
    scheme, _, given = header.partition(" ")
    if scheme.lower() != "bearer" or not hmac.compare_digest(given.strip(), expected):
        raise HTTPException(
            status_code=401,
            detail="jeton absent ou invalide",
            headers={"WWW-Authenticate": "Bearer"},
        )
    author = (request.headers.get("x-author") or "api").strip()[:60]
    return author or "api"


def _conn(request: Request) -> sqlite3.Connection:
    from .db import connect

    return connect(request.app.state.db_path)


def _check_slug(slug: str) -> None:
    if slug not in SLUGS:
        raise HTTPException(status_code=404, detail="contenu inconnu")


@router.get("/status")
def status(request: Request, _: str = Depends(require_token)) -> dict[str, Any]:
    conn = _conn(request)
    try:
        doc = content_store.load_doc(conn, "home")
        publication = content_store.last_publication(conn)
    finally:
        conn.close()
    return {
        "ok": True,
        "content_updated_at": doc["updated_at"],
        "custom": doc["custom"],
        "publish_ready": content_store.publish_ready(),
        "last_publication": (
            {
                "status": publication["status"],
                "detail": publication["detail"],
                "created_at": publication["created_at"],
            }
            if publication
            else None
        ),
    }


@router.get("/content/{slug}")
def read_content(slug: str, request: Request, _: str = Depends(require_token)) -> dict[str, Any]:
    _check_slug(slug)
    conn = _conn(request)
    try:
        document = content_store.load_doc(conn, slug)
    finally:
        conn.close()
    document["schema"] = content_model.SCHEMAS.get(slug, [])
    document["fields"] = content_model.fields_for(slug)
    return document


@router.put("/content/{slug}")
async def write_content(
    slug: str,
    request: Request,
    author: str = Depends(require_token),
) -> JSONResponse:
    """Écrit le contenu d'une page.

    Corps JSON accepté :
      {"data": {...}}             document complet (fusionné avec les défauts)
      {"changes": {"a.b": val}}   modification ciblée par chemin
      {"publish": true}           déclenche le déploiement après enregistrement

    Rien n'est enregistré si la validation échoue : la réponse 422 détaille le
    champ refusé, comme le formulaire du back office.
    """
    _check_slug(slug)
    try:
        payload = await request.json()
    except ValueError:
        raise HTTPException(status_code=400, detail="corps JSON invalide")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="corps JSON attendu : objet")

    conn = _conn(request)
    try:
        current = content_store.load_doc(conn, slug)
        data = current["data"]
        if "data" in payload:
            data = payload["data"]
        if "changes" in payload:
            changes = payload["changes"]
            if not isinstance(changes, dict) or not changes:
                raise HTTPException(status_code=400, detail="« changes » doit être un objet non vide")
            data = json.loads(json.dumps(data, ensure_ascii=False))
            for path, value in changes.items():
                if not isinstance(path, str) or not path.strip():
                    raise HTTPException(status_code=400, detail="chemin de champ invalide")
                content_model.set_path(data, path.strip(), value)
        try:
            content_model.validate(slug, data)
        except content_model.ContentError as exc:
            raise HTTPException(status_code=422, detail=str(exc))

        repo.save_revision(conn, "content", 0, current["data"], "avant édition API", author)
        content_store.save_doc(conn, slug, data, author=author)
        publish = bool(payload.get("publish"))
        result: dict[str, Any] = {"ok": True, "slug": slug, "author": author}
        if publish:
            publication = content_store.request_publish(conn, slug)
            result["publication"] = publication
            result["ok"] = bool(publication.get("ok"))
    finally:
        conn.close()
    return JSONResponse(result)


@router.post("/publish")
def publish(request: Request, _: str = Depends(require_token)) -> JSONResponse:
    conn = _conn(request)
    try:
        result = content_store.request_publish(conn, "home")
    finally:
        conn.close()
    return JSONResponse(result, status_code=200 if result.get("ok") else 409)
