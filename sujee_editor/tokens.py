"""Jetons signés du paquet : session et jeton CSRF.

Même format que le site (purpose.émission.nonce.signature, HMAC-SHA256) pour que
l'éditeur accepte le cookie de session existant et n'invente pas un second
mécanisme d'authentification.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import time

SESSION_PURPOSE = "session"
CSRF_PURPOSE = "editor"
SESSION_TTL = 12 * 60 * 60
SESSION_COOKIE = "sjd_admin"
CSRF_HEADER = "X-SJD-CSRF"


def sign(secret: str, payload: str) -> str:
    return hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()


def make_token(purpose: str, secret: str, ttl: int = SESSION_TTL, now: int | None = None) -> str:
    issued = int(time.time() if now is None else now)
    payload = f"{purpose}.{issued}.{secrets.token_urlsafe(9)}"
    return f"{payload}.{sign(secret, payload)}"


def verify_token(
    token: str, purpose: str, secret: str, ttl: int = SESSION_TTL, now: int | None = None
) -> bool:
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
    if not hmac.compare_digest(signature, sign(secret, ".".join(parts[:3]))):
        return False
    current = int(time.time() if now is None else now)
    return 0 <= current - issued <= ttl


def make_session(secret: str, now: int | None = None) -> str:
    return make_token(SESSION_PURPOSE, secret, SESSION_TTL, now)


def verify_session(token: str, secret: str, now: int | None = None) -> bool:
    return verify_token(token, SESSION_PURPOSE, secret, SESSION_TTL, now)


def make_csrf(secret: str, now: int | None = None) -> str:
    return make_token(CSRF_PURPOSE, secret, SESSION_TTL, now)


def verify_csrf(token: str, secret: str, now: int | None = None) -> bool:
    return verify_token(token, CSRF_PURPOSE, secret, SESSION_TTL, now)
