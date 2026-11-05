"""Tests de la boucle de conversation avec un faux modèle et un faux agenda."""

from __future__ import annotations

import json

import pytest

from app.agent import engine, slots, store
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

    # Le modèle n'est appelé qu'une fois la qualification terminée : le serveur
    # pilote l'ordre des questions (projet, branding, activité).
    llm = FakeLLM(
        [
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
    assert not any(event["type"] == "slots" for event in first)
    assert llm.calls == 0

    # Le branding arrive juste après le type de projet, rangé côté serveur.
    second = _collect(conn, session_id, "Refonte d'identité visuelle", llm, google, notifications.append)
    texte = "".join(e["text"] for e in second if e.get("type") == "delta")
    assert "branding" in texte.lower() or "marque" in texte.lower()
    assert llm.calls == 0

    third = _collect(conn, session_id, "Vaasam", llm, google, notifications.append)
    row_branding = store.get_session(conn, session_id)
    assert row_branding is not None
    assert store.session_fields(row_branding)["branding"] == "Vaasam"
    assert "activit" in "".join(e["text"] for e in third if e.get("type") == "delta").lower()

    fourth = _collect(conn, session_id, "Studio de yoga à Paris 11e", llm, google, notifications.append)
    assert any(event["type"] == "moment" for event in fourth)
    assert not any(event["type"] == "slots" for event in fourth)
    row_apres = store.get_session(conn, session_id)
    assert row_apres is not None
    assert row_apres["step"] == "moment"

    # La demi-journée choisie suffit : le serveur affiche les créneaux sans le modèle.
    fifth = _collect(conn, session_id, "Plutôt le matin", llm, google, notifications.append)
    assert any(event["type"] == "slots" for event in fifth)
    row_creneaux = store.get_session(conn, session_id)
    assert row_creneaux is not None
    assert row_creneaux["step"] == "creneaux"
    assert llm.calls == 0

    first_choice = engine._choice_by_id(row_creneaux, store.session_proposals(row_creneaux)[0])
    label = first_choice["label"]
    events = _collect(
        conn,
        session_id,
        f"{label}, Claire Martin, claire@example.com, 06 12 34 56 78, en visio",
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


def test_reponse_matin_ouvre_les_creneaux_du_matin_sans_le_modele(conn):
    """La réponse « le matin » affiche les créneaux du matin, sans appel au modèle."""
    matin = [start for start in slots.candidates() if start.hour < slots.MORNING_END_HOUR]
    apres_midi = [start for start in slots.candidates() if start.hour >= slots.MORNING_END_HOUR]
    assert matin and apres_midi
    google = FakeGoogle(available=[apres_midi[0], matin[0]])
    session_id = engine.prepare_session(conn)
    store.merge_fields(conn, session_id, FIELDS)
    store.touch(conn, session_id, step="moment")

    llm = FakeLLM([])
    events = _collect(conn, session_id, "Le matin de préférence", llm, google)

    assert llm.calls == 0
    # La question ne doit pas être reposée quand la réponse est déjà dans le message.
    assert not any(e.get("type") == "moment" for e in events)
    shown = next(e for e in events if e.get("type") == "slots")
    assert shown["moment"] == "Matin"
    assert [item["label"] for item in shown["slots"]] == [agent_tools.ToolBox._label(matin[0])]
    assert google.asked_moment == "matin"
    message = "".join(e["text"] for e in events if e.get("type") == "delta")
    assert "matin" in message.lower()


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


def test_liste_de_creneaux_retiree_quand_les_boutons_s_affichent():
    texte = (
        "Les créneaux sont affichés.\n"
        "Lequel vous convient :\n"
        "- Mardi 4 novembre à 14h\n"
        "- Jeudi 6 novembre à 10h ?"
    )
    propre = engine._drop_slot_list(texte)
    assert "Mardi 4 novembre" not in propre
    assert "Jeudi 6 novembre" not in propre
    assert "Lequel vous convient" in propre


def test_le_message_ne_recopie_pas_les_creneaux_affiches(conn):
    """Le modèle recopie parfois la liste : le serveur la retire du message."""
    start = slots.candidates()[0]
    google = FakeGoogle(available=[start])
    session_id = engine.prepare_session(conn)
    store.merge_fields(conn, session_id, FIELDS)
    # Demi-journée déjà connue : on teste la formation du message, pas la question.
    store.set_details(conn, session_id, {"moment": "Matin"})

    bavard = (
        "Les créneaux viennent de s'afficher. Lequel vous convient ?\n"
        "- Mardi 4 novembre à 14h\n"
        "- Jeudi 6 novembre à 10h"
    )
    llm = FakeLLM([[TurnOutput(text=bavard)]])
    events = _collect(conn, session_id, "Studio de yoga à Paris 11e", llm, google)

    message = "".join(e["text"] for e in events if e.get("type") == "delta")
    assert "novembre" not in message
    assert "14h" not in message
    assert len(message) < 120
    assert "créneaux" in message


def test_reponse_activite_enregistree_meme_si_le_modele_oublie_l_outil(conn):
    """Le petit modèle oublie parfois record_fields : le serveur enregistre."""
    start = slots.candidates()[0]
    google = FakeGoogle(available=[start])
    session_id = engine.prepare_session(conn)
    store.merge_fields(conn, session_id, {"project_type": "Identité de marque"})
    store.touch(conn, session_id, step="qualification")
    store.add_message(conn, session_id, "user", "Je veux refaire mon identité de marque")
    store.add_message(conn, session_id, "assistant", "Pour quelle activité ?")

    llm = FakeLLM([[TurnOutput(text="Très bien, noté.")]])
    events = _collect(conn, session_id, "Studio de yoga à Paris 11e", llm, google)

    row = store.get_session(conn, session_id)
    assert store.session_fields(row)["context"] == "Studio de yoga à Paris 11e"
    # La qualification est complète : le serveur demande la demi-journée.
    assert "moment" in [e.get("type") for e in events]


def test_horaires_inventes_remplaces_par_la_question_utile(conn):
    """Si aucun bouton n'est affiché, on ne laisse pas le modèle inventer des créneaux."""
    google = FakeGoogle(available=[slots.candidates()[0]])
    session_id = engine.prepare_session(conn)
    store.merge_fields(
        conn,
        session_id,
        {"project_type": "Identité de marque", "branding": "Vaasam"},
    )
    store.touch(conn, session_id, step="qualification")
    store.add_message(conn, session_id, "user", "Je veux refaire mon identité")
    store.add_message(conn, session_id, "assistant", "Pour quelle activité ?")

    llm = FakeLLM(
        [
            [
                TurnOutput(text="", tool_calls=[_call("request_slots", **{})]),
                TurnOutput(
                    text="Les créneaux sont mardi 10 septembre à 14h ou jeudi 12 à 10h."
                ),
            ]
        ]
    )
    events = _collect(conn, session_id, "Vous faites aussi du motion design ?", llm, google)

    message = "".join(e["text"] for e in events if e.get("type") == "delta")
    assert "septembre" not in message
    assert "secteur" in message


def test_creneaux_deja_affiches_ne_sont_pas_rediffuses(conn):
    google = FakeGoogle(available=[slots.candidates()[0]])
    session_id = engine.prepare_session(conn)
    store.merge_fields(
        conn,
        session_id,
        {
            "project_type": "Identité de marque",
            "branding": "Vaasam",
            "context": "Studio de yoga",
        },
    )
    store.touch(conn, session_id, step="moment")
    llm0 = FakeLLM([[]])
    first = _collect(conn, session_id, "plutôt le matin", llm0, google)
    assert "slots" in [e.get("type") for e in first]

    llm = FakeLLM(
        [
            [
                TurnOutput(text="", tool_calls=[_call("request_slots", **{})]),
                TurnOutput(text="Choisissez un créneau affiché."),
            ]
        ]
    )
    second = _collect(conn, session_id, "merci", llm, google)
    assert "slots" not in [e.get("type") for e in second]


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
    """Le CTA doit dire « pour l'appel avec Raj », pas « pour que Raj vous rappelle »."""
    google = FakeGoogle(available=slots.candidates()[:3])
    session_id = _session_avec_creneaux(conn, google)
    start = _creneau_unique(google.available)
    _collect(conn, session_id, f"le {start.day} à {start.hour:02d}h{start.minute:02d}", FakeLLM([]), google)
    _collect(conn, session_id, "Claire Martin", FakeLLM([]), google)
    events = _collect(conn, session_id, "claire@example.com", FakeLLM([]), google)
    message = "".join(e["text"] for e in events if e.get("type") == "delta")

    assert "téléphone" in message.lower()
    assert "rappelle" not in message.lower()
    assert "appel avec Raj" in message


def test_faute_telephone_reconnue_comme_appel() -> None:
    """« télphone » et « tel » sont des appels téléphoniques, pas du bruit."""
    for reponse in ("télphone", "tel", "Telephon", "par téléphone"):
        assert engine._guess_mode(reponse) == store.CALL_MODES["telephone"], reponse
    assert engine._guess_mode("visio") == store.CALL_MODES["visio"]
