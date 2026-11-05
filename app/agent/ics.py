"""Génération d'invitations iCalendar (ICS) pour les rendez-vous de l'agent.

Le mail part de `hello@sujeedesign.com` : c'est cette adresse qui apparaît
comme organisateur côté client, jamais le compte Google qui héberge l'agenda.
Le fichier est rattaché au mail de confirmation et au récapitulatif interne.
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

PARIS = ZoneInfo("Europe/Paris")

# Bloc VTIMEZONE Europe/Paris, nécessaire pour que Outlook/Apple affichent la
# bonne heure même hors de France.
_VTIMEZONE = """BEGIN:VTIMEZONE
TZID:Europe/Paris
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE"""


def _escape(value: str) -> str:
    return (
        str(value)
        .replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
    )


def _stamp(moment: datetime) -> str:
    return moment.astimezone(ZoneInfo("UTC")).strftime("%Y%m%dT%H%M%SZ")


def _paris(moment: datetime) -> datetime:
    if moment.tzinfo is None:
        return moment.replace(tzinfo=PARIS)
    return moment.astimezone(PARIS)


def _fold(line: str) -> str:
    """Replie une ligne à 75 octets (RFC 5545).

    Le repli se fait uniquement sur un espace existant : on remplace cet espace
    par CRLF + espace. Un dépliage retire le CRLF et retrouve donc la valeur
    d'origine. Couper au milieu d'un mot (une adresse email, par exemple)
    insérerait un espace parasite.
    """
    if len(line.encode("utf-8")) <= 75:
        return line
    out: list[str] = []
    current = ""
    for token in line.split(" "):
        candidate = f"{current} {token}" if current else token
        if len(candidate.encode("utf-8")) > 75 and current:
            out.append(current)
            current = token
        else:
            current = candidate
    if current:
        out.append(current)
    return "\r\n ".join(out)


def build_invite(
    *,
    start: datetime,
    end: datetime,
    summary: str,
    description: str,
    location: str,
    attendee_email: str,
    attendee_name: str,
    organizer_email: str,
    organizer_name: str,
    uid: str,
    method: str = "REQUEST",
) -> bytes:
    start = _paris(start)
    end = _paris(end)
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Sujee Design//Rendez-vous//FR",
        f"METHOD:{method}",
        "CALSCALE:GREGORIAN",
        _VTIMEZONE,
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{_stamp(start)}",
        f"DTSTART;TZID=Europe/Paris:{start:%Y%m%dT%H%M%S}",
        f"DTEND;TZID=Europe/Paris:{end:%Y%m%dT%H%M%S}",
        f"SUMMARY:{_escape(summary)}",
        f"DESCRIPTION:{_escape(description)}",
        f"LOCATION:{_escape(location)}",
        f"ORGANIZER;CN={organizer_name}:mailto:{organizer_email}",
        f"ATTENDEE;CN={attendee_name};ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:{attendee_email}",
        "STATUS:CONFIRMED",
        "SEQUENCE:0",
        "TRANSP:OPAQUE",
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    body = "\r\n".join(_fold(line) for line in lines) + "\r\n"
    return body.encode("utf-8")
