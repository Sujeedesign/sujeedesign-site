"""Invitations : en-têtes, pièce jointe ICS et absence d'invitation Google."""

from __future__ import annotations

import base64
import email
import json
from datetime import datetime
from email.message import Message
from zoneinfo import ZoneInfo

import httpx

from app.agent import ics
from app.agent.google import CalendarClient, GoogleConfig

PARIS = ZoneInfo("Europe/Paris")
START = datetime(2026, 11, 9, 14, 0, tzinfo=PARIS)


def _client(monkeypatch, calls: list[httpx.Request], **kwargs) -> CalendarClient:
    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if request.url.host == "oauth2.googleapis.com":
            return httpx.Response(200, json={"access_token": "jeton", "expires_in": 3600})
        if request.method == "POST" and request.url.path.endswith("/events"):
            return httpx.Response(200, json={"id": "evt_1", "htmlLink": "https://cal.example/evt_1"})
        return httpx.Response(200, json={"id": "msg_1"})

    config = GoogleConfig(
        client_id="id",
        client_secret="secret",
        refresh_token="refresh",
        calendar_id="primary",
        from_email="hello@sujeedesign.com",
        from_name="Sujee Design",
    )
    return CalendarClient(config=config, transport=httpx.MockTransport(handler))


def _sent_message(request: httpx.Request) -> Message:
    raw = json.loads(request.content.decode())["raw"]
    return email.message_from_bytes(base64.urlsafe_b64decode(raw + "=="))


def test_evenement_cree_sans_invitation_google(monkeypatch):
    calls: list[httpx.Request] = []
    client = _client(monkeypatch, calls)
    client.create_event(
        start=START,
        attendee_email="claire@example.com",
        attendee_name="Claire Martin",
        summary="Appel découverte · Claire Martin",
        description="Brief",
    )
    event_call = next(c for c in calls if c.url.path.endswith("/events"))
    assert event_call.url.params["sendUpdates"] == "none"


def test_invitation_google_sur_demande(monkeypatch):
    calls: list[httpx.Request] = []
    client = _client(monkeypatch, calls)
    client.create_event(
        start=START,
        attendee_email="claire@example.com",
        attendee_name="Claire Martin",
        summary="Appel découverte",
        description="Brief",
        notify_guest=True,
    )
    event_call = next(c for c in calls if c.url.path.endswith("/events"))
    assert event_call.url.params["sendUpdates"] == "all"


def test_mail_avec_expediteur_et_piece_jointe_calendrier(monkeypatch):
    calls: list[httpx.Request] = []
    client = _client(monkeypatch, calls)
    invite = ics.build_invite(
        start=START,
        end=datetime(2026, 11, 9, 14, 30, tzinfo=PARIS),
        summary="Appel découverte · Claire Martin",
        description="Brief",
        location="Téléphone",
        attendee_email="claire@example.com",
        attendee_name="Claire Martin",
        organizer_email="hello@sujeedesign.com",
        organizer_name="Sujee Design",
        uid="evt_1@sujeedesign.com",
    )
    client.send_mail(
        to="claire@example.com",
        subject="Votre rendez-vous",
        text="Bonjour",
        attachments=[("rendez-vous-sujee-design.ics", invite, "text", "calendar")],
        reply_to="hello@sujeedesign.com",
    )
    mail_call = next(c for c in calls if c.url.path.endswith("/messages/send"))
    message = _sent_message(mail_call)
    assert message["From"] == "Sujee Design <hello@sujeedesign.com>"
    assert message["Reply-To"] == "hello@sujeedesign.com"
    parts = [part.get_content_type() for part in message.walk()]
    assert "text/calendar" in parts


def test_echec_temporaire_de_google_est_rejoue(monkeypatch):
    """Un 503 passager ne doit pas annuler la reservation du client."""
    calls: list[httpx.Request] = []
    attempts = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if request.url.host == "oauth2.googleapis.com":
            return httpx.Response(200, json={"access_token": "jeton", "expires_in": 3600})
        attempts["n"] += 1
        if attempts["n"] == 1:
            return httpx.Response(503, json={"error": "backend"})
        return httpx.Response(200, json={"id": "evt_2", "htmlLink": "https://cal.example/evt_2"})

    config = GoogleConfig(
        client_id="id",
        client_secret="secret",
        refresh_token="refresh",
        calendar_id="primary",
        from_email="hello@sujeedesign.com",
        from_name="Sujee Design",
    )
    client = CalendarClient(config=config, transport=httpx.MockTransport(handler))
    event = client.create_event(
        start=START,
        attendee_email="claire@example.com",
        attendee_name="Claire Martin",
        summary="Appel decouverte",
        description="Brief",
    )
    assert event["id"] == "evt_2"
    assert attempts["n"] == 2


def test_ics_heure_de_paris_et_organisateur():
    payload = ics.build_invite(
        start=START,
        end=datetime(2026, 11, 9, 14, 30, tzinfo=PARIS),
        summary="Appel découverte · Vaasam, studio",
        description="Ligne 1\nLigne 2",
        location="Téléphone",
        attendee_email="claire@example.com",
        attendee_name="Claire Martin",
        organizer_email="hello@sujeedesign.com",
        organizer_name="Sujee Design",
        uid="evt_1@sujeedesign.com",
    ).decode("utf-8")
    assert "DTSTART;TZID=Europe/Paris:20261109T140000" in payload
    assert "DTEND;TZID=Europe/Paris:20261109T143000" in payload
    assert "ORGANIZER;CN=Sujee Design:mailto:hello@sujeedesign.com" in payload
    assert "mailto:claire@example.com" in payload
    # Virgule et retour à la ligne échappés selon la RFC 5545.
    assert "SUMMARY:Appel découverte · Vaasam\\, studio" in payload
    assert "Ligne 1\\nLigne 2" in payload
    assert payload.startswith("BEGIN:VCALENDAR") and "END:VCALENDAR" in payload
