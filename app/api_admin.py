"""API d'écriture du contenu, réservée aux agents autorisés.

Le back office HTML reste la voie de Sujee (session + CSRF). Cette API sert aux
automatisations et aux profils Hermes qui doivent éditer le contenu sans cookie :
authentification par jeton porteur, sur le même stockage et les mêmes garde-fous
que le formulaire (`content_model.validate`, révision avant écriture).
"""

from __future__ import annotations

import hmac
import json
import mimetypes
import re
import sqlite3
import unicodedata
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

from . import content as content_store
from . import content_model
from . import repo
from .admin import ALLOWED_TYPES, MAX_UPLOAD
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


# ------------------------------------------------------------------ médiathèque


def _slug_filename(name: str, extension: str) -> str:
    """Nom de fichier stable et lisible : « Elerya 01 » -> « elerya-01.jpg »."""
    ascii_name = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_name).strip("-").lower()
    return f"{(slug or 'media')[:90]}{extension}"


@router.get("/media")
def list_medias(request: Request, limit: int = 400, _: str = Depends(require_token)) -> dict[str, Any]:
    conn = _conn(request)
    try:
        rows = repo.list_medias(conn, limit=max(1, min(limit, 1000)))
        total = conn.execute("SELECT COUNT(*) FROM medias").fetchone()[0]
    finally:
        conn.close()
    return {
        "ok": True,
        "total": int(total),
        "items": [
            {
                "id": row["id"],
                "filename": row["filename"],
                "path": row["path"],
                "alt": row["alt"],
                "caption": row["caption"],
                "mime": row["mime"],
                "width": row["width"],
                "height": row["height"],
                "size": row["size"],
                "created_at": row["created_at"],
            }
            for row in rows
        ],
    }


@router.post("/media")
async def import_media(
    request: Request,
    fichier: UploadFile = File(...),
    alt: str = Form(""),
    caption: str = Form(""),
    credit: str = Form(""),
    filename: str = Form(""),
    overwrite: bool = Form(False),
    author: str = Depends(require_token),
) -> JSONResponse:
    """Importe une image dans la médiathèque du back office.

    Même stockage et mêmes contrôles que le formulaire `/admin/medias`, mais par
    jeton porteur : un nom de fichier stable peut être imposé (utile pour le
    référencement) et un ré-import met à jour la fiche au lieu de dupliquer.
    """
    mime = (fichier.content_type or "").lower()
    extension = ALLOWED_TYPES.get(mime)
    if extension is None:
        guessed = mimetypes.guess_type(fichier.filename or "")[0] or ""
        extension = ALLOWED_TYPES.get(guessed)
        mime = mime or guessed
    if extension is None:
        raise HTTPException(status_code=415, detail="format refusé (JPG, PNG, WebP, AVIF, GIF ou PDF)")

    payload = await fichier.read()
    if not payload:
        raise HTTPException(status_code=400, detail="fichier vide")
    if len(payload) > MAX_UPLOAD:
        raise HTTPException(status_code=413, detail="fichier trop lourd (15 Mo maximum)")

    requested = (filename or fichier.filename or "media").rsplit(".", 1)[0]
    target = _slug_filename(requested, extension)

    folder = Path(request.app.state.media_dir)
    folder.mkdir(parents=True, exist_ok=True)

    conn = _conn(request)
    try:
        existing = repo.get_media_by_filename(conn, target)
        if existing is not None and not overwrite:
            raise HTTPException(
                status_code=409,
                detail=f"un média nommé {target} existe déjà (overwrite=true pour le remplacer)",
            )

        (folder / target).write_bytes(payload)

        width = height = 0
        try:  # optionnel : les dimensions ne bloquent jamais l'import
            from PIL import Image  # type: ignore

            with Image.open(folder / target) as image:
                width, height = image.size
        except Exception:
            pass

        fields = {
            "original_filename": (fichier.filename or target)[:200],
            "path": f"/medias/{target}",
            "alt": alt.strip()[:300],
            "caption": caption.strip()[:300],
            "credit": credit.strip()[:200],
            "mime": mime,
            "width": width,
            "height": height,
            "size": len(payload),
        }
        if existing is not None:
            repo.update_media(conn, int(existing["id"]), fields)
            media_id = int(existing["id"])
            created = False
        else:
            media_id = repo.register_media(conn, {"filename": target, **fields})
            created = True
        conn.commit()
    finally:
        conn.close()

    return JSONResponse(
        {
            "ok": True,
            "created": created,
            "author": author,
            "media": {"id": media_id, "filename": target, "path": f"/medias/{target}", **fields},
        },
        status_code=201 if created else 200,
    )
