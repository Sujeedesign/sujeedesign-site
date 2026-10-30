"""Points d'entrée HTTP de l'agent de contact.

Deux familles de routes :

* `/api/agent/*` pour la page publique `/contact` de la vitrine (session et
  conversation en streaming SSE). Pas d'authentification : la page est
  publique, la protection vient du rate limit et des bornes de l'engine.
* `/api/sync/agent-leads*` pour le notifieur Telegram du serveur, protégé par
  le même jeton de synchronisation que les messages du formulaire.
"""

from __future__ import annotations

import asyncio
import json
import sqlite3
import time
from typing import Any, Iterator

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

from .. import security
from ..contact import client_ip, require_sync
from ..contact import validate as validate_contact
from ..db import connect
from . import engine, store
from .google import CalendarClient
from .llm import MistralClient

router = APIRouter(prefix="/api/agent", tags=["agent"])
sync = APIRouter(prefix="/api/sync", tags=["sync"])

SESSION_LIMIT = 5  # nouvelles conversations par heure et par IP
CHAT_LIMIT = 40  # messages par heure et par IP, toutes conversations confondues


def _limiter(request: Request, name: str) -> security.RateLimiter:
    limiter = getattr(request.app.state, name, None)
    if limiter is None:
        limiter = security.RateLimiter()
        setattr(request.app.state, name, limiter)
    return limiter


def _conn(request: Request) -> sqlite3.Connection:
    return connect(request.app.state.db_path)


def _allowed(request: Request) -> bool:
    ip = client_ip(request)
    sessions = _limiter(request, "agent_session_limiter").allow(f"s:{ip}", SESSION_LIMIT, 3600)
    messages = _limiter(request, "agent_chat_limiter").allow(f"c:{ip}", CHAT_LIMIT, 3600)
    return sessions and messages


def _sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


def _ip_hash(request: Request) -> str:
    try:
        return security.hash_ip(client_ip(request))
    except RuntimeError:  # SESSION_SECRET absent en dev : on n'identifie pas, on ne bloque pas
        return ""


@router.get("/health")
def health() -> JSONResponse:
    return JSONResponse({"ok": True, "agent": "contact"})


@router.post("/session")
async def session(request: Request) -> JSONResponse:
    if not _allowed(request):
        raise HTTPException(status_code=429, detail="Trop de demandes. Réessayez plus tard ou écrivez-nous.")
    conn = _conn(request)
    try:
        session_id = engine.prepare_session(conn, ip_hash=_ip_hash(request))
        conn.commit()
    finally:
        conn.close()
    return JSONResponse({"session_id": session_id})


@router.post("/chat")
async def chat(request: Request) -> StreamingResponse:
    if not _allowed(request):
        raise HTTPException(status_code=429, detail="Trop de messages. Réessayez plus tard.")
    try:
        payload = await request.json()
    except ValueError:
        raise HTTPException(status_code=400, detail="Requête illisible.")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Requête illisible.")

    session_id = str(payload.get("session_id") or "").strip()
    message = str(payload.get("message") or "")[: store.MAX_MESSAGE]
    if not session_id or not message.strip():
        raise HTTPException(status_code=400, detail="Session ou message manquant.")

    conn = _conn(request)
    try:
        if store.get_session(conn, session_id) is None:
            raise HTTPException(status_code=404, detail="Session inconnue.")
    finally:
        conn.close()

    def produce() -> Iterator[str]:
        conn = _conn(request)
        try:
            llm = MistralClient()
            google = CalendarClient()
            for event in engine.turn(conn, session_id, message, llm, google):
                yield _sse(event)
            conn.commit()
        except Exception as error:  # aucune fuite de trace dans le flux
            yield _sse({"type": "error", "message": "Une erreur est survenue. Vous pouvez continuer ou écrire via le formulaire."})
            print(f"agent: erreur de tour · {type(error).__name__}: {error}")
        finally:
            conn.close()
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        produce(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


LEAD_LIMIT = 5  # formulaires de secours par heure et par IP


@router.post("/lead")
async def lead(request: Request) -> JSONResponse:
    """Formulaire de secours : enregistre une demande sans passer par la conversation.

    Le lead rejoint la même table que ceux de l'agent ; le notifieur Telegram le
    relève comme les autres et Sujee le retrouve dans la console admin.
    """
    ip = client_ip(request)
    if not _limiter(request, "agent_lead_limiter").allow(f"l:{ip}", LEAD_LIMIT, 3600):
        raise HTTPException(status_code=429, detail="Trop d'envois. Réessayez plus tard.")
    try:
        payload = await request.json()
    except ValueError:
        raise HTTPException(status_code=400, detail="Requête illisible.")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Requête illisible.")

    data, errors = validate_contact(payload)
    if errors:
        raise HTTPException(status_code=422, detail={"errors": errors})

    conn = _conn(request)
    try:
        session_id = str(payload.get("session_id") or "").strip()
        if not session_id or store.get_session(conn, session_id) is None:
            session_id = store.new_session(conn, ip_hash=_ip_hash(request))
        fields = {
            "project_type": data["project_type"],
            "budget": data["budget"],
            "source": "formulaire",
        }
        created = store.create_lead(
            conn,
            session_id,
            fields,
            name=data["name"],
            email=data["email"],
            phone=data["phone"],
            summary=data["message"],
            status=store.STATUS_REVIEW,
            ip_hash=_ip_hash(request),
        )
        store.touch(conn, session_id, status=store.STATUS_FORM, lead_id=created["id"], reference=created["reference"])
        store.add_message(conn, session_id, "user", data["message"][: store.MAX_MESSAGE])
        return JSONResponse({"reference": created["reference"], "session_id": session_id})
    finally:
        conn.close()


@router.get("/session/{session_id}")
def read_session(request: Request, session_id: str) -> JSONResponse:
    conn = _conn(request)
    try:
        row = store.get_session(conn, session_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Session inconnue.")
        return JSONResponse(
            {
                "session_id": session_id,
                "step": row["step"],
                "status": row["status"],
                "reference": row["reference"] or "",
                "messages": [
                    {"role": item["role"], "content": item["content"]}
                    for item in store.messages(conn, session_id)
                ],
            }
        )
    finally:
        conn.close()


@sync.get("/agent-leads")
def sync_leads(request: Request, since: int = 0, _: None = Depends(require_sync)) -> dict:
    conn = _conn(request)
    try:
        rows = conn.execute(
            "SELECT id, reference, name, email, phone, fields, summary, status, "
            "event_id, slot_start, notified_at, created_at FROM agent_leads "
            "WHERE id > ? ORDER BY id",
            (int(since),),
        ).fetchall()
        leads = []
        for row in rows:
            item = dict(row)
            item["fields"] = store.json_loads(item.get("fields"), {})
            leads.append(item)
        return {"leads": leads}
    finally:
        conn.close()


@sync.post("/agent-leads/{lead_id}/notified")
def sync_lead_notified(request: Request, lead_id: int, _: None = Depends(require_sync)) -> dict:
    conn = _conn(request)
    try:
        store.update_lead(conn, int(lead_id), notified_at=time.strftime("%Y-%m-%d %H:%M:%S"))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()
