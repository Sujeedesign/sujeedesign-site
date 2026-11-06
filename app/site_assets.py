"""Inventaire des images réellement servies par la vitrine.

Le back office ne connaît que ses propres téléversements (`/data/medias`).
La vitrine sert aussi les visuels versionnés dans le dépôt Next
(`/assets/img/...`) : ils n'apparaissent donc jamais dans la médiathèque.
Ce module parcourt le sitemap public, relève les images de chaque page, puis
confronte le résultat aux fichiers présents sur le disque et aux lignes de la
base. Tout est en lecture seule sauf `reindex_orphans` (réparation explicite).
"""

from __future__ import annotations

import json
import re
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

import httpx

from . import repo, settings

CACHE_TTL = 6 * 3600  # secondes
IMAGE_EXT = (".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".svg")
LOC_RE = re.compile(r"<loc>\s*(.*?)\s*</loc>", re.I | re.S)
SRC_RE = re.compile(r"<img[^>]+src=\"([^\"]+)\"", re.I)
SRCSET_RE = re.compile(r"srcset=\"([^\"]+)\"", re.I)
CSS_URL_RE = re.compile(r"url\((['\"]?)(/assets/[^)'\"]+)\1\)", re.I)
NEXT_IMG_RE = re.compile(r"/_next/image\?url=([^&\"']+)")


def _cache_path() -> Path:
    return settings.data_dir() / "site_images.json"


def _is_image(url: str) -> bool:
    clean = url.split("?")[0].lower()
    return clean.endswith(IMAGE_EXT)


def _normalise(src: str, base: str) -> str:
    src = src.strip()
    if not src or src.startswith("data:"):
        return ""
    match = NEXT_IMG_RE.search(src)
    if match:
        src = unquote(match.group(1))
    if src.startswith("http://") or src.startswith("https://"):
        path = urlparse(src).path
        return path
    if src.startswith("//"):
        return urlparse("https:" + src).path
    if not src.startswith("/"):
        src = "/" + src
    return src.split("?")[0]


def _fetch_images(client: httpx.Client, url: str) -> list[str]:
    try:
        response = client.get(url)
        response.raise_for_status()
    except httpx.HTTPError:
        return []
    html = response.text
    found: list[str] = []
    for raw in SRC_RE.findall(html):
        found.append(_normalise(raw, url))
    for raw in SRCSET_RE.findall(html):
        for part in raw.split(","):
            found.append(_normalise(part.strip().split(" ")[0], url))
    for _quote, raw in CSS_URL_RE.findall(html):
        found.append(_normalise(raw, url))
    return [item for item in found if item and _is_image(item)]


def _head_ok(client: httpx.Client, base: str, path: str) -> bool:
    try:
        response = client.head(base + path, follow_redirects=True)
        return response.status_code == 200
    except httpx.HTTPError:
        return False


def cached() -> dict[str, Any] | None:
    """Retourne le dernier scan en cache, sans relancer d'analyse."""
    path = _cache_path()
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def scan(force: bool = False) -> dict[str, Any]:
    """Relève les images du site public, avec un cache disque de 6 h."""
    path = _cache_path()
    if not force and path.exists():
        try:
            cached = json.loads(path.read_text(encoding="utf-8"))
            if time.time() - float(cached.get("checked_at") or 0) < CACHE_TTL:
                return cached
        except (OSError, ValueError, TypeError):
            pass

    base = settings.public_base_url()
    pages: list[dict[str, Any]] = []
    with httpx.Client(timeout=20.0, follow_redirects=True, headers={"User-Agent": "sujeedesign-backoffice/1.0"}) as client:
        try:
            sitemap = client.get(base + "/sitemap.xml")
            sitemap.raise_for_status()
            urls = LOC_RE.findall(sitemap.text)
        except httpx.HTTPError as exc:
            return {"checked_at": time.time(), "error": f"sitemap inaccessible : {exc}", "pages": [], "images": []}

        def work(url: str) -> dict[str, Any]:
            return {"url": url.replace(base, "") or "/", "images": sorted(set(_fetch_images(client, url)))}

        with ThreadPoolExecutor(max_workers=6) as pool:
            pages = list(pool.map(work, urls))
        pages.sort(key=lambda item: item["url"])

        assets = sorted({img for page in pages for img in page["images"] if img.startswith("/assets/")})
        missing_assets: list[str] = []
        if assets:
            with ThreadPoolExecutor(max_workers=10) as pool:
                checks = list(pool.map(lambda p: (p, _head_ok(client, base, p)), assets))
            missing_assets = [path_ for path_, ok in checks if not ok]

    data = {
        "checked_at": time.time(),
        "base": base,
        "pages": pages,
        "images": sorted({img for page in pages for img in page["images"]}),
        "missing_assets": missing_assets,
    }
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    except OSError:
        pass
    return data


def _servi_en_ligne(base: str, src: str) -> bool:
    """Vérifie qu'une image répond vraiment sur la vitrine.

    Le disque local ne suffit pas : un back office restauré ailleurs peut très
    bien servir des fichiers qu'il n'a pas sous la main. On interroge donc le
    site quand le fichier local manque, pour ne pas crier « introuvable » à
    tort.
    """
    try:
        response = httpx.head(base.rstrip("/") + src, timeout=8, follow_redirects=True)
        return response.status_code < 400
    except httpx.HTTPError:
        return False


def inventory(conn: sqlite3.Connection, force: bool = False) -> dict[str, Any]:
    """Croise le scan du site avec la base et le dossier d'upload."""
    data = scan(force=force)
    media_dir = settings.media_dir()
    known = {row["filename"]: row for row in repo.list_medias(conn, limit=5000)}
    usage: dict[str, list[str]] = {}
    for page in data.get("pages", []):
        for img in page["images"]:
            usage.setdefault(img, []).append(page["url"])

    items: list[dict[str, Any]] = []
    counts = {"media": 0, "hors_media": 0, "statique": 0, "manquant": 0, "externe": 0}
    for src in data.get("images", []):
        item = {"src": src, "pages": usage.get(src, []), "kind": "", "exists": True, "label": ""}
        if src.startswith("/medias/"):
            filename = src.rsplit("/", 1)[-1]
            on_disk = (media_dir / filename).is_file() or _servi_en_ligne(
                data.get("base") or settings.public_base_url(), src
            )
            if not on_disk:
                item.update(kind="manquant", exists=False, label="fichier introuvable")
                counts["manquant"] += 1
            elif filename not in known:
                item.update(kind="hors_media", label="fichier présent, absent de la médiathèque")
                counts["hors_media"] += 1
            else:
                item.update(kind="media", label="médiathèque")
                counts["media"] += 1
        elif src.startswith("/assets/"):
            missing = src in set(data.get("missing_assets") or [])
            item.update(kind="statique", exists=not missing, label="fichier du dépôt" if not missing else "introuvable sur le site")
            counts["statique"] += 1
        else:
            item.update(kind="externe", label="image externe")
            counts["externe"] += 1
        items.append(item)

    orphans = []
    for filename, row in known.items():
        if f"/medias/{filename}" not in usage and (media_dir / filename).is_file():
            orphans.append({"filename": filename, "id": row["id"], "alt": row["alt"] or row["original_filename"] or ""})

    label = ""
    if data.get("checked_at"):
        from datetime import datetime

        label = datetime.fromtimestamp(float(data["checked_at"])).strftime("%d/%m/%Y %H:%M")

    return {
        "checked_at": data.get("checked_at"),
        "checked_at_label": label,
        "error": data.get("error", ""),
        "pages": data.get("pages", []),
        "items": items,
        "counts": counts,
        "total": len(items),
        "orphans": orphans,
    }


def reindex_orphans(conn: sqlite3.Connection) -> int:
    """Crée les lignes manquantes pour les fichiers /medias utilisés par le site."""
    data = inventory(conn)
    added = 0
    media_dir = settings.media_dir()
    import mimetypes

    for item in data["items"]:
        if item["kind"] != "hors_media":
            continue
        filename = item["src"].rsplit("/", 1)[-1]
        file_path = media_dir / filename
        if not file_path.is_file():
            continue
        mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        repo.register_media(
            conn,
            {
                "filename": filename,
                "original_filename": filename,
                "path": f"/medias/{filename}",
                "alt": "",
                "mime": mime,
                "size": file_path.stat().st_size,
            },
        )
        added += 1
    if added:
        conn.commit()
    return added
