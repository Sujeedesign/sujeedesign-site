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
from typing import Any, Iterator

from . import store
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
    answer = ""
    pending = ""

    for round_index in range(MAX_TOOL_ROUNDS):
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
    yield {
        "type": "done",
        "session": session_id,
        "step": final["step"] if final else "accueil",
        "status": final["status"] if final else store.STATUS_OPEN,
        "reference": (final["reference"] if final else "") or "",
    }


def _chunks(text: str, size: int = 24) -> list[str]:
    return [text[index : index + size] for index in range(0, len(text), size)] or [""]


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
    return _AWAITING.sub("", cleaned).strip()


def _one_question(text: str, keep: int = 2) -> str:
    """Garantit une seule question : on coupe après le premier point d'interrogation.

    Les modèles, même bien briefés, glissent parfois plusieurs questions d'affilée.
    La promesse « une question à la fois » est donc tenue côté serveur.
    """
    cleaned = _clean(text)
    mark = cleaned.find("?")
    if mark == -1:
        return cleaned
    head = cleaned[: mark + 1].strip()
    sentences = [part for part in _SENTENCE.split(head) if part.strip()]
    if len(sentences) > keep:
        head = " ".join(sentences[-(keep - 1) :]) if keep > 1 else sentences[-1]
    return head.strip()
