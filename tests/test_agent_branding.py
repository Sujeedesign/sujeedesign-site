"""Le nom de la marque n'est pas le projet redit : pas de relance en boucle."""

from __future__ import annotations

import pytest

from app.agent import engine, store

from test_agent_engine import FakeGoogle, FakeLLM, TurnOutput, _call, _collect


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


def test_redire_son_projet_n_est_pas_un_nom_de_marque(conn):
    """Le visiteur qui redit son projet ne doit pas voir son projet devenir le nom."""
    google = FakeGoogle()
    llm = FakeLLM(
        [
            [TurnOutput(text="Bonjour ! Quel type de projet avez-vous en tête ?")],
            [
                TurnOutput(text="", tool_calls=[_call("record_fields", project_type="Site web")]),
                TurnOutput(text="Un site web, très bien. Comment s'appelle la marque ?"),
            ],
            [TurnOutput(text="Je note le projet. Il a déjà un nom, ou on le trouve ensemble ?")],
        ]
    )
    session_id = engine.prepare_session(conn)

    _collect(conn, session_id, "Bonjour", llm, google)
    _collect(conn, session_id, "Site web pour une marque de vetement", llm, google)
    relance = _texte(_collect(conn, session_id, "C'est pour une marque de vetement", llm, google))

    fields = store.session_fields(store.get_session(conn, session_id))
    assert not fields.get("branding")
    assert fields["project_type"]
    assert relance


def test_un_vrai_nom_apres_une_relance(conn):
    """« Vaasam Paris » est le nom : le modèle le range tel quel."""
    google = FakeGoogle()
    llm = FakeLLM(
        [
            [TurnOutput(text="Bonjour ! Quel type de projet avez-vous en tête ?")],
            [
                TurnOutput(text="", tool_calls=[_call("record_fields", project_type="Refonte d'identité visuelle")]),
                TurnOutput(text="Très bien. Comment s'appelle la marque ?"),
            ],
            [
                TurnOutput(text="", tool_calls=[_call("record_fields", branding="Vaasam Paris")]),
                TurnOutput(text="Vaasam Paris, noté. Vous préférez le matin ou l'après-midi ?"),
            ],
        ]
    )
    session_id = engine.prepare_session(conn)

    _collect(conn, session_id, "Bonjour", llm, google)
    _collect(conn, session_id, "Refonte d'identité visuelle", llm, google)
    _collect(conn, session_id, "Vaasam Paris", llm, google)

    fields = store.session_fields(store.get_session(conn, session_id))
    assert fields["branding"] == "Vaasam Paris"


def test_le_secteur_deja_dit_n_est_pas_redemande(conn):
    """« Marque de cosmétique » suffit : le secteur est déduit, pas questionné."""
    google = FakeGoogle()
    llm = FakeLLM(
        [
            [TurnOutput(text="Bonjour ! Quel type de projet avez-vous en tête ?")],
            [
                TurnOutput(text="", tool_calls=[_call("record_fields", project_type="Créer une marque de cosmétique")]),
                TurnOutput(text="Une marque de cosmétique, très bien. Comment s'appelle-t-elle ?"),
            ],
            [
                TurnOutput(text="", tool_calls=[_call("record_fields", branding="Lahoni")]),
                TurnOutput(text="Lahoni, joli nom. Vous préférez le matin ou l'après-midi ?"),
            ],
        ]
    )
    session_id = engine.prepare_session(conn)

    accueil = _texte(_collect(conn, session_id, "Bonjour", llm, google))
    assert "type de projet" in accueil.lower()

    _collect(conn, session_id, "Créer une marque de cosmétique", llm, google)
    _collect(conn, session_id, "Lahoni", llm, google)

    fields = store.session_fields(store.get_session(conn, session_id))
    assert fields["branding"] == "Lahoni"
    assert "cosmétique" in fields["context"].lower()


