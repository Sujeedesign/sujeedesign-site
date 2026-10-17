"""Store de l'éditeur : brouillon, publication, révisions.

Contrat de contenu conservé : un brouillon vit dans `sections.draft`, les
données publiées dans `sections.data`, et la publication recopie l'un dans
l'autre en une transaction, en laissant une révision au format de
`app.repo.snapshot_page` (`{"page": {...}, "sections": [{...}]}`).
"""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass, field as dataclass_field
from pathlib import Path
from typing import Any, Iterable, Mapping

from ..blocks import Block, ValidationError, default_data, validate_data, validate_field

READY_TABLES = ("pages", "sections", "medias", "revisions")


class StoreError(RuntimeError):
    """Erreur de base du store."""


class StoreNotReady(StoreError):
    """La base du site n'a pas les tables attendues."""


class UnknownPage(StoreError):
    pass


class UnknownSection(StoreError):
    pass


class UnknownRevision(StoreError):
    pass


class VersionConflict(StoreError):
    """Une écriture annonce une version de brouillon dépassée."""

    def __init__(self, current: int) -> None:
        super().__init__(f"version de brouillon dépassée (courante : {current})")
        self.current = int(current)


class ValidationFailed(StoreError):
    def __init__(self, errors: Iterable[ValidationError]) -> None:
        self.errors = list(errors)
        super().__init__("; ".join(f"{error.field}: {error.rule}" for error in self.errors) or "validation refusée")


@dataclass
class SectionState:
    id: int
    page_id: int
    type: str
    variant: str
    label: str
    visible: bool
    position: int
    data: dict[str, Any]
    draft: dict[str, Any] | None
    draft_version: int

    @property
    def revised(self) -> bool:
        return self.draft is not None

    @property
    def effective(self) -> dict[str, Any]:
        return self.draft if self.draft is not None else self.data

    def serialize(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "page_id": self.page_id,
            "type": self.type,
            "variant": self.variant,
            "label": self.label,
            "visible": self.visible,
            "position": self.position,
            "data": self.data,
            "draft": self.draft,
            "effective": self.effective,
            "revised": self.revised,
            "draft_version": self.draft_version,
        }


@dataclass
class PageState:
    page: dict[str, Any]
    sections: list[SectionState] = dataclass_field(default_factory=list)
    revisions: list[dict[str, Any]] = dataclass_field(default_factory=list)

    def serialize(self) -> dict[str, Any]:
        return {
            "page": self.page,
            "sections": [section.serialize() for section in self.sections],
            "revisions": self.revisions,
        }


def _load_json(value: Any, default: Any = None) -> Any:
    if value in (None, ""):
        return {} if default is None else default
    if isinstance(value, (dict, list)):
        return value
    try:
        parsed = json.loads(value)
    except (TypeError, ValueError):
        return {} if default is None else default
    return parsed


def _dump_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


class Store:
    """Lecture et écriture du contenu pour l'éditeur. Ne connaît aucun gabarit."""

    def __init__(self, db_path: str | Path, blocks: Mapping[str, Block]) -> None:
        self.db_path = str(db_path)
        self.blocks = dict(blocks)

    # ---------------------------------------------------------------- base

    def connect(self) -> sqlite3.Connection:
        target = Path(self.db_path)
        if str(target.parent) not in ("", "."):
            target.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(target), timeout=15)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA busy_timeout = 8000")
        return conn

    def require_tables(self, conn: sqlite3.Connection) -> None:
        names = {row["name"] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        missing = [table for table in READY_TABLES if table not in names]
        if missing:
            raise StoreNotReady("tables manquantes dans la base du site : " + ", ".join(missing))

    # -------------------------------------------------------------- lecture

    def block_for(self, type_: str) -> Block:
        block = self.blocks.get(type_)
        if block is None:
            raise ValidationFailed([ValidationError("", "unknown_block", type_)])
        return block

    def _row(self, conn: sqlite3.Connection, section_id: int, page_id: int | None = None) -> sqlite3.Row:
        if not isinstance(section_id, int) or isinstance(section_id, bool):
            raise UnknownSection(str(section_id))
        row = conn.execute("SELECT * FROM sections WHERE id = ?", (int(section_id),)).fetchone()
        if row is None or (page_id is not None and int(row["page_id"]) != int(page_id)):
            raise UnknownSection(str(section_id))
        return row

    def section(self, conn: sqlite3.Connection, section_id: int, page_id: int | None = None) -> SectionState:
        return self._state(self._row(conn, section_id, page_id))

    def _state(self, row: sqlite3.Row) -> SectionState:
        draft_raw = row["draft"] if "draft" in row.keys() else None
        return SectionState(
            id=int(row["id"]),
            page_id=int(row["page_id"]),
            type=str(row["type"]),
            variant=str(row["variant"] or ""),
            label=str(row["label"] or ""),
            visible=bool(row["visible"]),
            position=int(row["position"] or 0),
            data=_load_json(row["data"]),
            draft=_load_json(draft_raw) if draft_raw not in (None, "") else None,
            draft_version=int(row["draft_version"] if "draft_version" in row.keys() else 0),
        )

    def page_state(self, conn: sqlite3.Connection, page_id: int) -> PageState:
        page = conn.execute("SELECT * FROM pages WHERE id = ?", (int(page_id),)).fetchone()
        if page is None:
            raise UnknownPage(str(page_id))
        rows = conn.execute(
            "SELECT * FROM sections WHERE page_id = ? ORDER BY position, id", (int(page_id),)
        ).fetchall()
        return PageState(
            page={key: page[key] for key in page.keys()},
            sections=[self._state(row) for row in rows],
            revisions=self.revisions(conn, page_id),
        )

    def effective_data(self, section: SectionState | Mapping[str, Any] | sqlite3.Row) -> dict[str, Any]:
        """Données visibles en édition : le brouillon s'il existe, sinon le publié."""
        if isinstance(section, SectionState):
            return section.effective
        if isinstance(section, sqlite3.Row):
            section = {key: section[key] for key in section.keys()}
        draft = section.get("draft")
        if draft not in (None, ""):
            return _load_json(draft)
        return _load_json(section.get("data"))

    # ------------------------------------------------------------- écriture

    def write_field(
        self,
        conn: sqlite3.Connection,
        *,
        section_id: int,
        field: str,
        value: Any,
        expected_version: int,
        page_id: int | None = None,
    ) -> SectionState:
        """Écrit un seul champ dans le brouillon, sans toucher aux données publiées."""
        row = self._row(conn, section_id, page_id)
        state = self._state(row)
        block = self.block_for(state.type)
        errors = validate_field(block, field, value)
        if errors:
            raise ValidationFailed(errors)
        data = dict(self.effective_data(state))
        data[field] = value
        return self._write(conn, row, data, expected_version)

    def write_draft(
        self,
        conn: sqlite3.Connection,
        *,
        section_id: int,
        data: Mapping[str, Any],
        expected_version: int,
        page_id: int | None = None,
    ) -> SectionState:
        """Écrit un brouillon complet (listes, plusieurs champs d'un coup)."""
        row = self._row(conn, section_id, page_id)
        state = self._state(row)
        block = self.block_for(state.type)
        merged = dict(self.effective_data(state))
        merged.update(dict(data))
        errors = validate_data(block, merged)
        if errors:
            raise ValidationFailed(errors)
        return self._write(conn, row, merged, expected_version)

    def _write(
        self, conn: sqlite3.Connection, row: sqlite3.Row, data: dict[str, Any], expected_version: int
    ) -> SectionState:
        current = int(row["draft_version"] if "draft_version" in row.keys() else 0)
        cursor = conn.execute(
            "UPDATE sections SET draft = ?, draft_version = draft_version + 1, updated_at = datetime('now') "
            "WHERE id = ? AND draft_version = ?",
            (_dump_json(data), int(row["id"]), int(expected_version)),
        )
        if cursor.rowcount == 0:
            conn.rollback()
            raise VersionConflict(current)
        conn.commit()
        return self.section(conn, int(row["id"]))

    def add_section(
        self,
        conn: sqlite3.Connection,
        *,
        page_id: int,
        type: str,
        variant: str = "",
        position: int | None = None,
        data: Mapping[str, Any] | None = None,
    ) -> SectionState:
        """Ajoute un bloc jamais publié : masqué en public, son contenu part en brouillon."""
        block = self.block_for(type)
        page = conn.execute("SELECT id FROM pages WHERE id = ?", (int(page_id),)).fetchone()
        if page is None:
            raise UnknownPage(str(page_id))
        if block.variants and variant and variant not in block.variants:
            raise ValidationFailed([ValidationError("_variant", "bad_variant", variant)])
        if position is None:
            row = conn.execute(
                "SELECT COALESCE(MAX(position), -1) AS p FROM sections WHERE page_id = ?", (int(page_id),)
            ).fetchone()
            position = int(row["p"]) + 1
        payload = default_data(block)
        payload.update(dict(data or {}))
        if block.variants and "_variant" not in payload:
            payload["_variant"] = variant or next(iter(block.variants))
        errors = validate_data(block, payload)
        if errors:
            raise ValidationFailed(errors)
        cursor = conn.execute(
            "INSERT INTO sections (page_id, position, type, variant, label, visible, data, draft, draft_version) "
            "VALUES (?, ?, ?, ?, ?, 0, '{}', ?, 1)",
            (int(page_id), int(position), type, variant or "", block.label, _dump_json(payload)),
        )
        new_id = int(cursor.lastrowid or 0)
        self._shift(conn, int(page_id), new_id, int(position))
        conn.commit()
        return self.section(conn, new_id)

    def _shift(self, conn: sqlite3.Connection, page_id: int, section_id: int, position: int) -> None:
        """Fait de la place à la position demandée (les suivants descendent)."""
        rows = conn.execute(
            "SELECT id, position FROM sections WHERE page_id = ? AND id != ? ORDER BY position, id",
            (int(page_id), int(section_id)),
        ).fetchall()
        ordered = [int(row["id"]) for row in rows]
        ordered.insert(max(0, min(int(position), len(ordered))), int(section_id))
        for index, current in enumerate(ordered):
            conn.execute("UPDATE sections SET position = ? WHERE id = ?", (index, current))

    def move_section(
        self, conn: sqlite3.Connection, *, section_id: int, offset: int, page_id: int | None = None
    ) -> None:
        row = self._row(conn, section_id, page_id)
        rows = conn.execute(
            "SELECT id FROM sections WHERE page_id = ? ORDER BY position, id", (int(row["page_id"]),)
        ).fetchall()
        order = [int(item["id"]) for item in rows]
        current = order.index(int(row["id"]))
        target = max(0, min(len(order) - 1, current + (1 if offset > 0 else -1)))
        if target != current:
            order.insert(target, order.pop(current))
            for index, item in enumerate(order):
                conn.execute("UPDATE sections SET position = ? WHERE id = ?", (index, item))
            conn.commit()

    def toggle_section(
        self, conn: sqlite3.Connection, *, section_id: int, page_id: int | None = None
    ) -> SectionState:
        row = self._row(conn, section_id, page_id)
        conn.execute(
            "UPDATE sections SET visible = CASE visible WHEN 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ?",
            (int(row["id"]),),
        )
        conn.commit()
        return self.section(conn, int(row["id"]))

    def duplicate_section(
        self, conn: sqlite3.Connection, *, section_id: int, page_id: int | None = None
    ) -> SectionState:
        """Duplique un bloc : la copie naît masquée et en brouillon, comme un ajout."""
        row = self._row(conn, section_id, page_id)
        state = self._state(row)
        return self.add_section(
            conn,
            page_id=state.page_id,
            type=state.type,
            variant=state.variant,
            position=state.position + 1,
            data=dict(state.effective),
        )

    def delete_section(
        self, conn: sqlite3.Connection, *, section_id: int, page_id: int | None = None
    ) -> None:
        row = self._row(conn, section_id, page_id)
        page_id = int(row["page_id"])
        conn.execute("DELETE FROM sections WHERE id = ?", (int(row["id"]),))
        rows = conn.execute(
            "SELECT id FROM sections WHERE page_id = ? ORDER BY position, id", (page_id,)
        ).fetchall()
        for index, item in enumerate(rows):
            conn.execute("UPDATE sections SET position = ? WHERE id = ?", (index, int(item["id"])))
        conn.commit()

    # ----------------------------------------------- publication, révisions

    def publish(self, conn: sqlite3.Connection, *, page_id: int, author: str = "sujee") -> dict[str, Any]:
        """Recopie tout le brouillon de la page, crée une révision, vide les brouillons."""
        state = self.page_state(conn, page_id)
        snapshot = {
            "page": {key: value for key, value in state.page.items()},
            "sections": [self._snapshot_row(section) for section in state.sections],
        }
        try:
            conn.execute("BEGIN")
            for section in state.sections:
                if not section.revised:
                    continue
                published = section.draft or {}
                cursor = conn.execute(
                    "UPDATE sections SET data = ?, draft = NULL, draft_version = draft_version + 1, "
                    "visible = CASE WHEN data IN ('', '{}') THEN 1 ELSE visible END, "
                    "updated_at = datetime('now') WHERE id = ? AND draft_version = ?",
                    (_dump_json(published), section.id, section.draft_version),
                )
                if cursor.rowcount == 0:
                    raise VersionConflict(section.draft_version)
            cursor = conn.execute(
                "INSERT INTO revisions (entity_type, entity_id, snapshot, note, author) VALUES (?, ?, ?, ?, ?)",
                ("page", int(page_id), json.dumps(snapshot, ensure_ascii=False, default=str), "Publication", author),
            )
            conn.execute("UPDATE pages SET updated_at = datetime('now') WHERE id = ?", (int(page_id),))
            revision = self._bump_content_revision(conn)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        revision_id = int(cursor.lastrowid or 0)
        row = conn.execute("SELECT created_at FROM revisions WHERE id = ?", (revision_id,)).fetchone()
        fresh = self.page_state(conn, page_id)
        return {
            "revision_id": revision_id,
            "published_at": row["created_at"] if row else "",
            "content_revision": revision,
            "sections": [section.serialize() for section in fresh.sections],
        }

    def _bump_content_revision(self, conn: sqlite3.Connection) -> str:
        row = conn.execute("SELECT value FROM _meta WHERE key = 'content_revision'").fetchone()
        current = int(row["value"]) if row else 1
        conn.execute(
            "INSERT INTO _meta (key, value) VALUES ('content_revision', ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (str(current + 1),),
        )
        return str(current + 1)

    def _snapshot_row(self, section: SectionState) -> dict[str, Any]:
        return {
            "id": section.id,
            "page_id": section.page_id,
            "position": section.position,
            "type": section.type,
            "variant": section.variant,
            "label": section.label,
            "visible": 1 if section.visible else 0,
            "data": _dump_json(section.data),
        }

    def revisions(self, conn: sqlite3.Connection, page_id: int) -> list[dict[str, Any]]:
        rows = conn.execute(
            "SELECT id, note, author, created_at FROM revisions WHERE entity_type = 'page' AND entity_id = ? "
            "ORDER BY created_at DESC, id DESC LIMIT 30",
            (int(page_id),),
        ).fetchall()
        return [{key: row[key] for key in row.keys()} for row in rows]

    def restore(
        self, conn: sqlite3.Connection, *, page_id: int, revision_id: int
    ) -> tuple[PageState, list[int]]:
        """Réécrit une révision en brouillon. Jamais directement en publié.

        Seuls les blocs communs sont réalimentés ; ceux qui n'existaient pas dans
        la révision sont réinsérés masqués et en brouillon. Retourne l'état et la
        liste des blocs présents aujourd'hui mais absents de la révision.
        """
        row = conn.execute(
            "SELECT * FROM revisions WHERE id = ? AND entity_type = 'page' AND entity_id = ?",
            (int(revision_id), int(page_id)),
        ).fetchone()
        if row is None:
            raise UnknownRevision(str(revision_id))
        snapshot = _load_json(row["snapshot"], {})
        if not isinstance(snapshot, dict) or not snapshot.get("sections"):
            raise UnknownRevision(str(revision_id))
        known = {section.id for section in self.page_state(conn, page_id).sections}
        restored: set[int] = set()
        for entry in snapshot.get("sections", []):
            data = _load_json(entry.get("data"), {})
            section_id = int(entry.get("id") or 0)
            restored.add(section_id)
            if section_id and section_id in known:
                self._write(conn, self._row(conn, section_id, page_id), data, self.section(conn, section_id).draft_version)
                continue
            self.add_section(
                conn,
                page_id=page_id,
                type=str(entry.get("type") or "texte-riche"),
                variant=str(entry.get("variant") or ""),
                position=int(entry.get("position") or 0),
                data=data,
            )
        extras = [section_id for section_id in known if section_id not in restored]
        return self.page_state(conn, page_id), extras
