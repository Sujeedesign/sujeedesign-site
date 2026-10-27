"""Contenu du site Next : stockage, API de lecture, publication.

Le front (Next) ne lit plus de texte en dur : au build, `scripts/pull-content.mjs`
appelle `/api/v1/content/home` et écrit le résultat dans `web/content/home.json`.
Le back office édite ce document, puis déclenche un déploiement Coolify.
"""

from __future__ import annotations

import json
import os
import sqlite3
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any

from . import content_model as model


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def stored_doc(conn: sqlite3.Connection, slug: str) -> dict[str, Any] | None:
    row = conn.execute("SELECT data, updated_at FROM content_docs WHERE slug = ?", (slug,)).fetchone()
    if row is None:
        return None
    try:
        data = json.loads(row["data"])
    except ValueError:
        return None
    return {"data": data, "updated_at": row["updated_at"]}


def load_doc(conn: sqlite3.Connection, slug: str) -> dict[str, Any]:
    """Document complet : valeurs enregistrées, complétées par les défauts.

    Les défauts viennent du fichier de contenu du front, donc un champ ajouté
    côté Next apparaît ici sans migration de base.
    """
    base = model.load_defaults() if slug == "home" else {}
    current = stored_doc(conn, slug)
    if current is None:
        return {"slug": slug, "data": base, "updated_at": None, "custom": False}
    data = _merge(base, current["data"])
    return {"slug": slug, "data": data, "updated_at": current["updated_at"], "custom": True}


def _merge(base: Any, override: Any) -> Any:
    if isinstance(base, dict) and isinstance(override, dict):
        merged = dict(base)
        for key, value in override.items():
            merged[key] = _merge(base.get(key), value) if key in base else value
        return merged
    return override


def save_doc(conn: sqlite3.Connection, slug: str, data: dict[str, Any], author: str = "admin") -> None:
    conn.execute(
        "INSERT INTO content_docs (slug, data, updated_at, updated_by) VALUES (?, ?, ?, ?) "
        "ON CONFLICT(slug) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
        (slug, json.dumps(data, ensure_ascii=False), _now(), author),
    )
    from .db import bump_revision

    bump_revision(conn)
    conn.commit()


# ------------------------------------------------------------------ publication


def publish_config() -> dict[str, str]:
    return {
        "url": os.environ.get("COOLIFY_URL", "https://coolify.sujeedesign.com").rstrip("/"),
        "token": os.environ.get("COOLIFY_TOKEN", "").strip(),
        "uuid": os.environ.get("COOLIFY_WEB_UUID", "kbt19dmgg3tnm6azvdcvuegg").strip(),
    }


def publish_ready() -> bool:
    config = publish_config()
    return bool(config["token"] and config["uuid"])


def _coolify(path: str, method: str = "GET", payload: dict[str, Any] | None = None) -> Any:
    config = publish_config()
    if not config["token"]:
        raise RuntimeError("COOLIFY_TOKEN absent")
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        f"{config['url']}{path}",
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {config['token']}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        raw = response.read().decode("utf-8")
    return json.loads(raw) if raw else {}


def request_publish(conn: sqlite3.Connection, slug: str = "home") -> dict[str, Any]:
    """Déclenche le déploiement de l'app Next et journalise la demande."""
    config = publish_config()
    if not publish_ready():
        return {"ok": False, "error": "publication non configurée : COOLIFY_TOKEN manquant"}
    try:
        result = _coolify(f"/api/v1/deploy?uuid={config['uuid']}&force=false", method="POST")
    except (urllib.error.HTTPError, urllib.error.URLError, RuntimeError, ValueError) as exc:
        detail = str(exc)
        conn.execute(
            "INSERT INTO publications (slug, status, detail) VALUES (?, 'echec', ?)",
            (slug, detail[:400]),
        )
        conn.commit()
        return {"ok": False, "error": detail}
    deployment = ""
    if isinstance(result, dict):
        deployments = result.get("deployments") or []
        if deployments and isinstance(deployments[0], dict):
            deployment = str(deployments[0].get("deployment_uuid") or "")
    conn.execute(
        "INSERT INTO publications (slug, status, deployment, detail) VALUES (?, 'lancee', ?, ?)",
        (slug, deployment, json.dumps(result, ensure_ascii=False)[:400]),
    )
    conn.commit()
    return {"ok": True, "deployment": deployment}


def last_publication(conn: sqlite3.Connection) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM publications ORDER BY id DESC LIMIT 1").fetchone()
    if row is None:
        return None
    entry = {
        "id": int(row["id"]),
        "status": row["status"],
        "deployment": row["deployment"],
        "detail": row["detail"],
        "created_at": row["created_at"],
    }
    if entry["deployment"] and entry["status"] == "lancee":
        try:
            info = _coolify(f"/api/v1/deployments/{entry['deployment']}")
            status = str((info or {}).get("status", "")).lower()
            if status in {"finished", "failed", "cancelled"}:
                entry["status"] = "terminee" if status == "finished" else "echec"
                conn.execute(
                    "UPDATE publications SET status = ?, detail = ? WHERE id = ?",
                    (entry["status"], status, entry["id"]),
                )
                conn.commit()
        except Exception:  # réseau : on garde le statut connu
            pass
    return entry


def wait_hint(seconds: int = 90) -> str:
    return time.strftime("%H:%M", time.localtime(time.time() + seconds))
