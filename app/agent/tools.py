"""Outils exposés au modèle, avec validation serveur.

Le modèle propose, le serveur décide. Chaque outil vérifie l'état réel de la
session avant d'agir : pas de créneau sans la qualification complète, pas de rendez-vous
sans créneau libre revérifié, un seul rendez-vous par conversation.
"""

from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime, timedelta
from typing import Any, Callable

from . import slots, store
from .google import CalendarClient, GoogleError

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$")

TOOL_SPECS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "record_fields",
            "description": "Enregistre les informations de qualification apprises dans le dernier message du visiteur.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_type": {"type": "string", "description": "Nature du projet"},
                    "context": {"type": "string", "description": "Contexte, activité, existant"},
                    "objective": {"type": "string", "description": "Objectif visé"},
                    "scope": {"type": "string", "description": "Périmètre et livrables"},
                    "deadline": {"type": "string", "description": "Échéance souhaitée"},
                    "decision_maker": {"type": "string", "description": "Qui décide et comment c'est validé"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "submit_recap",
            "description": "Enregistre la reformulation du besoin avant validation par le visiteur.",
            "parameters": {
                "type": "object",
                "properties": {"recap": {"type": "string", "description": "Reformulation en 3 à 5 lignes"}},
                "required": ["recap"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "request_slots",
            "description": "Demande les créneaux réellement disponibles. À appeler seulement après validation de la reformulation.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "book_meeting",
            "description": "Réserve le créneau choisi et envoie la confirmation. À appeler uniquement avec un créneau proposé par request_slots.",
            "parameters": {
                "type": "object",
                "properties": {
                    "slot_start": {"type": "string", "description": "Identifiant du créneau, ex. 2026-11-04T09:00:00+01:00"},
                    "name": {"type": "string", "description": "Prénom et nom"},
                    "email": {"type": "string", "description": "Email de confirmation"},
                    "phone": {"type": "string", "description": "Téléphone, facultatif"},
                },
                "required": ["slot_start", "name", "email"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_lead",
            "description": "Enregistre la demande sans rendez-vous, par exemple si elle sort du cadre.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "email": {"type": "string"},
                    "phone": {"type": "string"},
                    "reason": {"type": "string", "description": "Pourquoi aucun créneau n'est proposé"},
                    "status": {"type": "string", "enum": ["a_trier", "qualifie"]},
                },
                "required": ["reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "handoff_form",
            "description": "Bascule vers le formulaire classique si le visiteur préfère écrire.",
            "parameters": {
                "type": "object",
                "properties": {"reason": {"type": "string"}},
            },
        },
    },
]


def _slug(value: str) -> str:
    return " ".join(str(value or "").split())[:400]


class ToolBox:
    def __init__(
        self,
        conn: sqlite3.Connection,
        session_id: str,
        google: CalendarClient,
        notify: Callable[[str, str], bool] | None = None,
        mailer: Callable[[], bool] | None = None,
    ) -> None:
        self.conn = conn
        self.session_id = session_id
        self.google = google
        self.notify = notify
        self.events: list[dict[str, Any]] = []
        self.booking: dict[str, Any] | None = None
        self.handed_off = False

    # -- helpers ----------------------------------------------------------
    def _session(self) -> sqlite3.Row:
        row = store.get_session(self.conn, self.session_id)
        if row is None:
            raise RuntimeError("Session absente")
        return row

    def _fields(self) -> dict[str, str]:
        return store.session_fields(self._session())

    def _error(self, message: str) -> dict[str, Any]:
        return {"ok": False, "error": message}

    def call(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        handler = {
            "record_fields": self.record_fields,
            "submit_recap": self.submit_recap,
            "request_slots": self.request_slots,
            "book_meeting": self.book_meeting,
            "save_lead": self.save_lead,
            "handoff_form": self.handoff_form,
        }.get(name)
        if handler is None:
            return self._error(f"Outil inconnu : {name}")
        try:
            return handler(arguments or {})
        except GoogleError as error:
            return self._error(f"Service agenda indisponible : {error}")
        except (RuntimeError, ValueError) as error:
            return self._error(str(error))

    # -- outils -----------------------------------------------------------
    def record_fields(self, arguments: dict[str, Any]) -> dict[str, Any]:
        payload = arguments.get("fields") if isinstance(arguments.get("fields"), dict) else arguments
        fields = store.merge_fields(self.conn, self.session_id, payload)
        missing = store.missing_fields(fields)
        if not missing and self._session()["step"] in ("accueil", "qualification"):
            store.touch(self.conn, self.session_id, step="recap")
        self.events.append(
            {
                "type": "progress",
                "filled": len(fields),
                "total": len(store.FIELDS),
                "missing": missing,
            }
        )
        return {"ok": True, "renseignes": [store.FIELD_LABELS[k] for k in fields], "manquants": [store.FIELD_LABELS[k] for k in missing]}

    def submit_recap(self, arguments: dict[str, Any]) -> dict[str, Any]:
        fields = self._fields()
        missing = store.missing_fields(fields)
        if missing:
            return self._error(
                "Il manque encore : " + ", ".join(store.FIELD_LABELS[k] for k in missing) + ". Pose la question."
            )
        recap = _slug(arguments.get("recap", ""))
        if len(recap) < 20:
            return self._error("Reformulation trop courte. Reprends le besoin en 3 à 5 lignes.")
        store.touch(self.conn, self.session_id, recap=recap, step="recap", recap_ok=0)
        return {"ok": True, "consigne": "Affiche la reformulation et demande une validation explicite."}

    def request_slots(self, arguments: dict[str, Any]) -> dict[str, Any]:
        row = self._session()
        fields = store.session_fields(row)
        missing = store.missing_fields(fields)
        if missing:
            return self._error(
                "Créneaux indisponibles tant que ces points manquent : "
                + ", ".join(store.FIELD_LABELS[k] for k in missing)
            )
        if not row["recap"]:
            return self._error("Appelle d'abord submit_recap avec la reformulation.")
        previous = [slots.parse_slot(item) for item in store.session_proposals(row)]
        previous = [start for start in previous if start is not None and start > slots.now_paris()]
        if str(row["step"] or "") == "creneaux" and previous:
            labels = [self._label(start) for start in previous]
            self.events.append(
                {
                    "type": "slots",
                    "slots": [
                        {"id": slots.slot_id(start), "label": label}
                        for start, label in zip(previous, labels)
                    ],
                }
            )
            return {
                "ok": True,
                "deja_proposes": True,
                "creneaux": [
                    {"id": slots.slot_id(s), "quand": label} for s, label in zip(previous, labels)
                ],
            }
        booked = store.bookings_per_day(self.conn)
        available = self.google.available_slots(
            count=3, booked_per_day=booked, taken=store.taken_slots(self.conn)
        )
        if not available:
            store.touch(self.conn, self.session_id, step="recap")
            return self._error(
                "Aucun créneau libre dans les deux prochaines semaines. Propose au visiteur d'écrire via le formulaire et appelle handoff_form."
            )
        store.set_proposals(self.conn, self.session_id, [slots.slot_id(start) for start in available])
        store.touch(self.conn, self.session_id, step="creneaux", recap_ok=1)
        labels = [self._label(start) for start in available]
        self.events.append(
            {
                "type": "slots",
                "slots": [
                    {"id": slots.slot_id(start), "label": label}
                    for start, label in zip(available, labels)
                ],
            }
        )
        return {"ok": True, "creneaux": [{"id": slots.slot_id(s), "quand": label} for s, label in zip(available, labels)]}

    def book_meeting(self, arguments: dict[str, Any]) -> dict[str, Any]:
        row = self._session()
        if row["status"] == store.STATUS_BOOKED:
            return self._error("Un rendez-vous est déjà pris dans cette conversation.")
        fields = store.session_fields(row)
        if len(store.missing_fields(fields)) or not row["recap_ok"]:
            return self._error("La qualification n'est pas terminée ou la reformulation n'est pas validée.")
        start = slots.parse_slot(str(arguments.get("slot_start", "")))
        if start is None:
            return self._error("Créneau illisible. Utilise l'identifiant renvoyé par request_slots.")
        slot_start = slots.slot_id(start)
        if start < slots.now_paris() + slots.LEAD_TIME:
            return self._error("Ce créneau est trop proche. Propose les créneaux renvoyés par request_slots.")
        if slot_start not in store.session_proposals(row):
            return self._error("Ce créneau ne fait pas partie des propositions. Rappelle request_slots.")

        name = _slug(arguments.get("name", ""))[:120]
        email = _slug(arguments.get("email", "")).lower()[:180]
        phone = _slug(arguments.get("phone", ""))[:40]
        if len(name) < 2:
            return self._error("Nom manquant : demande le prénom et le nom.")
        if not EMAIL_RE.match(email):
            return self._error("Email invalide : demande une adresse correcte avant de réserver.")

        if not store.reserve_slot(self.conn, slot_start, self.session_id, email):
            store.set_proposals(self.conn, self.session_id, [])
            fresh = self.request_slots({})
            return {
                "ok": False,
                "erreur": "Ce créneau vient d'être pris.",
                "nouveaux_creneaux": fresh.get("creneaux", []),
                "consigne": "Présente uniquement ces nouveaux créneaux, sans en inventer.",
            }

        reference = store.next_reference(self.conn)
        summary = self._summary(fields)
        try:
            event = self.google.create_event(
                start=start,
                attendee_email=email,
                attendee_name=name,
                summary=f"Appel découverte · {name} · {fields.get('project_type', 'projet')}",
                description=summary,
            )
        except GoogleError as error:
            store.release_slot(self.conn, slot_start)
            return self._error(f"Service agenda indisponible : {error}")

        event_id = str(event.get("id", ""))
        lead = store.create_lead(
            self.conn,
            self.session_id,
            fields,
            name=name,
            email=email,
            phone=phone,
            summary=summary,
            status=store.STATUS_BOOKED,
            ip_hash=row["ip_hash"],
        )
        store.update_lead(
            self.conn,
            lead["id"],
            event_id=event_id,
            slot_start=slot_start,
            notified_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        )
        conn = self.conn
        conn.execute(
            "UPDATE agent_bookings SET event_id = ? WHERE slot_start = ?", (event_id, slot_start)
        )
        conn.commit()
        store.touch(
            self.conn,
            self.session_id,
            step="confirme",
            status=store.STATUS_BOOKED,
            reference=lead["reference"],
            lead_id=lead["id"],
            recap_ok=1,
        )
        mailed = self._send_confirmation(email, name, start, reference)
        if self.notify:
            self.notify(self._notification(reference, name, email, phone, fields, start))
        self.booking = {
            "reference": lead["reference"],
            "event_id": event_id,
            "start": slot_start,
            "label": self._label(start),
            "email": email,
            "mail_sent": mailed,
        }
        self.events.append({"type": "booking", **self.booking})
        return {
            "ok": True,
            "reference": lead["reference"],
            "quand": self._label(start),
            "confirmation_envoyee": mailed,
            "consigne": "Le rendez-vous est posé. Remercie, rappelle le créneau et la référence, et dis que la confirmation part par email.",
        }

    def save_lead(self, arguments: dict[str, Any]) -> dict[str, Any]:
        fields = self._fields()
        status = store.STATUS_REVIEW if str(arguments.get("status", "a_trier")) != "qualifie" else store.STATUS_QUALIFIED
        name = _slug(arguments.get("name", ""))[:120]
        email = _slug(arguments.get("email", "")).lower()[:180]
        reason = _slug(arguments.get("reason", ""))
        summary = self._summary(fields) + (f"\n\nMotif : {reason}" if reason else "")
        lead = store.create_lead(
            self.conn,
            self.session_id,
            fields,
            name=name,
            email=email,
            phone=_slug(arguments.get("phone", ""))[:40],
            summary=summary,
            status=status,
            ip_hash=self._session()["ip_hash"],
        )
        store.touch(self.conn, self.session_id, status=status, reference=lead["reference"], lead_id=lead["id"])
        if self.notify:
            self.notify(
                f"[contact] demande à trier {lead['reference']}\n{name} {email}\n{reason}\n\n{summary}"
            )
        self.events.append({"type": "lead", "reference": lead["reference"], "status": status})
        return {"ok": True, "reference": lead["reference"], "status": status}

    def handoff_form(self, arguments: dict[str, Any]) -> dict[str, Any]:
        self.handed_off = True
        store.touch(self.conn, self.session_id, step="recap", status=store.STATUS_FORM)
        self.events.append({"type": "handoff", "reason": _slug(arguments.get("reason", ""))})
        return {"ok": True, "consigne": "Dis au visiteur que le formulaire s'ouvre sous le chat et qu'il peut y détailler son besoin."}

    # -- rendu ------------------------------------------------------------
    @staticmethod
    def _label(start: datetime) -> str:
        jours = ("lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche")
        mois = (
            "janvier",
            "février",
            "mars",
            "avril",
            "mai",
            "juin",
            "juillet",
            "août",
            "septembre",
            "octobre",
            "novembre",
            "décembre",
        )
        return f"{jours[start.weekday()]} {start.day} {mois[start.month - 1]} à {start:%H}h{start:%M}"

    @staticmethod
    def _summary(fields: dict[str, str]) -> str:
        lines = ["Brief issu de la page contact", ""]
        for key in store.FIELDS:
            if fields.get(key):
                lines.append(f"{store.FIELD_LABELS[key].capitalize()} : {fields[key]}")
        return "\n".join(lines)

    def _confirmation_text(self, name: str, start: datetime, reference: str) -> str:
        return (
            f"Bonjour {name},\n\n"
            f"Votre rendez-vous est confirmé : {self._label(start)}, heure de Paris, pour 20 minutes.\n"
            f"Référence : {reference}\n\n"
            "L'appel sert à cadrer votre besoin. Si vous avez des références, un site existant ou un brief, "
            "vous pouvez répondre à cet email avec les éléments.\n\n"
            "À bientôt,\nSujee Design\nhttps://sujeedesign.com"
        )

    def _send_confirmation(self, email: str, name: str, start: datetime, reference: str) -> bool:
        try:
            self.google.send_mail(
                to=email,
                subject=f"Votre rendez-vous avec Sujee Design · {start:%d/%m à %Hh%M}",
                text=self._confirmation_text(name, start, reference),
            )
            return True
        except GoogleError:
            return False

    def _notification(
        self,
        reference: str,
        name: str,
        email: str,
        phone: str,
        fields: dict[str, str],
        start: datetime,
    ) -> str:
        lines = [
            f"[contact] rendez-vous {reference}",
            f"{self._label(start)} · {name} · {email}" + (f" · {phone}" if phone else ""),
            "",
        ]
        for key in store.FIELDS:
            if fields.get(key):
                lines.append(f"{store.FIELD_LABELS[key]} : {fields[key]}")
        return "\n".join(lines)

    def as_json(self, payload: dict[str, Any]) -> str:
        return json.dumps(payload, ensure_ascii=False)
