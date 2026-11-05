"""API de lecture du contenu, consommée par le build du site Next."""

from __future__ import annotations

import hashlib
import json
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse

from . import catalogue
from . import content as content_store
from . import content_model

router = APIRouter()

SLUGS = set(content_model.SCHEMAS)


def _conn(request: Request) -> sqlite3.Connection:
    from .db import connect

    return connect(request.app.state.db_path)


@router.get("/api/v1/content/{slug}")
def read_content(slug: str, request: Request) -> dict:
    """Document complet d'une page du site public.

    Lecture ouverte : ce sont les textes du site, déjà publics. Aucun secret ne
    transite par ici, et l'écriture reste derrière la session admin.
    """
    if slug not in SLUGS:
        raise HTTPException(status_code=404, detail="contenu inconnu")
    conn = _conn(request)
    try:
        document = content_store.load_doc(conn, slug)
    finally:
        conn.close()
    document["schema"] = content_model.SCHEMAS.get(slug, [])
    return document


@router.get("/api/v1/catalogue")
def read_catalogue(request: Request) -> Response:
    """Catalogue publié, à la forme exacte attendue par la vitrine.

    Lecture ouverte : ce sont les fiches que le site affiche déjà. Seul le statut
    `publie` sort d'ici ; un brouillon ou une fiche supprimée n'existe pas pour
    le site. `ETag` évite de retransférer un catalogue inchangé, et le cache
    court laisse le temps à l'invalidation (`revalidateTag("catalogue")`) de
    suivre une publication.
    """
    conn = _conn(request)
    try:
        payload = catalogue.export_site(conn)
    finally:
        conn.close()
    body = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    etag = '"' + hashlib.sha256(body.encode("utf-8")).hexdigest()[:32] + '"'
    headers = {
        "ETag": etag,
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    }
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return Response(content=body, media_type="application/json", headers=headers)


@router.get("/api/v1/instagram")
def read_instagram(request: Request) -> dict:
    """Grille « Sur Instagram » de l'accueil (cinq posts choisis à la main).

    Lecture ouverte comme le reste du contenu public. Pas de cache HTTP long :
    le front met en cache via le tag `instagram`, invalidé à chaque
    enregistrement dans le back office.
    """
    from . import repo
    from .db import get_meta

    conn = _conn(request)
    try:
        posts = repo.list_instagram_posts(conn)
        title = get_meta(conn, "instagram_title", "Sur Instagram")
        intro = get_meta(
            conn,
            "instagram_intro",
            "Identités, coulisses et images générées : le fil @sujeedesign.ai "
            "se regarde aussi ici.",
        )
    finally:
        conn.close()

    return {
        "title": title,
        "intro": intro,
        "profile": "https://www.instagram.com/sujeedesign.ai/",
        "handle": "@sujeedesign.ai",
        "posts": [
            {
                "id": int(row["id"]),
                "kind": row["kind"],
                "src": row["src"],
                "poster": row["poster"],
                "caption": row["caption"],
                "permalink": row["permalink"],
                "alt": row["alt"],
            }
            for row in posts
        ],
    }
