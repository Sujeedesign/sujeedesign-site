"""Tests de la boucle de conversation avec un faux modèle et un faux agenda."""

from __future__ import annotations

import json

import pytest

from app.agent import engine, slots, store
from app.agent import llm
from app.agent.llm import TurnOutput
from app.agent import tools as agent_tools

FIELDS = {
    "project_type": "Refonte d'identité visuelle",
    "branding": "Vaasam",
    "context": "Studio de yoga à Paris 11e, deux ans d'existence",
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

    def available_slots(self, count=3, booked_per_day=None, taken=None, moment=""):
        self.asked_moment = moment
        return [start for start in self.available if slots.matches_moment(start, moment)]

    def create_event(self, start, attendee_email, attendee_name, summary, description, location=""):
        if self.fail_event:
            raise agent_tools.GoogleError("boom")
        self.events.append(
            {
                "start": start,
                "email": attendee_email,
                "name": attendee_name,
                "summary": summary,
                "description": description,
                "location": location,
            }
        )
        return {"id": "evt_123"}

    def send_mail(self, to, subject, text, html="", attachments=None, reply_to=""):
        self.mails.append(
            {
                "to": to,
                "subject": subject,
                "text": text,
                "attachments": attachments or [],
                "reply_to": reply_to,
            }
        )
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
    """Le modèle mène la conversation, le serveur fournit les vrais créneaux."""
    start = next(c for c in slots.candidates() if slots.moment_of(c) == "matin")
    google = FakeGoogle(available=[start])
    session_id = engine.prepare_session(conn)
    notifications: list[str] = []

    llm = FakeLLM(
        [
            [
                TurnOutput(
                    text="Bonjour ! Racontez-moi votre projet, je vous dis tout de suite ce qui est possible."
                )
            ],
            [
                TurnOutput(
                    text="",
                    tool_calls=[_call("record_fields", project_type="Refonte d'identité visuelle")],
                ),
                TurnOutput(text="Une refonte d'identité, très bien. C'est pour quelle marque ?"),
            ],
            [
                TurnOutput(text="", tool_calls=[_call("record_fields", branding="Vaasam")]),
                TurnOutput(text="Vaasam, noté. Vous êtes dans quel secteur ?"),
            ],
            [
                TurnOutput(
                    text="",
                    tool_calls=[_call("record_fields", context="Studio de yoga à Paris 11e")],
                ),
                TurnOutput(
                    text=(
                        "Un studio de yoga, j'ai des références proches. Vous préférez le matin "
                        "ou l'après-midi pour un point de 30 minutes avec Sujee ?"
                    )
                ),
            ],
            # La demi-journée ouvre les créneaux côté serveur : le modèle n'est
            # pas sollicité sur ce tour.
            [
                TurnOutput(
                    text="",
                    tool_calls=[
                        _call(
                            "book_meeting",
                            slot_start=slots.slot_id(start),
                            name="Claire Martin",
                            email="claire@example.com",
                        )
                    ],
                ),
                TurnOutput(text="C'est réservé, vous recevez l'invitation par email."),
            ],
        ]
    )

    first = _collect(conn, session_id, "Bonjour", llm, google, notifications.append)
    assert "".join(e["text"] for e in first if e.get("type") == "delta").strip()
    assert not any(event["type"] == "slots" for event in first)

    _collect(conn, session_id, "Refonte d'identité visuelle", llm, google, notifications.append)
    _collect(conn, session_id, "Vaasam", llm, google, notifications.append)
    _collect(conn, session_id, "Studio de yoga à Paris 11e", llm, google, notifications.append)

    row = store.get_session(conn, session_id)
    assert row is not None
    fields = store.session_fields(row)
    assert fields["project_type"] == "Refonte d'identité visuelle"
    assert fields["branding"] == "Vaasam"
    assert "yoga" in fields["context"]

    fifth = _collect(conn, session_id, "Plutôt le matin", llm, google, notifications.append)
    assert any(event["type"] == "slots" for event in fifth)
    row_creneaux = store.get_session(conn, session_id)
    assert row_creneaux is not None
    assert row_creneaux["step"] == "creneaux"
    assert store.session_proposals(row_creneaux)

    events = _collect(
        conn,
        session_id,
        "Le premier créneau me va, Claire Martin, claire@example.com",
        llm,
        google,
        notifications.append,
    )
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
    # Deux mails partent : le client et la notification interne.
    assert len(google.mails) == 2
    client_mail = next(mail for mail in google.mails if mail["to"] == "claire@example.com")
    admin_mail = next(mail for mail in google.mails if mail["to"] != "claire@example.com")
    assert "Votre rendez-vous" in client_mail["subject"]
    assert client_mail["attachments"][0][1].startswith(b"BEGIN:VCALENDAR")
    assert "DEM-" in admin_mail["subject"] and "claire@example.com" in admin_mail["text"]
    assert admin_mail["attachments"][0][1].startswith(b"BEGIN:VCALENDAR")
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
    assert "activité / secteur" in result["error"]
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
    store.set_details(conn, session_id, {"branding": "Vaasam", "phone": "06 12 34 56 78", "call_mode": "visio"})
    store.touch(conn, session_id, recap="Reformulation suffisamment longue pour passer.", recap_ok=1)

    toolbox = agent_tools.ToolBox(conn, session_id, google)
    toolbox.request_slots({})
    result = toolbox.book_meeting(
        {
            "slot_start": slots.slot_id(start),
            "name": "Claire",
            "email": "claire@example.com",
            "phone": "06 12 34 56 78",
        }
    )
    assert result["ok"] is False
    assert conn.execute("SELECT COUNT(*) AS n FROM agent_bookings").fetchone()["n"] == 0
    assert store.list_leads(conn) == []


def test_limite_de_tours(conn):
    google = FakeGoogle()
    session_id = engine.prepare_session(conn)
    store.touch(conn, session_id, turns=engine.MAX_TURNS)
    events = _collect(conn, session_id, "Encore une question", FakeLLM([]), google)
    assert events[0]["type"] == "error"


def test_qualification_complete_demande_la_demi_journee_avant_les_creneaux(conn):
    """Type + activité connus : le serveur demande matin ou après-midi, sans créneau."""
    start = slots.candidates()[0]
    google = FakeGoogle(available=[start])
    session_id = engine.prepare_session(conn)
    store.merge_fields(conn, session_id, FIELDS)
    store.add_message(conn, session_id, "assistant", "Pour quelle activité ?")

    llm = FakeLLM([[TurnOutput(text="Vous préférez le matin ou l'après-midi ?")]])
    events = _collect(conn, session_id, "Studio de yoga à Paris 11e", llm, google)

    kinds = [event.get("type") for event in events]
    assert "moment" in kinds
    assert "slots" not in kinds
    row = store.get_session(conn, session_id)
    assert row is not None
    assert row["step"] == "moment"
    assert not store.session_proposals(row)
    message = "".join(e["text"] for e in events if e.get("type") == "delta")
    assert "matin" in message and "après-midi" in message


def test_reponse_matin_ouvre_les_creneaux_du_matin(conn):
    """Le modèle enregistre la demi-journée et demande les créneaux réels."""
    start = next(c for c in slots.candidates() if slots.moment_of(c) == "matin")
    google = FakeGoogle(available=[start])
    session_id = engine.prepare_session(conn)
    store.merge_fields(conn, session_id, FIELDS)
    store.touch(conn, session_id, step="moment")

    llm = FakeLLM(
        [
            [
                TurnOutput(
                    text="",
                    tool_calls=[
                        _call("record_fields", moment="matin"),
                        _call("request_slots", moment="matin"),
                    ],
                ),
                TurnOutput(text="Voici les créneaux du matin, choisissez celui qui vous arrange."),
            ]
        ]
    )
    events = _collect(conn, session_id, "plutôt le matin", llm, google)
    assert any(e["type"] == "slots" for e in events)
    row = store.get_session(conn, session_id)
    assert row["step"] == "creneaux"


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


def test_creneau_demande_absent_des_propositions_est_refuse(conn):
    """« mardi 10 à 09h00 » non proposé : on le dit, sans décaler le rendez-vous."""
    from datetime import datetime

    paris = lambda j, h, mi=0: datetime(2026, 11, j, h, mi, tzinfo=slots.PARIS)  # noqa: E731
    proposals = [paris(9, 9, 30), paris(10, 9, 30), paris(11, 9)]
    google = FakeGoogle(available=proposals)
    session_id = engine.prepare_session(conn)
    store.merge_fields(conn, session_id, FIELDS)
    store.touch(conn, session_id, step="creneaux")
    store.set_proposals(conn, session_id, [slots.slot_id(start) for start in proposals])

    events = _collect(conn, session_id, "mardi 10 novembre à 09h00", FakeLLM([[]]), google)
    texte = " ".join("".join(e["text"] for e in events if e.get("type") == "delta").split())

    assert "n'est pas libre" in texte
    assert "mardi 10 novembre à 09h30" in texte
    assert google.events == []
    assert store.session_chosen(store.get_session(conn, session_id)) in (None, "")


class PanneLLM:
    """Modèle injoignable : le tour doit rester utilisable côté serveur."""

    def __init__(self) -> None:
        self.calls = 0

    def stream(self, messages, tools, model=None):  # noqa: ANN001, ANN201
        self.calls += 1
        raise llm.LLMError("503 indisponible")
        yield  # pragma: no cover


def test_panne_du_modele_ne_coupe_pas_la_conversation(conn):
    google = FakeGoogle()
    session_id = engine.prepare_session(conn)
    events = _collect(conn, session_id, "Bonjour", PanneLLM(), google)
    assert not [e for e in events if e.get("type") == "error"]
    texte = "".join(e["text"] for e in events if e.get("type") == "delta").strip()
    assert "type de projet" in texte.lower()


def test_message_hors_sujet_recoit_toujours_une_phrase(conn):
    """Un « auto » lâché en vrac ne doit jamais produire une bulle vide."""
    google = FakeGoogle(available=[slots.candidates()[0]])
    session_id = engine.prepare_session(conn)
    store.merge_fields(
        conn,
        session_id,
        {"project_type": "Site web", "branding": "Vaasam", "context": "vente de pièce auto"},
    )
    store.touch(conn, session_id, step="moment")

    llm = FakeLLM([[TurnOutput(text="Je n'ai pas compris, vous parlez bien de votre projet web ?")]])
    events = _collect(conn, session_id, "auto", llm, google)
    texte = "".join(e["text"] for e in events if e.get("type") == "delta").strip()
    assert texte
    assert not [e for e in events if e.get("type") == "error"]


def test_premiere_reponse_du_visiteur_n_est_pas_jetee(conn):
    """Le modèle range la réponse donnée et ne repose pas la même question."""
    google = FakeGoogle(available=[slots.candidates()[0]])
    session_id = engine.prepare_session(conn)

    llm = FakeLLM(
        [
            [TurnOutput(text="Bonjour ! Quel type de projet avez-vous en tête ?")],
            [
                TurnOutput(
                    text="",
                    tool_calls=[_call("record_fields", project_type="Site web ou e-commerce")],
                ),
                TurnOutput(
                    text="Un site e-commerce, très bien. C'est pour quelle marque ?"
                ),
            ],
        ]
    )

    first = _collect(conn, session_id, "Bonjour", llm, google)
    assert "type de projet" in "".join(e["text"] for e in first if e.get("type") == "delta")

    second = _collect(conn, session_id, "Site web ou e-commerce", llm, google)
    texte = "".join(e["text"] for e in second if e.get("type") == "delta")
    assert "type de projet" not in texte
    assert "marque" in texte.lower()
    row = store.get_session(conn, session_id)
    assert store.session_fields(row)["project_type"] == "Site web ou e-commerce"


def test_salutation_seule_ne_remplit_aucun_champ(conn):
    """« Bonjour » ne doit jamais devenir le type de projet."""
    google = FakeGoogle(available=[slots.candidates()[0]])
    session_id = engine.prepare_session(conn)
    _collect(conn, session_id, "Bonjour !", FakeLLM([[]]), google)
    row = store.get_session(conn, session_id)
    assert row is not None
    assert store.session_fields(row).get("project_type", "") == ""


def test_creneaux_deja_reserves_ne_sont_plus_proposes(conn):
    """Un créneau réservé en base ne doit jamais revenir dans les propositions."""
    start = slots.candidates()[0]
    store.reserve_slot(conn, slots.slot_id(start), "sid", "a@b.fr")
    assert slots.slot_id(start) in store.taken_slots(conn)
    picked = slots.pick(now=slots.now_paris(), taken=store.taken_slots(conn), count=3)
    assert slots.slot_id(start) not in [slots.slot_id(item) for item in picked]


def test_markdown_retire_des_reponses():
    assert engine._clean("**Bonjour**, quel est votre projet ?") == "Bonjour, quel est votre projet ?"


def test_reponse_activite_enregistree_par_le_modele(conn):
    """Le modèle utilise record_fields pour ranger l'activité, pas le serveur."""
    start = slots.candidates()[0]
    google = FakeGoogle(available=[start])
    session_id = engine.prepare_session(conn)
    store.merge_fields(conn, session_id, {"project_type": "Identité de marque"})

    llm = FakeLLM(
        [
            [
                TurnOutput(
                    text="",
                    tool_calls=[_call("record_fields", context="Studio de yoga à Paris 11e")],
                ),
                TurnOutput(
                    text=(
                        "Un studio de yoga, j'ai des références proches. Vous préférez le matin "
                        "ou l'après-midi pour un point de 30 minutes ?"
                    )
                ),
            ]
        ]
    )
    events = _collect(conn, session_id, "Studio de yoga à Paris 11e", llm, google)

    row = store.get_session(conn, session_id)
    assert store.session_fields(row)["context"] == "Studio de yoga à Paris 11e"
    texte = "".join(e["text"] for e in events if e.get("type") == "delta").lower()
    assert "matin" in texte


def test_horaires_inventes_remplaces_par_une_phrase_neutre(conn):
    """Si les boutons n'affichent rien, on ne laisse pas le modèle inventer des créneaux."""
    google = FakeGoogle(available=[slots.candidates()[0]])
    session_id = engine.prepare_session(conn)
    store.merge_fields(
        conn,
        session_id,
        {"project_type": "Identité de marque", "branding": "Vaasam"},
    )

    llm = FakeLLM(
        [[TurnOutput(text="Les créneaux sont mardi 10 septembre à 14h ou jeudi 12 à 10h.")]]
    )
    events = _collect(conn, session_id, "Vous faites aussi du motion design ?", llm, google)

    message = "".join(e["text"] for e in events if e.get("type") == "delta")
    assert "septembre" not in message
    # Pas de promesse creuse : on demande l'information suivante.
    assert "agenda" not in message
    assert message.rstrip().endswith("?")


def _session_avec_creneaux(conn, google):
    """Session arrivée à l'écran des créneaux, comme en production."""
    session_id = engine.prepare_session(conn)
    store.merge_fields(
        conn,
        session_id,
        {"project_type": "Identité de marque", "context": "Alimentation générale"},
    )
    store.touch(conn, session_id, step="creneaux")
    store.set_proposals(conn, session_id, [slots.slot_id(s) for s in google.available])
    return session_id


def _creneau_unique(starts):
    """Un créneau dont le couple (jour du mois, heure) ne prête à confusion avec aucun autre."""
    for start in starts:
        same = [
            other
            for other in starts
            if other is not start and (other.day, other.hour, other.minute) == (start.day, start.hour, start.minute)
        ]
        if not same:
            return start
    raise AssertionError("créneaux trop proches pour le test")


def test_creneau_saisi_en_texte_est_reconnu_et_la_reservation_aboutit(conn):
    """Le visiteur écrit « mercredi 4 novembre à 09h00 » au lieu de cliquer : ça doit réserver."""
    google = FakeGoogle(available=slots.candidates()[:3])
    session_id = _session_avec_creneaux(conn, google)
    start = _creneau_unique(google.available)
    jour = engine._WEEKDAYS[start.weekday()]
    texte = (
        f"{jour} {start.day} novembre à {start.hour:02d}h{start.minute:02d}, "
        "Claire Martin, claire@example.com, 06 12 34 56 78, branding Vaasam, en visio"
    )

    llm = FakeLLM([])
    events = _collect(conn, session_id, texte, llm, google)

    message = "".join(e["text"] for e in events if e.get("type") == "delta")
    assert llm.calls == 0
    assert "Choisissez l'un des créneaux affichés" not in message
    assert "réservé" in message.lower()
    assert any(e.get("type") == "booking" for e in events)
    assert store.get_session(conn, session_id)["status"] == store.STATUS_BOOKED
    assert google.events and google.events[0]["email"] == "claire@example.com"


def test_creneau_saisi_puis_coordonnees_au_tour_suivant(conn):
    """Texte seul d'abord, coordonnées ensuite : le créneau reste retenu."""
    google = FakeGoogle(available=slots.candidates()[:3])
    session_id = _session_avec_creneaux(conn, google)
    start = _creneau_unique(google.available)

    premier = _collect(
        conn,
        session_id,
        f"le {start.day} à {start.hour:02d}h{start.minute:02d}",
        FakeLLM([]),
        google,
    )
    message = "".join(e["text"] for e in premier if e.get("type") == "delta")
    assert "noté" in message.lower()
    assert store.session_chosen(store.get_session(conn, session_id)) == slots.slot_id(start)
    assert not google.events

    second = _collect(
        conn,
        session_id,
        "Claire Martin, claire@example.com, 06 12 34 56 78, branding Vaasam, en visio",
        FakeLLM([]),
        google,
    )
    assert any(e.get("type") == "booking" for e in second)
    assert store.get_session(conn, session_id)["status"] == store.STATUS_BOOKED


def test_creneau_avec_heure_absente_n_est_pas_remplace_par_un_autre(conn):
    from datetime import datetime, timedelta

    class _Google:
        def __init__(self):
            base = datetime(2026, 11, 4, 9, 0)
            self.available = [base, base + timedelta(days=1)]

    session_id = _session_avec_creneaux(conn, _Google())
    row = store.get_session(conn, session_id)
    assert (engine._pick_slot(row, "mercredi 4 novembre à 09h00") or {}).get("id", "").endswith(
        "09:00:00+01:00"
    )
    assert engine._pick_slot(row, "mercredi 4 novembre à 10h00") is None
    assert engine._pick_slot(row, "jeudi 5 novembre à 15h00") is None


def test_le_creneau_est_not_e_puis_une_seule_question_le_nom(conn):
    """Après le créneau, une seule demande : le nom. Pas d'email ni de téléphone."""
    google = FakeGoogle(available=slots.candidates()[:3])
    session_id = _session_avec_creneaux(conn, google)
    start = _creneau_unique(google.available)

    events = _collect(
        conn, session_id, f"le {start.day} à {start.hour:02d}h{start.minute:02d}", FakeLLM([]), google
    )
    message = "".join(e["text"] for e in events if e.get("type") == "delta")
    assert "noté" in message.lower()
    assert message.count("?") == 1
    assert "nom" in message.lower()
    assert "email" not in message.lower()
    assert "téléphone" not in message.lower()


def test_details_demandes_un_par_un_jusqu_au_bout(conn):
    """Nom, email, téléphone, branding, format : une question par message."""
    google = FakeGoogle(available=slots.candidates()[:3])
    session_id = _session_avec_creneaux(conn, google)
    start = _creneau_unique(google.available)

    _collect(conn, session_id, f"le {start.day} à {start.hour:02d}h{start.minute:02d}", FakeLLM([]), google)

    tours = [
        ("Claire Martin", "email"),
        ("claire@example.com", "téléphone"),
        ("06 12 34 56 78", "branding"),
        ("Vaasam", "visio"),
    ]
    for texte, attendu in tours:
        events = _collect(conn, session_id, texte, FakeLLM([]), google)
        message = "".join(e["text"] for e in events if e.get("type") == "delta")
        assert message.count("?") == 1, message
        assert attendu in message.lower(), (texte, message)
        assert not google.events


def test_extraction_des_details_dans_une_phrase_condensee():
    phrase = "Claire Martin, claire@example.com, 06 12 34 56 78, branding Le Fournil, en visio"
    assert engine._guess_name(phrase) == "Claire Martin"
    assert engine._guess_branding(phrase) == "Le Fournil"
    assert engine._guess_mode(phrase) == "visio"
    assert engine._guess_branding("le branding c'est Vaasam") == "Vaasam"
    assert engine._guess_name("06 12 34 56 78") == ""
    assert engine._guess_branding("en visio, ce sera plus simple") == ""


def test_parcours_detaille_nom_email_telephone_branding_et_format(conn):
    """Chaque information est demandée une seule fois, puis la réservation aboutit."""
    google = FakeGoogle(available=slots.candidates()[:3])
    session_id = _session_avec_creneaux(conn, google)
    start = _creneau_unique(google.available)
    creneau = slots.slot_id(start)

    _collect(conn, session_id, f"le {start.day} à {start.hour:02d}h{start.minute:02d}", FakeLLM([]), google)
    assert store.session_chosen(store.get_session(conn, session_id)) == creneau

    nom_events = _collect(conn, session_id, "Claire Martin", FakeLLM([]), google)
    nom_message = "".join(e["text"] for e in nom_events if e.get("type") == "delta")
    assert "Merci Claire" in nom_message
    assert "email" in nom_message
    row = store.get_session(conn, session_id)
    assert store.session_chosen(row) == creneau
    assert store.session_contact(row) == ("Claire Martin", "")
    assert not google.events

    mail_events = _collect(conn, session_id, "claire@example.com", FakeLLM([]), google)
    mail_message = "".join(e["text"] for e in mail_events if e.get("type") == "delta")
    assert "téléphone" in mail_message
    assert not google.events

    tel_events = _collect(conn, session_id, "06 12 34 56 78", FakeLLM([]), google)
    tel_message = "".join(e["text"] for e in tel_events if e.get("type") == "delta")
    assert "branding" in tel_message
    assert not google.events

    branding_events = _collect(conn, session_id, "Vaasam", FakeLLM([]), google)
    branding_message = "".join(e["text"] for e in branding_events if e.get("type") == "delta")
    assert "visio" in branding_message and "téléphonique" in branding_message
    assert not google.events

    mode_events = _collect(conn, session_id, "en visio, ce sera plus simple", FakeLLM([]), google)
    mode_message = "".join(e["text"] for e in mode_events if e.get("type") == "delta")
    assert "réservé" in mode_message.lower()
    assert any(e.get("type") == "booking" for e in mode_events)
    assert store.get_session(conn, session_id)["status"] == store.STATUS_BOOKED
    assert google.events[0]["location"] == "Visio"
    assert "Vaasam" in google.events[0]["summary"]
    assert "06 12 34 56 78" in google.events[0]["description"] or "06 12 34 56 78" in google.mails[0]["text"]


def test_heure_seule_suffit_quand_un_seul_creneau_correspond(conn):
    """« 09h00 » sans le jour : on retient l'unique créneau de cette heure."""
    google = FakeGoogle(available=slots.candidates()[:3])
    session_id = _session_avec_creneaux(conn, google)
    heures = [(s.hour, s.minute) for s in google.available]
    start = next(
        s for s in google.available if heures.count((s.hour, s.minute)) == 1
    )

    events = _collect(
        conn,
        session_id,
        f"{start.hour:02d}h{start.minute:02d}",
        FakeLLM([]),
        google,
    )
    assert "Choisissez l'un des créneaux" not in "".join(e["text"] for e in events if e.get("type") == "delta")
    assert store.session_chosen(store.get_session(conn, session_id)) == slots.slot_id(start)


def _session_prete_a_reserver(conn, google, start, mode=""):
    """Session où tout est connu : il ne reste plus qu'à bloquer le créneau."""
    session_id = _session_avec_creneaux(conn, google)
    store.set_chosen(conn, session_id, slots.slot_id(start))
    store.set_contact(conn, session_id, name="Sujeepan Sabesan", email="sujeepan@example.com")
    store.set_details(
        conn,
        session_id,
        {"phone": "06 51 51 74 63", "branding": "Desigual", "call_mode": mode},
    )
    return session_id


def test_creneau_devenu_trop_proche_repropose_sans_reposer_la_question(conn):
    """Un créneau retenu puis devenu trop proche ne doit jamais boucler sur le format."""
    from datetime import timedelta

    stale = (slots.now_paris() + timedelta(hours=20)).replace(minute=0, second=0, microsecond=0)
    fresh = slots.candidates()[0]
    google = FakeGoogle(available=[stale, fresh])
    session_id = _session_prete_a_reserver(conn, google, stale)

    events = _collect(conn, session_id, "Appel", FakeLLM([]), google)
    message = "".join(e["text"] for e in events if e.get("type") == "delta")

    assert "visio ou un appel" not in message
    assert "plus disponible" in message
    assert "slots" in [e.get("type") for e in events]
    assert not google.events
    row = store.get_session(conn, session_id)
    assert store.session_proposals(row) == [slots.slot_id(fresh)]
    assert store.session_chosen(row) == ""


def test_panne_agenda_enregistre_la_demande_et_sort_de_la_boucle(conn):
    """Si l'agenda tombe, la demande est conservée pour un humain, sans reposer la question."""
    start = slots.candidates()[0]
    google = FakeGoogle(available=[start])
    google.fail_event = True
    session_id = _session_prete_a_reserver(conn, google, start, mode="téléphonique")

    events = _collect(conn, session_id, "Appel", FakeLLM([]), google)
    message = "".join(e["text"] for e in events if e.get("type") == "delta")

    assert "visio ou un appel" not in message
    assert "enregistrée" in message
    row = store.get_session(conn, session_id)
    assert row is not None and row["step"] == "confirme"
    leads = store.list_leads(conn)
    assert len(leads) == 1
    assert leads[0]["status"] == store.STATUS_REVIEW
    assert "Réservation automatique impossible" in leads[0]["summary"]

    # Le tour suivant ne doit pas rejouer la réservation ni la question de format.
    suite = _collect(conn, session_id, "Merci", FakeLLM([]), google)
    suite_message = "".join(e["text"] for e in suite if e.get("type") == "delta")
    assert "visio ou un appel" not in suite_message
    assert not google.events


def test_creneaux_caducs_ne_sont_pas_representes(conn):
    """request_slots ne represente pas un créneau passé sous le délai minimum."""
    from datetime import timedelta

    stale = slots.now_paris() + timedelta(hours=10)
    fresh = slots.candidates()[0]
    google = FakeGoogle(available=[stale, fresh])
    session_id = engine.prepare_session(conn)
    store.merge_fields(
        conn,
        session_id,
        {"project_type": "Identité de marque", "context": "Alimentation générale"},
    )
    store.touch(conn, session_id, step="creneaux")
    store.set_proposals(conn, session_id, [slots.slot_id(stale), slots.slot_id(fresh)])

    toolbox = agent_tools.ToolBox(conn, session_id, google)  # type: ignore[arg-type]
    result = toolbox.request_slots({})

    assert result["ok"] is True
    assert slots.slot_id(stale) not in [item["id"] for item in result["creneaux"]]
    assert slots.slot_id(fresh) in [item["id"] for item in result["creneaux"]]


def test_la_question_du_telephone_annonce_l_appel_du_visiteur(conn):
    """Le CTA doit dire « pour l'appel avec Sujee », pas « pour que Sujee vous rappelle »."""
    google = FakeGoogle(available=slots.candidates()[:3])
    session_id = _session_avec_creneaux(conn, google)
    start = _creneau_unique(google.available)
    _collect(conn, session_id, f"le {start.day} à {start.hour:02d}h{start.minute:02d}", FakeLLM([]), google)
    _collect(conn, session_id, "Claire Martin", FakeLLM([]), google)
    events = _collect(conn, session_id, "claire@example.com", FakeLLM([]), google)
    message = "".join(e["text"] for e in events if e.get("type") == "delta")

    assert "téléphone" in message.lower()
    assert "rappelle" not in message.lower()
    assert "appel avec Sujee" in message


def test_faute_telephone_reconnue_comme_appel() -> None:
    """« télphone » et « tel » sont des appels téléphoniques, pas du bruit."""
    for reponse in ("télphone", "tel", "Telephon", "par téléphone"):
        assert engine._guess_mode(reponse) == store.CALL_MODES["telephone"], reponse
    assert engine._guess_mode("visio") == store.CALL_MODES["visio"]


def test_le_serveur_ne_range_pas_n_importe_quoi_dans_les_champs() -> None:
    """Chaque champ a son filtre : un message lu pour un autre champ ne fuit pas."""
    # Le type de projet n'accepte que les messages qui nomment un projet.
    assert engine._qualification_value("project_type", "Site web ou e-commerce")
    assert engine._qualification_value("project_type", "Le matin") == ""
    assert engine._qualification_value("project_type", "auto") == ""
    assert engine._qualification_value("project_type", "télphone 0651517463") == ""
    # Le branding ne prend pas une phrase de type de projet pour un nom de marque.
    assert engine._qualification_value("branding", "Création d'un site ecommerce") == ""
    assert engine._qualification_value("branding", "Vaasam") == "Vaasam"
    assert (
        engine._qualification_value(
            "branding", "Branding pas encore trouvé mais ça sera vente de pièce auto"
        )
        == store.BRANDING_UNKNOWN
    )


def test_conversation_reelle_les_champs_sont_vraiment_ranges(conn):
    """Rejoue la conversation signalée : chaque réponse atterrit dans son champ."""
    google = FakeGoogle(available=slots.candidates()[:6])
    session_id = engine.prepare_session(conn)
    llm = FakeLLM(
        [
            [
                TurnOutput(
                    text="",
                    tool_calls=[_call("record_fields", project_type="Création d'un site ecommerce")],
                ),
                TurnOutput(text="C'est noté. C'est pour quelle marque ?"),
            ],
            [
                TurnOutput(
                    text="",
                    tool_calls=[_call("record_fields", branding=store.BRANDING_UNKNOWN)],
                ),
                TurnOutput(text="Pas de souci, on trouvera le nom ensemble. Vous vendez quoi ?"),
            ],
            [
                TurnOutput(text="", tool_calls=[_call("record_fields", context="vente de pièce auto")]),
                TurnOutput(text="Vente de pièces auto, noté. Vous préférez le matin ou l'après-midi ?"),
            ],
        ]
    )

    _collect(conn, session_id, "Création d'un site ecommerce", llm, google)
    _collect(conn, session_id, "Branding pas encore trouvé mais ça sera vente de pièce auto", llm, google)
    _collect(conn, session_id, "auto", llm, google)

    fields = store.session_fields(store.get_session(conn, session_id))
    assert fields["project_type"] == "Création d'un site ecommerce"
    assert fields["branding"] == store.BRANDING_UNKNOWN
    assert fields["context"] == "vente de pièce auto"
    assert google.events == []


def test_aucun_autre_prenom_n_atteint_le_visiteur() -> None:
    """Filet de sécurité : même un modèle qui recopie « Raj » est corrigé."""
    assert engine._sans_autre_prenom("L'appel avec Raj dure 30 minutes.") == (
        "L'appel avec Sujee dure 30 minutes."
    )
    assert engine._sans_autre_prenom("Votre numéro, pour l'appel avec Sujee ?") == (
        "Votre numéro, pour l'appel avec Sujee ?"
    )


def test_question_meta_est_laissee_au_modele(conn):
    """« Qui es-tu ? » est traité par le modèle, pas par un questionnaire serveur."""
    google = FakeGoogle(available=[slots.candidates()[0]])
    session_id = engine.prepare_session(conn)
    llm = FakeLLM(
        [
            [TurnOutput(text="Bonjour ! Quel type de projet avez-vous en tête ?")],
            [
                TurnOutput(
                    text=(
                        "Je suis l'assistant de Sujee Design. Je vous aide à cadrer votre projet "
                        "puis je vous propose un appel de 30 minutes avec Sujee."
                    )
                )
            ],
        ]
    )

    _collect(conn, session_id, "Bonjour", llm, google)
    events = _collect(conn, session_id, "Qui es tu ?", llm, google)
    texte = "".join(e["text"] for e in events if e.get("type") == "delta").strip()

    assert "sujee" in texte.lower()
    assert "type de projet" not in texte.lower()
    row = store.get_session(conn, session_id)
    assert store.session_fields(row).get("project_type", "") == ""


def test_message_riche_range_par_le_modele(conn):
    """Un message qui donne projet, demi-journée et prénom : le modèle range tout."""
    google = FakeGoogle(available=[slots.candidates()[0]])
    session_id = engine.prepare_session(conn)
    llm = FakeLLM(
        [
            [TurnOutput(text="Bonjour ! Quel type de projet avez-vous en tête ?")],
            [
                TurnOutput(
                    text="",
                    tool_calls=[
                        _call(
                            "record_fields",
                            project_type="conception de logo",
                            moment="matin",
                        ),
                        _call(
                            "book_meeting",
                            slot_start=slots.slot_id(slots.candidates()[0]),
                            name="Ramm",
                            email="ramm@example.com",
                        ),
                    ],
                ),
                TurnOutput(text="C'est noté pour le matin, je vous confirme le créneau."),
            ],
        ]
    )
    _collect(conn, session_id, "Bonjour", llm, google)
    _collect(
        conn,
        session_id,
        "tres bien. je veux RDV avec sujee pour le Lundi matin, sur un conception de logo. Je m'appel Ramm",
        llm,
        google,
    )

    fields = store.session_fields(store.get_session(conn, session_id))
    assert fields["project_type"] == "conception de logo"
    assert fields["moment"] == "Matin"


def test_projet_et_prenom_extraits_du_message(monkeypatch):
    """Extraction pure : le bruit autour de la prestation ne finit pas dans les champs."""
    dit = "Salut, je voudrais un RDV mardi après-midi pour une refonte de site web, je m'appelle Jean Dupont."
    assert engine._project_phrase(dit) == "refonte de site web"
    assert engine._self_name(dit) == "Jean Dupont"
    # Un message déjà propre n'est pas retouché.
    assert engine._project_phrase("Un site vitrine pour ma marque") == "Un site vitrine pour ma marque"


def test_aucun_montant_invente_n_atteint_le_visiteur():
    """Le modèle arrondit : la fourchette annoncée doit rester celle du site."""
    dit = "Franchement, un logo c'est entre 500 € et 2 500 € selon le périmètre."
    sortie = engine._price_guard(dit, "je veux un logo pour ma marque de thé")
    assert "entre 500" not in sortie
    assert "800 à 1 500 €" in sortie


def test_les_fourchettes_du_site_passent_sans_retouche():
    """Une réponse déjà conforme ne doit pas être réécrite."""
    for dit in (
        "Logo seul, c'est 800 à 1 500 €, et la charte complète 1 200 à 2 500 €.",
        "Avec 1 200 € de budget, on tient un logo seul.",
        "Un site vitrine sur mesure, c'est à partir de 2 000 €.",
    ):
        assert engine._price_guard(dit, "budget serré") == dit


def test_le_remplacement_reste_dans_le_sujet_du_visiteur():
    """Le repère injecté parle du besoin réel, pas d'une grille au hasard."""
    sortie = engine._price_guard(
        "Les paquets, c'est entre 500 et 1 500 € de plus.",
        "je veux aussi les paquets et les étiquettes",
    )
    assert "packaging" in sortie.lower()
    assert "3 200 à 5 000 €" in sortie


def test_le_prix_demande_est_toujours_annonce_avant_l_appel():
    """Un prix demandé et renvoyé à l'appel est une esquive : le prompt l'interdit."""
    from app.agent.prompt import build_system_prompt

    prompt = build_system_prompt()
    assert "Renvoyer un prix demandé à l'appel" in prompt
    assert "n'annonce jamais que tu vérifies l'agenda" in prompt


def test_la_demi_journee_ouvre_les_creneaux_sans_le_modele(conn):
    """« Le matin » doit afficher les vrais créneaux, même si le modèle se tait."""
    google = FakeGoogle(available=[slots.candidates()[0], slots.candidates()[1]])
    session_id = engine.prepare_session(conn)
    store.merge_fields(conn, session_id, FIELDS)
    llm = FakeLLM([])

    events = _collect(conn, session_id, "Le matin plutôt.", llm, google)

    assert any(e.get("type") == "slots" for e in events)
    message = "".join(e["text"] for e in events if e.get("type") == "delta")
    assert "créneaux" in message.lower()
    assert google.asked_moment == "matin"


def test_la_demi_journee_sans_qualification_demande_le_point_manquant(conn):
    """Pas de créneaux tant que le projet n'est pas cadré : on demande, on n'invente pas."""
    google = FakeGoogle(available=[slots.candidates()[0]])
    session_id = engine.prepare_session(conn)
    llm = FakeLLM([])

    events = _collect(conn, session_id, "Le matin de préférence.", llm, google)

    assert not any(e.get("type") == "slots" for e in events)
    message = "".join(e["text"] for e in events if e.get("type") == "delta").strip()
    assert message.endswith("?")


def test_la_question_du_creneau_n_est_pas_rabachee(conn):
    """Une fois posée, la question matin/après-midi ne bloque plus le modèle."""
    google = FakeGoogle(available=[slots.candidates()[0]])
    session_id = engine.prepare_session(conn)
    store.merge_fields(conn, session_id, FIELDS)
    store.touch(conn, session_id, step="moment")

    llm = FakeLLM([[TurnOutput(text="Pour les paquets, comptez 1 200 à 2 500 €. Vous préférez le matin ?")]])
    events = _collect(conn, session_id, "Et les paquets, c'est combien ?", llm, google)

    message = "".join(e["text"] for e in events if e.get("type") == "delta")
    assert "pas de tarif public" in message and "800 à 1 500" in message
    assert not any(e.get("type") == "moment" for e in events)
