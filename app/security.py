"""Sécurité : sessions signées, jetons de formulaire, limitation de débit."""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
from threading import Lock

SESSION_COOKIE = "sjd_admin"
SESSION_TTL = 12 * 60 * 60
FORM_TTL = 2 * 60 * 60


def session_secret() -> str:
    value = os.environ.get("SESSION_SECRET", "").strip()
    if not value:
        raise RuntimeError("SESSION_SECRET est requis")
    return value


def admin_password() -> str:
    value = os.environ.get("ADMIN_PASSWORD", "").strip()
    if not value:
        raise RuntimeError("ADMIN_PASSWORD est requis")
    return value


def sync_token() -> str:
    return os.environ.get("SYNC_TOKEN", "").strip()


def _sign(payload: str, secret: str | None = None) -> str:
    key = (secret or session_secret()).encode("utf-8")
    return hmac.new(key, payload.encode("utf-8"), hashlib.sha256).hexdigest()


def make_token(purpose: str, ttl: int = FORM_TTL, now: int | None = None) -> str:
    issued = int(time.time() if now is None else now)
    payload = f"{purpose}.{issued}.{secrets.token_urlsafe(9)}"
    return f"{payload}.{_sign(payload)}"


def verify_token(purpose: str, token: str, ttl: int = FORM_TTL, now: int | None = None) -> bool:
    if not token:
        return False
    parts = token.split(".")
    if len(parts) != 4:
        return False
    token_purpose, issued_text, nonce, signature = parts
    if token_purpose != purpose or len(nonce) < 8:
        return False
    try:
        issued = int(issued_text)
    except ValueError:
        return False
    if not hmac.compare_digest(signature, _sign(".".join(parts[:3]))):
        return False
    current = int(time.time() if now is None else now)
    return 0 <= current - issued <= ttl


def make_session(now: int | None = None) -> str:
    return make_token("session", SESSION_TTL, now)


def verify_session(token: str, now: int | None = None) -> bool:
    return verify_token("session", token, SESSION_TTL, now)


def check_password(candidate: str) -> bool:
    expected = admin_password()
    return hmac.compare_digest(candidate.encode("utf-8"), expected.encode("utf-8"))


def hash_ip(ip: str) -> str:
    return hashlib.sha256(f"{session_secret()}:{ip}".encode("utf-8")).hexdigest()[:32]


def random_filename(extension: str) -> str:
    stem = secrets.token_hex(8)
    ext = extension.lower().lstrip(".")
    return f"{stem}.{ext}" if ext else stem


class RateLimiter:
    """Limiteur en mémoire, fenêtre glissante. Suffisant pour un conteneur unique."""

    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = {}
        self._lock = Lock()

    def allow(self, key: str, limit: int, window: int, now: float | None = None) -> bool:
        current = time.time() if now is None else now
        with self._lock:
            history = [value for value in self._hits.get(key, []) if current - value < window]
            if len(history) >= limit:
                self._hits[key] = history
                return False
            history.append(current)
            self._hits[key] = history
            if len(self._hits) > 5000:
                for stale in [k for k, v in self._hits.items() if not v or current - v[-1] > window]:
                    self._hits.pop(stale, None)
            return True

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()
