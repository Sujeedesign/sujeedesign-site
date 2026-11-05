"""Outils exposés au modèle, avec validation serveur.

Le modèle propose, le serveur décide. Chaque outil vérifie l'état réel de la
session avant d'agir : pas de créneau sans la qualification complète, pas de rendez-vous
sans créneau libre revérifié, un seul rendez-vous par conversation.
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
from datetime import datetime, timedelta
from typing import Any, Callable

from . import ics, slots, store
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
                    "context": {"type": "string", "description": "Activité, secteur, contexte"},
                    "moment": {
                        "type": "string",
                        "enum": ["matin", "apres-midi"],
                        "description": "Demi-journée préférée, seulement si le visiteur vient de la donner",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "request_slots",
            "description": "Demande les créneaux réellement disponibles, filtrés sur la demi-journée choisie. Appelé automatiquement dès que la qualification est complète et le moment connu.",
            "parameters": {
                "type": "object",
                "properties": {
                    "moment": {
                        "type": "string",
                        "enum": ["matin", "apres-midi"],
                        "description": "Demi-journée préférée par le visiteur",
                    }
                },
            },
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
        self.slots_emitted = False
        self.handed_off = False
        # Phrase finale déjà rédigée : le tour ne doit plus la réécrire.
        self.final_answer = False

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
        raw_fields = arguments.get("fields")
        payload: dict[str, Any] = raw_fields if isinstance(raw_fields, dict) else dict(arguments)
        moment = slots.normalize_moment(str(arguments.get("moment") or payload.get("moment") or ""))
        if moment:
            # On enregistre un libellé lisible ; la comparaison repasse par normalize_moment.
            store.set_details(self.conn, self.session_id, {"moment": slots.MOMENT_LABELS[moment]})
            payload = {key: value for key, value in payload.items() if key != "moment"}
        fields = store.merge_fields(self.conn, self.session_id, payload)
        missing = store.missing_fields(fields)
        self.events.append(
            {
                "type": "progress",
                "filled": len([k for k in store.FIELDS if fields.get(k)]),
                "total": len(store.FIELDS),
                "missing": missing,
            }
        )
        result: dict[str, Any] = {
            "ok": True,
            "renseignes": [store.FIELD_LABELS[k] for k in fields],
            "manquants": [store.FIELD_LABELS[k] for k in missing],
        }
        # Qualification : type de projet connu, activité à préciser.
        if missing and "project_type" not in missing:
            store.touch(self.conn, self.session_id, step="qualification")
        # Qualification complète : on demande d'abord la demi-journée préférée,
        # puis le serveur ouvre les créneaux correspondants sans attendre.
        # Pas de récapitulatif, pas de validation à demander : on va au rendez-vous.
        if not missing:
            row = self._session()
            if row["status"] != store.STATUS_BOOKED and not store.session_proposals(row):
                moment = slots.normalize_moment(store.session_fields(row).get("moment", ""))
                if not moment:
                    store.touch(self.conn, self.session_id, step="moment")
                    self.events.append(
                        {
                            "type": "moment",
                            "question": "Vous préférez le matin ou l'après-midi ?",
                            "options": [
                                {"value": "matin", "label": "Le matin"},
                                {"value": "apres-midi", "label": "L'après-midi"},
                            ],
                        }
                    )
                    result["consigne"] = (
                        "Qualification complète. Demande en une seule question s'il préfère le matin "
                        "ou l'après-midi. Les créneaux s'afficheront tout seuls après sa réponse : "
                        "n'appelle pas request_slots et ne propose aucun horaire."
                    )
                    return result
                opened = self.request_slots({"moment": moment})
                result["slots"] = opened.get("creneaux", [])
                if opened.get("ok"):
                    result["consigne"] = (
                        "Les créneaux réels sont déjà affichés en boutons. Annonce-les en une phrase "
                        "et demande prénom, nom et email en une seule phrase. Ne pose aucune autre question."
                    )
                else:
                    result["consigne"] = (
                        "Créneaux indisponibles. Propose au visiteur d'écrire via le formulaire et appelle handoff_form."
                    )
        return result

    def request_slots(self, arguments: dict[str, Any]) -> dict[str, Any]:
        row = self._session()
        fields = store.session_fields(row)
        missing = store.missing_fields(fields)
        if missing:
            return self._error(
                "Créneaux indisponibles tant que ces points manquent : "
                + ", ".join(store.FIELD_LABELS[k] for k in missing)
            )
        known = slots.normalize_moment(fields.get("moment", ""))
        moment = slots.normalize_moment(str(arguments.get("moment") or "")) or known
        if moment and moment != known:
            # Le visiteur change de demi-journée : on remplace les créneaux affichés.
            store.set_details(self.conn, self.session_id, {"moment": slots.MOMENT_LABELS[moment]})
        previous = [slots.parse_slot(item) for item in store.session_proposals(row)]
        # Un créneau proposé il y a deux jours peut être devenu trop proche :
        # on ne le represente pas, sinon la réservation échoue en boucle.
        previous = [
            start
            for start in previous
            if start is not None and start > slots.now_paris() + slots.LEAD_TIME
        ]
        if str(row["step"] or "") == "creneaux" and previous and moment == known:
            labels = [self._label(start) for start in previous]
            return {
                "ok": True,
                "deja_proposes": True,
                "moment": slots.MOMENT_LABELS.get(moment, ""),
                "creneaux": [
                    {"id": slots.slot_id(s), "quand": label} for s, label in zip(previous, labels)
                ],
            }
        booked = store.bookings_per_day(self.conn)
        available = self.google.available_slots(
            count=3,
            booked_per_day=booked,
            taken=store.taken_slots(self.conn),
            moment=moment,
        )
        # Même règle que pour les propositions existantes : jamais un créneau
        # à moins de 48 h, sinon la réservation échoue et la question revient.
        available = [start for start in available if start > slots.now_paris() + slots.LEAD_TIME]
        if not available:
            store.touch(self.conn, self.session_id, step="creneaux")
            return self._error(
                "Aucun créneau libre dans les deux prochaines semaines. Propose au visiteur d'écrire via le formulaire et appelle handoff_form."
            )
        store.set_proposals(self.conn, self.session_id, [slots.slot_id(start) for start in available])
        store.touch(self.conn, self.session_id, step="creneaux", recap_ok=1)
        labels = [self._label(start) for start in available]
        if not self.slots_emitted:
            self.slots_emitted = True
            self.events.append(
                {
                    "type": "slots",
                    "moment": slots.MOMENT_LABELS.get(moment, ""),
                    "slots": [
                        {"id": slots.slot_id(start), "label": label}
                        for start, label in zip(available, labels)
                    ],
                }
            )
        return {
            "ok": True,
            "moment": slots.MOMENT_LABELS.get(moment, ""),
            # Faux si la demi-journée demandée est saturée : le modèle doit le dire.
            "moment_respecte": all(slots.matches_moment(start, moment) for start in available),
            "creneaux": [{"id": slots.slot_id(s), "quand": label} for s, label in zip(available, labels)],
        }

    def book_meeting(self, arguments: dict[str, Any]) -> dict[str, Any]:
        row = self._session()
        if row["status"] == store.STATUS_BOOKED:
            return self._error("Un rendez-vous est déjà pris dans cette conversation.")
        fields = store.session_fields(row)
        if len(store.missing_fields(fields)):
            return self._error("La qualification n'est pas terminée. Reprends les points manquants.")
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
        phone = _slug(arguments.get("phone", ""))[:40] or fields.get("phone", "")
        branding = fields.get("branding", "")
        mode = fields.get("call_mode", "")
        if len(name) < 2:
            return self._error("Nom manquant : demande le prénom et le nom.")
        if not EMAIL_RE.match(email):
            return self._error("Email invalide : demande une adresse correcte avant de réserver.")
        if not phone:
            return self._error("Téléphone manquant : demande le numéro avant de réserver.")
        if not branding:
            return self._error("Nom du branding manquant : demande la marque ou le projet à réaliser.")
        if not mode:
            return self._error("Format manquant : demande s'il préfère un point visio ou un appel téléphonique.")

        if not store.reserve_slot(self.conn, slot_start, self.session_id, email):
            store.set_proposals(self.conn, self.session_id, [])
            self.slots_emitted = False
            fresh = self.request_slots({})
            return {
                "ok": False,
                "erreur": "Ce créneau vient d'être pris.",
                "nouveaux_creneaux": fresh.get("creneaux", []),
                "consigne": "Présente uniquement ces nouveaux créneaux, sans en inventer.",
            }

        reference = store.next_reference(self.conn)
        summary = self._summary(fields)
        titre = f"Appel découverte · {name}"
        if branding:
            titre += f" · {branding}"
        elif fields.get("project_type"):
            titre += f" · {fields['project_type']}"
        if mode == "visio":
            description = summary + "\n\nFormat : point visio (lien envoyé avant l'appel)."
            location = "Visio"
        elif mode:
            description = summary + (f"\n\nFormat : appel téléphonique au {phone}." if phone else "\n\nFormat : appel téléphonique.")
            location = phone or "Téléphone"
        else:
            description = summary
            location = phone or ""
        try:
            event = self.google.create_event(
                start=start,
                attendee_email=email,
                attendee_name=name,
                summary=titre,
                description=description,
                location=location,
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
        mailed = self._send_confirmation(
            email, name, start, reference, mode, phone, event_id=event_id, title=titre, location=location
        )
        admin_mailed = self._send_admin_notice(
            reference, name, email, phone, fields, start, event_id=event_id, title=titre,
            location=location, mode=mode, event_link=str(event.get("htmlLink", "")),
        )
        if self.notify:
            self.notify(self._notification(reference, name, email, phone, fields, start))
        self.booking = {
            "reference": lead["reference"],
            "event_id": event_id,
            "start": slot_start,
            "label": self._label(start),
            "email": email,
            "phone": phone,
            "branding": branding,
            "call_mode": mode,
            "mail_sent": mailed,
            "admin_mail_sent": admin_mailed,
        }
        self.events.append({"type": "booking", **self.booking})
        return {
            "ok": True,
            "reference": lead["reference"],
            "quand": self._label(start),
            "format": mode,
            "branding": branding,
            "telephone": phone,
            "confirmation_envoyee": mailed,
            "consigne": "Le rendez-vous est posé. Remercie, rappelle le créneau, le format et la référence, et dis que la confirmation part par email.",
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
        store.touch(self.conn, self.session_id, step="coordonnees", status=store.STATUS_FORM)
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
        for key in (*store.FIELDS, *store.DETAILS):
            if fields.get(key):
                lines.append(f"{store.FIELD_LABELS[key].capitalize()} : {fields[key]}")
        return "\n".join(lines)

    def _confirmation_text(
        self, name: str, start: datetime, reference: str, mode: str = "", phone: str = ""
    ) -> str:
        if mode == "visio":
            format_line = "Le point se fait en visio : le lien vous parvient avant l'appel."
        elif mode:
            format_line = "L'appel se fait au téléphone" + (f" au {phone}." if phone else ".")
        else:
            format_line = "L'appel se fait au téléphone."
        return (
            f"Bonjour {name},\n\n"
            f"Votre rendez-vous est confirmé : {self._label(start)}, heure de Paris, pour 30 minutes.\n"
            f"Référence : {reference}\n"
            f"{format_line}\n\n"
            "L'appel sert à cadrer votre besoin. Si vous avez des références, un site existant ou un brief, "
            "vous pouvez répondre à cet email avec les éléments.\n\n"
            "À bientôt,\nSujee Design\nhttps://sujeedesign.com"
        )

    # -- emails -----------------------------------------------------------
    def _organizer(self) -> tuple[str, str]:
        config = getattr(self.google, "config", None)
        email = getattr(config, "from_email", "") or "hello@sujeedesign.com"
        name = getattr(config, "from_name", "") or "Sujee Design"
        return email, name

    def _invite(
        self,
        *,
        start: datetime,
        name: str,
        email: str,
        title: str,
        description: str,
        location: str,
        uid: str,
    ) -> tuple[str, bytes, str, str]:
        organizer_email, organizer_name = self._organizer()
        payload = ics.build_invite(
            start=start,
            end=start + timedelta(minutes=slots.SLOT_MINUTES),
            summary=title,
            description=description,
            location=location,
            attendee_email=email,
            attendee_name=name,
            organizer_email=organizer_email,
            organizer_name=organizer_name,
            uid=uid,
        )
        return ("rendez-vous-sujee-design.ics", payload, "text", "calendar")

    def _send_confirmation(
        self,
        email: str,
        name: str,
        start: datetime,
        reference: str,
        mode: str = "",
        phone: str = "",
        *,
        event_id: str = "",
        title: str = "",
        location: str = "",
    ) -> bool:
        organizer_email, _ = self._organizer()
        try:
            self.google.send_mail(
                to=email,
                subject=f"Votre rendez-vous avec Sujee Design · {self._label(start)}",
                text=self._confirmation_text(name, start, reference, mode, phone),
                attachments=[
                    self._invite(
                        start=start,
                        name=name,
                        email=email,
                        title=title or "Rendez-vous avec Sujee Design",
                        description=(
                            f"Rendez-vous de {slots.SLOT_MINUTES} minutes avec Sujee Design."
                            f"\nRéférence : {reference}"
                        ),
                        location=location,
                        uid=f"{event_id or reference}@sujeedesign.com",
                    )
                ],
                reply_to=organizer_email,
            )
            return True
        except GoogleError:
            return False

    def _admin_recipients(self) -> list[str]:
        raw = os.environ.get("AGENT_NOTIFY_EMAIL", "s.sujeepan.pro@gmail.com")
        return [item.strip() for item in raw.split(",") if item.strip()]

    def _send_admin_notice(
        self,
        reference: str,
        name: str,
        email: str,
        phone: str,
        fields: dict[str, str],
        start: datetime,
        *,
        event_id: str = "",
        title: str = "",
        location: str = "",
        mode: str = "",
        event_link: str = "",
    ) -> bool:
        recipients = self._admin_recipients()
        if not recipients:
            return False
        format_line = "visio" if mode == "visio" else f"téléphone ({phone})" if phone else "téléphone"
        lines = [
            f"Nouveau rendez-vous {reference}",
            "",
            f"Quand : {self._label(start)}, heure de Paris ({slots.SLOT_MINUTES} min)",
            f"Client : {name}",
            f"Email : {email}",
            f"Téléphone : {phone}",
            f"Format : {format_line}",
            f"Agenda : {event_link}" if event_link else "",
            "",
        ]
        for key in (*store.FIELDS, *store.DETAILS):
            if fields.get(key):
                lines.append(f"{store.FIELD_LABELS[key]} : {fields[key]}")
        try:
            organizer_email, _ = self._organizer()
            self.google.send_mail(
                to=", ".join(recipients),
                subject=f"Nouveau RDV {reference} · {self._label(start)} · {name}",
                text="\n".join(line for line in lines if line is not None),
                attachments=[
                    self._invite(
                        start=start,
                        name=name,
                        email=email,
                        title=title or "Rendez-vous avec Sujee Design",
                        description=self._summary(fields),
                        location=location,
                        uid=f"{event_id or reference}@sujeedesign.com",
                    )
                ],
                reply_to=email,
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
        for key in (*store.FIELDS, *store.DETAILS):
            if fields.get(key):
                lines.append(f"{store.FIELD_LABELS[key]} : {fields[key]}")
        return "\n".join(lines)

    def as_json(self, payload: dict[str, Any]) -> str:
        return json.dumps(payload, ensure_ascii=False)
