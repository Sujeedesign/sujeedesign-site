"""API d'écriture du contenu, réservée aux agents autorisés.

Le back office HTML reste la voie de Sujee (session + CSRF). Cette API sert aux
automatisations et aux profils Hermes qui doivent éditer le contenu sans cookie :
authentification par jeton porteur, sur le même stockage et les mêmes garde-fous
que le formulaire (`content_model.validate`, révision avant écriture).
"""

from __future__ import annotations

import hmac
import json
import mimetypes
import re
import sqlite3
import unicodedata
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

from . import catalogue
from . import content as content_store
from . import content_model
from . import repo
from . import security
from .admin import ALLOWED_TYPES, MAX_UPLOAD, _limiter
from .settings import env

router = APIRouter(prefix="/api/v1/admin", tags=["admin-api"])

SLUGS = {"home"}


def _token() -> str:
    return env("SITE_API_TOKEN")


def require_token(request: Request) -> str:
    """Jeton porteur `Authorization: Bearer <SITE_API_TOKEN>`.

    Renvoie le nom de l'auteur déclaré (en-tête `X-Author`), utile dans les
    révisions pour savoir qui a écrit quoi.
    """
    expected = _token()
    if not expected:
        raise HTTPException(status_code=503, detail="API désactivée : SITE_API_TOKEN absent")
    ip = security.client_ip_from(
        request.client.host if request.client else "",
        request.headers.get("x-forwarded-for", ""),
    )
    # Le jeton est long, mais autant couper court au bourrage : 40 essais / 15 min.
    if not _limiter(request).allow("api:" + security.hash_ip(ip), limit=40, window=900):
        raise HTTPException(status_code=429, detail="trop de requêtes, réessaie plus tard")
    header = request.headers.get("authorization", "")
    scheme, _, given = header.partition(" ")
    if scheme.lower() != "bearer" or not hmac.compare_digest(given.strip(), expected):
        raise HTTPException(
            status_code=401,
            detail="jeton absent ou invalide",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # L'auteur est déclaratif (le jeton est partagé) : on le nettoie des
    # caractères de contrôle pour qu'il ne casse ni les journaux ni l'affichage.
    author = "".join(ch for ch in (request.headers.get("x-author") or "api") if ch.isprintable())
    author = " ".join(author.split())[:60]
    return author or "api"


def _conn(request: Request) -> sqlite3.Connection:
    from .db import connect

    return connect(request.app.state.db_path)


def _check_slug(slug: str) -> None:
    if slug not in SLUGS:
        raise HTTPException(status_code=404, detail="contenu inconnu")


@router.get("/status")
def status(request: Request, _: str = Depends(require_token)) -> dict[str, Any]:
    conn = _conn(request)
    try:
        doc = content_store.load_doc(conn, "home")
        publication = content_store.last_publication(conn)
    finally:
        conn.close()
    return {
        "ok": True,
        "content_updated_at": doc["updated_at"],
        "custom": doc["custom"],
        "publish_ready": content_store.publish_ready(),
        "last_publication": (
            {
                "status": publication["status"],
                "detail": publication["detail"],
                "created_at": publication["created_at"],
            }
            if publication
            else None
        ),
    }


@router.get("/content/{slug}")
def read_content(slug: str, request: Request, _: str = Depends(require_token)) -> dict[str, Any]:
    _check_slug(slug)
    conn = _conn(request)
    try:
        document = content_store.load_doc(conn, slug)
    finally:
        conn.close()
    document["schema"] = content_model.SCHEMAS.get(slug, [])
    document["fields"] = content_model.fields_for(slug)
    return document


@router.put("/content/{slug}")
async def write_content(
    slug: str,
    request: Request,
    author: str = Depends(require_token),
) -> JSONResponse:
    """Écrit le contenu d'une page.

    Corps JSON accepté :
      {"data": {...}}             document complet (fusionné avec les défauts)
      {"changes": {"a.b": val}}   modification ciblée par chemin
      {"publish": true}           déclenche le déploiement après enregistrement

    Rien n'est enregistré si la validation échoue : la réponse 422 détaille le
    champ refusé, comme le formulaire du back office.
    """
    _check_slug(slug)
    try:
        payload = await request.json()
    except ValueError:
        raise HTTPException(status_code=400, detail="corps JSON invalide")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="corps JSON attendu : objet")

    conn = _conn(request)
    try:
        current = content_store.load_doc(conn, slug)
        data = current["data"]
        if "data" in payload:
            data = payload["data"]
        if "changes" in payload:
            changes = payload["changes"]
            if not isinstance(changes, dict) or not changes:
                raise HTTPException(status_code=400, detail="« changes » doit être un objet non vide")
            data = json.loads(json.dumps(data, ensure_ascii=False))
            for path, value in changes.items():
                if not isinstance(path, str) or not path.strip():
                    raise HTTPException(status_code=400, detail="chemin de champ invalide")
                content_model.set_path(data, path.strip(), value)
        try:
            content_model.validate(slug, data)
        except content_model.ContentError as exc:
            raise HTTPException(status_code=422, detail=str(exc))

        repo.save_revision(conn, "content", 0, current["data"], "avant édition API", author)
        content_store.save_doc(conn, slug, data, author=author)
        publish = bool(payload.get("publish"))
        result: dict[str, Any] = {"ok": True, "slug": slug, "author": author}
        if publish:
            publication = content_store.request_publish(conn, slug)
            result["publication"] = publication
            result["ok"] = bool(publication.get("ok"))
    finally:
        conn.close()
    return JSONResponse(result)


@router.post("/publish")
def publish(request: Request, _: str = Depends(require_token)) -> JSONResponse:
    conn = _conn(request)
    try:
        result = content_store.request_publish(conn, "home")
    finally:
        conn.close()
    return JSONResponse(result, status_code=200 if result.get("ok") else 409)


# ------------------------------------------------------------------ médiathèque


def _slug_filename(name: str, extension: str) -> str:
    """Nom de fichier stable et lisible : « Elerya 01 » -> « elerya-01.jpg »."""
    ascii_name = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_name).strip("-").lower()
    return f"{(slug or 'media')[:90]}{extension}"


@router.get("/media")
def list_medias(request: Request, limit: int = 400, _: str = Depends(require_token)) -> dict[str, Any]:
    conn = _conn(request)
    try:
        rows = repo.list_medias(conn, limit=max(1, min(limit, 1000)))
        total = conn.execute("SELECT COUNT(*) FROM medias").fetchone()[0]
    finally:
        conn.close()
    return {
        "ok": True,
        "total": int(total),
        "items": [
            {
                "id": row["id"],
                "filename": row["filename"],
                "path": row["path"],
                "alt": row["alt"],
                "caption": row["caption"],
                "mime": row["mime"],
                "width": row["width"],
                "height": row["height"],
                "size": row["size"],
                "created_at": row["created_at"],
            }
            for row in rows
        ],
    }


@router.post("/media")
async def import_media(
    request: Request,
    fichier: UploadFile = File(...),
    alt: str = Form(""),
    caption: str = Form(""),
    credit: str = Form(""),
    filename: str = Form(""),
    overwrite: bool = Form(False),
    author: str = Depends(require_token),
) -> JSONResponse:
    """Importe une image dans la médiathèque du back office.

    Même stockage et mêmes contrôles que le formulaire `/admin/medias`, mais par
    jeton porteur : un nom de fichier stable peut être imposé (utile pour le
    référencement) et un ré-import met à jour la fiche au lieu de dupliquer.
    """
    mime = (fichier.content_type or "").lower()
    extension = ALLOWED_TYPES.get(mime)
    if extension is None:
        guessed = mimetypes.guess_type(fichier.filename or "")[0] or ""
        extension = ALLOWED_TYPES.get(guessed)
        mime = mime or guessed
    if extension is None:
        raise HTTPException(status_code=415, detail="format refusé (JPG, PNG, WebP, AVIF, GIF ou PDF)")

    payload = await fichier.read()
    if not payload:
        raise HTTPException(status_code=400, detail="fichier vide")
    if len(payload) > MAX_UPLOAD:
        raise HTTPException(status_code=413, detail="fichier trop lourd (15 Mo maximum)")
    if not security.sniff_matches(payload, extension):
        raise HTTPException(status_code=415, detail="le contenu du fichier ne correspond pas au format annoncé")

    requested = (filename or fichier.filename or "media").rsplit(".", 1)[0]
    target = _slug_filename(requested, extension)

    folder = Path(request.app.state.media_dir)
    folder.mkdir(parents=True, exist_ok=True)

    conn = _conn(request)
    try:
        existing = repo.get_media_by_filename(conn, target)
        if existing is not None and not overwrite:
            raise HTTPException(
                status_code=409,
                detail=f"un média nommé {target} existe déjà (overwrite=true pour le remplacer)",
            )

        (folder / target).write_bytes(payload)

        width = height = 0
        try:  # optionnel : les dimensions ne bloquent jamais l'import
            from PIL import Image  # type: ignore

            with Image.open(folder / target) as image:
                width, height = image.size
        except Exception:
            pass

        fields = {
            "original_filename": (fichier.filename or target)[:200],
            "path": f"/medias/{target}",
            "alt": alt.strip()[:300],
            "caption": caption.strip()[:300],
            "credit": credit.strip()[:200],
            "mime": mime,
            "width": width,
            "height": height,
            "size": len(payload),
        }
        if existing is not None:
            repo.update_media(conn, int(existing["id"]), fields)
            media_id = int(existing["id"])
            created = False
        else:
            media_id = repo.register_media(conn, {"filename": target, **fields})
            created = True
        conn.commit()
    finally:
        conn.close()

    return JSONResponse(
        {
            "ok": True,
            "created": created,
            "author": author,
            "media": {"id": media_id, "filename": target, "path": f"/medias/{target}", **fields},
        },
        status_code=201 if created else 200,
    )


# -------------------------------------------------------------------- catalogue


def _visuel_error(item: Any, label: str) -> str | None:
    """Contrôle une image du catalogue : `src` et dimensions intrinsèques.

    La vitrine réserve la place de chaque visuel à partir de `width`/`height`
    (aucun décalage de mise en page à l'affichage) : une image sans dimensions
    est refusée plutôt que stockée en 0 × 0, comme pour la couverture portrait.
    """
    if not isinstance(item, dict):
        return f"{label} : objet attendu (src, alt, width, height)"
    if not str(item.get("src") or "").strip():
        return f"{label} : « src » obligatoire"
    for key in ("width", "height"):
        try:
            value = int(str(item.get(key) or "0").strip() or 0)
        except (TypeError, ValueError):
            value = 0
        if value <= 0:
            return f"{label} : « {key} » obligatoire (dimensions intrinsèques)"
    return None


def _check_visuels(payload: dict[str, Any]) -> None:
    """Refuse en 422 toute image incomplète, avant d'écrire quoi que ce soit."""
    images = payload.get("images")
    if images is not None:
        if not isinstance(images, list):
            raise HTTPException(status_code=422, detail="« images » doit être une liste")
        for index, item in enumerate(images, start=1):
            problem = _visuel_error(item, f"Image {index}")
            if problem:
                raise HTTPException(status_code=422, detail=problem)
    for key, label in (("cover", "Couverture"), ("coverPortrait", "Couverture portrait")):
        item = payload.get(key)
        if item is None or item == {} or item == "":
            continue
        problem = _visuel_error(item, label)
        if problem:
            raise HTTPException(status_code=422, detail=problem)


def _lines_value(value: Any) -> str:
    """Liste ou texte multiligne -> texte à une entrée par ligne (forme du formulaire)."""
    if isinstance(value, str):
        return value
    if isinstance(value, (list, tuple)):
        return "\n".join(str(item) for item in value if str(item).strip())
    return ""


def _projet_form(payload: dict[str, Any], existing: dict[str, Any] | None = None) -> dict[str, Any]:
    """Traduit une fiche au format `catalogue_seed.json` en formulaire `save_projet`.

    Le formulaire du back office travaille en texte multiligne et en tuples, la
    fiche publique en JSON structuré. On part de la fiche existante (mise à jour
    partielle sûre : un champ absent n'est pas effacé) puis on écrase avec les
    clés réellement fournies.
    """
    source = existing or {}
    form: dict[str, Any] = {
        "slug": str(source.get("slug") or ""),
        "nom": str(source.get("nom") or ""),
        "client": str(source.get("client") or ""),
        "annee": str(source.get("annee") or ""),
        "ville": str(source.get("ville") or ""),
        "pitch": str(source.get("pitch") or ""),
        "scope": str(source.get("scope") or ""),
        "duree": str(source.get("duree") or ""),
        "ton": str(source.get("ton") or "paper"),
        "statut": str(source.get("statut") or "brouillon"),
        "disciplines": _lines_value(source.get("disciplines") or []),
        "tags": _lines_value(source.get("tags") or []),
        "images": [
            (
                str(item.get("src") or ""),
                str(item.get("alt") or ""),
                item.get("width") or 0,
                item.get("height") or 0,
            )
            for item in source.get("images") or []
            if isinstance(item, dict)
        ],
        "sections": [
            (
                str(section.get("k") or ""),
                str(section.get("label") or ""),
                str(section.get("title") or ""),
                _lines_value(section.get("paragraphs") or []),
                _lines_value(section.get("bullets") or []),
            )
            for section in source.get("sections") or []
            if isinstance(section, dict)
        ],
        "results": [
            (str(item.get("value") or ""), str(item.get("label") or ""))
            for item in source.get("results") or []
            if isinstance(item, dict)
        ],
    }

    cover = source.get("cover")
    if isinstance(cover, dict) and cover.get("src"):
        form.update(
            cover_src=str(cover.get("src") or ""),
            cover_alt=str(cover.get("alt") or ""),
            cover_w=cover.get("width") or 0,
            cover_h=cover.get("height") or 0,
        )
    portrait = source.get("coverPortrait")
    if isinstance(portrait, dict) and portrait.get("src"):
        form.update(
            cover_portrait_src=str(portrait.get("src") or ""),
            cover_portrait_alt=str(portrait.get("alt") or ""),
            cover_portrait_w=portrait.get("width") or 0,
            cover_portrait_h=portrait.get("height") or 0,
        )

    for key in ("slug", "nom", "client", "annee", "ville", "pitch", "scope", "duree"):
        if key in payload:
            form[key] = "" if payload[key] is None else str(payload[key])

    if "ton" in payload:
        ton = str(payload.get("ton") or "").strip()
        if ton not in catalogue.TONS:
            raise HTTPException(status_code=422, detail=f"« ton » inconnu (attendu : {', '.join(catalogue.TONS)})")
        form["ton"] = ton

    if "statut" in payload:
        statut = str(payload.get("statut") or "").strip()
        if statut not in catalogue.STATUTS:
            raise HTTPException(
                status_code=422, detail=f"« statut » inconnu (attendu : {', '.join(catalogue.STATUTS)})"
            )
        form["statut"] = statut

    for key in ("disciplines", "tags"):
        if key in payload:
            form[key] = _lines_value(payload[key])

    if isinstance(payload.get("images"), list):
        form["images"] = [
            (
                str(item.get("src") or ""),
                str(item.get("alt") or ""),
                item.get("width") or 0,
                item.get("height") or 0,
            )
            for item in payload["images"]
        ]

    if isinstance(payload.get("sections"), list):
        sections: list[tuple[str, str, str, str, str]] = []
        for section in payload["sections"]:
            if not isinstance(section, dict):
                raise HTTPException(status_code=422, detail="« sections » : objet attendu par entrée")
            sections.append(
                (
                    str(section.get("k") or ""),
                    str(section.get("label") or ""),
                    str(section.get("title") or ""),
                    _lines_value(section.get("paragraphs") or []),
                    _lines_value(section.get("bullets") or []),
                )
            )
        form["sections"] = sections

    if isinstance(payload.get("results"), list):
        form["results"] = [
            (str(item.get("value") or ""), str(item.get("label") or ""))
            for item in payload["results"]
            if isinstance(item, dict)
        ]

    for key, src_key, alt_key, w_key, h_key, label in (
        ("cover", "cover_src", "cover_alt", "cover_w", "cover_h", "Couverture"),
        ("coverPortrait", "cover_portrait_src", "cover_portrait_alt", "cover_portrait_w", "cover_portrait_h", "Couverture portrait"),
    ):
        if key not in payload:
            continue
        visuel = payload.get(key)
        if visuel is None or visuel == "" or visuel == {}:
            # Couverture explicitement retirée : `save_projet` vide le champ.
            form[src_key] = ""
            continue
        if not isinstance(visuel, dict):
            raise HTTPException(status_code=422, detail=f"{label} : objet attendu (src, alt, width, height)")
        form[src_key] = str(visuel.get("src") or "")
        form[alt_key] = str(visuel.get("alt") or "")
        form[w_key] = visuel.get("width") or 0
        form[h_key] = visuel.get("height") or 0

    return form


def _requested_position(payload: dict[str, Any]) -> int | None:
    """Position d'affichage demandée, ou None si absente (aucune réécriture)."""
    if "position" not in payload or payload["position"] in (None, ""):
        return None
    try:
        return int(str(payload["position"]).strip())
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="« position » doit être un entier")


async def _json_body(request: Request) -> dict[str, Any]:
    try:
        payload = await request.json()
    except ValueError:
        raise HTTPException(status_code=400, detail="corps JSON invalide")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="corps JSON attendu : objet")
    return payload


def _projet_response(
    saved: dict[str, Any] | None, author: str, revalidated: bool, previous_slug: str = ""
) -> dict[str, Any]:
    """Réponse commune à la création et à la mise à jour d'une fiche."""
    if saved is None:
        raise HTTPException(status_code=500, detail="fiche introuvable après écriture")
    return {
        "ok": True,
        "author": author,
        "projet": {
            "id": saved["id"],
            "slug": saved["slug"],
            "nom": saved["nom"],
            "statut": saved["statut"],
            "ton": saved["ton"],
            "images": len(saved["images"]),
            "sections": len(saved["sections"]),
            "position": saved["position"],
        },
        "slug_changed": bool(previous_slug) and saved["slug"] != previous_slug,
        "revalidated": revalidated,
    }


@router.put("/projets/{slug}")
async def write_projet(
    slug: str,
    request: Request,
    author: str = Depends(require_token),
) -> JSONResponse:
    """Met à jour une fiche réalisation par son slug (`PUT /api/v1/admin/projets/{slug}`).

    Même forme qu'une entrée de `app/data/catalogue_seed.json` : `nom`, `client`,
    `annee`, `ville`, `pitch`, `scope`, `duree`, `ton`, `statut`, `disciplines`,
    `tags`, `images[]`, `cover`, `coverPortrait`, `sections[]`, `results[]`,
    `position`. Toute clé absente du corps conserve la valeur en base (mise à
    jour partielle), `"cover": null` ou `{}` retire la couverture.

    Contrôles : 404 si le slug est inconnu, 422 si une image n'a ni `src` ni
    `width`/`height`, si `ton`/`statut` sortent du référentiel, ou si
    `catalogue.save_projet` refuse la fiche (couverture portrait sans
    dimensions par exemple). Une fois la fiche écrite, le cache du site est
    revalidé via `content_store.notify_site("catalogue")`.
    """
    payload = await _json_body(request)
    _check_visuels(payload)
    position = _requested_position(payload)

    conn = _conn(request)
    try:
        existing = catalogue.get_projet_by_slug(conn, slug)
        if existing is None:
            raise HTTPException(status_code=404, detail=f"projet inconnu : {slug}")
        form = _projet_form(payload, existing)
        try:
            projet_id = catalogue.save_projet(conn, form, int(existing["id"]))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        if position is not None:
            conn.execute("UPDATE projets SET position = ? WHERE id = ?", (position, projet_id))
            conn.commit()
        saved = catalogue.get_projet(conn, projet_id)
    finally:
        conn.close()

    revalidated = content_store.notify_site("catalogue")
    return JSONResponse(_projet_response(saved, author, revalidated, previous_slug=slug))


@router.post("/projets")
async def create_projet(
    request: Request,
    author: str = Depends(require_token),
) -> JSONResponse:
    """Crée une fiche réalisation sans toucher au seed (`POST /api/v1/admin/projets`).

    Même corps que la mise à jour, `nom` obligatoire. Le slug est dérivé du nom
    (ou de `slug` s'il est fourni) et dédoublonné par `catalogue.save_projet`.
    Sans `statut`, la fiche naît en `brouillon` : passer `"statut": "publie"`
    pour la mettre en ligne. Le cache du site est revalidé à la création.
    """
    payload = await _json_body(request)
    if not str(payload.get("nom") or "").strip():
        raise HTTPException(status_code=422, detail="« nom » obligatoire pour créer une fiche")
    _check_visuels(payload)
    position = _requested_position(payload)

    conn = _conn(request)
    try:
        form = _projet_form(payload)
        if position is not None:
            form["position"] = position
        try:
            projet_id = catalogue.save_projet(conn, form)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        saved = catalogue.get_projet(conn, projet_id)
    finally:
        conn.close()

    revalidated = content_store.notify_site("catalogue")
    return JSONResponse(_projet_response(saved, author, revalidated), status_code=201)
