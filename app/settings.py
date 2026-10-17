"""Réglages : environnement et table `reglages`."""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path

VERSION = "1.0.0"

DEFAULT_SETTINGS = {
    "site_name": "Sujee Design",
    "tagline": "Votre marque, de A à Z",
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


def public_base_url() -> str:
    return env("SITE_BASE_URL", "https://sujeedesign.com").rstrip("/")


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
        merged[row["key"]] = row["value"]
    return merged
