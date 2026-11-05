"""Suit un déploiement Coolify jusqu'à son terme.

Usage : python3 tools/coolify_suivi.py <deployment_uuid> [<deployment_uuid> ...]
"""

from __future__ import annotations

import json
import pathlib
import sys
import time
import urllib.request

TOKEN_FILE = pathlib.Path("/opt/data/.coolify_token")
MAX_ATTENTES = 40
PAUSE = 20


def appel(url: str, token: str) -> dict:
    requete = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
    with urllib.request.urlopen(requete, timeout=60) as reponse:
        return json.loads(reponse.read().decode())


def main() -> int:
    lignes = TOKEN_FILE.read_text(encoding="utf-8").splitlines()
    base, token = lignes[0].strip(), lignes[1].strip()
    suivis = list(dict.fromkeys(sys.argv[1:]))
    etats: dict[str, dict] = {uuid: {} for uuid in suivis}
    for _ in range(MAX_ATTENTES):
        termines = 0
        for uuid in suivis:
            try:
                donnees = appel(f"{base}/api/v1/deployments/{uuid}", token)
            except Exception as exc:  # noqa: BLE001
                etats[uuid] = {"status": f"erreur {exc}"}
                continue
            etats[uuid] = donnees
            statut = str(donnees.get("status") or "")
            if statut in {"finished", "failed", "cancelled"}:
                termines += 1
        for uuid, donnees in etats.items():
            commit = donnees.get("commit") or ""
            print(f"{uuid} {donnees.get('status')} {commit[:8]}")
        if termines == len(suivis):
            return 0
        time.sleep(PAUSE)
    print("délai dépassé")
    return 1


if __name__ == "__main__":
    sys.exit(main())
