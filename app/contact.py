"""Formulaire de contact : jeton signé, anti-spam, stockage et synchronisation.

Le jeton attendu est délivré de deux façons : par le cookie ``sjd_form`` posé
sur les pages contenant un formulaire (source fraîche, insensible au cache de
rendu) et par le champ caché ``form_token`` du gabarit. L'API accepte les deux.
"""

from __future__ import annotations

import hmac
import re
import sqlite3
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from . import repo
from . import security
from . import settings as settings_module
from .db import connect

router = APIRouter()
sync = APIRouter()

FORM_COOKIE = "sjd_form"
FORM_PURPOSE = "contact"
MIN_AGE = 3  # secondes : un envoi instantané est un robot
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
URL_RE = re.compile(r"https?://|www\.", re.IGNORECASE)


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "0.0.0.0"


def _limiter(request: Request) -> security.RateLimiter:
    limiter = getattr(request.app.state, "contact_limiter", None)
    if limiter is None:
        limiter = security.RateLimiter()
        request.app.state.contact_limiter = limiter
    return limiter


def _db(request: Request) -> sqlite3.Connection:
    return connect(request.app.state.db_path)


def validate(payload: dict[str, Any]) -> tuple[dict[str, str], dict[str, str]]:
    """Nettoie et valide les champs. Retourne (données, erreurs par champ)."""
    def clean(key: str, limit: int) -> str:
        value = payload.get(key)
        if value is None:
            return ""
        return " ".join(str(value).split())[:limit]

    raw_message = str(payload.get("message") or "").strip()
    data = {
        "name": clean("name", 120),
        "email": clean("email", 180).lower(),
        "phone": clean("phone", 40),
        "project_type": clean("project_type", 80),
        "budget": clean("budget", 80),
        "message": raw_message[:4000],
        "source": clean("source_path", 200),
    }
    errors: dict[str, str] = {}
    if len(data["name"]) < 2:
        errors["cf-name"] = "Merci d'indiquer votre nom."
    if not EMAIL_RE.match(data["email"]):
        errors["cf-email"] = "Merci d'indiquer un email valide."
    if len(data["message"]) < 10:
        errors["cf-message"] = "Décrivez votre projet en quelques mots."
    elif len(raw_message) > 4000:
        errors["cf-message"] = "Message trop long (4000 caractères maximum)."
    if str(payload.get("consent") or "") in {"", "off", "0", "false", "False", "None"}:
        errors["cf-consent"] = "Merci d'accepter le traitement de vos informations."
    return data, errors


def looks_like_spam(data: dict[str, str]) -> bool:
    """Filtre grossier : trop de liens dans le message = robot."""
    return len(URL_RE.findall(data.get("message", ""))) > 3


def store(conn: sqlite3.Connection, data: dict[str, str], ip: str, user_agent: str = "") -> str:
    """Enregistre le message et renvoie sa référence lisible."""
    message_id = repo.create_message(
        conn,
        {
            "name": data.get("name", ""),
            "email": data.get("email", ""),
            "phone": data.get("phone", ""),
            "project_type": data.get("project_type", ""),
            "budget": data.get("budget", ""),
            "message": data.get("message", ""),
            "source": data.get("source", ""),
            "status": "nouveau",
            "spam_score": 1 if looks_like_spam(data) else 0,
            "ip": ip,
            "user_agent": user_agent[:400],
        },
    )
    conn.commit()
    return repo.message_reference(conn, message_id)


def _token_from_request(request: Request, payload: dict[str, Any]) -> str:
    """Le cookie passe en premier : il est posé à chaque visite, le champ caché
    vient du HTML mis en cache et peut donc être périmé."""
    cookie = request.cookies.get(FORM_COOKIE, "").strip()
    field = str(payload.get("form_token") or "").strip()
    return cookie or field


def _token_age(token: str) -> int | None:
    issued = security.token_issued_at(token)
    if issued is None:
        return None
    return int(time.time()) - issued


def _refuse(message: str, status_code: int, errors: dict[str, str] | None = None) -> JSONResponse:
    body: dict[str, Any] = {"ok": False, "message": message}
    if errors:
        body["errors"] = errors
    return JSONResponse(body, status_code=status_code)


@router.post("/api/contact")
async def submit(request: Request) -> JSONResponse:
    form = await request.form()
    payload = {key: form.get(key) for key in form.keys()}

    # Champ piège : un robot le remplit, on répond comme si tout allait bien.
    if str(form.get("website") or "").strip():
        return JSONResponse({"ok": True, "reference": ""})

    ip_hash = security.hash_ip(client_ip(request))
    if not _limiter(request).allow("contact:" + ip_hash, limit=3, window=3600):
        return _refuse("Trop de messages envoyés depuis cette connexion. Réessaie dans une heure.", 429)

    age = _token_age(_token_from_request(request, payload))
    if age is None or age < MIN_AGE:
        return _refuse("Formulaire expiré, recharge la page et renvoie ton message.", 400)

    data, errors = validate(payload)
    if errors:
        return _refuse("Merci de corriger les champs signalés.", 400, errors)
    if looks_like_spam(data):
        return JSONResponse({"ok": True, "reference": ""})

    conn = _db(request)
    try:
        reference = store(conn, data, ip_hash, request.headers.get("user-agent", ""))
    finally:
        conn.close()
    return JSONResponse({"ok": True, "reference": reference})


def require_sync(request: Request) -> None:
    expected = settings_module.env("SYNC_TOKEN")
    supplied = str(request.headers.get("x-sync-token") or request.query_params.get("token") or "")
    if not expected or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="jeton de synchronisation invalide")


@sync.get("/api/sync/messages")
def sync_messages(request: Request, since: int = 0, _: None = Depends(require_sync)) -> dict:
    conn = _db(request)
    try:
        rows = conn.execute(
            "SELECT id, reference, name, email, phone, project_type, budget, message, source, "
            "status, notified_at, created_at FROM messages WHERE id > ? ORDER BY id",
            (int(since),),
        ).fetchall()
        return {"messages": [dict(row) for row in rows]}
    finally:
        conn.close()


@sync.post("/api/sync/messages/{message_id}/notified")
def sync_notified(request: Request, message_id: int, _: None = Depends(require_sync)) -> dict:
    conn = _db(request)
    try:
        repo.update_message(conn, message_id, {"notified_at": time.strftime("%Y-%m-%d %H:%M:%S")})
        conn.commit()
    finally:
        conn.close()
    return {"ok": True}
