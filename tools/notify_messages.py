"""Notifie sur Telegram les messages reçus par le formulaire du site.

Le site stocke chaque message et l'expose sur `GET /api/sync/messages`
(en-tête `x-sync-token`). Ce script les récupère, envoie une notification
Telegram, puis marque le message comme notifié. Il est prévu pour un cron
Hermes local ; il ne dépend ni du gateway ni d'un agent.

    python3 tools/notify_messages.py --base https://sujeedesign.com --token XXX
    python3 tools/notify_messages.py --base http://127.0.0.1:8140 --token dev --dry-run
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


def fetch(base: str, token: str, since: int) -> list[dict]:
    url = f"{base.rstrip('/')}/api/sync/messages?since={int(since)}"
    request = urllib.request.Request(url, headers={"x-sync-token": token, "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8")).get("messages", [])


def mark_notified(base: str, token: str, message_id: int) -> None:
    url = f"{base.rstrip('/')}/api/sync/messages/{int(message_id)}/notified"
    request = urllib.request.Request(url, method="POST", headers={"x-sync-token": token})
    with urllib.request.urlopen(request, timeout=20):
        pass


def render(message: dict) -> str:
    lines = [
        "Nouveau message depuis sujeedesign.com",
        f"Référence : {message.get('reference', '')}",
        f"Nom : {message.get('name', '')}",
        f"Email : {message.get('email', '')}",
    ]
    if message.get("phone"):
        lines.append(f"Téléphone : {message['phone']}")
    if message.get("project_type"):
        lines.append(f"Projet : {message['project_type']}")
    if message.get("budget"):
        lines.append(f"Budget : {message['budget']}")
    if message.get("source"):
        lines.append(f"Depuis : {message['source']}")
    lines.append("")
    lines.append(str(message.get("message", ""))[:1500])
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
    parser = argparse.ArgumentParser(description="Notifie les messages du site sur Telegram.")
    parser.add_argument("--base", required=True, help="URL du site")
    parser.add_argument("--token", required=True, help="jeton de synchronisation")
    parser.add_argument("--target", default="telegram", help="cible d'envoi (hermes send -t)")
    parser.add_argument("--profile", default="raj", help="profil Hermes qui envoie")
    parser.add_argument("--since", type=int, default=0, help="ne considérer que les messages après cet id")
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
        messages = fetch(args.base, args.token, since)
    except urllib.error.URLError as error:
        print(f"site injoignable : {error}", file=sys.stderr)
        return 2

    sent = 0
    for message in messages:
        text = render(message)
        if args.dry_run:
            print("-----")
            print(text)
            print(f"(serait notifié : {message.get('reference')})")
            sent += 1
            continue
        if not notify(text, args.target, args.profile):
            continue
        mark_notified(args.base, args.token, int(message["id"]))
        sent += 1
        since = max(since, int(message["id"]))

    if args.state and sent:
        with open(args.state, "w", encoding="utf-8") as handle:
            json.dump({"since": since}, handle)

    print(f"{len(messages)} message(s) récupéré(s), {sent} notifié(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
