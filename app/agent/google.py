"""Accès Google côté serveur : agenda et envoi d'emails.

Deux usages, un seul jeton dédié stocké dans les variables d'environnement du
back office (jamais côté navigateur) :

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`
- `AGENT_CALENDAR_ID` (par défaut `primary`), `AGENT_FROM_EMAIL`, `AGENT_FROM_NAME`

En développement seulement, `AGENT_ALLOW_MASTER_GOOGLE=1` permet de réutiliser
le jeton local existant pour tester le parcours de bout en bout.
"""

from __future__ import annotations

import base64
import json
import os
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from email.message import EmailMessage
from pathlib import Path
from typing import Any

import httpx

from . import slots

TOKEN_URL = "https://oauth2.googleapis.com/token"
CALENDAR_API = "https://www.googleapis.com/calendar/v3"
GMAIL_SEND = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"

MASTER_TOKEN_FILE = Path("/opt/data/google_token.json")
MASTER_CLIENT_FILE = Path("/opt/data/google_client_secret.json")


class GoogleError(RuntimeError):
    """Erreur d'accès à Google, remontée à l'agent comme échec d'outil."""


@dataclass(frozen=True)
class GoogleConfig:
    client_id: str
    client_secret: str
    refresh_token: str
    calendar_id: str = "primary"
    from_email: str = ""
    from_name: str = "Sujee Design"

    @property
    def configured(self) -> bool:
        return bool(self.client_id and self.client_secret and self.refresh_token)


def _master_config() -> GoogleConfig | None:
    if not (MASTER_TOKEN_FILE.exists() and MASTER_CLIENT_FILE.exists()):
        return None
    try:
        token = json.loads(MASTER_TOKEN_FILE.read_text(encoding="utf-8"))
        secret = json.loads(MASTER_CLIENT_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    block = secret.get("installed") or secret.get("web") or {}
    client_id = block.get("client_id") or token.get("client_id") or ""
    client_secret = block.get("client_secret") or token.get("client_secret") or ""
    refresh = token.get("refresh_token") or ""
    if not (client_id and client_secret and refresh):
        return None
    return GoogleConfig(
        client_id=client_id,
        client_secret=client_secret,
        refresh_token=refresh,
        calendar_id=os.environ.get("AGENT_CALENDAR_ID", "primary"),
        from_email=os.environ.get("AGENT_FROM_EMAIL", "hello@sujeedesign.com"),
        from_name=os.environ.get("AGENT_FROM_NAME", "Sujee Design"),
    )


def load_config() -> GoogleConfig:
    config = GoogleConfig(
        client_id=os.environ.get("GOOGLE_CLIENT_ID", ""),
        client_secret=os.environ.get("GOOGLE_CLIENT_SECRET", ""),
        refresh_token=os.environ.get("GOOGLE_REFRESH_TOKEN", ""),
        calendar_id=os.environ.get("AGENT_CALENDAR_ID", "primary"),
        from_email=os.environ.get("AGENT_FROM_EMAIL", "hello@sujeedesign.com"),
        from_name=os.environ.get("AGENT_FROM_NAME", "Sujee Design"),
    )
    if config.configured:
        return config
    if os.environ.get("AGENT_ALLOW_MASTER_GOOGLE") == "1":
        master = _master_config()
        if master:
            return master
    return config


def _rfc3339(moment: datetime) -> str:
    return slots._as_paris(moment).isoformat()


class CalendarClient:
    """Client minimal Google Calendar + Gmail, avec jeton rafraîchi en mémoire."""

    def __init__(
        self,
        config: GoogleConfig | None = None,
        transport: httpx.BaseTransport | None = None,
        timeout: float = 20.0,
    ) -> None:
        self.config = config or load_config()
        self._client = httpx.Client(transport=transport, timeout=timeout)
        self._token = ""
        self._token_until = 0.0

    # -- bas niveau -------------------------------------------------------
    def access_token(self) -> str:
        if self._token and time.time() < self._token_until - 60:
            return self._token
        if not self.config.configured:
            raise GoogleError("Accès Google non configuré")
        payload = {
            "client_id": self.config.client_id,
            "client_secret": self.config.client_secret,
            "refresh_token": self.config.refresh_token,
            "grant_type": "refresh_token",
        }
        try:
            response = self._client.post(TOKEN_URL, data=payload)
        except httpx.HTTPError as error:
            raise GoogleError(f"Google injoignable : {error}") from error
        if response.status_code != 200:
            raise GoogleError(f"Jeton Google refusé ({response.status_code})")
        data = response.json()
        token = data.get("access_token") or ""
        if not token:
            raise GoogleError("Réponse Google sans jeton")
        self._token = token
        self._token_until = time.time() + float(data.get("expires_in", 3600))
        return token

    def _request(self, method: str, url: str, **kwargs: Any) -> dict[str, Any]:
        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Bearer {self.access_token()}"
        try:
            response = self._client.request(method, url, headers=headers, **kwargs)
        except httpx.HTTPError as error:
            raise GoogleError(f"Google injoignable : {error}") from error
        if response.status_code >= 400:
            raise GoogleError(f"Google a répondu {response.status_code} : {response.text[:200]}")
        if not response.content:
            return {}
        return response.json()

    # -- agenda -----------------------------------------------------------
    def busy(self, time_min: datetime, time_max: datetime) -> list[tuple[datetime, datetime]]:
        body = {
            "timeMin": _rfc3339(time_min),
            "timeMax": _rfc3339(time_max),
            "timeZone": "Europe/Paris",
            "items": [{"id": self.config.calendar_id}],
        }
        data = self._request("POST", f"{CALENDAR_API}/freeBusy", json=body)
        calendars = (data.get("calendars") or {}).get(self.config.calendar_id) or {}
        intervals: list[tuple[datetime, datetime]] = []
        for entry in calendars.get("busy") or []:
            start = slots.parse_slot(str(entry.get("start", "")))
            end = slots.parse_slot(str(entry.get("end", "")))
            if start and end:
                intervals.append((start, end))
        return intervals

    def available_slots(self, count: int = 3, booked_per_day: dict[str, int] | None = None) -> list[datetime]:
        now = slots.now_paris()
        horizon = now + timedelta(days=slots.HORIZON_DAYS + 1)
        try:
            busy = self.busy(now, horizon)
        except GoogleError:
            busy = []
        return slots.pick(now, busy, count=count, booked_per_day=booked_per_day)

    def create_event(
        self,
        start: datetime,
        attendee_email: str,
        attendee_name: str,
        summary: str,
        description: str,
    ) -> dict[str, Any]:
        end = start + timedelta(minutes=slots.SLOT_MINUTES)
        body = {
            "summary": summary,
            "description": description,
            "start": {"dateTime": _rfc3339(start), "timeZone": "Europe/Paris"},
            "end": {"dateTime": _rfc3339(end), "timeZone": "Europe/Paris"},
            "attendees": [{"email": attendee_email, "displayName": attendee_name}],
            "guestsCanModify": False,
            "reminders": {"useDefault": True},
        }
        return self._request(
            "POST",
            f"{CALENDAR_API}/calendars/{self.config.calendar_id}/events",
            params={"sendUpdates": "all"},
            json=body,
        )

    def delete_event(self, event_id: str) -> None:
        self._request(
            "DELETE",
            f"{CALENDAR_API}/calendars/{self.config.calendar_id}/events/{event_id}",
            params={"sendUpdates": "all"},
        )

    # -- email ------------------------------------------------------------
    def send_mail(self, to: str, subject: str, text: str, html: str = "") -> dict[str, Any]:
        message = EmailMessage()
        message["To"] = to
        message["From"] = f"{self.config.from_name} <{self.config.from_email}>"
        message["Subject"] = subject
        message.set_content(text)
        if html:
            message.add_alternative(html, subtype="html")
        raw = base64.urlsafe_b64encode(message.as_bytes()).decode("ascii")
        return self._request("POST", GMAIL_SEND, json={"raw": raw})

    def close(self) -> None:
        self._client.close()
