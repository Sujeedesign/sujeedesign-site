"""Tests de la grille de créneaux."""

from __future__ import annotations

from datetime import datetime, timedelta

from app.agent import slots

NOW = datetime(2026, 10, 30, 8, 0, tzinfo=slots.PARIS)  # un vendredi


def test_grille_respecte_jours_heures_et_delai() -> None:
    found = slots.candidates(NOW)
    assert found
    for start in found:
        assert start.weekday() <= 4
        assert (start.hour, start.minute) in slots.GRID
        assert start >= NOW + slots.LEAD_TIME
        assert start.utcoffset() is not None
        assert start.utcoffset().total_seconds() == 3600  # heure d'hiver


def test_premier_creneau_est_le_lundi_suivant() -> None:
    first = slots.candidates(NOW)[0]
    assert first.date().isoformat() == "2026-11-02"
    assert (first.hour, first.minute) == (9, 0)


def test_candidats_tries_et_sans_week_end() -> None:
    found = slots.candidates(NOW)
    assert found == sorted(found)
    assert all(start.weekday() != 5 and start.weekday() != 6 for start in found)


def test_creneau_occupe_est_ecarte() -> None:
    busy = [
        (
            datetime(2026, 11, 2, 9, 0, tzinfo=slots.PARIS),
            datetime(2026, 11, 2, 10, 15, tzinfo=slots.PARIS),
        )
    ]
    chosen = slots.pick(NOW, busy=busy)
    assert chosen[0].isoformat() == "2026-11-02T10:30:00+01:00"


def test_battement_bloque_le_creneau_suivant() -> None:
    busy = [
        (
            datetime(2026, 11, 2, 9, 0, tzinfo=slots.PARIS),
            datetime(2026, 11, 2, 9, 15, tzinfo=slots.PARIS),
        )
    ]
    # 9h30 + 10 min de battement chevauche 9h00-9h15 ? Non, 9h30 > 9h15.
    chosen = slots.pick(NOW, busy=busy, count=1)
    assert chosen[0].isoformat() == "2026-11-02T09:30:00+01:00"


def test_un_creneau_par_jour_quand_possible() -> None:
    chosen = slots.pick(NOW)
    assert len(chosen) == 3
    assert len({start.date() for start in chosen}) == 3


def test_plafond_quotidien_respecte() -> None:
    booked = {"2026-11-02": slots.MAX_PER_DAY}
    chosen = slots.pick(NOW, booked_per_day=booked, count=3)
    assert all(start.date().isoformat() != "2026-11-02" for start in chosen)


def test_complement_si_peu_de_jours_libres() -> None:
    booked = {f"2026-11-{day:02d}": slots.MAX_PER_DAY for day in range(2, 5)}
    chosen = slots.pick(NOW, booked_per_day=booked, count=3)
    assert len(chosen) == 3
    assert chosen[0].date().isoformat() == "2026-11-05"


def test_identifiant_stable() -> None:
    start = datetime(2026, 11, 2, 9, 0, 12, tzinfo=slots.PARIS)
    assert slots.slot_id(start) == "2026-11-02T09:00:00+01:00"
    assert slots.parse_slot(slots.slot_id(start)) == start.replace(second=0, microsecond=0)
    assert slots.parse_slot("n'importe quoi") is None


def test_fin_de_grille_dans_horizon() -> None:
    found = slots.candidates(NOW, horizon_days=3)
    assert max(start.date().isoformat() for start in found) <= (
        NOW.date() + timedelta(days=3)
    ).isoformat()
