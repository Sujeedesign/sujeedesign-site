"""Tests HTTP de l'agent de contact (routes publiques et synchronisation)."""

from __future__ import annotations

import sqlite3

import pytest
from fastapi.testclient import TestClient

import importlib

from app.agent import engine as agent_engine
from app.agent import store

agent_routes = importlib.import_module("app.agent.routes")


def _events(response) -> list[dict]:
    import json

    out = []
    for line in response.text.splitlines():
        if line.startswith("data: ") and line[6:].strip() != "[DONE]":
            out.append(json.loads(line[6:]))
    return out


def test_session_puis_chat_diffuse_les_evenements(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    created = client.post("/api/agent/session")
    assert created.status_code == 200
    session_id = created.json()["session_id"]
    assert session_id

    monkeypatch.setattr(agent_routes, "MistralClient", lambda: object())
    monkeypatch.setattr(agent_routes, "CalendarClient", lambda: object())

    def fake_turn(conn: sqlite3.Connection, sid: str, message: str, llm, google):
        assert sid == session_id
        assert message == "Bonjour"
        yield {"type": "delta", "text": "Bonjour"}
        yield {"type": "done", "session": sid, "step": "accueil", "status": "ouverture", "reference": ""}

    monkeypatch.setattr(agent_engine, "turn", fake_turn)

    response = client.post("/api/agent/chat", json={"session_id": session_id, "message": "Bonjour"})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    events = _events(response)
    assert [event["type"] for event in events] == ["delta", "done"]
    assert response.text.rstrip().endswith("data: [DONE]")


def test_chat_refuse_une_session_inconnue(client: TestClient) -> None:
    response = client.post("/api/agent/chat", json={"session_id": "inconnue", "message": "Bonjour"})
    assert response.status_code == 404


def test_chat_refuse_un_message_vide(client: TestClient) -> None:
    session_id = client.post("/api/agent/session").json()["session_id"]
    response = client.post("/api/agent/chat", json={"session_id": session_id, "message": "   "})
    assert response.status_code == 400


def test_sync_leads_exige_le_jeton(client: TestClient) -> None:
    assert client.get("/api/sync/agent-leads").status_code in (401, 403)
    ok = client.get("/api/sync/agent-leads", headers={"X-Sync-Token": "jeton-de-test"})
    assert ok.status_code == 200
    assert ok.json()["leads"] == []


def test_sync_marque_un_lead_comme_notifie(client: TestClient, db_file) -> None:
    from app.db import connect

    conn = connect(db_file)
    try:
        session_id = store.new_session(conn)
        created = store.create_lead(
            conn,
            session_id,
            {"project_type": "Refonte d'identité"},
            name="Claire Martin",
            email="claire@example.com",
            summary="Refonte d'identité pour un studio de yoga.",
            status=store.STATUS_QUALIFIED,
        )
        lead_id = created["id"]
    finally:
        conn.close()

    headers = {"X-Sync-Token": "jeton-de-test"}
    listed = client.get("/api/sync/agent-leads", headers=headers).json()["leads"]
    assert len(listed) == 1
    assert listed[0]["fields"]["project_type"] == "Refonte d'identité"

    marked = client.post(f"/api/sync/agent-leads/{lead_id}/notified", headers=headers)
    assert marked.status_code == 200 and marked.json()["ok"] is True

    after = client.get("/api/sync/agent-leads", headers=headers).json()["leads"]
    assert after[0]["notified_at"]


def test_formulaire_de_secours_cree_un_lead_a_trier(client: TestClient) -> None:
    response = client.post(
        "/api/agent/lead",
        json={
            "name": "Claire Martin",
            "email": "Claire@Example.com",
            "phone": "06 12 34 56 78",
            "project_type": "Refonte d'identité",
            "budget": "3 000 à 5 000 €",
            "message": "Je cherche une refonte d'identité pour un studio de yoga à Paris.",
            "consent": "on",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["reference"]
    assert body["session_id"]

    headers = {"X-Sync-Token": "jeton-de-test"}
    leads = client.get("/api/sync/agent-leads", headers=headers).json()["leads"]
    assert len(leads) == 1
    lead = leads[0]
    assert lead["email"] == "claire@example.com"
    assert lead["status"] == store.STATUS_REVIEW
    assert lead["fields"]["budget"] == "3 000 à 5 000 €"
    assert "studio de yoga" in lead["summary"]


def test_formulaire_de_secours_refuse_un_email_invalide(client: TestClient) -> None:
    response = client.post(
        "/api/agent/lead",
        json={
            "name": "Claire Martin",
            "email": "pas-un-email",
            "message": "Je voudrais un site pour mon atelier de céramique.",
            "consent": "on",
        },
    )
    assert response.status_code == 422
    assert "cf-email" in response.json()["detail"]["errors"]


def test_formulaire_de_secours_exige_le_consentement(client: TestClient) -> None:
    response = client.post(
        "/api/agent/lead",
        json={
            "name": "Claire Martin",
            "email": "claire@example.com",
            "message": "Je voudrais un site pour mon atelier de céramique.",
        },
    )
    assert response.status_code == 422
    assert "cf-consent" in response.json()["detail"]["errors"]
