"""API de lecture du contenu, consommée par le build du site Next."""

from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Request

from . import content as content_store
from . import content_model

router = APIRouter()

SLUGS = {"home"}


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
