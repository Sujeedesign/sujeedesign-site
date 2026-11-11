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
    # Tout ce que le message contient déjà (projet, prénom, demi-journée, email)
    # est enregistré avant les chemins serveur : sans ça, l'agent reposait des
    # questions dont la réponse était dans la première phrase.
    _harvest(toolbox, message)
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
    # Choix d'un créneau déjà proposé : seule mécanique encore déterministe,
    # parce qu'elle touche à la réservation réelle. Le reste de la
    # conversation est mené par le modèle.
    answer = _server_slot_turn(toolbox, store.get_session(conn, session_id), message)
    server_led = bool(answer)
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
            # Panne du fournisseur : on continue en mode serveur plutôt que de
            # laisser le visiteur devant une conversation morte.
            print(f"agent: modèle indisponible · {error}")
            answer = ""
            break
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

    if not answer.strip():
        # Le modèle a enchaîné des outils sans conclure : on force une dernière phrase.
        final = None
        run = getattr(llm, "run", None)
        if run is not None:
            try:
                final = run(
                    messages
                    + [
                        {
                            "role": "system",
                            "content": (
                                "[consigne] Réponds maintenant au visiteur en texte simple, sans appeler d'outil. "
                                "Deux à quatre phrases, dans le ton de la conversation."
                            ),
                        }
                    ],
                    tools=[],
                )
            except LLMError as error:
                print(f"agent: conclusion indisponible · {error}")
        if final is not None:
            answer = _clean(final.text) or pending

    if not answer.strip():
        # Ni chemin serveur ni modèle : on ne laisse jamais le visiteur sans réponse.
        answer = _fallback_answer(store.get_session(conn, session_id), message)

    # Le studio, c'est Sujee : même si le modèle dérape, aucun autre prénom
    # n'atteint le visiteur.
    answer = _sans_autre_prenom(answer)

    if answer.strip() and toolbox.final_answer:
        # Phrase déjà rédigée par le moteur : on la diffuse telle quelle.
        for chunk in _chunks(answer):
            yield {"type": "delta", "text": chunk}
            time.sleep(0.012)
        store.add_message(conn, session_id, "assistant", answer)
    elif answer.strip():
        row_now = store.get_session(conn, session_id)
        fields = store.session_fields(row_now) if row_now else {}
        # Une phrase écrite par le moteur (créneaux réels) n'est jamais réécrite.
        if not server_led and _fake_slots(answer) and not toolbox.booking:
            # Le modèle invente parfois des horaires alors que rien n'est
            # affiché : on ne laisse pas passer de faux créneaux.
            answer = (
                "Laissez-moi vérifier l'agenda, je vous propose les créneaux "
                "réels dans un instant."
            )
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
            "filled": len([key for key in store.FIELDS if fields.get(key)]),
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


def _question_for(fields: dict[str, str]) -> str:
    """Question suivante, dans l'ordre de store.QUALIFICATION."""
    missing = [key for key in store.QUALIFICATION if not fields.get(key)]
    if missing:
        first = missing[0]
        if first == "project_type":
            return "Quel type de projet avez-vous en tête ?"
        if first == "branding":
            projet = " ".join(str(fields.get("project_type") or "").split())[:80]
            if projet:
                dit = projet[0].lower() + projet[1:]
                return f"Bien reçu, {dit}. Et quel est le nom de la marque ?"
            return "Quel est le nom de la marque ?"
        if first == "context":
            return "Pour quelle activité ou quel secteur est-ce ?"
    return "Pouvez-vous préciser votre besoin en une phrase ?"


_AUTRE_PRENOM = re.compile(r"\bRaj\b", re.IGNORECASE)


def _sans_autre_prenom(text: str) -> str:
    """Filet de sécurité : le visiteur ne lit jamais un prénom autre que Sujee."""
    return _AUTRE_PRENOM.sub("Sujee", text)


def _fallback_answer(row: Any, message: str) -> str:
    """Phrase de repli quand ni le serveur ni le modèle n'ont produit de texte.

    Le visiteur ne doit jamais recevoir une bulle vide.
    """
    step = str(row["step"] or "") if row is not None else ""
    fields = store.session_fields(row) if row is not None else {}
    if step == "moment":
        return "Vous préférez le matin ou l'après-midi ?"
    if step == "creneaux":
        chosen = store.session_chosen(row) if row is not None else None
        if not chosen:
            moment = slots.normalize_moment(fields.get("moment", ""))
            if moment:
                return f"Voici les créneaux {slots.MOMENTS[moment]}. Lequel vous convient ?"
            return "Choisissez l'un des créneaux affichés. Lequel vous convient ?"
        name, email = store.session_contact(row)
        if not name:
            return "Quel est votre prénom et nom ?"
        if not email:
            return "Quelle est votre adresse email, pour l'invitation ?"
        return "Quel est votre numéro de téléphone, pour l'appel avec Sujee ?"
    if step == "qualification":
        question = _question_for(fields)
        if question:
            return question
    question = _question_for(fields)
    if question:
        return question
    if not store.missing_fields(fields):
        return "Vous préférez le matin ou l'après-midi pour un point de 30 minutes avec Sujee ?"
    return "Je n'ai pas bien saisi votre message. Pouvez-vous le reformuler en une phrase ?"


def _chunks(text: str, size: int = 24) -> list[str]:
    return [text[index : index + size] for index in range(0, len(text), size)] or [""]


_VALIDATION = re.compile(
    r"^\s*(?:oui|ok|okay|yes|d'accord|parfait|exact|c'est (?:bon|exact|parfait|ça|ca)|"
    r"ça marche|ca marche|on y va|vas-y|je valide|valide)\b",
    re.IGNORECASE,
)
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE = re.compile(r"(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}")
_MODE_VISIO = re.compile(r"\b(?:visio|visioconf\w*|zoom|teams|meet|video|en ligne|par ecran)\b")
_MODE_PHONE_CALL = re.compile(
    r"\b(?:telephon\w*|telphon\w*|tel|phone|appel\w*|portable|mobile|rappel)\b"
)
# Fautes courantes sur "téléphone" ramenées à la forme canonique avant analyse.
_MODE_PHONE_TYPOS = re.compile(r"\bt[a-z]?l[e]?phon\w*|\bt[e]?l[e]?phone\b")
_MODE_WORDS = {
    "visio", "visioconference", "zoom", "teams", "meet", "video", "ligne", "ecran",
    "telephonique", "telephone", "tel", "phone", "appel", "portable", "mobile", "rappel",
}
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
    wanted_hours = [
        (int(match.group(1)), int(match.group(2)) if match.group(2) else None)
        for match in re.finditer(r"\b(\d{1,2})\s*(?:h|:)\s*(\d{2})?\b", said)
    ]
    wanted = _wanted_slot(message)
    scored: list[tuple[int, dict[str, str]]] = []
    for proposal in proposals:
        start = slots.parse_slot(proposal["id"])
        if start is None:
            continue
        if _slot_contradiction(proposal, wanted):
            # Jour, quantième, mois ou heure explicitement différents : on ne
            # décale pas le rendez-vous sur un créneau voisin.
            continue
        if wanted_hours and not any(
            hour == start.hour and (minute is None or minute == start.minute)
            for hour, minute in wanted_hours
        ):
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
    # Jour de la semaine et heure annoncés, sans quantième ni minute exacte :
    # « mardi matin à 9 h ». On tranche seulement si un seul créneau correspond.
    jours = [nom for nom in _WEEKDAYS if nom in said]
    if len(jours) == 1 and wanted_hours:
        memes = [
            proposal
            for proposal in proposals
            if (start := slots.parse_slot(proposal["id"])) is not None
            and _WEEKDAYS[start.weekday()] == jours[0]
            and any(
                hour == start.hour and (minute is None or minute == start.minute)
                for hour, minute in wanted_hours
            )
        ]
        if len(memes) == 1:
            return memes[0]
    return None


_MONTHS = (
    "janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet",
    "aout", "septembre", "octobre", "novembre", "decembre",
)


def _wanted_slot(message: str) -> dict[str, int]:
    """Ce que le visiteur demande : jour de semaine, quantième, mois, heure."""
    said = _flat(message)
    wanted: dict[str, int] = {}
    for index, nom in enumerate(_WEEKDAYS):
        if re.search(rf"\b{nom}\b", said):
            wanted["weekday"] = index
            break
    jour = re.search(r"\b(\d{1,2})(?:er)?\s+(?:" + "|".join(_MONTHS) + r")\b", said)
    if jour:
        wanted["day"] = int(jour.group(1))
    for index, nom in enumerate(_MONTHS, start=1):
        if re.search(rf"\b{nom}\b", said):
            wanted["month"] = index
            break
    heure = re.search(r"\b(\d{1,2})\s*(?:h|:)\s*(\d{2})?\b", said)
    if heure:
        wanted["hour"] = int(heure.group(1))
        if heure.group(2):
            wanted["minute"] = int(heure.group(2))
    return wanted


def _slot_parts(proposal: dict[str, str]) -> dict[str, int]:
    start = slots.parse_slot(proposal["id"])
    if start is None:
        return {}
    return {
        "weekday": start.weekday(),
        "day": start.day,
        "month": start.month,
        "hour": start.hour,
        "minute": start.minute,
    }


def _slot_contradiction(proposal: dict[str, str], wanted: dict[str, int]) -> bool:
    """Vrai si le créneau proposé contredit un élément explicitement demandé."""
    parts = _slot_parts(proposal)
    if not parts:
        return True
    for cle in ("weekday", "day", "month", "hour", "minute"):
        if cle in wanted and wanted[cle] != parts.get(cle):
            return True
    return False


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


_SPLIT = re.compile(r"[,;\n]+|\s+(?:et|puis)\s+", re.IGNORECASE)


def _segments(message: str) -> list[str]:
    """Découpe un message en morceaux d'information (« nom, email, téléphone »)."""
    parts = [part.strip(" .;!?:") for part in _SPLIT.split(message or "")]
    return [part for part in parts if part]


def _words(text: str) -> list[str]:
    return [word for word in re.split(r"[^\w'’\-]+", text or "") if word]


def _name_in_segment(segment: str) -> str:
    """Nom plausible contenu dans un seul morceau de message."""
    if _EMAIL.search(segment) or _PHONE.search(segment):
        return ""
    low = _flat(segment)
    if "branding" in low or "marque" in low or "projet" in low:
        return ""
    if any(_flat(word) in _MODE_WORDS for word in _words(segment)):
        return ""
    rest = re.sub(
        r"(?i)\b(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|"
        r"janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|"
        r"septembre|octobre|novembre|decembre|décembre)\b",
        " ",
        segment,
    )
    rest = re.sub(r"(?i)\b\d{1,2}\s*(?:h|:)\s*\d{0,2}\b", " ", rest)
    rest = re.sub(r"(?i)\b\d{1,2}(?:er)?\b", " ", rest)
    rest = re.sub(
        r"(?i)\b(?:mon nom est|je m'appelle|je me nomme|nom\s*:|prenom\s*:|c'est|moi c'est|et)\b",
        " ",
        rest,
    )
    words = [word for word in _words(rest) if _flat(word) not in _NAME_NOISE]
    if not words or len(words) > 4:
        return ""
    if any(any(char.isdigit() for char in word) for word in words):
        return ""
    if not any(word[:1].isupper() for word in words):
        return ""
    if not any(len(word) >= 3 for word in words):
        return ""
    return " ".join(words)[:80]


def _guess_name(message: str) -> str:
    """Extrait un nom plausible d'un message libre."""
    for segment in _segments(message) or [message or ""]:
        name = _name_in_segment(segment)
        if name:
            return name
    return ""


_ASK_PROJECT = re.compile(r"(?i)quel type de projet|type de projet (?:avez|souhaitez|envisagez)|quel projet")
_ASK_CONTEXT = re.compile(r"(?i)quel(?:le)? (?:type d'activité|activité|secteur)|secteur d'activité|quelle activité")


def _asks_known_field(answer: str, fields: dict[str, str]) -> bool:
    """Vrai si la réponse redemande un champ déjà renseigné."""
    if "?" not in (answer or ""):
        return False
    if fields.get("project_type") and _ASK_PROJECT.search(answer):
        return True
    if fields.get("context") and _ASK_CONTEXT.search(answer):
        return True
    return False


def _branding_words(text: str) -> str:
    """Nettoie un morceau de message pour n'en garder que le nom du branding."""
    rest = _EMAIL.sub(" ", text or "")
    rest = _PHONE.sub(" ", rest)
    rest = re.sub(r"^(?:le|la|les|du|de|des)\s+", "", rest)
    rest = re.sub(
        r"(?i)^\s*(?:mon|ma|notre|nom|branding|marque|projet|"
        r"c'est|ces|s'appelle|sappelle|s'appellera|sera|est|pour|nomme|appele|appelle|et|sujet)\b\s*",
        "",
        rest,
    )
    for char in "«»\"“”()[],;:!?":
        rest = rest.replace(char, " ")
    words = [
        word
        for word in _words(rest)
        if (word != word.lower() or _flat(word) not in _NAME_NOISE)
        and _flat(word) not in _MODE_WORDS
    ]
    words = [word for word in words if not any(char.isdigit() for char in word)]
    while words and _flat(words[0]) in {"est", "sera", "pour", "nom", "sujet"}:
        words.pop(0)
    if not words or len(words) > 8:
        return ""
    if not any(len(word) >= 3 for word in words):
        return ""
    if len(words) > 1 and not any(word[:1].isupper() for word in words):
        return ""
    return " ".join(words)[:120]


def _guess_branding(message: str) -> str:
    """Extrait le nom du branding d'un message libre (« le branding Vaasam »)."""
    segments = _segments(message) or [message or ""]
    for index, segment in enumerate(segments):
        marker = re.search(r"(?i)(?:branding|marque|projet)\b(?:\s*(?:à|a)\s*réaliser)?", segment)
        if marker is None:
            continue
        found = _branding_words(segment[marker.end():])
        if found:
            return found
        if index + 1 < len(segments):
            found = _branding_words(segments[index + 1])
            if found:
                return found
    name = _flat(_guess_name(message))
    for segment in segments:
        if _EMAIL.search(segment) or _PHONE.search(segment):
            continue
        low = _flat(segment)
        if not low or (len(segments) > 1 and low == name):
            continue
        if any(_flat(word) in _MODE_WORDS for word in _words(segment)):
            continue
        found = _branding_words(segment)
        if found:
            return found
    return ""


def _guess_mode(message: str) -> str:
    """Déduit le format souhaité : visio ou appel téléphonique."""
    text = _flat(message)
    # « je m'appel Ramm » n'est pas une demande d'appel téléphonique.
    text = re.sub(r"(?i)\bm'?\s?ap{1,2}e?l{1,2}e?\b[^,.;]*", " ", text)
    # "télphone", "telephon", "tlphone", "tel" : on tolère la faute et l'abrégé.
    text = _MODE_PHONE_TYPOS.sub("telephone ", text)
    visio = bool(_MODE_VISIO.search(text))
    phone = bool(_MODE_PHONE_CALL.search(text))
    if visio and not phone:
        return store.CALL_MODES["visio"]
    if phone and not visio:
        return store.CALL_MODES["telephone"]
    return ""


def _already_known(fields: dict, key: str, value: str) -> bool:
    """Évite d'enregistrer deux fois la même phrase dans deux champs."""
    flat = _flat(value)
    return any(_flat(other) == flat for name, other in fields.items() if name != key and other)


_GREETING = re.compile(
    r"(?i)^(?:bonjour|bonsoir|salut|hello|coucou|hey|yo|bjr|slt|bonne\s+journee)\b[\s!.,;:-]*"
)


def _strip_greeting(text: str) -> str:
    """Retire une salutation d'ouverture : « Bonjour, je veux un site » -> « je veux un site »."""
    cleaned = str(text or "").strip()
    for _ in range(3):
        stripped = _GREETING.sub("", cleaned).strip()
        if stripped == cleaned:
            break
        cleaned = stripped
    return cleaned


# « Bonjour » seul : le visiteur salue, il ne répond pas encore au questionnaire.
_GREETING_ONLY = re.compile(
    r"(?i)^\s*(bonjour|bonsoir|salut|hello|coucou|hey|yo|bjr|slt)\b[\s!.,;:-]*$"
)
_GREETING_WORD = re.compile(r"(?i)\b(bonjour|bonsoir|salut|hello|coucou|hey|yo|bjr|slt)\b")

# Questions sur l'assistant, sur Sujee ou sur le déroulé. Un petit modèle les
# ignore et repose sa question de qualification : on répond ici, sûrement.
_IDENTITY_Q = re.compile(
    r"(?i)(qui\s+(?:es|est|êtes)[- ]?(?:tu|vous)|tu\s+es\s+qui|c'?est\s+qui\s+(?:toi|vous)|"
    r"qui\s+me\s+r[ée]pond|tu\s+es\s+(?:un|une)\s+(?:robot|bot|ia|intelligence\s+artificielle|humain)|"
    r"es[- ]?tu\s+(?:un\s+|une\s+)?(?:robot|bot|humain|ia)|"
    r"(?:un\s+)?(?:robot|chatbot)\s*\?|tu\s+es\s+une\s+machine)"
)
_ABOUT_SUJEE_Q = re.compile(
    r"(?i)(qui\s+est\s+sujee|qui\s+est\s+sujeepan|c'?est\s+qui\s+sujee|sujee\s*,?\s*c'?est\s+qui)"
)
_HOW_Q = re.compile(
    r"(?i)(comment\s+[çc]a\s+(?:marche|se\s+passe)|[àa]\s+quoi\s+[çc]a\s+sert|"
    r"tu\s+sers\s+[àa]\s+quoi|que\s+fais[- ]tu)\b"
)

_SIDE_ANSWERS = {
    "identity": (
        "Je suis l'assistant IA de Sujeedesign : je comprends votre besoin en trois questions, "
        "puis je vous ouvre un appel de 30 minutes avec Sujee. Un humain relit chaque échange, "
        "rien ne part automatiquement."
    ),
    "sujee": (
        "Sujee, c'est Sujeepan SABESAN, le fondateur de Sujeedesign, studio de design graphique "
        "et digital à Paris depuis 2013. L'appel de 30 minutes se fait directement avec lui, "
        "sans intermédiaire."
    ),
    "how": (
        "Je vous pose trois questions sur votre besoin, puis je vous propose un créneau d'appel "
        "de 30 minutes avec Sujee. Vous choisissez l'horaire qui vous arrange, la réservation "
        "se fait en ligne."
    ),
}


def _greet_back(message: str, answer: str) -> str:
    """Rend la politesse quand le visiteur salue et que le modèle l'oublie."""
    text = (answer or "").strip()
    said = str(message or "").strip()
    if not text or not _GREETING_ONLY.match(said):
        return text
    if _GREETING_WORD.search(text.split("?")[0]):
        return text
    hello = "Bonsoir" if said.lower().startswith("bonsoir") else "Bonjour"
    return f"{hello} ! {text}"


# Un message ne vaut pour le type de projet que s'il nomme un type de projet :
# sans ce filtre, « Le matin » ou « auto » étaient enregistrés comme projet.
_ANY_PROJECT = re.compile(
    r"(?i)\b(site|web|e-?commerce|ecommerce|boutique|branding|logotype|logo|"
    r"identit\w*|charte|applica\w*|appli|mobile|refonte|print|[eé]dition|affiche|"
    r"flyer|brochure|packaging|photo|vid[eé]o|motion|3d|anim\w*|illustration|"
    r"r[eé]seaux sociaux|social|seo|campagne|ads|ui|ux|maquette|portfolio|"
    r"vitrine|crm|erp|logiciel|automatisation|chatbot|"
    r"direction\s+artistique|da\b|cr[eé]ation\s+de\s+marque|"
    r"lancement\s+de\s+marque|cosm[eé]ti\w*|parfum|soin|"
    r"menu|restaurant|traiteur|d[eé]coration|papeterie)\b"
)
_PURE_MOMENT = re.compile(r"(?i)^\s*(?:le\s+|l')?(matin|apr[eè]s[- ]?midi|soir)\s*$")
_PURE_MODE = re.compile(
    r"(?i)^\s*(?:t[ée]l\w*|phone|appel|visio\w*|zoom|meet|téléphone)\s*$"
)
_BRAND_MARK = re.compile(r"(?i)(marque|branding|nom|appel\w*|s'appelle|soci[eé]t[eé])")
# Un vrai nom de marque est court et ne commence pas par une formule de phrase :
# « C'est pour une marque de vêtement » décrit le projet, ce n'est pas un nom.
_BRAND_NAME_MARK = re.compile(r"(?i)(s'appelle|se nomme|s'intitule|nomm[ée]e?\b|nom\s*[:=])")
_BRAND_FIRST_STOP = re.compile(
    r"(?i)^\s*(?:c'est|c[’']est|ce\s+sont|je|j'ai|nous|on|pour|de|du|des|d[’']|"
    r"une|un|avec|dans|il|elle|mon|ma|mes|notre|nos|votre|vos)\b"
)
_BRAND_PREFIX = re.compile(
    r"(?i)^(?:.*?\b(?:s'appelle|se nomme|s'intitule)\s+|"
    r"(?:le\s+)?nom(?:\s+de\s+la\s+marque)?\s*(?:c'est|est)\s*:?\s*|c[’']est\s+)"
)


def _strip_brand_prefix(text: str) -> str:
    """« Ma marque s'appelle Vaasam » -> « Vaasam »."""
    cleaned = _BRAND_PREFIX.sub("", text).strip(" :,-")
    return cleaned or text


_PROJECT_FILLER = re.compile(
    r"(?i)\b(?:rdv|rendez[- ]?vous|je\s+veux|je\s+voudrais|j'?aimerais|je\s+souhaite|"
    r"je\s+cherche|je\s+m'?\s?ap{1,2}e?l{1,2}e?|mon\s+nom\s+est|bonjour|bonsoir|salut|hello|"
    r"tr[eè]s\s+bien|d'?accord|parfait|lundi|mardi|mercredi|jeudi|vendredi)\b"
)
_PROJECT_LEAD_CUT = re.compile(
    r"(?i)^\s*(?:pour\s+|sur\s+|de\s+|du\s+|d'|au\s+sujet\s+de\s+|concernant\s+|avec\s+)*"
)
_PROJECT_ART = re.compile(r"(?i)^\s*(?:un|une|le|la|les|des|l'|d')\s+")
# « je veux RDV avec sujee », « je m'appelle Ramm » : du bruit autour du projet.
_PROJECT_NOISE = re.compile(
    r"(?i)\b(?:je\s+veux|je\s+voudrais|j'?aimerais|je\s+souhaite|je\s+cherche|prendre)\b"
)
_PROJECT_RDV = re.compile(r"(?i)\b(?:un\s+)?(?:rdv|rendez[- ]?vous)\b(?:\s+avec\s+sujee)?")
_PROJECT_SELF = re.compile(
    r"(?i)\b(?:je\s+m'?\s?ap{1,2}e?l{1,2}e?|mon\s+nom\s+est)\b[^,.;]*"
)


def _project_phrase(text: str) -> str:
    """Garde la prestation demandée, pas la phrase entière du visiteur.

    « très bien. je veux RDV avec sujee pour lundi matin, sur une conception de
    logo. Je m'appelle Ramm » -> « conception de logo ». Recopier le message
    donnait l'impression que l'agent n'avait rien lu.
    """
    raw = " ".join(str(text or "").split())
    if not raw or not _PROJECT_FILLER.search(raw):
        return raw
    best = ""
    for chunk in re.split(r"[,;]|\.(?=\s|$)|\bet\b", raw):
        if not _ANY_PROJECT.search(chunk):
            continue
        part = _PROJECT_NOISE.sub(" ", chunk)
        part = _PROJECT_RDV.sub(" ", part)
        part = _PROJECT_SELF.sub(" ", part)
        part = re.sub(r"(?i)\bavec\s+sujee\b", " ", part)
        part = re.sub(
            r"(?i)\b(?:le\s+|ce\s+)?(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b"
            r"(?:\s+(?:prochain|matin|apr[eè]s[- ]?midi))?",
            " ",
            part,
        )
        part = re.sub(r"(?i)\b(?:le\s+)?(?:matin|matin[eé]e|apr[eè]s[- ]?midi|aprem)\b", " ", part)
        part = _PROJECT_LEAD_CUT.sub("", " ".join(part.split()))
        for _ in range(3):
            before = part
            part = re.sub(
                r"(?i)^\s*(?:bonjour|bonsoir|salut|hello|coucou|tr[eè]s\s+bien|ok|"
                r"d'?accord|parfait)\b[\s,.;:!-]*",
                "",
                part,
            )
            part = _PROJECT_LEAD_CUT.sub("", part)
            part = _PROJECT_ART.sub("", part)
            if part == before:
                break
        part = part.strip(" .,:;!-'’")
        if part and (not best or len(part) < len(best)):
            best = part
    return best or raw


_SELF_NAME = re.compile(
    r"(?i)\b(?:je\s+m'?\s?ap{1,2}e?l{1,2}e?|mon\s+nom\s+est|moi\s+c'?est)\s+"
    r"([A-Za-zÀ-ÖØ-öø-ÿ][\w'’-]{1,24}(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ][\w'’-]{1,24})?)"
)


def _self_name(text: str) -> str:
    """« je m'appel Ramm » -> « Ramm » : le prénom ne se redemande pas ensuite."""
    match = _SELF_NAME.search(text or "")
    if not match:
        return ""
    nom = " ".join(match.group(1).split()).strip(" .,;:!?-")
    # « Ramm et je veux un logo » : on ne garde pas la conjonction.
    nom = re.sub(r"(?i)\s+(?:et|mais|pour|sur|puis|donc)\b.*$", "", nom).strip()
    if len(nom) < 2 or _ANY_PROJECT.search(nom) or _flat(nom) in _MODE_WORDS:
        return ""
    return nom


def _harvest(toolbox: ToolBox, message: str) -> None:
    """Lit tout ce que le message contient déjà, au lieu de le redemander.

    Un visiteur qui écrit « je veux un RDV lundi matin pour une conception de
    logo, je m'appelle Ramm » a déjà donné quatre informations : l'agent ne doit
    poser ensuite que les questions réellement sans réponse.
    """
    conn, session_id = toolbox.conn, toolbox.session_id
    row = store.get_session(conn, session_id)
    if row is None or toolbox.booking or toolbox.handed_off:
        return
    if str(row["status"] or "") != store.STATUS_OPEN:
        return
    fields = store.session_fields(row)
    learned: dict[str, str] = {}
    if not fields.get("project_type"):
        project = _qualification_value("project_type", message)
        if project:
            learned["project_type"] = project
            if not fields.get("context"):
                context = store.infer_context(message)
                if context:
                    learned["context"] = context
    if not fields.get("branding") and _BRAND_NAME_MARK.search(_flat(message)):
        branding = _qualification_value("branding", message)
        if branding and branding != store.BRANDING_UNKNOWN:
            learned["branding"] = branding
    if not fields.get("context") and "context" not in learned:
        context = store.infer_context(message)
        if context:
            learned["context"] = context
    if learned:
        store.merge_fields(conn, session_id, learned)
        fields = store.session_fields(store.get_session(conn, session_id))

    details: dict[str, str] = {}
    if not fields.get("moment"):
        moment = slots.normalize_moment(message)
        if moment:
            details["moment"] = slots.MOMENT_LABELS[moment]
    if not fields.get("call_mode"):
        mode = _guess_mode(message)
        if mode:
            details["call_mode"] = mode
    tel = _PHONE.search(message)
    if tel and not fields.get("phone"):
        details["phone"] = " ".join(tel.group(0).split())
    if details:
        store.set_details(conn, session_id, details)

    name, email = store.session_contact(store.get_session(conn, session_id))
    if not name:
        found_name = _self_name(message)
        if found_name:
            store.set_contact(conn, session_id, name=found_name)
    if not email:
        mail = _EMAIL.search(message)
        if mail:
            store.set_contact(conn, session_id, email=mail.group(0))


def _qualification_value(key: str, message: str) -> str:
    """Valeur exploitable tirée du message pour le champ demandé.

    Chaque champ a son propre filtre : le serveur ne range plus n'importe quoi
    dans n'importe quel champ, sinon l'agent semble ne pas lire les messages.
    """
    text = _strip_greeting(" ".join(str(message or "").split()))
    if not text or len(text) < 2 or "?" in text or len(text) > 200:
        return ""
    if _PURE_MOMENT.match(text) or _PURE_MODE.match(text) or _EMAIL.search(text) or _PHONE.search(text):
        return ""
    if key == "branding":
        normalized = store.normalize_branding(text)
        if normalized == store.BRANDING_UNKNOWN:
            return normalized
        if not normalized:
            return ""
        cleaned = _strip_brand_prefix(normalized) or normalized
        if not _BRAND_NAME_MARK.search(normalized):
            words = cleaned.split()
            # « C'est pour une marque de vêtement », « de vêtement », « création
            # d'un site ecommerce » : le projet redit, pas un nom de marque.
            if _BRAND_FIRST_STOP.search(cleaned) or len(words) > 5:
                return ""
            if _ANY_PROJECT.search(cleaned) or store.infer_context(cleaned):
                return ""
        return cleaned
    if key == "project_type":
        if store._BRANDING_NOISE.match(text.lower()):
            return ""
        if re.search(r"(?i)(pas encore|pas trouv|aucun|à définir|a definir)", text):
            return ""
        return _project_phrase(text) if _ANY_PROJECT.search(text) else ""
    return text


def _qualification_question(
    toolbox: ToolBox, row: Any, answer: str
) -> str:
    """Garde-fou après le modèle : on ne saute jamais une question."""
    if toolbox.booking or toolbox.handed_off:
        return answer
    # Le modèle vient peut-être d'enregistrer des champs : on relit la session.
    row = store.get_session(toolbox.conn, toolbox.session_id)
    if row is None:
        return answer
    if str(row["status"] or "") != store.STATUS_OPEN:
        return answer
    if str(row["step"] or "") in ("creneaux", "confirme") or store.session_proposals(row):
        return answer
    fields = store.session_fields(row)
    missing = [key for key in store.QUALIFICATION if not fields.get(key)]
    if not missing:
        if str(row["pending"] or ""):
            store.touch(toolbox.conn, toolbox.session_id, pending="")
        return answer
    nxt = missing[0]
    if str(row["pending"] or "") != nxt:
        store.touch(toolbox.conn, toolbox.session_id, pending=nxt)
    if _asks_field(answer, nxt):
        return answer
    return _question_for(fields)


_ASKS_FIELD = {
    "project_type": re.compile(r"type de projet|projet|besoin", re.IGNORECASE),
    "branding": re.compile(r"branding|nom de (?:la )?marque|marque", re.IGNORECASE),
    "context": re.compile(r"activit|secteur|domaine", re.IGNORECASE),
}


def _asks_field(answer: str, key: str) -> bool:
    if "?" not in (answer or ""):
        return False
    pattern = _ASKS_FIELD.get(key)
    return bool(pattern and pattern.search(answer))


# Relance d'une question dont la réponse n'était pas exploitable : la phrase
# est construite à partir de ce que le visiteur vient de dire (_relance_for),
# jamais recopiée de la question précédente.


def _echo(message: str, limit: int = 8) -> str:
    """Reprend les mots du visiteur, courts, pour montrer qu'on l'a lu."""
    words = " ".join(str(message or "").split())
    if not words:
        return ""
    parts = words.split()[:limit]
    said = " ".join(parts).strip(" .,;:!?…\"'")
    return said[:80]


def _relance_for(asked: str, message: str, fields: dict[str, str]) -> str:
    """Relance qui s'appuie sur la réponse reçue : on n'accuse pas sans écouter.

    La relance ne recopie jamais la question précédente : elle nomme ce que le
    visiteur vient de dire, puis pose la question autrement.
    """
    said = _echo(message)
    if asked == "project_type":
        if said:
            return (
                f"Je note « {said} ». Pour bien cadrer : c'est une création de marque, "
                "une direction artistique, un site, du packaging ?"
            )
        return "Pour bien vous orienter : création de marque, direction artistique, site, packaging ?"
    if asked == "branding":
        if said and len(said.split()) <= 3 and not _ANY_PROJECT.search(said):
            return f"Bien noté pour {said}. Comment s'appelle-t-elle, cette marque ?"
        return "Bien noté. Comment s'appelle-t-elle, cette marque ? Même un nom provisoire me va."
    if asked == "context":
        if said:
            return f"D'accord, {said}. Et dans quel secteur ou pour quelle activité, concrètement ?"
        return "Et dans quel secteur ou pour quelle activité, concrètement ?"
    return _question_for(fields)
_FALLBACK_VALUE = {
    "project_type": "à préciser",
    "branding": store.BRANDING_UNKNOWN,
    "context": "à préciser",
}
_RELANCE_MARK = {
    "project_type": ("type de projet", "création de marque", "direction artistique", "packaging"),
    "branding": ("nom de la marque", "s'appelle-t-elle", "s'appelle-t-il"),
    "context": ("activité", "secteur"),
}


def _relance_deja_faite(
    conn: Any, session_id: str, key: str, seuil: int = 2
) -> bool:
    """Vrai si la question de ce champ a déjà été reposée une fois.

    Deux messages de l'assistant mentionnent le champ : la question initiale
    puis la relance. Au troisième essai on avance, quitte à marquer le champ
    « à préciser » : mieux vaut un rendez-vous qu'une boucle. `seuil` laisse un
    essai de plus quand le visiteur redit son projet au lieu de répondre.
    """
    markers = _RELANCE_MARK.get(key, ())
    if not markers:
        return False
    recent = store.messages(conn, session_id, limit=10)

    def _parle_du_champ(m: Any) -> bool:
        contenu = (m["content"] or "").lower()
        return m["role"] == "assistant" and any(marker in contenu for marker in markers)

    return sum(1 for m in recent if _parle_du_champ(m)) >= seuil


def _slots_answer(row: Any, moment: str = "") -> str:
    """Liste les propositions en cours, prêtes à être lues par le visiteur."""
    proposals = _proposal_slots(row)
    if not proposals:
        return ""
    libelles = " ; ".join(proposal["label"] for proposal in proposals[:6])
    return f"Voici les créneaux disponibles : {libelles}. Lequel vous convient ?"


def _server_slot_turn(toolbox: ToolBox, row: Any, message: str) -> str:
    """Choix du créneau et coordonnées : piloté par le serveur, sans le modèle.

    Retourne la phrase à afficher (vide si le tour ne relève pas de ce chemin).
    """
    if row is None or str(row["step"] or "") != "creneaux":
        return ""
    choice = _pick_slot(row, message)
    pending = store.session_chosen(row)
    known_name, known_email = store.session_contact(row)
    details = store.session_details(row)
    mail = _EMAIL.search(message)
    tel = _PHONE.search(message)
    email = (mail.group(0) if mail else "") or known_email
    phone = " ".join(tel.group(0).split()) if tel else details.get("phone", "")
    name = known_name or _guess_name(message)
    mode = details.get("call_mode", "") or _guess_mode(message)
    branding = details.get("branding", "")
    if not branding and name and email and phone:
        branding = _guess_branding(message)

    # Le créneau vient-il d'être choisi dans ce message ? Sert à ne pas répéter
    # « C'est noté pour … » à chaque tour de collecte.
    chosen_now = choice is not None
    lead_in = ""
    if choice is None:
        if not pending:
            # Le visiteur demande un créneau (jour/heure) : s'il n'est pas dans
            # les propositions, on le dit franchement au lieu de laisser le
            # modèle inventer une heure voisine.
            wanted = _wanted_slot(message)
            if wanted:
                libre = [
                    proposal
                    for proposal in _proposal_slots(row)
                    if not _slot_contradiction(proposal, wanted)
                ]
                if len(libre) == 1:
                    choice = libre[0]
                    lead_in = f"C'est noté pour {choice['label']}. "
                else:
                    libelles = " ; ".join(p["label"] for p in _proposal_slots(row)[:6])
                    if libelles:
                        return (
                            f"Ce créneau n'est pas libre. Voici ce que j'ai : {libelles}. "
                            "Lequel vous convient ?"
                        )
                    return ""
            if choice is None and not pending:
                return ""
        choice = _choice_by_id(row, pending)
        if choice is None:
            return ""
    else:
        lead_in = f"C'est noté pour {choice['label']}. "

    store.set_chosen(toolbox.conn, toolbox.session_id, choice["id"])
    store.set_contact(toolbox.conn, toolbox.session_id, name=name, email=email)
    store.set_details(
        toolbox.conn,
        toolbox.session_id,
        {"phone": phone, "branding": branding, "call_mode": mode},
    )

    if name and email and phone and branding and mode:
        result = toolbox.call(
            "book_meeting",
            {"slot_start": choice["id"], "name": name, "email": email, "phone": phone},
        )
        if result.get("ok") and toolbox.booking:
            format_label = "point visio" if mode == store.CALL_MODES["visio"] else "appel téléphonique"
            return (
                f"C'est réservé : {toolbox.booking['label']}, {format_label} de 30 minutes avec Sujee. "
                f"Une invitation vient de partir sur {email} (référence {toolbox.booking['reference']})."
            )
        if result.get("ok") is False:
            # book_meeting renvoie "error" (et non "erreur") : sans cette lecture,
            # tout échec de réservation retombait sur la question du format.
            erreur = str(result.get("erreur") or result.get("error") or "")
            bas = _flat(erreur)
            if any(hint in bas for hint in _SLOT_GONE_HINTS):
                # Créneau passé ou retiré pendant la conversation : on rouvre
                # des propositions fraîches au lieu de reposer une question
                # dont la réponse est déjà connue.
                return _reopen_slots(toolbox, details.get("moment", ""))
            # Panne agenda ou erreur inattendue : on enregistre la demande pour
            # confirmation humaine, sinon le visiteur retombe en boucle.
            prenom_humain = name.split()[0]
            enregistre = toolbox.call(
                "save_lead",
                {
                    "status": "a_trier",
                    "name": name,
                    "email": email,
                    "phone": phone,
                    "reason": "Réservation automatique impossible : " + (erreur or "erreur inconnue"),
                },
            )
            store.touch(toolbox.conn, toolbox.session_id, step="confirme")
            toolbox.final_answer = True
            reference = str(enregistre.get("reference") or "")
            suite = f" (référence {reference})" if reference else ""
            return (
                f"Merci {prenom_humain}, votre demande est enregistrée{suite}. "
                "Je n'ai pas pu bloquer le créneau automatiquement : "
                "Sujee vous confirme l'horaire par email."
            )
    if not name or not email:
        if email and not name:
            return "À quel nom dois-je réserver l'appel ?"
        if name and not email:
            prenom = name.split()[0]
            lead = f"Merci {prenom}, c'est noté pour {choice['label']}. " if chosen_now else f"Merci {prenom}. "
            return lead + "Quelle est votre adresse email, pour l'invitation ?"
        return f"{lead_in}Quel est votre prénom et nom ?"
    prenom = name.split()[0]
    if not phone:
        return f"Merci {prenom}. Votre numéro de téléphone, pour l'appel avec Sujee ?"
    if not branding:
        return "Quel est le nom du branding à réaliser (marque, produit ou projet) ?"
    if not mode:
        return "Vous préférez un point visio ou un appel téléphonique ?"
    # Tout est connu et la réservation n'a pas abouti : jamais de boucle.
    return (
        "Je n'ai pas pu bloquer ce créneau. Choisissez-en un autre "
        "parmi ceux affichés, ou dites-moi le matin ou l'après-midi."
    )


_SLOT_GONE_HINTS = (
    "pris",
    "trop proche",
    "ne fait pas partie des propositions",
    "illisible",
)


def _reopen_slots(toolbox: ToolBox, moment: str) -> str:
    """Repropose des horaires frais quand le créneau retenu n'est plus valable."""
    sid = toolbox.session_id
    store.set_chosen(toolbox.conn, sid, "")
    store.set_proposals(toolbox.conn, sid, [])
    toolbox.slots_emitted = False
    moment = slots.normalize_moment(moment)
    fresh = toolbox.call("request_slots", {"moment": moment})
    toolbox.final_answer = True
    if fresh.get("ok") and fresh.get("creneaux"):
        return "Ce créneau n'est plus disponible. Voici les prochains, lequel vous convient ?"
    return (
        "Ce créneau n'est plus disponible et je n'en ai pas d'autre à vous proposer. "
        "Vous préférez le matin ou l'après-midi ?"
    )


def _preflight(toolbox: ToolBox, row: Any, message: str) -> list[dict[str, Any]]:
    """Transitions déterministes : le serveur avance même si le modèle hésite."""
    if row is None:
        return []
    step = str(row["step"] or "")

    # Qualification complète mais créneaux pas encore ouverts (le modèle a
    # oublié de les demander) : le serveur les ouvre lui-même.
    fields = store.session_fields(row)
    qualification_pending = [key for key in store.QUALIFICATION if not fields.get(key)]
    if (
        not store.missing_fields(fields)
        and not qualification_pending
        and step in ("accueil", "qualification", "recap", "coordonnees", "moment")
        and not store.session_proposals(row)
        and row["status"] != store.STATUS_BOOKED
        # Une réponse « le matin » / « l'après-midi » est traitée par _server_slot_turn.
        and not slots.normalize_moment(message)
    ):
        moment = slots.normalize_moment(fields.get("moment", ""))
        if not moment:
            # Une seule question avant les créneaux : matin ou après-midi.
            store.touch(toolbox.conn, toolbox.session_id, step="moment")
            toolbox.events.append(
                {
                    "type": "moment",
                    "question": "Vous préférez le matin ou l'après-midi ?",
                    "options": [
                        {"value": "matin", "label": "Le matin"},
                        {"value": "apres-midi", "label": "L'après-midi"},
                    ],
                }
            )
            return [
                {
                    "role": "system",
                    "content": (
                        "[consigne serveur] Les informations utiles sont réunies. Tu peux maintenant "
                        "proposer un créneau : demande simplement s'il préfère le matin ou "
                        "l'après-midi, dans tes mots, une seule question. Les horaires réels "
                        "s'afficheront après sa réponse."
                    ),
                }
            ]
        result = toolbox.call("request_slots", {"moment": moment})
        if result.get("ok"):
            listed = " · ".join(
                f"{item['quand']} [id {item['id']}]" for item in result.get("creneaux") or []
            )
            return [
                {
                    "role": "system",
                    "content": (
                        "[consigne serveur] Les trois points sont renseignés et les créneaux "
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
            f"{choice['id']}. Sinon demande uniquement son prénom et son nom, une seule question."
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


