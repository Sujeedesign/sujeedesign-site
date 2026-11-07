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

    # Il redit son projet encore une fois : on lui laisse un essai de plus
    # avant d'avancer, sans recopier la même phrase.
    suite = _collect(conn, session_id, "de vetement", llm, google)
    fields = store.session_fields(store.get_session(conn, session_id))
    assert not fields.get("branding")
    assert "s'appelle-t-elle" in _texte(suite).lower()

    # Troisième redite : on avance au lieu de tourner en rond.
    fin = _collect(conn, session_id, "de vetement", llm, google)
    fields = store.session_fields(store.get_session(conn, session_id))
    assert fields["branding"] == store.BRANDING_UNKNOWN
    # Le secteur se déduit de « marque de vetement » : pas de question dont la
    # réponse est déjà dans la demande, on passe à la demi-journée.
    assert fields["context"] == "mode et textile"
    assert "activit" not in _texte(fin).lower()
    assert "matin" in _texte(fin).lower()
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


def test_transcript_lahoni_plus_de_question_morte(conn):
    """Le transcript signalé : cosmétique, puis redite, puis « Lahoni ».

    L'agent ne doit ni redemander le type de projet, ni demander le secteur
    alors que « marque de cosmétique » le dit déjà, et jamais recopier
    « Pardon, pour quel type de projet me contactez-vous ? ».
    """
    google = FakeGoogle()
    llm = FakeLLM([])
    session_id = engine.prepare_session(conn)

    accueil = _texte(_collect(conn, session_id, "Bonjour", llm, google))
    assert "type de projet" in accueil.lower()

    projet = _texte(_collect(conn, session_id, "Direction artistique", llm, google))
    assert "nom de la marque" in projet.lower()
    assert "pardon" not in projet.lower()
    assert "pardon" not in accueil.lower()

    redite = _collect(conn, session_id, "Créer une marque de cosmétique", llm, google)
    texte_redite = _texte(redite)
    assert "pardon" not in texte_redite.lower()
    assert "bien reçu, à préciser" not in texte_redite.lower()
    # La redite est comprise, pas recopiée : la question de la marque tient.
    assert "s'appelle-t-elle" in texte_redite.lower()
    champs = store.session_fields(store.get_session(conn, session_id))
    assert "cosmétique" in champs["project_type"].lower()

    marque = _collect(conn, session_id, "Lahoni", llm, google)
    fields = store.session_fields(store.get_session(conn, session_id))
    assert fields["branding"] == "Lahoni"
    assert fields["context"] == "beauté et cosmétique"
    # Secteur déduit : aucune question « activité / secteur » après « Lahoni ».
    texte_marque = _texte(marque).lower()
    assert "secteur" not in texte_marque
    assert "activit" not in texte_marque
    assert "matin" in texte_marque
    assert llm.calls == 0
