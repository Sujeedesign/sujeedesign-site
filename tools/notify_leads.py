"""Notifie sur Telegram les leads qualifiés par l'agent de la page contact.

L'agent écrit chaque lead dans le back office et l'expose sur
`GET /api/sync/agent-leads` (en-tête `x-sync-token`). Ce script récupère les
leads non notifiés, envoie le brief sur Telegram, puis marque le lead. Il suit
le même modèle que `tools/notify_messages.py` : cron Hermes local, sans
identifiant Telegram dans le back office public.

    python3 tools/notify_leads.py --base https://sujeedesign.com --token XXX
    python3 tools/notify_leads.py --base http://127.0.0.1:8140 --token dev --dry-run
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import urllib.error
import urllib.request

HERMES = "/opt/hermes/bin/hermes"

LABELS = [
    ("project_type", "Projet"),
    ("context", "Contexte"),
    ("goal", "Objectif"),
    ("scope", "Périmètre"),
    ("deadline", "Échéance"),
    ("decision_maker", "Décideur"),
    ("budget", "Enveloppe"),
]


def fetch(base: str, token: str, since: int) -> list[dict]:
    url = f"{base.rstrip('/')}/api/sync/agent-leads?since={int(since)}"
    request = urllib.request.Request(url, headers={"x-sync-token": token, "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8")).get("leads", [])


def mark_notified(base: str, token: str, lead_id: int) -> None:
    url = f"{base.rstrip('/')}/api/sync/agent-leads/{int(lead_id)}/notified"
    request = urllib.request.Request(url, method="POST", headers={"x-sync-token": token})
    with urllib.request.urlopen(request, timeout=20):
        pass


def render(lead: dict) -> str:
    fields = lead.get("fields") or {}
    title = "Nouveau lead qualifié" if lead.get("status") == "rdv" else "Demande à trier"
    lines = [f"{title} · {lead.get('reference', '')}".strip(), ""]
    name = lead.get("name") or "contact inconnu"
    lines.append(f"{name}")
    if lead.get("email"):
        lines.append(str(lead["email"]))
    if lead.get("phone"):
        lines.append(str(lead["phone"]))
    lines.append("")
    for key, label in LABELS:
        value = str(fields.get(key) or "").strip()
        if value:
            lines.append(f"{label} : {value}")
    if lead.get("slot_start"):
        lines.append("")
        lines.append(f"Rendez-vous : {lead['slot_start']}")
    if lead.get("summary"):
        lines.append("")
        lines.append(str(lead["summary"])[:1500])
    return "\n".join(lines)


def notify(text: str, target: str, profile: str) -> bool:
    if not shutil.which(HERMES):
        print(f"hermes introuvable ({HERMES})", file=sys.stderr)
        return False
    result = subprocess.run(
        [HERMES, "-p", profile, "send", "-t", target, "-q", text],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(result.stderr.strip() or "envoi refusé", file=sys.stderr)
        return False
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Notifie les leads de l'agent sur Telegram.")
    parser.add_argument("--base", required=True, help="URL du back office ou du site")
    parser.add_argument("--token", required=True, help="jeton de synchronisation")
    parser.add_argument("--target", default="telegram", help="cible d'envoi (hermes send -t)")
    parser.add_argument("--profile", default="raj", help="profil Hermes qui envoie")
    parser.add_argument("--since", type=int, default=0, help="ne considérer que les leads après cet id")
    parser.add_argument("--dry-run", action="store_true", help="afficher sans envoyer")
    parser.add_argument("--state", default="", help="fichier où mémoriser le dernier id traité")
    args = parser.parse_args(argv)

    since = args.since
    if args.state:
        try:
            with open(args.state, encoding="utf-8") as handle:
                since = int(json.load(handle).get("since", since))
        except (OSError, ValueError):
            pass

    try:
        leads = fetch(args.base, args.token, since)
    except urllib.error.URLError as error:
        print(f"back office injoignable : {error}", file=sys.stderr)
        return 2

    sent = 0
    for lead in leads:
        if lead.get("notified_at"):
            since = max(since, int(lead["id"]))
            continue
        text = render(lead)
        if args.dry_run:
            print("-----")
            print(text)
            print(f"(serait notifié : {lead.get('reference')})")
            sent += 1
            continue
        if not notify(text, args.target, args.profile):
            continue
        mark_notified(args.base, args.token, int(lead["id"]))
        sent += 1
        since = max(since, int(lead["id"]))

    if args.state and sent:
        with open(args.state, "w", encoding="utf-8") as handle:
            json.dump({"since": since}, handle)

    print(f"{len(leads)} lead(s) récupéré(s), {sent} notifié(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
