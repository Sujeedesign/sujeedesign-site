"""Grille de créneaux et croisement avec les indisponibilités de l'agenda.

Aucune dépendance réseau ici : la génération et la sélection sont pures, donc
testables sans Google. Le fuseau est Europe/Paris.
"""

from __future__ import annotations

import unicodedata
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

PARIS = ZoneInfo("Europe/Paris")

SLOT_MINUTES = 20
BUFFER_MINUTES = 10
LEAD_TIME = timedelta(hours=48)
MAX_PER_DAY = 4
HORIZON_DAYS = 14
MORNING_END_HOUR = 12

# Demi-journées proposées au visiteur. Les valeurs servent de clés internes,
# les libellés sont ceux affichés.
MOMENTS = {
    "matin": "le matin",
    "apres-midi": "l'après-midi",
}
MOMENT_LABELS = {
    "matin": "Matin",
    "apres-midi": "Après-midi",
}
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


def _fold(value: str) -> str:
    """Minuscules sans accents, pour reconnaître « après-midi » et « apres midi »."""
    text = unicodedata.normalize("NFD", str(value or "").lower())
    return "".join(char for char in text if unicodedata.category(char) != "Mn")


def normalize_moment(value: str) -> str:
    """Renvoie « matin », « apres-midi » ou "" si le message n'est pas concluant.

    Un message qui évoque les deux moments (ex. « le matin ou l'après-midi ? »)
    ne tranche pas : on renvoie "" pour que la question soit reposée.
    """
    text = _fold(value)
    if not text.strip():
        return ""
    morning = any(word in text for word in ("matin", "matinee"))
    afternoon = any(word in text for word in ("apres-midi", "apres midi", "aprem", "apresmidi", "apres"))
    if morning and afternoon:
        return ""
    if afternoon:
        return "apres-midi"
    if morning:
        return "matin"
    return ""


def moment_of(start: datetime) -> str:
    """Demi-journée d'un créneau : avant midi ou après."""
    return "matin" if _as_paris(start).hour < MORNING_END_HOUR else "apres-midi"


def matches_moment(start: datetime, moment: str) -> bool:
    return not moment or moment_of(start) == moment


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
    moment: str = "",
) -> list[datetime]:
    """Trois créneaux libres, un par jour tant que possible.

    `booked_per_day` compte les rendez-vous déjà posés par l'agent, pour
    respecter le plafond quotidien ; `taken` liste les créneaux déjà réservés.
    `moment` (« matin » ou « apres-midi ») restreint la proposition à la
    demi-journée choisie par le visiteur ; si elle est saturée, on retombe sur
    la grille complète pour ne jamais laisser le visiteur sans proposition.
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
    if moment:
        preferred = [start for start in free if matches_moment(start, moment)]
        if preferred:
            free = preferred
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
