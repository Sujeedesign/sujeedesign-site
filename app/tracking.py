"""Suivi de consultation des propositions clients.

Les pages /propositions/<slug>/ sont des fichiers statiques servis par Next.js.
Une petite balise y envoie deux événements à cet endpoint, relayé par le site
via /api/track/* : « ouverture » au chargement, « fermeture » quand la page est
quittée avec le temps passé.

Vie privée : aucun cookie, aucune adresse IP en clair. Seul un condensat salé
de l'IP sert à compter les visiteurs uniques, et l'identifiant de session est
régénéré à chaque chargement de page. Les vues sont supprimées au-delà de
12 mois (voir `purger_vues`), la durée annoncée dans le pied de page des
propositions.
"""

from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timezone

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from . import security
from .contact import client_ip
from .db import connect, get_meta, set_meta

log = logging.getLogger("sujee.admin")

router = APIRouter(prefix="/api/track", tags=["suivi"])

SLUGS = {
    "n2e": "N2E Échafaudages",
    "dimension-nouvelle": "Dimension Nouvelle",
    "polyresine": "Polyrésine",
    "sei": "SEI",
}
LIMITE = 120  # événements par heure et par IP
DUREE_MAX = 7200  # secondes : on ignore les onglets restés ouverts la nuit
PURGE_MOIS = 12  # conservation des vues, alignée sur la mention du pied de page
PURGE_META_KEY = "proposition_purge_at"


def purger_vues(conn: sqlite3.Connection, aujourdhui: str | None = None) -> int:
    """Supprime les vues de plus de 12 mois. Une passe par jour au maximum.

    La dispense CNIL pour la mesure d'audience plafonne la conservation à
    13 mois : on coupe à 12 pour rester cohérent avec la mention affichée
    dans le pied de page des propositions. Le marqueur `_meta` évite de
    relancer la requête à chaque démarrage de conteneur.
    """
    jour = aujourdhui or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if get_meta(conn, PURGE_META_KEY, "") == jour:
        return 0
    cursor = conn.execute(
        "DELETE FROM proposition_vues WHERE created_at < datetime('now', ?)",
        (f"-{PURGE_MOIS} months",),
    )
    set_meta(conn, PURGE_META_KEY, jour)
    conn.commit()
    supprimees = int(cursor.rowcount or 0)
    log.info("vues de propositions purgées : %s ligne(s) de plus de %s mois", supprimees, PURGE_MOIS)
    return supprimees


def _conn(request: Request) -> sqlite3.Connection:
    return connect(request.app.state.db_path)


def _limiter(request: Request) -> security.RateLimiter:
    limiter = getattr(request.app.state, "proposition_limiter", None)
    if limiter is None:
        limiter = security.RateLimiter()
        request.app.state.proposition_limiter = limiter
    return limiter


def _ip_hash(request: Request) -> str:
    try:
        return security.hash_ip(client_ip(request))
    except RuntimeError:  # SESSION_SECRET absent en dev
        return ""


def _clean(value: object, limit: int) -> str:
    return str(value or "").strip()[:limit]


@router.post("/vue")
async def vue(request: Request) -> JSONResponse:
    """Enregistre l'ouverture d'une proposition ou le temps passé dessus."""
    ip = client_ip(request)
    if not _limiter(request).allow(f"p:{ip}", LIMITE, 3600):
        return JSONResponse({"ok": False, "detail": "trop de requêtes"}, status_code=429)

    try:
        payload = await request.json()
    except ValueError:
        payload = {}
    if not isinstance(payload, dict):
        payload = {}

    slug = _clean(payload.get("slug"), 64)
    if slug not in SLUGS:
        return JSONResponse({"ok": False, "detail": "proposition inconnue"}, status_code=404)

    evenement = _clean(payload.get("evenement"), 16) or "ouverture"
    if evenement not in {"ouverture", "fermeture"}:
        return JSONResponse({"ok": False, "detail": "événement inconnu"}, status_code=400)

    session = _clean(payload.get("session"), 64)
    try:
        secondes = int(payload.get("secondes") or 0)
    except (TypeError, ValueError):
        secondes = 0
    secondes = max(0, min(secondes, DUREE_MAX))

    conn = _conn(request)
    try:
        if evenement == "ouverture":
            conn.execute(
                "INSERT INTO proposition_vues (slug, session, evenement, referer, ua, ip_hash)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                (
                    slug,
                    session,
                    evenement,
                    _clean(request.headers.get("referer"), 300),
                    _clean(request.headers.get("user-agent"), 300),
                    _ip_hash(request),
                ),
            )
        elif session:
            conn.execute(
                "UPDATE proposition_vues SET secondes = MAX(secondes, ?)"
                " WHERE id = (SELECT id FROM proposition_vues WHERE slug = ? AND session = ?"
                " ORDER BY id DESC LIMIT 1)",
                (secondes, slug, session),
            )
        conn.commit()
    finally:
        conn.close()
    return JSONResponse({"ok": True})
