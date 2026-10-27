"""Petites fonctions d'affichage partagées par les gabarits du back office."""

from __future__ import annotations

import json
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi.templating import Jinja2Templates

TEMPLATES_DIR = Path(__file__).resolve().parent / "admin_templates"

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

MOIS = (
    "janv.", "févr.", "mars", "avr.", "mai", "juin",
    "juil.", "août", "sept.", "oct.", "nov.", "déc.",
)


def _parse(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    text = str(value or "").strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text[:19], fmt)
        except ValueError:
            continue
    return None


def datefr(value: Any) -> str:
    moment = _parse(value)
    if moment is None:
        return "—"
    return f"{moment.day} {MOIS[moment.month - 1]} {moment.year}"


def timefr(value: Any) -> str:
    moment = _parse(value)
    if moment is None:
        return "—"
    return moment.strftime("%H:%M")


def datetimefr(value: Any) -> str:
    moment = _parse(value)
    if moment is None:
        return "—"
    return f"{datefr(moment)} · {moment.strftime('%H:%M')}"


def ago(value: Any) -> str:
    moment = _parse(value)
    if moment is None:
        return "—"
    seconds = int((datetime.now() - moment).total_seconds())
    if seconds < 60:
        return "à l'instant"
    if seconds < 3600:
        return f"il y a {seconds // 60} min"
    if seconds < 86400:
        return f"il y a {seconds // 3600} h"
    if seconds < 86400 * 7:
        return f"il y a {seconds // 86400} j"
    return datefr(moment)


def initials(name: Any) -> str:
    parts = [part for part in str(name or "").split() if part]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def excerpt(value: Any, length: int = 160) -> str:
    text = " ".join(str(value or "").split())
    return text if len(text) <= length else text[: length - 1].rstrip() + "…"


def slugify(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode("ascii")
    return "-".join("".join(c if c.isalnum() else " " for c in text.lower()).split())


def human_size(size: Any) -> str:
    try:
        value = float(size or 0)
    except (TypeError, ValueError):
        return "—"
    if value <= 0:
        return "—"
    for unit in ("o", "Ko", "Mo", "Go"):
        if value < 1024 or unit == "Go":
            return f"{value:.0f} {unit}" if unit == "o" else f"{value:.1f} {unit}"
        value /= 1024
    return f"{value:.1f} Go"


def tojson(value: Any, indent: int = 2) -> str:
    return json.dumps(value, ensure_ascii=False, indent=indent, default=str)


templates.env.filters.update(
    {
        "datefr": datefr,
        "timefr": timefr,
        "datetimefr": datetimefr,
        "ago": ago,
        "initials": initials,
        "excerpt": excerpt,
        "human_size": human_size,
    }
)
templates.env.globals.update({"tojson": tojson, "slugify": slugify})
