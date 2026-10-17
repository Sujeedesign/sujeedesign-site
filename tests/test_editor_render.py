"""Mode édition : enveloppes de blocs et brouillon réservé à la session admin.

Le brouillon ne doit jamais atteindre un visiteur, même en manipulant l'URL, et
les enveloppes de blocs ne doivent rien changer d'autre au HTML.
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path

import pytest

from app import render as render_module
from app import security
from app.db import connect

SLUG = "a-propos"
PUBLIE = "Titre publié"
BROUILLON = "Titre en brouillon"


def seed_page(db_file: Path) -> tuple[int, int]:
    conn = connect(db_file)
    try:
        page_id = conn.execute(
            "INSERT INTO pages (slug, kind, title, status) VALUES (?, 'page', 'À propos', 'publie')", (SLUG,)
        ).lastrowid
        section_id = conn.execute(
            "INSERT INTO sections (page_id, position, type, variant, label, visible, data) "
            "VALUES (?, 0, 'chapter', '', 'Chapitre', 1, ?)",
            (page_id, json.dumps({"title": PUBLIE, "body": "<p>Texte publié</p>"}, ensure_ascii=False)),
        ).lastrowid
        for position, (type_, label, data) in enumerate(
            (
                ("citation", "Citation", {"quote": "Citation publiée"}),
                ("citation", "Citation masquée", {"quote": "Citation masquée"}),
            ),
            start=1,
        ):
            conn.execute(
                "INSERT INTO sections (page_id, position, type, label, visible, data) VALUES (?, ?, ?, ?, ?, ?)",
                (page_id, position, type_, label, 0 if "masquée" in label else 1, json.dumps(data, ensure_ascii=False)),
            )
        conn.commit()
        return int(page_id), int(section_id)
    finally:
        conn.close()


def write_draft(db_file: Path, section_id: int, data: dict) -> None:
    conn = connect(db_file)
    try:
        conn.execute(
            "UPDATE sections SET draft = ?, draft_version = draft_version + 1 WHERE id = ?",
            (json.dumps(data, ensure_ascii=False), section_id),
        )
        conn.commit()
    finally:
        conn.close()


def admin_cookies(now: int | None = None) -> dict[str, str]:
    return {security.SESSION_COOKIE: security.make_session(now)}


def unwrap_envelopes(html_text: str) -> str:
    """Retire les `<div class="sjd-block">` et leur fermeture, en gardant le contenu."""
    out: list[str] = []
    index = 0
    opener = re.compile(r'<div class="sjd-block"[^>]*>')
    token = re.compile(r"<div\b|</div>")
    while True:
        match = opener.search(html_text, index)
        if match is None:
            out.append(html_text[index:])
            break
        out.append(html_text[index : match.start()])
        depth = 1
        cursor = match.end()
        inner_start = match.end()
        inner_end = match.end()
        while depth:
            found = token.search(html_text, cursor)
            assert found is not None, "enveloppe non fermée"
            depth += 1 if found.group().startswith("<div") else -1
            cursor = found.end()
            if depth == 0:
                inner_end = found.start()
        out.append(html_text[inner_start:inner_end])
        index = cursor
    return "".join(out)


def main_of(html_text: str) -> str:
    match = re.search(r'<main id="main-content"[^>]*>(.*?)</main>', html_text, re.S)
    assert match is not None, "contenu principal absent"
    return match.group(1)


def without_hidden_blocks(html_text: str) -> str:
    """Retire les enveloppes des blocs masqués (data-block-visible="0").

    Ils sont rendus en mode édition pour rester éditables, mais ils ne font pas
    partie de ce qu'un visiteur voit : on les écarte avant de comparer, avec le
    séparateur qui les précède, pour ne pas laisser de ligne vide derrière eux.
    """
    pieces: list[tuple[str, str | None]] = []
    index = 0
    opener = re.compile(r'<div class="sjd-block"[^>]*>')
    token = re.compile(r"<div\b|</div>")
    while True:
        match = opener.search(html_text, index)
        if match is None:
            pieces.append((html_text[index:], None))
            break
        separator = html_text[index : match.start()]
        depth = 1
        cursor = match.end()
        while depth:
            found = token.search(html_text, cursor)
            assert found is not None, "enveloppe non fermée"
            depth += 1 if found.group().startswith("<div") else -1
            cursor = found.end()
        pieces.append((separator, html_text[match.start() : cursor]))
        index = cursor
    out: list[str] = []
    for separator, body in pieces:
        if body is None:
            out.append(separator)
        elif 'data-block-visible="0"' not in body.split(">", 1)[0]:
            out.append(separator + body)
    return "".join(out)


def draft_html(client, cookies=None) -> str:
    response = client.get(f"/{SLUG}?edit=1", cookies=cookies or {})
    assert response.status_code == 200
    return response.text


def test_visitor_never_receives_a_draft(client, db_file: Path) -> None:
    _, section_id = seed_page(db_file)
    write_draft(db_file, section_id, {"title": BROUILLON, "body": "<p>Texte en brouillon</p>"})
    published = client.get(f"/{SLUG}")
    flagged = client.get(f"/{SLUG}?edit=1")
    for response in (published, flagged):
        assert PUBLIE in response.text
        assert BROUILLON not in response.text


def test_editor_session_receives_the_draft(client, db_file: Path) -> None:
    _, section_id = seed_page(db_file)
    write_draft(db_file, section_id, {"title": BROUILLON, "body": "<p>Texte en brouillon</p>"})
    html = draft_html(client, admin_cookies())
    assert BROUILLON in html
    assert PUBLIE not in html


def test_editor_session_without_the_flag_sees_the_published_page(client, db_file: Path) -> None:
    _, section_id = seed_page(db_file)
    write_draft(db_file, section_id, {"title": BROUILLON})
    html = client.get(f"/{SLUG}", cookies=admin_cookies()).text
    assert PUBLIE in html and BROUILLON not in html


def test_forged_or_expired_cookie_is_ignored(client, db_file: Path) -> None:
    _, section_id = seed_page(db_file)
    write_draft(db_file, section_id, {"title": BROUILLON})
    for cookies in (
        {security.SESSION_COOKIE: "nimportequoi"},
        {security.SESSION_COOKIE: ""},
        admin_cookies(now=int(time.time()) - security.SESSION_TTL - 60),
    ):
        html = draft_html(client, cookies)
        assert BROUILLON not in html and PUBLIE in html


def test_the_edit_flag_is_advertised_to_the_template(client, db_file: Path) -> None:
    seed_page(db_file)
    assert 'data-edit-mode="1"' in client.get(f"/{SLUG}?edit=1", cookies=admin_cookies()).text
    assert 'data-edit-mode="1"' not in client.get(f"/{SLUG}", cookies=admin_cookies()).text
    assert 'data-edit-mode="1"' not in client.get(f"/{SLUG}?edit=1").text


def test_every_visible_section_is_wrapped_and_hidden_ones_are_not(client, db_file: Path) -> None:
    seed_page(db_file)
    html = client.get(f"/{SLUG}").text
    assert html.count('class="sjd-block"') == 2
    assert "Citation publiée" in html
    assert "Citation masquée" not in html
    assert 'data-block-type="chapter"' in html
    assert 'data-block-label="Chapitre"' in html
    assert 'data-block-visible="1"' in html


def test_envelope_only_adds_the_envelope(db_file: Path, conn) -> None:
    page_id, _ = seed_page(db_file)
    page = conn.execute("SELECT * FROM pages WHERE id = ?", (page_id,)).fetchone()
    sections = conn.execute("SELECT * FROM sections WHERE page_id = ? ORDER BY position", (page_id,)).fetchall()
    env = render_module.build_env()
    ctx = {"edit": False}
    wrapped = render_module.render_page(env, page=page, sections=sections, ctx=ctx)
    plain = render_module.render_page(env, page=page, sections=sections, ctx=ctx, envelopes=False)
    assert wrapped != plain
    assert unwrap_envelopes(wrapped) == plain
    assert 'class="sjd-block"' in wrapped and 'class="sjd-block"' not in plain


def test_edit_mode_does_not_serve_a_cached_page(client, db_file: Path) -> None:
    _, section_id = seed_page(db_file)
    first = client.get(f"/{SLUG}", cookies=admin_cookies()).text
    write_draft(db_file, section_id, {"title": BROUILLON})
    assert BROUILLON not in first
    assert BROUILLON in client.get(f"/{SLUG}?edit=1", cookies=admin_cookies()).text


def test_sitemap_and_jsonld_ignore_drafts(client, db_file: Path) -> None:
    _, section_id = seed_page(db_file)
    write_draft(db_file, section_id, {"title": BROUILLON, "body": "<p>Texte en brouillon</p>"})
    sitemap = client.get("/sitemap.xml").text
    assert BROUILLON not in sitemap and SLUG in sitemap
    html = client.get(f"/{SLUG}", cookies=admin_cookies()).text
    assert BROUILLON not in html


def test_a_page_without_any_draft_is_unchanged_by_edit_mode(client, db_file: Path) -> None:
    seed_page(db_file)
    published = client.get(f"/{SLUG}").text
    edited = draft_html(client, admin_cookies())
    # Les blocs masqués n'existent qu'en mode édition : écartés, le reste doit
    # être identique au rendu public.
    assert unwrap_envelopes(main_of(published)) == unwrap_envelopes(without_hidden_blocks(main_of(edited)))


def test_edit_mode_renders_hidden_sections_muted(client, db_file: Path) -> None:
    """Un bloc masqué n'est pas public, mais reste dans le canevas, grisé."""
    seed_page(db_file)
    public = client.get(f"/{SLUG}").text
    edited = draft_html(client, admin_cookies())
    assert "Citation masquée" not in public
    assert "Citation masquée" in edited
    assert 'data-block-visible="0"' in edited
    assert edited.count('class="sjd-block"') == 3


# --- Revue de branche : le cache ne melange pas admin et visiteur ----------
# Fix [I2] : la cle de cache ignorait le contexte du lecteur, donc la page mise
# en cache pour une session admin (avec son entree "Modifier cette page") etait
# servie au visiteur suivant, et inversement.


def test_the_cache_never_mixes_the_editor_shell_with_the_visitor_page(client, db_file: Path) -> None:
    seed_page(db_file)
    admin_first = client.get(f"/{SLUG}", cookies=admin_cookies())
    assert "sjd-edit-entry" in admin_first.text

    visitor = client.get(f"/{SLUG}")
    assert "sjd-edit-entry" not in visitor.text
    assert "/assets/editor/editor.css" not in visitor.text
    assert "sjd-editor-data" not in visitor.text

    client.get(f"/{SLUG}")
    admin_again = client.get(f"/{SLUG}", cookies=admin_cookies())
    assert "sjd-edit-entry" in admin_again.text
