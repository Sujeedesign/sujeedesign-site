"""Store de l'éditeur : brouillon, publication, révisions, structure."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app import db as db_module
from app import repo as repo_module
from sujee_editor.blocks import DEFAULT_BLOCKS
from sujee_editor.store import (
    Store,
    StoreNotReady,
    UnknownPage,
    UnknownRevision,
    UnknownSection,
    ValidationFailed,
    VersionConflict,
)

CHAPITRE = json.dumps({"title": "Titre publié", "body": "<p>Texte publié</p>", "dark": False}, ensure_ascii=False)


@pytest.fixture()
def store(tmp_path: Path) -> Store:
    return Store(tmp_path / "site.db", DEFAULT_BLOCKS)


@pytest.fixture()
def conn(store: Store):
    connection = store.connect()
    db_module.init_db(connection)
    yield connection
    connection.close()


def make_page(conn, slug: str = "a-propos", sections: tuple[tuple[str, str, str], ...] = (
    ("chapter", "", CHAPITRE),
    ("citation", "", json.dumps({"quote": "Citation publiée"})),
    ("chapter", "dark", json.dumps({"title": "Second chapitre"})),
)) -> int:
    page_id = conn.execute(
        "INSERT INTO pages (slug, kind, title, status) VALUES (?, 'page', 'À propos', 'publie')", (slug,)
    ).lastrowid
    for position, (type_, variant, data) in enumerate(sections):
        conn.execute(
            "INSERT INTO sections (page_id, position, type, variant, label, visible, data) VALUES (?, ?, ?, ?, ?, 1, ?)",
            (page_id, position, type_, variant, type_, data),
        )
    conn.commit()
    return int(page_id)


@pytest.fixture()
def page_id(conn) -> int:
    return make_page(conn)


def first_section(conn, page_id: int) -> dict:
    row = conn.execute("SELECT * FROM sections WHERE page_id = ? ORDER BY position", (page_id,)).fetchone()
    return {key: row[key] for key in row.keys()}


def published(conn, section_id: int) -> dict:
    row = conn.execute("SELECT data, draft, draft_version, visible FROM sections WHERE id = ?", (section_id,)).fetchone()
    return {
        "data": json.loads(row["data"]),
        "draft": json.loads(row["draft"]) if row["draft"] not in (None, "") else None,
        "draft_version": int(row["draft_version"]),
        "visible": bool(row["visible"]),
    }


# ------------------------------------------------------------------ lecture


def test_require_tables_refuses_a_foreign_db(store: Store, tmp_path: Path) -> None:
    conn = store.connect()
    try:
        conn.execute("CREATE TABLE bidule (id INTEGER)")
        with pytest.raises(StoreNotReady) as exc:
            store.require_tables(conn)
        assert "pages" in str(exc.value)
    finally:
        conn.close()


def test_page_state_reads_published_data_and_structure(store: Store, conn, page_id: int) -> None:
    state = store.page_state(conn, page_id)
    assert state.page["slug"] == "a-propos"
    assert [section.type for section in state.sections] == ["chapter", "citation", "chapter"]
    assert state.sections[0].effective["title"] == "Titre publié"
    assert state.sections[0].revised is False
    assert state.sections[2].variant == "dark"
    assert state.revisions == []


def test_page_state_refuses_an_unknown_page(store: Store, conn) -> None:
    with pytest.raises(UnknownPage):
        store.page_state(conn, 9999)


# -------------------------------------------------------------- écriture


def test_write_field_only_touches_the_draft(store: Store, conn, page_id: int) -> None:
    section_id = int(first_section(conn, page_id)["id"])
    state = store.write_field(conn, section_id=section_id, field="title", value="Nouveau", expected_version=0)
    assert state.draft_version == 1 and state.revised is True
    assert state.effective["title"] == "Nouveau"
    assert published(conn, section_id)["data"]["title"] == "Titre publié"
    assert published(conn, section_id)["draft"]["title"] == "Nouveau"


def test_localized_field_is_written_with_its_accent(store: Store, conn, page_id: int) -> None:
    section_id = int(first_section(conn, page_id)["id"])
    store.write_field(conn, section_id=section_id, field="kicker", value="01 · Résumé", expected_version=0)
    assert published(conn, section_id)["draft"]["kicker"] == "01 · Résumé"


def test_stale_version_is_refused(store: Store, conn, page_id: int) -> None:
    section_id = int(first_section(conn, page_id)["id"])
    store.write_field(conn, section_id=section_id, field="title", value="A", expected_version=0)
    with pytest.raises(VersionConflict) as exc:
        store.write_field(conn, section_id=section_id, field="title", value="B", expected_version=0)
    assert exc.value.current == 1
    assert store.section(conn, section_id).effective["title"] == "A"


def test_unknown_field_writes_nothing(store: Store, conn, page_id: int) -> None:
    section_id = int(first_section(conn, page_id)["id"])
    with pytest.raises(ValidationFailed) as exc:
        store.write_field(conn, section_id=section_id, field="fantome", value="x", expected_version=0)
    assert exc.value.errors[0].rule == "unknown_field"
    assert published(conn, section_id)["draft"] is None


def test_too_long_value_is_refused_without_any_write(store: Store, conn, page_id: int) -> None:
    section_id = int(first_section(conn, page_id)["id"])
    with pytest.raises(ValidationFailed) as exc:
        store.write_field(conn, section_id=section_id, field="kicker", value="x" * 200, expected_version=0)
    assert exc.value.errors[0].rule == "max_length"
    assert published(conn, section_id)["draft"] is None


def test_unknown_block_type_is_refused(store: Store, conn, page_id: int) -> None:
    conn.execute(
        "INSERT INTO sections (page_id, position, type, data) VALUES (?, 9, 'bloc-inconnu', '{}')", (page_id,)
    )
    conn.commit()
    section_id = int(conn.execute("SELECT id FROM sections WHERE type = 'bloc-inconnu'").fetchone()["id"])
    with pytest.raises(ValidationFailed) as exc:
        store.write_field(conn, section_id=section_id, field="title", value="x", expected_version=0)
    assert exc.value.errors[0].rule == "unknown_block"


def test_unknown_section_and_section_of_another_page(store: Store, conn, page_id: int) -> None:
    with pytest.raises(UnknownSection):
        store.write_field(conn, section_id=9999, field="title", value="x", expected_version=0)
    with pytest.raises(UnknownSection):
        store.section(conn, "abc")
    other = make_page(conn, slug="contact", sections=(("citation", "", "{}"),))
    other_section = int(first_section(conn, other)["id"])
    with pytest.raises(UnknownSection):
        store.write_field(conn, section_id=other_section, field="quote", value="x", expected_version=0, page_id=page_id)
    assert published(conn, other_section)["draft"] is None


def test_write_draft_writes_lists_and_keeps_other_fields(store: Store, conn, page_id: int) -> None:
    section_id = int(first_section(conn, page_id)["id"])
    state = store.write_draft(
        conn,
        section_id=section_id,
        data={"list": ["Première puce", "Deuxième puce"]},
        expected_version=0,
    )
    assert state.effective["list"] == ["Première puce", "Deuxième puce"]
    assert state.effective["title"] == "Titre publié"
    with pytest.raises(ValidationFailed) as exc:
        store.write_draft(conn, section_id=section_id, data={"list": ["ok", 3]}, expected_version=1)
    assert exc.value.errors[0].rule == "bad_item"
    assert published(conn, section_id)["draft"]["list"] == ["Première puce", "Deuxième puce"]


# -------------------------------------------------------------- structure


def test_add_section_is_hidden_and_pending_until_publish(store: Store, conn, page_id: int) -> None:
    state = store.add_section(conn, page_id=page_id, type="citation", position=1)
    assert state.visible is False
    assert state.revised is True
    assert state.position == 1
    order = [section.type for section in store.page_state(conn, page_id).sections]
    assert order == ["chapter", "citation", "citation", "chapter"]
    assert published(conn, state.id)["data"] == {}


def test_add_section_refuses_a_bad_variant_or_an_unknown_page(store: Store, conn, page_id: int) -> None:
    with pytest.raises(ValidationFailed):
        store.add_section(conn, page_id=page_id, type="hero", variant="nope")
    with pytest.raises(UnknownPage):
        store.add_section(conn, page_id=9999, type="citation")


def test_move_toggle_duplicate_delete(store: Store, conn, page_id: int) -> None:
    first = int(first_section(conn, page_id)["id"])
    store.move_section(conn, section_id=first, offset=1)
    assert [section.id for section in store.page_state(conn, page_id).sections][1] == first
    store.move_section(conn, section_id=first, offset=-1)
    assert [section.id for section in store.page_state(conn, page_id).sections][0] == first

    assert store.toggle_section(conn, section_id=first).visible is False
    assert store.toggle_section(conn, section_id=first).visible is True

    copy = store.duplicate_section(conn, section_id=first)
    assert copy.id != first and copy.visible is False and copy.effective["title"] == "Titre publié"

    store.delete_section(conn, section_id=copy.id)
    assert [section.id for section in store.page_state(conn, page_id).sections] == [
        int(row["id"]) for row in conn.execute("SELECT id FROM sections WHERE page_id = ? ORDER BY position", (page_id,))
    ]
    with pytest.raises(UnknownSection):
        store.section(conn, copy.id)


# --------------------------------------------------- publication, révisions


def test_publish_copies_draft_creates_revision_and_clears_drafts(store: Store, conn, page_id: int) -> None:
    first, second = [section.id for section in store.page_state(conn, page_id).sections][:2]
    before = db_module.content_revision(conn)
    store.write_field(conn, section_id=first, field="title", value="Nouveau", expected_version=0)
    result = store.publish(conn, page_id=page_id)

    assert result["revision_id"] > 0 and result["published_at"]
    assert db_module.content_revision(conn) != before
    assert published(conn, first)["data"]["title"] == "Nouveau"
    assert published(conn, first)["draft"] is None
    assert published(conn, second)["data"]["quote"] == "Citation publiée"
    assert store.section(conn, first).revised is False
    assert store.section(conn, first).effective["title"] == "Nouveau"


def test_published_snapshot_is_restorable_by_the_current_admin(store: Store, conn, page_id: int) -> None:
    first = store.page_state(conn, page_id).sections[0].id
    store.write_field(conn, section_id=first, field="title", value="Nouveau", expected_version=0)
    result = store.publish(conn, page_id=page_id)
    row = conn.execute("SELECT snapshot FROM revisions WHERE id = ?", (result["revision_id"],)).fetchone()
    snapshot = json.loads(row["snapshot"])
    assert set(snapshot) == {"page", "sections"}
    assert set(snapshot["sections"][0]) == {"id", "page_id", "position", "type", "variant", "label", "visible", "data"}
    assert isinstance(snapshot["sections"][0]["data"], str)
    assert repo_module.restore_snapshot(conn, page_id, snapshot) is True


def test_publish_reveals_a_block_that_was_never_published(store: Store, conn, page_id: int) -> None:
    added = store.add_section(conn, page_id=page_id, type="citation", position=1)
    assert published(conn, added.id)["visible"] is False
    store.write_field(conn, section_id=added.id, field="quote", value="Citation neuve", expected_version=1)
    store.publish(conn, page_id=page_id)
    assert published(conn, added.id)["visible"] is True
    assert published(conn, added.id)["data"]["quote"] == "Citation neuve"


def test_publish_keeps_a_block_hidden_by_hand(store: Store, conn, page_id: int) -> None:
    section_id = store.page_state(conn, page_id).sections[0].id
    store.toggle_section(conn, section_id=section_id)
    store.write_field(conn, section_id=section_id, field="title", value="Nouveau", expected_version=0)
    store.publish(conn, page_id=page_id)
    assert published(conn, section_id)["visible"] is False
    assert published(conn, section_id)["data"]["title"] == "Nouveau"


def test_publish_without_any_draft_still_records_a_revision(store: Store, conn, page_id: int) -> None:
    result = store.publish(conn, page_id=page_id)
    assert result["revision_id"] > 0
    assert len(store.revisions(conn, page_id)) == 1


def test_restore_writes_into_the_draft_only(store: Store, conn, page_id: int) -> None:
    first = store.page_state(conn, page_id).sections[0].id
    store.write_field(conn, section_id=first, field="title", value="Nouveau", expected_version=0)
    store.publish(conn, page_id=page_id)
    revision_id = store.revisions(conn, page_id)[0]["id"]

    store.write_field(conn, section_id=first, field="title", value="Encore", expected_version=2)
    state, extras = store.restore(conn, page_id=page_id, revision_id=revision_id)

    assert extras == []
    # Une révision est l'état d'avant l'opération : restaurer ramène le titre publié avant publication.
    assert store.section(conn, first).effective["title"] == "Titre publié"
    # ... et le publié ne bouge pas tant qu'on n'a pas publié.
    assert published(conn, first)["data"]["title"] == "Nouveau"
    assert [section.id for section in state.sections] == [section.id for section in store.page_state(conn, page_id).sections]

    store.publish(conn, page_id=page_id)
    assert published(conn, first)["data"]["title"] == "Titre publié"
    assert store.section(conn, first).effective["title"] == "Titre publié"


def test_restore_brings_back_a_deleted_block_as_a_draft(store: Store, conn, page_id: int) -> None:
    sections = store.page_state(conn, page_id).sections
    store.publish(conn, page_id=page_id)
    revision_id = store.revisions(conn, page_id)[0]["id"]
    store.delete_section(conn, section_id=sections[2].id)

    state, extras = store.restore(conn, page_id=page_id, revision_id=revision_id)

    assert extras == []
    assert len(state.sections) == 3
    back = [section for section in state.sections if not section.visible]
    assert len(back) == 1
    assert back[0].effective["title"] == "Second chapitre"
    assert back[0].revised is True
    assert [section.type for section in state.sections] == ["chapter", "citation", "chapter"]


def test_restore_reports_sections_that_did_not_exist_in_the_revision(store: Store, conn, page_id: int) -> None:
    store.publish(conn, page_id=page_id)
    revision_id = store.revisions(conn, page_id)[0]["id"]
    added = store.add_section(conn, page_id=page_id, type="citation")

    state, extras = store.restore(conn, page_id=page_id, revision_id=revision_id)

    assert extras == [added.id]
    assert store.section(conn, added.id).revised is True


def test_restore_refuses_an_unknown_revision(store: Store, conn, page_id: int) -> None:
    with pytest.raises(UnknownRevision):
        store.restore(conn, page_id=page_id, revision_id=999)
