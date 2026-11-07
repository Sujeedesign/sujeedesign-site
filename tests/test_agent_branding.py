"""Le nom de la marque n'est pas le projet redit : pas de relance en boucle."""

from __future__ import annotations

import pytest

from app.agent import engine, store

from test_agent_engine import FakeGoogle, FakeLLM, _collect


def _texte(events) -> str:
    return "".join(e["text"] for e in events if e.get("type") == "delta")


@pytest.mark.parametrize(
    "dit,attendu",
    [
        ("Vaasam", "Vaasam"),
        ("Vaasam Paris", "Vaasam Paris"),
        ("L'Atelier Bleu", "L'Atelier Bleu"),
        ("Atelier du Printemps", "Atelier du Printemps"),
        ("Ma marque s'appelle Vaasam", "Vaasam"),
        ("C'est Vaasam", "Vaasam"),
        ("C'est pour une marque de vetement", ""),
        ("de vetement", ""),
        ("Une marque de vêtement éthique", ""),
        ("Site web pour une marque de vetement", ""),
        ("Ça sera une marque de fringues", ""),
    ],
)
def test_valeur_branding(dit, attendu):
    assert engine._qualification_value("branding", dit) == attendu


def test_pas_de_boucle_sur_le_nom_de_la_marque(conn):
    """Le transcript qui a fait tourner en rond : projet redit deux fois."""
    google = FakeGoogle()
    llm = FakeLLM([])
    session_id = engine.prepare_session(conn)

    _collect(conn, session_id, "Bonjour", llm, google)
    premier = _collect(conn, session_id, "Site web pour une marque de vetement", llm, google)
    # La question suivante accuse réception du projet avant de demander la marque.
    assert "nom de la marque" in _texte(premier)
    assert "site web pour une marque de vetement" in _texte(premier).lower()

    # Le visiteur redit son projet : ce n'est pas un nom, on ne l'enregistre pas.
    relance = _collect(conn, session_id, "C'est pour une marque de vetement", llm, google)
    fields = store.session_fields(store.get_session(conn, session_id))
    assert not fields.get("branding")
    # Et la relance est formulée autrement que la question initiale.
    assert "Comment s'appelle-t-elle" in _texte(relance)
    assert _texte(relance) != _texte(premier)

    # Il insiste encore : on avance au lieu de tourner en rond.
    suite = _collect(conn, session_id, "de vetement", llm, google)
    fields = store.session_fields(store.get_session(conn, session_id))
    assert fields["branding"] == store.BRANDING_UNKNOWN
    assert "activit" in _texte(suite).lower()
    assert llm.calls == 0


def test_un_vrai_nom_apres_une_relance(conn):
    google = FakeGoogle()
    llm = FakeLLM([])
    session_id = engine.prepare_session(conn)

    _collect(conn, session_id, "Bonjour", llm, google)
    _collect(conn, session_id, "Refonte d'identité visuelle", llm, google)
    _collect(conn, session_id, "C'est pour une marque de vetement", llm, google)
    _collect(conn, session_id, "Vaasam Paris", llm, google)

    fields = store.session_fields(store.get_session(conn, session_id))
    assert fields["branding"] == "Vaasam Paris"
