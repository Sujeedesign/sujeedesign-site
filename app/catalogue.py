"""Catalogue du back office : projets (études de cas) et prestations.

Décision d'architecture (29/10/2026) : la base SQLite du back office devient la
source de vérité du catalogue. Les pages du site (Réalisations, Services) sont
du contenu structuré, pas du texte éditorial : elles ont besoin de champs
typés, d'images, d'un ordre et d'un état de publication. L'éditeur de contenu
par page (content_docs) reste réservé aux textes de pages ; les projets et les
prestations ont chacun leur table et leur écran d'édition.

La vitrine consomme ce catalogue via `export_site()` : la forme renvoyée est
celle de `web/content/projects.ts` (type `Project`) et de `content/services.json`.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from .ui import slugify

STATUTS = ("brouillon", "publie")
TONS = ("paper", "tint", "dark")

PROJET_FIELDS = (
    "slug",
    "nom",
    "client",
    "annee",
    "ville",
    "pitch",
    "scope",
    "duree",
    "ton",
    "statut",
)
PROJET_JSON = ("disciplines", "tags", "images", "sections", "results")
PRESTATION_FIELDS = ("slug", "nom", "accroche", "description", "prix", "duree", "statut")
PRESTATION_JSON = ("livrables",)


def _text(value: Any) -> str:
    return " ".join(str(value or "").split())


def _block(value: Any) -> str:
    """Texte multiligne : on garde les retours à la ligne, on compacte les espaces."""
    return "\n".join(line.strip() for line in str(value or "").replace("\r\n", "\n").split("\n")).strip()


def _lines(value: str) -> list[str]:
    return [line.strip() for line in str(value or "").replace("\r\n", "\n").split("\n") if line.strip()]


def _json(value: Any) -> Any:
    if isinstance(value, (list, dict)):
        return value
    try:
        parsed = json.loads(value or "[]")
    except (TypeError, ValueError):
        return []
    return parsed if isinstance(parsed, (list, dict)) else []


def _loads(value: Any, default: Any) -> Any:
    parsed = _json(value)
    return parsed if parsed else default


def _iso_day(value: Any) -> str:
    """Jour `AAAA-MM-JJ` d'un horodatage SQLite, ou chaîne vide s'il est illisible.

    `updated_at` est écrit par `datetime('now')`, donc en UTC et à la seconde.
    On n'expose que le jour : c'est la granularité de `lastmod` et cela évite de
    faire croire à une précision que la donnée n'a pas.
    """
    head = str(value or "").strip()[:10]
    if len(head) == 10 and head[4] == "-" and head[7] == "-" and head.replace("-", "").isdigit():
        return head
    return ""


def _int_or_zero(value: Any) -> int:
    try:
        return int(str(value or "0").strip() or 0)
    except (TypeError, ValueError):
        return 0


# ------------------------------------------------------------------ projets


def projet_from_row(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["disciplines"] = _loads(item.get("disciplines"), [])
    item["tags"] = _loads(item.get("tags"), [])
    item["images"] = _loads(item.get("images"), [])
    item["sections"] = _loads(item.get("sections"), [])
    item["results"] = _loads(item.get("results"), [])
    cover = _loads(item.get("cover"), {})
    item["cover"] = cover if isinstance(cover, dict) and cover.get("src") else None
    # Portrait mobile : même forme que `cover`, exposé en camelCase pour la
    # vitrine (`coverPortrait`) et laissé à None s'il est absent.
    portrait = _loads(item.get("cover_portrait"), {})
    item["coverPortrait"] = portrait if isinstance(portrait, dict) and portrait.get("src") else None
    return item


def list_projets(conn: sqlite3.Connection, statut: str = "") -> list[dict[str, Any]]:
    sql = "SELECT * FROM projets"
    params: tuple[Any, ...] = ()
    if statut in STATUTS:
        sql += " WHERE statut = ?"
        params = (statut,)
    sql += " ORDER BY position ASC, id ASC"
    return [projet_from_row(row) for row in conn.execute(sql, params)]


def get_projet(conn: sqlite3.Connection, projet_id: int) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM projets WHERE id = ?", (projet_id,)).fetchone()
    return projet_from_row(row) if row else None


def get_projet_by_slug(conn: sqlite3.Connection, slug: str) -> dict[str, Any] | None:
    """Fiche par slug : l'identifiant stable utilisé par l'API et la vitrine."""
    row = conn.execute("SELECT * FROM projets WHERE slug = ?", (slug,)).fetchone()
    return projet_from_row(row) if row else None


def next_position(conn: sqlite3.Connection, table: str) -> int:
    row = conn.execute(f"SELECT COALESCE(MAX(position), 0) + 10 AS p FROM {table}").fetchone()
    return int(row["p"])


def _unique_slug(conn: sqlite3.Connection, table: str, slug: str, current_id: int | None) -> str:
    base = slug or "sans-titre"
    candidate = base
    index = 2
    while True:
        row = conn.execute(f"SELECT id FROM {table} WHERE slug = ?", (candidate,)).fetchone()
        if row is None or row["id"] == current_id:
            return candidate
        candidate = f"{base}-{index}"
        index += 1


def _existing_rows(conn: sqlite3.Connection, projet_id: int | None, column: str) -> list[Any]:
    """Lignes déjà enregistrées pour une fiche (protection contre un envoi partiel).

    Le formulaire du back office envoie toujours ses répéteurs ; une écriture
    partielle (API, script) peut omettre la clé. Dans ce cas on conserve
    l'existant au lieu de vider les images, sections ou résultats du projet.
    """
    if not projet_id:
        return []
    row = conn.execute(f"SELECT {column} FROM projets WHERE id = ?", (projet_id,)).fetchone()
    value = _loads(row[column] if row else "", [])
    return value if isinstance(value, list) else []


def save_projet(conn: sqlite3.Connection, form: dict[str, Any], projet_id: int | None = None) -> int:
    nom = _text(form.get("nom")) or "Projet sans titre"
    slug = _unique_slug(conn, "projets", slugify(form.get("slug") or nom), projet_id)
    ton = form.get("ton") if form.get("ton") in TONS else "paper"
    statut = form.get("statut") if form.get("statut") in STATUTS else "brouillon"

    if "images" in form:
        image_rows = form.get("images") or []
    else:
        image_rows = [
            (item.get("src", ""), item.get("alt", ""), item.get("width", 0), item.get("height", 0))
            for item in _existing_rows(conn, projet_id, "images")
            if isinstance(item, dict)
        ]

    images: list[dict[str, Any]] = []
    for src, alt, width, height in image_rows:
        if not _text(src):
            continue
        try:
            w = int(width or 0)
        except (TypeError, ValueError):
            w = 0
        try:
            h = int(height or 0)
        except (TypeError, ValueError):
            h = 0
        images.append({"src": _text(src), "alt": _text(alt), "width": w, "height": h})

    if "sections" in form:
        section_rows = form.get("sections") or []
    else:
        section_rows = [
            (
                item.get("k", ""),
                item.get("label", ""),
                item.get("title", ""),
                "\n\n".join(item.get("paragraphs") or []),
                "\n".join(item.get("bullets") or []),
            )
            for item in _existing_rows(conn, projet_id, "sections")
            if isinstance(item, dict)
        ]

    sections: list[dict[str, Any]] = []
    for k, label, title, paragraphs, bullets in section_rows:
        item = {
            "k": _text(k) or str(len(sections) + 1).zfill(2),
            "label": _text(label),
            "title": _text(title),
            "paragraphs": _lines(paragraphs),
        }
        points = _lines(bullets)
        if points:
            item["bullets"] = points
        if item["title"] or item["paragraphs"]:
            sections.append(item)

    cover: dict[str, Any] = {}
    if "cover_src" in form:
        cover_src = _text(form.get("cover_src"))
        if cover_src:
            cover = {
                "src": cover_src,
                "alt": _text(form.get("cover_alt")),
                "width": _int_or_zero(form.get("cover_w")),
                "height": _int_or_zero(form.get("cover_h")),
            }
    elif projet_id:
        row = conn.execute("SELECT cover FROM projets WHERE id = ?", (projet_id,)).fetchone()
        saved = _loads(row["cover"] if row else "", {})
        if isinstance(saved, dict) and saved.get("src"):
            cover = saved

    # Couverture portrait (mobile) : même contrat que `cover`, plus un refus
    # explicite d'un visuel sans dimensions. Sans portrait, la fiche reste
    # paysage : le champ est optionnel.
    cover_portrait: dict[str, Any] = {}
    if "cover_portrait_src" in form:
        portrait_src = _text(form.get("cover_portrait_src"))
        if portrait_src:
            portrait_w = _int_or_zero(form.get("cover_portrait_w"))
            portrait_h = _int_or_zero(form.get("cover_portrait_h"))
            if not portrait_w or not portrait_h:
                raise ValueError(
                    "Couverture portrait : largeur et hauteur sont obligatoires "
                    "(visuel 1080 × 1920)."
                )
            cover_portrait = {
                "src": portrait_src,
                "alt": _text(form.get("cover_portrait_alt")),
                "width": portrait_w,
                "height": portrait_h,
            }
    elif projet_id:
        row = conn.execute("SELECT cover_portrait FROM projets WHERE id = ?", (projet_id,)).fetchone()
        saved_portrait = _loads(row["cover_portrait"] if row else "", {})
        if isinstance(saved_portrait, dict) and saved_portrait.get("src"):
            cover_portrait = saved_portrait

    if "results" in form:
        result_rows = form.get("results") or []
    else:
        result_rows = [
            (item.get("value", ""), item.get("label", ""))
            for item in _existing_rows(conn, projet_id, "results")
            if isinstance(item, dict)
        ]

    results: list[dict[str, str]] = []
    for value, label in result_rows:
        if _text(value) or _text(label):
            results.append({"value": _text(value), "label": _text(label)})

    payload = {
        "slug": slug,
        "nom": nom,
        "client": _text(form.get("client")),
        "annee": _text(form.get("annee")),
        "ville": _text(form.get("ville")),
        "pitch": _block(form.get("pitch")),
        "scope": _block(form.get("scope")),
        "duree": _text(form.get("duree")),
        "ton": ton,
        "statut": statut,
        "disciplines": json.dumps(_lines(form.get("disciplines", "")), ensure_ascii=False),
        "tags": json.dumps(_lines(form.get("tags", "")), ensure_ascii=False),
        "images": json.dumps(images, ensure_ascii=False),
        "cover": json.dumps(cover, ensure_ascii=False),
        "cover_portrait": json.dumps(cover_portrait, ensure_ascii=False),
        "sections": json.dumps(sections, ensure_ascii=False),
        "results": json.dumps(results, ensure_ascii=False),
    }

    if projet_id:
        sets = ", ".join(f"{key} = ?" for key in payload)
        conn.execute(
            f"UPDATE projets SET {sets}, updated_at = datetime('now') WHERE id = ?",
            (*payload.values(), projet_id),
        )
        conn.commit()
        return projet_id

    position = form.get("position")
    payload["position"] = int(position) if str(position or "").strip().isdigit() else next_position(conn, "projets")
    columns = ", ".join(payload)
    marks = ", ".join("?" for _ in payload)
    cur = conn.execute(f"INSERT INTO projets ({columns}) VALUES ({marks})", tuple(payload.values()))
    conn.commit()
    return int(cur.lastrowid)


def delete_projet(conn: sqlite3.Connection, projet_id: int) -> None:
    conn.execute("DELETE FROM projets WHERE id = ?", (projet_id,))
    conn.commit()


def set_projet_statut(conn: sqlite3.Connection, projet_id: int, statut: str) -> None:
    if statut not in STATUTS:
        return
    conn.execute(
        "UPDATE projets SET statut = ?, updated_at = datetime('now') WHERE id = ?",
        (statut, projet_id),
    )
    conn.commit()


def move_projet(conn: sqlite3.Connection, projet_id: int, direction: int) -> None:
    rows = conn.execute("SELECT id, position FROM projets ORDER BY position ASC, id ASC").fetchall()
    ids = [row["id"] for row in rows]
    if projet_id not in ids:
        return
    index = ids.index(projet_id)
    target = index + direction
    if target < 0 or target >= len(ids):
        return
    ids[index], ids[target] = ids[target], ids[index]
    for offset, row_id in enumerate(ids):
        conn.execute("UPDATE projets SET position = ? WHERE id = ?", ((offset + 1) * 10, row_id))
    conn.commit()


# -------------------------------------------------------------- prestations


def prestation_from_row(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["livrables"] = _loads(item.get("livrables"), [])
    return item


def list_prestations(conn: sqlite3.Connection, statut: str = "") -> list[dict[str, Any]]:
    sql = "SELECT * FROM prestations"
    params: tuple[Any, ...] = ()
    if statut in STATUTS:
        sql += " WHERE statut = ?"
        params = (statut,)
    sql += " ORDER BY position ASC, id ASC"
    return [prestation_from_row(row) for row in conn.execute(sql, params)]


def get_prestation(conn: sqlite3.Connection, prestation_id: int) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM prestations WHERE id = ?", (prestation_id,)).fetchone()
    return prestation_from_row(row) if row else None


def save_prestation(conn: sqlite3.Connection, form: dict[str, Any], prestation_id: int | None = None) -> int:
    nom = _text(form.get("nom")) or "Prestation sans titre"
    slug = _unique_slug(conn, "prestations", slugify(form.get("slug") or nom), prestation_id)
    statut = form.get("statut") if form.get("statut") in STATUTS else "brouillon"
    payload = {
        "slug": slug,
        "nom": nom,
        "accroche": _block(form.get("accroche")),
        "description": _block(form.get("description")),
        "prix": _text(form.get("prix")),
        "duree": _text(form.get("duree")),
        "statut": statut,
        "livrables": json.dumps(_lines(form.get("livrables", "")), ensure_ascii=False),
    }
    if prestation_id:
        sets = ", ".join(f"{key} = ?" for key in payload)
        conn.execute(
            f"UPDATE prestations SET {sets}, updated_at = datetime('now') WHERE id = ?",
            (*payload.values(), prestation_id),
        )
        conn.commit()
        return prestation_id
    position = form.get("position")
    payload["position"] = int(position) if str(position or "").strip().isdigit() else next_position(conn, "prestations")
    columns = ", ".join(payload)
    marks = ", ".join("?" for _ in payload)
    cur = conn.execute(f"INSERT INTO prestations ({columns}) VALUES ({marks})", tuple(payload.values()))
    conn.commit()
    return int(cur.lastrowid)


def delete_prestation(conn: sqlite3.Connection, prestation_id: int) -> None:
    conn.execute("DELETE FROM prestations WHERE id = ?", (prestation_id,))
    conn.commit()


def set_prestation_statut(conn: sqlite3.Connection, prestation_id: int, statut: str) -> None:
    if statut not in STATUTS:
        return
    conn.execute(
        "UPDATE prestations SET statut = ?, updated_at = datetime('now') WHERE id = ?",
        (statut, prestation_id),
    )
    conn.commit()


def move_prestation(conn: sqlite3.Connection, prestation_id: int, direction: int) -> None:
    rows = conn.execute("SELECT id, position FROM prestations ORDER BY position ASC, id ASC").fetchall()
    ids = [row["id"] for row in rows]
    if prestation_id not in ids:
        return
    index = ids.index(prestation_id)
    target = index + direction
    if target < 0 or target >= len(ids):
        return
    ids[index], ids[target] = ids[target], ids[index]
    for offset, row_id in enumerate(ids):
        conn.execute("UPDATE prestations SET position = ? WHERE id = ?", ((offset + 1) * 10, row_id))
    conn.commit()


# ------------------------------------------------------------------ export


def export_site(conn: sqlite3.Connection) -> dict[str, Any]:
    """Catalogue publié, à la forme attendue par la vitrine Next."""
    projets = []
    for index, item in enumerate(list_projets(conn, "publie"), start=1):
        projet: dict[str, Any] = {
            "slug": item["slug"],
            "index": str(index).zfill(2),
            "name": item["nom"],
            "client": item["client"],
            "disciplines": item["disciplines"],
            "pitch": item["pitch"],
            "scope": item["scope"],
            "sections": item["sections"],
            "images": item["images"],
            "tags": item["tags"],
            "tone": item["ton"],
        }
        # Date éditoriale de la fiche : `updated_at`, réécrit à chaque
        # enregistrement depuis l'admin. La vitrine en fait le `lastmod` du plan
        # de site ; clé absente (fiche importée sans horodatage), elle retombe
        # sur sa propre date de repli.
        updated = _iso_day(item.get("updated_at"))
        if updated:
            projet["updated_at"] = updated
        for source, target in (("annee", "year"), ("ville", "city"), ("duree", "duration")):
            if item[source]:
                projet[target] = item[source]
        if item["results"]:
            projet["results"] = item["results"]
        if item.get("cover"):
            projet["cover"] = item["cover"]
        elif item["images"]:
            projet["cover"] = item["images"][0]
        # Portrait mobile : la vitrine le sert sous 720 px. Absent, aucune clé
        # n'est émise et le rendu paysage reste inchangé.
        if item.get("coverPortrait"):
            projet["coverPortrait"] = item["coverPortrait"]
        projets.append(projet)

    services = []
    for item in list_prestations(conn, "publie"):
        service: dict[str, Any] = {
            "slug": item["slug"],
            "name": item["nom"],
            "pitch": item["accroche"],
            "description": item["description"],
            "deliverables": item["livrables"],
        }
        for source, target in (("prix", "price"), ("duree", "duration")):
            if item[source]:
                service[target] = item[source]
        services.append(service)

    return {"projects": projets, "services": services}


def export_json(conn: sqlite3.Connection) -> str:
    return json.dumps(export_site(conn), ensure_ascii=False, indent=2)


# ------------------------------------------------------------------ amorçage
#
# Bascule du 2 novembre 2026 : le site lisait `web/content/projects.ts`, la base
# devient la source de vérité. Pour ne rien perdre, les fiches historiques sont
# livrées dans `data/catalogue_seed.json` et insérées au démarrage **si et
# seulement si** leur slug n'existe pas déjà. Une fiche créée ou modifiée dans
# l'admin n'est donc jamais écrasée, et supprimer une fiche la fait disparaître
# pour de bon (le seed ne la ressuscite pas).
SEED_PATH = Path(__file__).resolve().parent / "data" / "catalogue_seed.json"


def seed_from_file(conn: sqlite3.Connection, path: Path | None = None) -> int:
    """Reprend les fiches historiques du site, une seule fois par slug.

    Chaque slug repris est noté dans `catalogue_seeded` : si Sujee supprime une
    fiche dans l'admin, elle ne réapparaît pas au redémarrage suivant.
    """
    source = path or SEED_PATH
    if not source.exists():
        return 0
    payload = json.loads(source.read_text(encoding="utf-8"))
    rows = payload.get("projets") or []
    added = 0
    for row in rows:
        slug = _text(row.get("slug"))
        if not slug:
            continue
        if conn.execute("SELECT 1 FROM catalogue_seeded WHERE slug = ?", (slug,)).fetchone():
            continue
        if conn.execute("SELECT 1 FROM projets WHERE slug = ?", (slug,)).fetchone():
            conn.execute("INSERT OR IGNORE INTO catalogue_seeded (slug) VALUES (?)", (slug,))
            continue
        conn.execute(
            """
            INSERT INTO projets (
              slug, nom, client, annee, ville, pitch, scope, duree, ton,
              disciplines, tags, images, cover, cover_portrait, sections, results, statut, position
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'publie', ?)
            """,
            (
                slug,
                _text(row.get("nom")),
                _text(row.get("client")),
                _text(row.get("annee")),
                _text(row.get("ville")),
                _text(row.get("pitch")),
                _text(row.get("scope")),
                _text(row.get("duree")),
                _text(row.get("ton")) or "paper",
                json.dumps(row.get("disciplines") or [], ensure_ascii=False),
                json.dumps(row.get("tags") or [], ensure_ascii=False),
                json.dumps(row.get("images") or [], ensure_ascii=False),
                json.dumps(row.get("cover") or {}, ensure_ascii=False),
                json.dumps(row.get("coverPortrait") or {}, ensure_ascii=False),
                json.dumps(row.get("sections") or [], ensure_ascii=False),
                json.dumps(row.get("results") or [], ensure_ascii=False),
                int(row.get("position") or 0),
            ),
        )
        conn.execute("INSERT OR IGNORE INTO catalogue_seeded (slug) VALUES (?)", (slug,))
        added += 1

    # Prestations : reprise des cinq offres affichées en dur sur le site. Même
    # règle d'insertion seule, avec sa propre pierre tombale.
    for row in payload.get("prestations") or []:
        slug = _text(row.get("slug"))
        if not slug:
            continue
        if conn.execute("SELECT 1 FROM prestations_seeded WHERE slug = ?", (slug,)).fetchone():
            continue
        if conn.execute("SELECT 1 FROM prestations WHERE slug = ?", (slug,)).fetchone():
            conn.execute("INSERT OR IGNORE INTO prestations_seeded (slug) VALUES (?)", (slug,))
            continue
        conn.execute(
            """
            INSERT INTO prestations (
              slug, nom, accroche, description, prix, duree, livrables,
              statut, position
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'publie', ?)
            """,
            (
                slug,
                _text(row.get("nom")),
                _text(row.get("accroche")),
                _text(row.get("description")),
                _text(row.get("prix")),
                _text(row.get("duree")),
                json.dumps(row.get("livrables") or [], ensure_ascii=False),
                int(row.get("position") or 0),
            ),
        )
        conn.execute("INSERT OR IGNORE INTO prestations_seeded (slug) VALUES (?)", (slug,))
        added += 1

    if added:
        conn.commit()
    return added
