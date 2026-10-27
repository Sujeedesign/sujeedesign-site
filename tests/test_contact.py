"""Formulaire de contact : validation, anti-spam, stockage et synchronisation."""

from __future__ import annotations

import sqlite3
import time
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import security
from app.db import connect

SYNC_TOKEN = "jeton-de-test"
URL = "/api/contact"


def token(age: int = 10) -> str:
    return security.make_token("contact", now=int(time.time()) - age)


def payload(**overrides: Any) -> dict[str, Any]:
    data: dict[str, Any] = {
        "name": "Camille Durand",
        "email": "camille@example.com",
        "phone": "06 12 34 56 78",
        "project_type": "Identité de marque",
        "budget": "1 000 € à 3 000 €",
        "message": "Bonjour, je voudrais refaire mon identité de marque complète.",
        "consent": "1",
        "form_token": token(),
        "source_path": "/contact",
    }
    data.update(overrides)
    return data


def rows(db_file: Any) -> list[sqlite3.Row]:
    conn = connect(db_file)
    try:
        return list(conn.execute("SELECT * FROM messages ORDER BY id"))
    finally:
        conn.close()


# ------------------------------------------------------------------ soumission


def test_valid_submission_is_stored(client: TestClient, db_file: Any) -> None:
    response = client.post(URL, data=payload())
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["reference"] == "MSG-00001"
    stored = rows(db_file)
    assert len(stored) == 1
    assert stored[0]["email"] == "camille@example.com"
    assert stored[0]["status"] == "nouveau"
    assert stored[0]["ip"] and stored[0]["ip"] != "testclient"  # IP hachée


def test_cookie_token_is_accepted(client: TestClient, db_file: Any) -> None:
    """Sans JavaScript, le champ caché peut être périmé : le cookie fait foi."""
    client.cookies.set("sjd_form", token(age=30))
    data = payload()
    data.pop("form_token")
    response = client.post(URL, data=data)
    assert response.status_code == 200
    assert len(rows(db_file)) == 1


def test_fresh_cookie_wins_over_stale_field(client: TestClient, db_file: Any) -> None:
    """Le champ caché (HTML en cache) peut être périmé : le cookie frais prime."""
    client.cookies.set("sjd_form", token(age=30))
    response = client.post(URL, data=payload(form_token="contact.1.abcdef.invalide"))
    assert response.status_code == 200
    assert len(rows(db_file)) == 1


def test_honeypot_is_silent(client: TestClient, db_file: Any) -> None:
    response = client.post(URL, data=payload(website="http://spam.example"))
    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert rows(db_file) == []


def test_link_flood_is_not_stored(client: TestClient, db_file: Any) -> None:
    flood = " ".join(f"http://spam{i}.example" for i in range(6)) + " achat en gros"
    response = client.post(URL, data=payload(message=flood))
    assert response.status_code == 200
    assert rows(db_file) == []


def test_missing_token_is_refused(client: TestClient, db_file: Any) -> None:
    data = payload()
    data["form_token"] = ""
    response = client.post(URL, data=data)
    assert response.status_code == 400
    assert "expiré" in response.json()["message"].lower()
    assert rows(db_file) == []


def test_instant_submission_is_refused(client: TestClient) -> None:
    response = client.post(URL, data=payload(form_token=token(age=0)))
    assert response.status_code == 400


def test_invalid_email_is_refused(client: TestClient, db_file: Any) -> None:
    response = client.post(URL, data=payload(email="pas-un-email"))
    assert response.status_code == 400
    assert "cf-email" in response.json()["errors"]
    assert rows(db_file) == []


def test_short_message_is_refused(client: TestClient) -> None:
    response = client.post(URL, data=payload(message="court"))
    assert response.status_code == 400
    assert "cf-message" in response.json()["errors"]


def test_consent_is_required(client: TestClient, db_file: Any) -> None:
    data = payload()
    data.pop("consent")
    response = client.post(URL, data=data)
    assert response.status_code == 400
    assert "cf-consent" in response.json()["errors"]
    assert rows(db_file) == []


def test_rate_limit_per_ip(client: TestClient, db_file: Any) -> None:
    for _ in range(3):
        assert client.post(URL, data=payload()).status_code == 200
    refused = client.post(URL, data=payload())
    assert refused.status_code == 429
    assert len(rows(db_file)) == 3


# ------------------------------------------------------------------ synchronisation


def test_sync_requires_token(client: TestClient) -> None:
    assert client.get("/api/sync/messages").status_code == 401


def test_sync_lists_and_marks_messages(client: TestClient, db_file: Any) -> None:
    client.post(URL, data=payload())
    listed = client.get("/api/sync/messages", headers={"x-sync-token": SYNC_TOKEN})
    assert listed.status_code == 200
    messages = listed.json()["messages"]
    assert len(messages) == 1
    assert messages[0]["reference"] == "MSG-00001"
    assert messages[0]["notified_at"] is None

    marked = client.post(f"/api/sync/messages/{messages[0]['id']}/notified", headers={"x-sync-token": SYNC_TOKEN})
    assert marked.status_code == 200
    assert rows(db_file)[0]["notified_at"]


def test_sync_since_filters(client: TestClient) -> None:
    client.post(URL, data=payload())
    assert client.get("/api/sync/messages?since=99", headers={"x-sync-token": SYNC_TOKEN}).json()["messages"] == []
