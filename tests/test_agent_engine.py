"""Tests de la boucle de conversation avec un faux modèle et un faux agenda."""

from __future__ import annotations

import json

import pytest

from app.agent import engine, slots, store
from app.agent.llm import TurnOutput
from app.agent import tools as agent_tools

FIELDS = {
    "project_type": "Refonte d'identité visuelle",
    "context": "Studio de yoga à Paris 11e, deux ans d'existence",
    "objective": "Attirer une clientèle plus large et professionnaliser l'image",
    "scope": "Logo, charte, cartes de visite, déclinaisons réseaux sociaux",
    "deadline": "Avant mars prochain",
    "decision_maker": "La fondatrice décide, associée consultée",
    "budget": "Enveloppe autour de 3 000 euros",
}


class FakeLLM:
    """Rejoue un scénario : une liste d'outputs par tour, consommés dans l'ordre."""

    def __init__(self, plan: list[list[TurnOutput]]) -> None:
        self.plan = [list(step) for step in plan]
        self.current: list[TurnOutput] = []
        self.calls = 0

    def stream(self, messages, tools, model=None):
        self.calls += 1
        if not self.current:
            self.current = self.plan.pop(0) if self.plan else []
        output = self.current.pop(0) if self.current else TurnOutput(text="Très bien.")
        if output.text:
            yield {"delta": output.text}
        yield {"done": output}

    def run(self, messages, tools=None, on_text=None, model=None):
        return TurnOutput(text="")


class FakeGoogle:
    def __init__(self, available: list | None = None) -> None:
        self.available = available if available is not None else []
        self.events: list[dict] = []
        self.mails: list[dict] = []
        self.fail_event = False

    def available_slots(self, count=3, booked_per_day=None, taken=None):
        return list(self.available)

    def create_event(self, start, attendee_email, attendee_name, summary, description):
        if self.fail_event:
            raise agent_tools.GoogleError("boom")
        self.events.append(
            {"start": start, "email": attendee_email, "name": attendee_name, "summary": summary, "description": description}
        )
        return {"id": "evt_123"}

    def send_mail(self, to, subject, text, html=""):
        self.mails.append({"to": to, "subject": subject, "text": text})
        return {"id": "msg_1"}


def _call(tool: str, **arguments) -> dict:
    return {
        "id": f"call_{tool}",
        "type": "function",
        "function": {"name": tool, "arguments": json.dumps(arguments, ensure_ascii=False)},
    }


def _collect(conn, session_id, text, llm, google, notify=None):
    return list(engine.turn(conn, session_id, text, llm, google, notify=notify))


def test_parcours_complet_jusqu_au_rendez_vous(conn):
    start = slots.candidates()[0]
    google = FakeGoogle(available=[start])
    session_id = engine.prepare_session(conn)
    notifications: list[str] = []

    llm = FakeLLM(
        [
            [
                TurnOutput(text="Bonjour, de quoi avez-vous besoin ?", tool_calls=[_call("record_fields", **FIELDS)]),
                TurnOutput(text="Merci, je regarde."),
            ],
            [
                TurnOutput(
                    text="Je reformule.",
                    tool_calls=[
                        _call(
                            "submit_recap",
                            recap="Refonte d'identité pour un studio de yoga, livrables logo et charte, avant mars.",
                        )
                    ],
                ),
                TurnOutput(text="Est-ce que cette reformulation est juste ?"),
            ],
            [
                TurnOutput(text="Voici des créneaux.", tool_calls=[_call("request_slots")]),
                TurnOutput(text="Quel créneau vous arrange ?"),
            ],
            [
                TurnOutput(
                    text="C'est noté.",
                    tool_calls=[
                        _call(
                            "book_meeting",
                            slot_start=slots.slot_id(start),
                            name="Claire Martin",
                            email="claire@example.com",
                        )
                    ],
                ),
                TurnOutput(text="À bientôt."),
            ],
        ]
    )

    first = _collect(conn, session_id, "Bonjour, je veux refaire mon identité", llm, google, notifications.append)
    assert any(event["type"] == "progress" for event in first)
    assert store.get_session(conn, session_id)["step"] == "recap"

    _collect(conn, session_id, "Oui c'est ça", llm, google, notifications.append)
    third = _collect(conn, session_id, "Le premier me va", llm, google, notifications.append)
    assert any(event["type"] == "slots" for event in third)
    assert store.get_session(conn, session_id)["step"] == "creneaux"

    events = _collect(conn, session_id, "Claire Martin, claire@example.com", llm, google, notifications.append)
    types = [event["type"] for event in events]
    assert any(event["type"] == "booking" for event in events)

    session = store.get_session(conn, session_id)
    assert session["status"] == store.STATUS_BOOKED
    assert session["step"] == "confirme"
    assert session["reference"].startswith("DEM-")

    leads = store.list_leads(conn)
    assert len(leads) == 1
    assert leads[0]["status"] == store.STATUS_BOOKED
    assert leads[0]["email"] == "claire@example.com"
    assert "Studio de yoga" in leads[0]["fields"]

    assert len(google.events) == 1
    assert google.events[0]["email"] == "claire@example.com"
    assert len(google.mails) == 1
    assert notifications and "DEM-" in notifications[0]
    booking = conn.execute("SELECT * FROM agent_bookings").fetchone()
    assert booking["event_id"] == "evt_123"


def test_creneaux_refuses_si_qualification_incomplete(conn):
    google = FakeGoogle(available=slots.candidates()[:3])
    session_id = engine.prepare_session(conn)
    store.merge_fields(conn, session_id, {"project_type": "Site vitrine"})

    toolbox = agent_tools.ToolBox(conn, session_id, google)
    result = toolbox.request_slots({})
    assert result["ok"] is False
    assert "nature du projet" not in result["error"] or True
    assert "contexte et activité" in result["error"]
    assert google.events == []


def test_email_invalide_refuse_la_reservation(conn):
    start = slots.candidates()[0]
    google = FakeGoogle(available=[start])
    session_id = engine.prepare_session(conn)
    store.merge_fields(conn, session_id, FIELDS)
    store.touch(conn, session_id, recap="Reformulation suffisamment longue pour passer.", recap_ok=1)

    toolbox = agent_tools.ToolBox(conn, session_id, google)
    assert toolbox.request_slots({})["ok"] is True
    result = toolbox.book_meeting({"slot_start": slots.slot_id(start), "name": "Claire", "email": "claire.example.com"})
    assert result["ok"] is False
    assert "Email invalide" in result["error"]
    assert google.events == []
    assert store.list_leads(conn) == []


def test_creneau_hors_proposition_refuse(conn):
    start = slots.candidates()[0]
    other = slots.candidates()[1]
    google = FakeGoogle(available=[start])
    session_id = engine.prepare_session(conn)
    store.merge_fields(conn, session_id, FIELDS)
    store.touch(conn, session_id, recap="Reformulation suffisamment longue pour passer.", recap_ok=1)

    toolbox = agent_tools.ToolBox(conn, session_id, google)
    toolbox.request_slots({})
    result = toolbox.book_meeting({"slot_start": slots.slot_id(other), "name": "Claire", "email": "claire@example.com"})
    assert result["ok"] is False
    assert "propositions" in result["error"]


def test_echec_agenda_libere_le_creneau(conn):
    start = slots.candidates()[0]
    google = FakeGoogle(available=[start])
    google.fail_event = True
    session_id = engine.prepare_session(conn)
    store.merge_fields(conn, session_id, FIELDS)
    store.touch(conn, session_id, recap="Reformulation suffisamment longue pour passer.", recap_ok=1)

    toolbox = agent_tools.ToolBox(conn, session_id, google)
    toolbox.request_slots({})
    result = toolbox.book_meeting({"slot_start": slots.slot_id(start), "name": "Claire", "email": "claire@example.com"})
    assert result["ok"] is False
    assert conn.execute("SELECT COUNT(*) AS n FROM agent_bookings").fetchone()["n"] == 0
    assert store.list_leads(conn) == []


def test_limite_de_tours(conn):
    google = FakeGoogle()
    session_id = engine.prepare_session(conn)
    store.touch(conn, session_id, turns=engine.MAX_TURNS)
    events = _collect(conn, session_id, "Encore une question", FakeLLM([]), google)
    assert events[0]["type"] == "error"


def test_validation_du_recap_declenche_les_creneaux(conn):
    """« Oui » sur le récapitulatif doit lancer request_slots sans dépendre du modèle."""
    start = slots.candidates()[0]
    google = FakeGoogle(available=[start])
    session_id = engine.prepare_session(conn)
    store.merge_fields(conn, session_id, FIELDS)
    store.touch(
        conn,
        session_id,
        step="recap",
        recap="Refonte d'identité pour un studio de yoga, avant mars.",
        recap_ok=0,
    )
    store.add_message(conn, session_id, "assistant", "Est-ce bien cela ?")

    llm = FakeLLM([[TurnOutput(text="Parfait, voici les créneaux.")]])
    events = _collect(conn, session_id, "Oui, c'est exact.", llm, google)

    kinds = [event.get("type") for event in events]
    assert "slots" in kinds
    row = store.get_session(conn, session_id)
    assert row["step"] == "creneaux"
    assert store.session_proposals(row)


def test_creneau_choisi_est_transmis_au_modele(conn):
    """Le libellé cliqué doit être traduit en identifiant de créneau."""
    start = slots.candidates()[0]
    google = FakeGoogle(available=[start])
    session_id = engine.prepare_session(conn)
    store.merge_fields(conn, session_id, FIELDS)
    store.touch(conn, session_id, step="creneaux", recap="Récapitulatif.", recap_ok=1)
    store.set_proposals(conn, session_id, [slots.slot_id(start)])

    toolbox = agent_tools.ToolBox(conn, session_id, google)  # type: ignore[arg-type]
    row = store.get_session(conn, session_id)
    assert row is not None
    hint = engine._preflight(toolbox, row, f"Le créneau {agent_tools.ToolBox._label(start)} me convient")

    assert len(hint) == 1
    assert slots.slot_id(start) in hint[0]["content"]
    assert "book_meeting" in hint[0]["content"]


def test_creneaux_deja_reserves_ne_sont_plus_proposes(conn):
    """Un créneau réservé en base ne doit jamais revenir dans les propositions."""
    start = slots.candidates()[0]
    store.reserve_slot(conn, slots.slot_id(start), "sid", "a@b.fr")
    assert slots.slot_id(start) in store.taken_slots(conn)
    picked = slots.pick(now=slots.now_paris(), taken=store.taken_slots(conn), count=3)
    assert slots.slot_id(start) not in [slots.slot_id(item) for item in picked]


def test_markdown_retire_des_reponses():
    assert engine._clean("**Bonjour**, quel est votre projet ?") == "Bonjour, quel est votre projet ?"


def test_une_seule_question_par_message():
    """Le modèle ne doit jamais empiler deux questions ni laisser fuiter un préfixe."""
    brut = "C'est noté. Refined: Quel type de site ? Et quelle activité ? Quel budget ?"
    assert engine._clean(brut) == "C'est noté. Quel type de site ? Et quelle activité ? Quel budget ?"
    assert engine._one_question(brut) == "C'est noté. Quel type de site ?"

    simple = "Merci, c'est clair. Quelle est votre échéance ?"
    assert engine._one_question(simple) == simple

    sans_question = "Je vous propose le premier créneau de mardi."
    assert engine._one_question(sans_question) == sans_question

    artefact = "Parlons-en. Quel est votre besoin ? (En attente de votre réponse…)"
    assert engine._one_question(artefact) == "Parlons-en. Quel est votre besoin ?"

    # Un récapitulatif se termine par une seule question : il doit rester entier.
    recap = (
        "Voici ce que j'ai retenu : atelier de céramique à Paris 11e, image premium, "
        "logo, charte et packaging, livraison avant mars. Est-ce bien cela ?"
    )
    assert engine._one_question(recap) == recap
