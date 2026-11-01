"""Boucle de conversation : modèle, outils, état de session.

Chaque tour produit un flux d'événements prêt pour le SSE :
`delta` (texte), `tool` (outil appelé), `progress`, `slots`, `booking`,
`lead`, `handoff`, `error`, `done`.
"""

from __future__ import annotations

import json
import re
import sqlite3
import time
from datetime import datetime
from typing import Any, Iterator

from . import slots, store
from .google import CalendarClient
from .llm import LLMError, MistralClient, TurnOutput, assistant_message
from .prompt import build_system_prompt, reminder
from .tools import TOOL_SPECS, ToolBox

MAX_TURNS = 20
MAX_TOOL_ROUNDS = 3


def prepare_session(conn: sqlite3.Connection, ip_hash: str = "") -> str:
    return store.new_session(conn, ip_hash=ip_hash)


def _history(conn: sqlite3.Connection, session_id: str) -> list[dict[str, Any]]:
    session = store.get_session(conn, session_id)
    fields = store.session_fields(session)
    step = session["step"] if session else "accueil"
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": build_system_prompt()},
        {"role": "system", "content": reminder(fields, str(step))},
    ]
    for row in store.messages(conn, session_id):
        if row["role"] in ("user", "assistant") and row["content"]:
            messages.append({"role": row["role"], "content": row["content"]})
    return messages


def _tool_result(call: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    return {
        "role": "tool",
        "tool_call_id": call.get("id", ""),
        "name": (call.get("function") or {}).get("name", ""),
        "content": json.dumps(result, ensure_ascii=False),
    }


def turn(
    conn: sqlite3.Connection,
    session_id: str,
    text: str,
    llm: MistralClient,
    google: CalendarClient,
    notify: Any = None,
) -> Iterator[dict[str, Any]]:
    """Exécute un tour complet et renvoie les événements à diffuser."""
    session = store.get_session(conn, session_id)
    if session is None:
        yield {"type": "error", "message": "Session inconnue."}
        return

    message = (text or "").strip()
    if not message:
        yield {"type": "error", "message": "Message vide."}
        return
    if int(session["turns"] or 0) >= MAX_TURNS:
        yield {"type": "error", "message": "Cette conversation a atteint sa limite. Écrivez-nous via le formulaire."}
        return

    store.add_message(conn, session_id, "user", message[: store.MAX_MESSAGE])
    store.touch(conn, session_id, turns=int(session["turns"] or 0) + 1)
    if session["status"] == store.STATUS_OPEN:
        store.touch(conn, session_id, status=store.STATUS_OPEN)

    toolbox = ToolBox(conn, session_id, google, notify=notify)
    messages = _history(conn, session_id)
    # Certaines transitions clés (validation du récap, choix d'un créneau) sont
    # pilotées côté serveur : un petit modèle les oublie trop souvent.
    pre = _preflight(toolbox, store.get_session(conn, session_id), message)
    had_slots = bool(store.session_proposals(store.get_session(conn, session_id)))
    slots_shown = had_slots
    for event in toolbox.events:
        slots_shown = slots_shown or event.get("type") == "slots"
        yield event
    toolbox.events = []
    messages.extend(pre)
    answer = ""
    pending = ""
    # Choix du créneau + coordonnées : chemin serveur déterministe.
    answer = _server_slot_turn(toolbox, store.get_session(conn, session_id), message)
    if answer:
        for event in toolbox.events:
            slots_shown = slots_shown or event.get("type") == "slots"
            yield event
        toolbox.events = []

    for round_index in (() if answer else range(MAX_TOOL_ROUNDS)):
        output: TurnOutput | None = None
        turn_text = ""
        try:
            for event in llm.stream(messages, TOOL_SPECS):
                if "delta" in event:
                    turn_text += event["delta"]
                else:
                    output = event["done"]
        except LLMError as error:
            print(f"agent: modèle indisponible · {error}")
            yield {
                "type": "error",
                "message": (
                    "Je ne peux pas répondre à l'instant. Réessayez dans un moment, "
                    "ou utilisez le formulaire pour décrire votre projet."
                ),
            }
            return
        if output is None:
            yield {"type": "error", "message": "Réponse incomplète du modèle."}
            return

        turn_text = _clean(turn_text)
        messages.append(assistant_message(output))

        # Les outils du tour précédent ont pu mettre des nouvelles à jour.
        for event in toolbox.events:
            slots_shown = slots_shown or event.get("type") == "slots"
            yield event
        toolbox.events = []

        if not output.tool_calls:
            answer = turn_text or pending
            break

        # Tour d'outils : le texte produit avant l'appel est un brouillon
        # (souvent une reformulation partielle). On le garde de côté sans
        # l'afficher, sinon le visiteur lit la réponse deux fois de suite.
        pending = turn_text or pending

        result: dict[str, Any] = {}
        for call in output.tool_calls:
            name = (call.get("function") or {}).get("name", "")
            try:
                arguments = json.loads((call.get("function") or {}).get("arguments") or "{}")
            except ValueError:
                arguments = {}
            if not isinstance(arguments, dict):
                arguments = {}
            yield {"type": "tool", "name": name}
            result = toolbox.call(name, arguments)
            messages.append(_tool_result(call, result))

        if round_index == MAX_TOOL_ROUNDS - 1:
            # Dernier tour d'outils : on laisse le modèle conclure une fois de plus.
            final = llm.run(messages, tools=[])
            answer = _clean(final.text) or pending
            break

    # Filet de sécurité : le petit modèle oublie parfois d'enregistrer une
    # réponse évidente. Si un seul champ manque et que le message ressemble à
    # une réponse courte, on l'enregistre côté serveur.
    row_now = store.get_session(conn, session_id)
    if (
        row_now
        and not toolbox.booking
        and row_now["step"] == "qualification"
        and len(store.messages(conn, session_id)) > 2
    ):
        guess = message.strip()
        missing = store.missing_fields(store.session_fields(row_now))
        if len(missing) == 1 and guess and "?" not in guess and len(guess) <= 200:
            store.merge_fields(conn, session_id, {missing[0]: guess})
            if not store.missing_fields(
                store.session_fields(store.get_session(conn, session_id))
            ):
                toolbox.call("request_slots", {})
                opened = False
                for event in toolbox.events:
                    slots_shown = slots_shown or event.get("type") == "slots"
                    opened = opened or event.get("type") == "slots"
                    yield event
                toolbox.events = []
                if not opened:
                    answer = (
                        "Je n'ai pas de créneau en ligne ces prochains jours. "
                        "Écrivez à hello@sujeedesign.com et je vous propose un horaire."
                    )

    if not answer.strip():
        # Le modèle a enchaîné des outils sans conclure : on force une dernière phrase.
        try:
            final = llm.run(
                messages
                + [
                    {
                        "role": "system",
                        "content": (
                            "[consigne] Réponds maintenant au visiteur en une seule question, "
                            "deux phrases maximum, sans appeler d'outil."
                        ),
                    }
                ],
                tools=[],
            )
        except LLMError as error:
            print(f"agent: conclusion indisponible · {error}")
            final = None
        if final is not None:
            answer = _clean(final.text) or pending

    if answer.strip():
        row_now = store.get_session(conn, session_id)
        if slots_shown and not toolbox.booking and row_now and row_now["step"] == "creneaux":
            # Les boutons font le travail : une phrase suffit, jamais la liste.
            if store.session_chosen(row_now):
                answer = _one_question(answer)
            elif had_slots:
                answer = "Choisissez l'un des créneaux affichés pour réserver l'appel de 30 minutes."
            else:
                answer = "Les créneaux viennent de s'afficher. Lequel vous convient ?"
        else:
            fields = store.session_fields(row_now) if row_now else {}
            if _fake_slots(answer) and not toolbox.booking:
                # Le modèle invente parfois des horaires alors que rien n'est affiché.
                answer = _question_for(store.missing_fields(fields))
            answer = _one_question(answer)
        for chunk in _chunks(answer):
            yield {"type": "delta", "text": chunk}
            time.sleep(0.012)
        store.add_message(conn, session_id, "assistant", answer)

    if toolbox.handed_off:
        store.touch(conn, session_id, status=store.STATUS_FORM)
    elif not toolbox.booking and int(store.get_session(conn, session_id)["turns"] or 0) >= MAX_TURNS:
        store.touch(conn, session_id, status=store.STATUS_DROPPED)

    final = store.get_session(conn, session_id)
    if final:
        fields = store.session_fields(final)
        yield {
            "type": "progress",
            "filled": len(fields),
            "total": len(store.FIELDS),
            "missing": store.missing_fields(fields),
        }
    yield {
        "type": "done",
        "session": session_id,
        "step": final["step"] if final else "accueil",
        "status": final["status"] if final else store.STATUS_OPEN,
        "reference": (final["reference"] if final else "") or "",
    }


def _fake_slots(text: str) -> bool:
    """Vrai si la réponse énumère des horaires alors qu'aucun bouton n'est affiché."""
    return bool(
        re.search(
            r"(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)[^.!?]{0,40}?\d{1,2}\s*h",
            text or "",
            re.IGNORECASE,
        )
    )


def _question_for(missing: list[str]) -> str:
    if "context" in missing:
        return "Pour quelle activité ou quel secteur est-ce ?"
    if "project_type" in missing:
        return "Quel type de projet avez-vous en tête ?"
    return "Pouvez-vous préciser votre besoin en une phrase ?"


def _chunks(text: str, size: int = 24) -> list[str]:
    return [text[index : index + size] for index in range(0, len(text), size)] or [""]


_VALIDATION = re.compile(
    r"^\s*(?:oui|ok|okay|yes|d'accord|parfait|exact|c'est (?:bon|exact|parfait|ça|ca)|"
    r"ça marche|ca marche|on y va|vas-y|je valide|valide)\b",
    re.IGNORECASE,
)
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE = re.compile(r"(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}")
_ORDINAL = re.compile(r"\b(?:le\s+)?(premier|1er|deuxième|deuxieme|2e|troisième|troisieme|3e)\b", re.IGNORECASE)


def _flat(value: str) -> str:
    text = " ".join((value or "").lower().split())
    for source, target in (("é", "e"), ("è", "e"), ("ê", "e"), ("à", "a"), ("ç", "c"), ("ô", "o"), ("û", "u")):
        text = text.replace(source, target)
    return text


def _proposal_slots(row: Any) -> list[dict[str, str]]:
    """Reconstruit les créneaux proposés (id + libellé) depuis la session."""
    found: list[dict[str, str]] = []
    for raw in store.session_proposals(row):
        start = slots.parse_slot(raw)
        if start is None:
            continue
        found.append({"id": slots.slot_id(start), "label": ToolBox._label(start)})
    return found


def _pick_slot(row: Any, message: str) -> dict[str, str] | None:
    """Retrouve le créneau visé par le visiteur (bouton cliqué ou texte libre)."""
    proposals = _proposal_slots(row)
    if not proposals:
        return None
    said = _flat(message)
    for proposal in proposals:
        if _flat(proposal["label"]) and _flat(proposal["label"]) in said:
            return proposal
    if len(proposals) > 1:
        match = _ORDINAL.search(said)
        if match:
            index = {"premier": 0, "1er": 0, "deuxieme": 1, "2e": 1, "troisieme": 2, "3e": 2}.get(
                _flat(match.group(1)).replace("è", "e")
            )
            if index is not None and index < len(proposals):
                return proposals[index]
    # Texte libre approximatif (« mercredi 4 novembre à 09h00 ») : on compare
    # jour de la semaine, quantième et heure du créneau.
    scored: list[tuple[int, dict[str, str]]] = []
    for proposal in proposals:
        start = slots.parse_slot(proposal["id"])
        if start is None:
            continue
        score = _slot_mention(start, said)
        if score:
            scored.append((score, proposal))
    if scored:
        scored.sort(key=lambda item: item[0], reverse=True)
        best = scored[0][0]
        winners = [item for item in scored if item[0] == best]
        if best >= 3 and len(winners) == 1:
            return winners[0][1]
    return None


_WEEKDAYS = ("lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche")


def _slot_mention(start: datetime, said: str) -> int:
    """Score de correspondance entre un créneau et une phrase libre."""
    score = 0
    if _WEEKDAYS[start.weekday()] in said:
        score += 2
    if re.search(rf"\b0?{start.day}\b", said):
        score += 2
    if re.search(rf"\b0?{start.hour}\s*(?:h|:)\s*0?{start.minute}\b", said):
        score += 3
    elif re.search(rf"\b0?{start.hour}\s*h\b", said):
        score += 1
    return score


def _choice_by_id(row: Any, slot_start: str) -> dict[str, str] | None:
    for proposal in _proposal_slots(row):
        if proposal["id"] == slot_start:
            return proposal
    start = slots.parse_slot(slot_start)
    if start is None:
        return None
    return {"id": slots.slot_id(start), "label": ToolBox._label(start)}


_NAME_NOISE = {
    "oui", "ok", "okay", "voici", "mon", "ma", "le", "la", "mail", "email", "e", "adresse",
    "merci", "bonjour", "salut", "c'est", "je", "suis", "nom", "prenom", "et", "pour",
    "rendez", "vous", "creneau", "confirme", "parfait", "tres", "bien",
}


def _guess_name(message: str) -> str:
    """Extrait un nom plausible d'un message libre."""
    rest = _EMAIL.sub(" ", message or "")
    rest = _PHONE.sub(" ", rest)
    rest = re.sub(
        r"(?i)\b(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|"
        r"janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|"
        r"septembre|octobre|novembre|decembre|décembre)\b",
        " ",
        rest,
    )
    rest = re.sub(r"(?i)\b\d{1,2}\s*(?:h|:)\s*\d{0,2}\b", " ", rest)
    rest = re.sub(r"(?i)\b\d{1,2}(?:er)?\b", " ", rest)
    rest = re.sub(
        r"(?i)\b(?:mon nom est|je m'appelle|je me nomme|nom\s*:|prenom\s*:|c'est|moi c'est|et)\b",
        " ",
        rest,
    )
    rest = re.sub(r"[^\w'\- ]+", " ", rest)
    words = [word for word in rest.split() if word]
    words = [word for word in words if _flat(word) not in _NAME_NOISE]
    if not words or len(words) > 4:
        return ""
    if any(any(ch.isdigit() for ch in word) for word in words):
        return ""
    if not any(word[:1].isupper() for word in words):
        return ""
    if not any(len(word) >= 3 for word in words):
        return ""
    return " ".join(words)[:80]


def _server_slot_turn(toolbox: ToolBox, row: Any, message: str) -> str:
    """Choix du créneau et coordonnées : piloté par le serveur, sans le modèle.

    Retourne la phrase à afficher (vide si le tour ne relève pas de ce chemin).
    """
    if row is None or str(row["step"] or "") != "creneaux":
        return ""
    choice = _pick_slot(row, message)
    pending = store.session_chosen(row)
    known_name, known_email = store.session_contact(row)
    mail = _EMAIL.search(message)
    tel = _PHONE.search(message)
    email = (mail.group(0) if mail else "") or known_email
    name = _guess_name(message) or known_name
    phone = tel.group(0) if tel else ""
    if choice is None:
        # Pas de créneau dans ce message : c'est peut-être la suite des coordonnées.
        if not pending or (name == known_name and email == known_email):
            return ""
        choice = _choice_by_id(row, pending)
        if choice is None:
            return ""

    store.set_chosen(toolbox.conn, toolbox.session_id, choice["id"])
    store.set_contact(toolbox.conn, toolbox.session_id, name=name, email=email)

    if name and email:
        result = toolbox.call(
            "book_meeting",
            {"slot_start": choice["id"], "name": name, "email": email, "phone": phone},
        )
        if result.get("ok") and toolbox.booking:
            return (
                f"C'est réservé : {toolbox.booking['label']}, appel de 30 minutes avec Raj. "
                f"Une invitation vient de partir sur {email} (référence {toolbox.booking['reference']})."
            )
        if result.get("ok") is False:
            erreur = str(result.get("erreur") or "")
            if "pris" in erreur.lower():
                store.set_chosen(toolbox.conn, toolbox.session_id, "")
                store.set_contact(toolbox.conn, toolbox.session_id, name=name, email=email)
                return "Ce créneau vient d'être pris. Choisissez-en un autre parmi ceux affichés."
    if email:
        return f"C'est noté pour {choice['label']}. À quel nom dois-je réserver l'appel ?"
    return (
        f"C'est noté pour {choice['label']}. "
        "Votre nom et votre adresse email, pour envoyer l'invitation ?"
    )


def _preflight(toolbox: ToolBox, row: Any, message: str) -> list[dict[str, Any]]:
    """Transitions déterministes : le serveur avance même si le modèle hésite."""
    if row is None:
        return []
    step = str(row["step"] or "")

    # Qualification complète mais créneaux pas encore ouverts (le modèle a
    # oublié de les demander) : le serveur les ouvre lui-même.
    fields = store.session_fields(row)
    if (
        not store.missing_fields(fields)
        and step in ("accueil", "qualification", "recap", "coordonnees")
        and not store.session_proposals(row)
        and row["status"] != store.STATUS_BOOKED
    ):
        result = toolbox.call("request_slots", {})
        if result.get("ok"):
            listed = " · ".join(
                f"{item['quand']} [id {item['id']}]" for item in result.get("creneaux") or []
            )
            return [
                {
                    "role": "system",
                    "content": (
                        "[consigne serveur] Les deux points sont renseignés et les créneaux "
                        "réels sont déjà affichés en boutons. En une phrase, dis qu'ils sont "
                        "affichés, sans les recopier en liste, et demande lequel lui convient. "
                        "Ne demande pas encore ses coordonnées et n'annonce aucune vérification. "
                        f"Aucune autre question. Créneaux : {listed}"
                    ),
                }
            ]

    if step == "creneaux":
        choice = _pick_slot(row, message)
        if choice is None:
            return []
        email = _EMAIL.search(message)
        phone = _PHONE.search(message)
        details = [f"Le visiteur a choisi le créneau {choice['label']} [id {choice['id']}]."]
        if email:
            details.append(f"Email détecté : {email.group(0)}.")
        if phone:
            details.append(f"Téléphone détecté : {phone.group(0)}.")
        details.append(
            "Si tu as son nom et son email, appelle book_meeting avec slot_start="
            f"{choice['id']}. Sinon demande son nom et son email en une seule phrase."
        )
        return [{"role": "system", "content": "[consigne serveur] " + " ".join(details)}]
    return []


_PREAMBLE = re.compile(
    r"(?:^|\s)(?:refined|brouillon|draft|final answer|reformulation)\s*:\s*",
    re.IGNORECASE,
)
_AWAITING = re.compile(r"\s*\((?:en attente|awaiting)[^)]*\)", re.IGNORECASE)
_SENTENCE = re.compile(r"(?<=[.!?…])\s+")


def _clean(text: str) -> str:
    """Retire les marqueurs techniques que le modèle laisse parfois fuiter."""
    cleaned = (text or "").strip()
    for _ in range(3):
        stripped = _PREAMBLE.sub(" ", cleaned).strip()
        if stripped == cleaned:
            break
        cleaned = stripped
    cleaned = re.sub(r"\*\*(.+?)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"\1", cleaned)
    cleaned = re.sub(r"__(\S(?:.*?\S)?)__", r"\1", cleaned)
    return _AWAITING.sub("", cleaned).strip()


_WEEKDAY = re.compile(
    r"\b(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b", re.IGNORECASE
)
_BULLET = re.compile(r"^\s*(?:[-–—•*]|\d+[.)])\s+")
_CLOCK = re.compile(r"\b\d{1,2}\s*[h:]\s*\d{2}\b|\b\d{1,2}h\b", re.IGNORECASE)


def _drop_slot_list(text: str) -> str:
    """Retire la liste des créneaux quand les boutons les affichent déjà.

    Le prompt l'interdit, mais les modèles recopient volontiers les horaires.
    On supprime les puces et les lignes de créneau, puis on garde la phrase.
    """
    kept: list[str] = []
    for line in text.splitlines():
        if not line.strip():
            continue
        if _BULLET.match(line) and (_WEEKDAY.search(line) or _CLOCK.search(line)):
            continue
        if _WEEKDAY.search(line) and _CLOCK.search(line) and len(line) < 90:
            continue
        kept.append(line.strip())
    return " ".join(kept).strip() or text


def _one_question(text: str, keep: int = 2) -> str:
    """Garantit une seule question : on coupe après le premier point d'interrogation.

    Les modèles, même bien briefés, glissent parfois plusieurs questions d'affilée.
    La promesse « une question à la fois » est donc tenue côté serveur.
    """
    cleaned = _clean(text)
    if cleaned.count("?") <= 1:
        return cleaned
    mark = cleaned.find("?")
    head = cleaned[: mark + 1].strip()
    sentences = [part for part in _SENTENCE.split(head) if part.strip()]
    if len(sentences) > keep:
        head = " ".join(sentences[-(keep - 1) :]) if keep > 1 else sentences[-1]
    return head.strip()
