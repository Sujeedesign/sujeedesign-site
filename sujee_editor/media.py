"""Safe display metadata for uploaded media; never use it as a storage path."""

from __future__ import annotations

import unicodedata


_INVALID_FILENAME_CHARS = set('<>:"/\\|?*')


def safe_original_filename(value: str | None) -> str:
    """Keep a safe basename for display while storage uses a random filename."""
    raw = str(value or "").replace("\\", "/")
    basename = raw.rsplit("/", 1)[-1]
    normalized = unicodedata.normalize("NFC", basename)
    cleaned = "".join(
        "-" if character in _INVALID_FILENAME_CHARS else character
        for character in normalized
        if character.isprintable() and character not in "\x00\r\n"
    ).strip(" .")
    if not cleaned:
        cleaned = "fichier"
    if len(cleaned) > 180:
        suffix = cleaned.rsplit(".", 1)[-1] if "." in cleaned else ""
        ext = f".{suffix}" if suffix and len(suffix) <= 12 else ""
        stem = cleaned[:-len(ext)] if ext else cleaned
        cleaned = stem[: 180 - len(ext)].rstrip(" .") + ext
    return cleaned or "fichier"
