"""Ajoute une variable d'environnement Coolify sans exposer le secret en ligne de commande."""
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

_LINES = [l.strip() for l in Path("/opt/data/.coolify_token").read_text().splitlines() if l.strip()]
BASE = "https://coolify.sujeedesign.com"
TOKEN = _LINES[-1]  # le fichier contient l'URL puis le jeton


def call(path, method="GET", payload=None):
    body = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        BASE + path,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


if __name__ == "__main__":
    uuid = sys.argv[1]
    key = sys.argv[2]
    value = sys.argv[3] if len(sys.argv) > 3 else TOKEN
    status, text = call(
        f"/api/v1/applications/{uuid}/envs",
        "POST",
        {"key": key, "value": value, "is_preview": False, "is_buildtime": True, "is_runtime": True},
    )
    print("status", status)
    print(text[:300].replace(TOKEN, "<token>"))
