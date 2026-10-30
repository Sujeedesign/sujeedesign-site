"""Grille de créneaux et croisement avec les indisponibilités de l'agenda.

Aucune dépendance réseau ici : la génération et la sélection sont pures, donc
testables sans Google. Le fuseau est Europe/Paris.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

PARIS = ZoneInfo("Europe/Paris")

SLOT_MINUTES = 20
BUFFER_MINUTES = 10
LEAD_TIME = timedelta(hours=48)
MAX_PER_DAY = 4
HORIZON_DAYS = 14
GRID: tuple[tuple[int, int], ...] = (
    (9, 0),
    (9, 30),
    (10, 0),
    (10, 30),
    (14, 0),
    (14, 30),
    (15, 0),
    (15, 30),
)


def now_paris() -> datetime:
    return datetime.now(tz=PARIS)


def _as_paris(moment: datetime) -> datetime:
    if moment.tzinfo is None:
        return moment.replace(tzinfo=PARIS)
    return moment.astimezone(PARIS)


def slot_id(start: datetime) -> str:
    """Identifiant stable d'un créneau : ISO 8601 en heure de Paris, à la minute."""
    return _as_paris(start).replace(second=0, microsecond=0).isoformat()


def parse_slot(value: str) -> datetime | None:
    try:
        return _as_paris(datetime.fromisoformat(value))
    except (TypeError, ValueError):
        return None


def candidates(now: datetime | None = None, horizon_days: int = HORIZON_DAYS) -> list[datetime]:
    """Tous les créneaux théoriques de la grille, week-ends et délai exclus."""
    current = _as_paris(now or now_paris())
    earliest = current + LEAD_TIME
    start_day = current.date()
    found: list[datetime] = []
    for offset in range(horizon_days + 1):
        day = start_day + timedelta(days=offset)
        if day.weekday() > 4:  # samedi et dimanche
            continue
        for hour, minute in GRID:
            start = datetime(day.year, day.month, day.day, hour, minute, tzinfo=PARIS)
            if start < earliest:
                continue
            found.append(start)
    return found


def _overlaps(start: datetime, busy_start: datetime, busy_end: datetime) -> bool:
    end = start + timedelta(minutes=SLOT_MINUTES + BUFFER_MINUTES)
    return start < busy_end and busy_start < end


def is_free(start: datetime, busy: list[tuple[datetime, datetime]]) -> bool:
    return not any(_overlaps(start, _as_paris(b0), _as_paris(b1)) for b0, b1 in busy)


def day_key(moment: datetime) -> str:
    return _as_paris(moment).date().isoformat()


def pick(
    now: datetime | None = None,
    busy: list[tuple[datetime, datetime]] | None = None,
    count: int = 3,
    booked_per_day: dict[str, int] | None = None,
    horizon_days: int = HORIZON_DAYS,
    taken: set[str] | None = None,
) -> list[datetime]:
    """Trois créneaux libres, un par jour tant que possible.

    `booked_per_day` compte les rendez-vous déjà posés par l'agent, pour
    respecter le plafond quotidien ; `taken` liste les créneaux déjà réservés.
    """
    busy = busy or []
    booked = dict(booked_per_day or {})
    taken = taken or set()
    free = [
        start
        for start in candidates(now, horizon_days)
        if is_free(start, busy)
        and booked.get(day_key(start), 0) < MAX_PER_DAY
        and slot_id(start) not in taken
    ]
    chosen: list[datetime] = []
    seen_days: set[str] = set()
    for start in free:
        key = day_key(start)
        if key in seen_days:
            continue
        chosen.append(start)
        seen_days.add(key)
        if len(chosen) == count:
            return chosen
    # Pas assez de jours distincts : on complète avec le reste de la grille.
    for start in free:
        if start in chosen:
            continue
        chosen.append(start)
        if len(chosen) == count:
            break
    return chosen
