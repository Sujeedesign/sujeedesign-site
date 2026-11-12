"""Réglages : environnement et table `reglages`."""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from urllib.parse import urlparse

VERSION = "1.0.0"

DEFAULT_SETTINGS = {
    "site_name": "Sujee Design",
    "tagline": "Votre marque, de A à Z",
    "site_url": "https://sujeedesign.com",
    "site_description": (
        "Sujee Design — Sujeepan Sabesan, designer & directeur artistique à Paris. "
        "Identité de marque, création visuelle, web, marketing, solutions IA."
    ),
    "base_url": "",
    "og_image": "",
    "email": "s.sujeepan.pro@gmail.com",
    "phone": "",
    "linkedin": "https://www.linkedin.com/in/sujeepan-sabesan",
    "behance": "https://www.behance.net/SujeepanSabesan",
    "city": "Paris, France",
    "studio": "Sujee Design",
    "person_name": "Sujeepan Sabesan",
    "job_title": "Designer et directeur artistique",
    "legal_name": "Sujee Design — Sujeepan Sabesan",
    "mentions": "SIRET, hébergeur et mentions légales à compléter dans le back office.",
    "analytics_id": "",
}


def env(key: str, default: str = "") -> str:
    return (os.environ.get(key) or default).strip()


def data_dir() -> Path:
    return Path(env("SITE_DATA", "./data"))


def db_path() -> Path:
    raw = env("SITE_DB")
    return Path(raw) if raw else data_dir() / "site.db"


def media_dir() -> Path:
    return data_dir() / "medias"


def cookie_secure() -> bool:
    """Cookie de session en Secure (production HTTPS). COOKIE_SECURE=0 pour les tests HTTP."""
    return env("COOKIE_SECURE", "1").strip().lower() not in {"0", "false", "no", ""}


def public_base_url() -> str:
    return env("SITE_BASE_URL", "https://sujeedesign.com").rstrip("/")


def cookie_domain(request) -> str | None:
    """Domaine des cookies de session, partagé entre l'apex et le back office.

    Le back office vit sur `admin.sujeedesign.com` depuis le 12/11, mais
    l'édition en place se fait sur le site public : la vitrine appelle
    `/api/editor/session` pour savoir si une session existe et si l'édition est
    demandée (`sjd_edit`). Avec des cookies host-only, ces repères posés par le
    back office seraient invisibles depuis `sujeedesign.com` et la barre
    d'édition ne s'afficherait jamais.

    On élargit donc le domaine à `.sujeedesign.com` quand la requête arrive sur
    ce domaine (ou un sous-domaine), et on garde des cookies host-only partout
    ailleurs : un hôte de secours type `*.sslip.io` ne peut pas poser de cookie
    pour `sujeedesign.com`, et inversement.
    """
    host = (request.headers.get("host") or "").split(",")[0].strip().lower()
    host = host.split(":")[0]
    site = urlparse(public_base_url()).netloc.lower().split(":")[0]
    if not host or not site:
        return None
    if host == site or host.endswith("." + site):
        # Domaine parent explicite : accepté depuis l'apex comme depuis un
        # sous-domaine, et c'est la seule forme partagée entre les deux.
        return "." + site
    return None


def admin_host() -> str:
    """Hôte du back office. `ADMIN_HOST` permet de viser un autre domaine."""
    return (env("ADMIN_HOST", "admin.sujeedesign.com") or "").lower()


def is_admin_host(host: str) -> bool:
    host = (host or "").split(",")[0].strip().lower().split(":")[0]
    return bool(host) and host == admin_host()


def admin_base(host: str) -> str:
    """Préfixe des URL du back office : vide sur son domaine, `/admin` ailleurs.

    Sur `admin.sujeedesign.com`, l'administration est servie à la racine
    (`/connexion`, `/pages`) : le nom d'hôte dit déjà qu'on est dans le back
    office. L'hôte de secours (`*.sslip.io`) garde `/admin`, et le préfixe reste
    la seule forme que connaissent les liens historiques.
    """
    return "" if is_admin_host(host) else "/admin"


def get(conn: sqlite3.Connection, key: str, default: str = "") -> str:
    row = conn.execute("SELECT value FROM reglages WHERE key = ?", (key,)).fetchone()
    if row is not None and row["value"] != "":
        return row["value"]
    if key in DEFAULT_SETTINGS:
        return DEFAULT_SETTINGS[key]
    return default


def set_value(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute(
        "INSERT INTO reglages (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value or ""),
    )


def all_settings(conn: sqlite3.Connection) -> dict[str, str]:
    merged = dict(DEFAULT_SETTINGS)
    for row in conn.execute("SELECT key, value FROM reglages"):
        if row["value"] != "":
            merged[row["key"]] = row["value"]
    return merged


def publish_webhook() -> str:
    """URL de déploiement (webhook Coolify) appelée à la publication."""
    return env("PUBLISH_WEBHOOK_URL")
