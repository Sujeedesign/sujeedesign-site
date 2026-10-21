from __future__ import annotations

import copy
import json

import pytest

from sujee_editor.editor.project import (
    PROJECT_SCHEMA_VERSION,
    THEME_ID,
    THEME_VERSION,
    ProjectError,
    project_to_sections,
    sections_to_project,
)
from sujee_editor.blocks import DEFAULT_BLOCKS, default_data
from editor_fixtures import sample_data


def _field(tag: str, name: str, content: str = "") -> dict:
    return {
        "tagName": tag,
        "attributes": {"data-sjd-field": name},
        "content": content,
    }


def _section(section_type: str, identifier: int | None, children: list[dict], *, visible: bool = True) -> dict:
    attributes = {
        "data-sjd-section": section_type,
        "data-sjd-visible": "1" if visible else "0",
    }
    if identifier is not None:
        attributes["data-sjd-section-id"] = str(identifier)
    return {
        "type": f"sjd-section-{section_type}",
        "tagName": "section",
        "attributes": attributes,
        "components": children,
    }


def _project(*sections: dict, styles: list | None = None) -> dict:
    return {
        "schema_version": PROJECT_SCHEMA_VERSION,
        "theme_id": THEME_ID,
        "theme_version": THEME_VERSION,
        "project_data": {
            "pages": [
                {
                    "frames": [
                        {
                            "component": {
                                "type": "wrapper",
                                "components": list(sections),
                            }
                        }
                    ]
                }
            ],
            "styles": list(styles or []),
            "assets": [],
        },
    }


def _rich_body() -> dict:
    return {
        "tagName": "div",
        "attributes": {"data-sjd-field": "body"},
        "components": [
            {
                "tagName": "p",
                "components": [
                    {"type": "textnode", "content": "Un texte "},
                    {"tagName": "strong", "content": "riche"},
                    {"type": "textnode", "content": "."},
                ],
            }
        ],
    }


def _three_section_project() -> dict:
    return _project(
        _section(
            "chapter",
            7,
            [
                _field("p", "kicker", "01 · Présentation"),
                _field("h2", "title", "Une histoire créative"),
                _rich_body(),
                _field("ul", "list", ""),
            ],
        ),
        _section(
            "image-pleine-largeur",
            8,
            [
                {
                    "type": "image",
                    "tagName": "img",
                    "attributes": {
                        "data-sjd-field": "src",
                        "src": "/medias/projet.webp",
                        "alt": "Affiche de projet",
                    },
                },
                _field("figcaption", "caption", "Une légende"),
            ],
            visible=False,
        ),
        _section(
            "citation",
            9,
            [
                _field("blockquote", "quote", "Créer avec intention."),
                _field("span", "author", "Sujee"),
                _field("span", "role", "Direction artistique"),
            ],
        ),
    )


def _source_sections() -> list[dict]:
    return [
        {
            "id": 7,
            "type": "chapter",
            "variant": "",
            "visible": True,
            "position": 0,
            "effective": {
                "kicker": "01 · Présentation",
                "title": "Une histoire créative",
                "body": "<p>Un texte <strong>riche</strong>.</p>",
                "list": "",
                "dark": False,
            },
        },
        {
            "id": 8,
            "type": "image-pleine-largeur",
            "variant": "",
            "visible": False,
            "position": 1,
            "effective": {
                "src": "/medias/projet.webp",
                "alt": "Affiche de projet",
                "caption": "Une légende",
            },
        },
        {
            "id": 9,
            "type": "citation",
            "variant": "",
            "visible": True,
            "position": 2,
            "effective": {
                "quote": "Créer avec intention.",
                "author": "Sujee",
                "role": "Direction artistique",
            },
        },
    ]


def test_sections_to_project_emits_versioned_theme_and_stable_section_types():
    project = sections_to_project(_source_sections())

    assert project["schema_version"] == PROJECT_SCHEMA_VERSION
    assert project["theme_id"] == THEME_ID
    assert project["theme_version"] == THEME_VERSION
    components = project["project_data"]["pages"][0]["frames"][0]["component"]["components"]
    assert [component["type"] for component in components] == [
        "sjd-section-chapter",
        "sjd-section-image-pleine-largeur",
        "sjd-section-citation",
    ]
    assert [component["attributes"]["data-sjd-section-id"] for component in components] == ["7", "8", "9"]


def test_project_uses_theme_dom_classes_for_the_canvas_preview():
    project = sections_to_project(_source_sections())
    components = project["project_data"]["pages"][0]["frames"][0]["component"]["components"]
    chapter = components[0]

    assert "s-chap" in chapter["attributes"]["class"].split()
    container = chapter["components"][0]
    assert container["attributes"]["class"] == "container"
    fields = [node for node in _walk_test_nodes(chapter) if "data-sjd-field" in node.get("attributes", {})]
    title = next(node for node in fields if node["attributes"]["data-sjd-field"] == "title")
    assert title["attributes"]["class"] == "chap-title"
    citation = components[2]
    assert "citation" in citation["attributes"]["class"].split()
    image = components[1]
    assert "page-body" in image["attributes"]["class"].split()


def _walk_test_nodes(node: dict):
    yield node
    for child in node.get("components", []):
        if isinstance(child, dict):
            yield from _walk_test_nodes(child)


def test_project_to_sections_restores_fields_visibility_and_order():
    sections = project_to_sections(_three_section_project())

    assert [section["type"] for section in sections] == ["chapter", "image-pleine-largeur", "citation"]
    assert [section["position"] for section in sections] == [0, 1, 2]
    assert [section["id"] for section in sections] == [7, 8, 9]
    assert [section["visible"] for section in sections] == [True, False, True]
    assert sections[0]["data"]["title"] == "Une histoire créative"
    assert "<strong>riche</strong>" in sections[0]["data"]["body"]
    assert sections[1]["data"] == {
        "src": "/medias/projet.webp",
        "alt": "Affiche de projet",
        "caption": "Une légende",
        "section_background": "default",
        "section_background_color": "#f2f2f4",
    }
    assert sections[2]["data"]["author"] == "Sujee"


def test_project_and_sections_round_trip_without_losing_theme_content():
    imported = sections_to_project(_source_sections())

    assert project_to_sections(imported) == project_to_sections(_three_section_project())


def test_banniere_svg_survives_project_round_trip():
    svg = '<svg viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>'
    source = [{
        "id": 21,
        "type": "banniere",
        "variant": "",
        "visible": True,
        "position": 0,
        "effective": {"svg": svg},
    }]

    result = project_to_sections(sections_to_project(source))

    assert result[0]["data"]["svg"].startswith("<svg")
    assert "M0 0h10v10z" in result[0]["data"]["svg"]


def test_import_uses_effective_draft_content_and_sorts_by_position():
    sections = _source_sections()
    sections[0]["position"] = 2
    sections[0]["effective"] = {**sections[0]["effective"], "title": "Brouillon"}
    sections[1]["position"] = 0
    sections[2]["position"] = 1

    project = sections_to_project(sections)
    result = project_to_sections(project)

    assert [section["type"] for section in result] == ["image-pleine-largeur", "citation", "chapter"]
    assert result[-1]["data"]["title"] == "Brouillon"


def test_import_rejects_a_page_with_any_unsupported_section():
    sections = _source_sections()
    sections.append({"id": 10, "type": "not-a-block", "position": 3, "visible": True, "effective": {}})

    with pytest.raises(ProjectError, match="not-a-block"):
        sections_to_project(sections)


def test_project_rejects_native_or_unknown_components():
    project = _three_section_project()
    root_components = project["project_data"]["pages"][0]["frames"][0]["component"]["components"]
    root_components[1]["type"] = "image"

    with pytest.raises(ProjectError, match="composant"):
        project_to_sections(project)


def test_project_rejects_arbitrary_styles_instead_of_publishing_them():
    project = _three_section_project()
    project["project_data"]["styles"] = [{"selectors": ["body"], "style": {"color": "red"}}]

    with pytest.raises(ProjectError, match="style"):
        project_to_sections(project)


def test_project_rejects_style_on_the_canvas_wrapper():
    project = _three_section_project()
    project["project_data"]["pages"][0]["frames"][0]["component"]["style"] = {"color": "red"}

    with pytest.raises(ProjectError, match="style"):
        project_to_sections(project)


def test_project_rejects_script_and_event_attributes_inside_rich_text():
    project = _three_section_project()
    project["project_data"]["pages"][0]["frames"][0]["component"]["components"][0]["components"][2]["components"] = [
        {"tagName": "script", "content": "alert(1)"}
    ]

    with pytest.raises(ProjectError, match="HTML"):
        project_to_sections(project)


def test_project_rejects_external_or_script_image_urls():
    project = _three_section_project()
    image = project["project_data"]["pages"][0]["frames"][0]["component"]["components"][1]["components"][0]
    image["attributes"]["src"] = "javascript:alert(1)"

    with pytest.raises(ProjectError, match="image"):
        project_to_sections(project)


def test_project_rejects_duplicate_section_ids_and_wrong_theme_version():
    project = _three_section_project()
    components = project["project_data"]["pages"][0]["frames"][0]["component"]["components"]
    components[1]["attributes"]["data-sjd-section-id"] = "7"
    with pytest.raises(ProjectError, match="identifiant"):
        project_to_sections(project)

    project = _three_section_project()
    project["theme_version"] += 1
    with pytest.raises(ProjectError, match="version"):
        project_to_sections(project)


def test_project_rejects_bad_field_types_and_max_lengths():
    project = _three_section_project()
    components = project["project_data"]["pages"][0]["frames"][0]["component"]["components"]
    components[0]["components"][1]["content"] = "x" * 250
    with pytest.raises(ProjectError, match="validation"):
        project_to_sections(project)


def test_round_trip_handles_empty_image_values_and_unicode():
    source = _source_sections()
    source[0]["effective"]["title"] = "À travers les étoiles ✨"
    source[1]["effective"]["src"] = ""

    result = project_to_sections(sections_to_project(source))

    assert result[0]["data"]["title"] == "À travers les étoiles ✨"
    assert result[1]["data"]["src"] == ""


def test_imported_chapter_list_items_round_trip_without_becoming_fields():
    source = _source_sections()
    source[0]["effective"]["list"] = "Première ligne\nDeuxième ligne"

    result = project_to_sections(sections_to_project(source))

    assert result[0]["data"]["list"] == "Première ligne\nDeuxième ligne"


def test_input_objects_are_not_mutated():
    source = _source_sections()
    before = copy.deepcopy(source)

    sections_to_project(source)

    assert source == before


def _all_typed_sections() -> list[dict]:
    sections = []
    for position, block in enumerate(DEFAULT_BLOCKS.values()):
        data = sample_data(block)
        sections.append({
            "id": position + 1,
            "type": block.name,
            "variant": data.get("_variant", ""),
            "visible": position % 2 == 0,
            "position": position,
            "effective": data,
        })
    return sections


def test_all_twenty_block_types_round_trip_without_data_loss():
    source = _all_typed_sections()

    result = project_to_sections(sections_to_project(source))

    assert len(result) == 20
    assert [item["type"] for item in result] == [item["type"] for item in source]
    assert [item["id"] for item in result] == [item["id"] for item in source]
    assert [item["position"] for item in result] == list(range(20))
    assert [item["visible"] for item in result] == [item["visible"] for item in source]
    assert [item["variant"] for item in result] == [item["variant"] for item in source]
    assert [item["data"] for item in result] == [item["effective"] for item in source]


def test_all_block_variants_round_trip_without_data_loss():
    source = []
    for position, block in enumerate(DEFAULT_BLOCKS.values()):
        for variant in block.variants:
            data = sample_data(block)
            data["_variant"] = variant
            source.append({
                "id": len(source) + 1,
                "type": block.name,
                "variant": variant,
                "visible": True,
                "position": len(source),
                "effective": data,
            })

    result = project_to_sections(sections_to_project(source))

    assert [(item["type"], item["variant"], item["data"]) for item in result] == [
        (item["type"], item["variant"], item["effective"]) for item in source
    ]


def test_section_background_mode_and_color_round_trip():
    data = default_data(DEFAULT_BLOCKS["chapter"])
    data.update(section_background="custom", section_background_color="#123456")
    source = [{"id": 1, "type": "chapter", "position": 0, "effective": data}]

    saved = project_to_sections(sections_to_project(source))[0]["data"]

    assert saved["section_background"] == "custom"
    assert saved["section_background_color"] == "#123456"


def test_theme_v3_project_gains_default_background_fields_without_content_changes():
    from sujee_editor.editor.project import migrate_project

    project = _three_section_project()
    project["theme_version"] = 3
    components = project["project_data"]["pages"][0]["frames"][0]["component"]["components"]
    for component in components:
        raw_data = component["attributes"].get("data-sjd-data")
        if raw_data:
            data = json.loads(raw_data)
            data.pop("section_background", None)
            data.pop("section_background_color", None)
            component["attributes"]["data-sjd-data"] = json.dumps(data, ensure_ascii=False, separators=(",", ":"))

    migrated = migrate_project(project)
    sections = project_to_sections(migrated)

    assert migrated["theme_version"] == THEME_VERSION == 6
    assert all(section["data"]["section_background"] == "default" for section in sections)
    assert all(section["data"]["section_background_color"] == "#f2f2f4" for section in sections)


@pytest.mark.parametrize("legacy_background", ["none", "paper", "obsidian", "accent", "image"])
def test_theme_v3_zone_free_background_mode_survives_migration(legacy_background: str):
    from sujee_editor.editor.project import migrate_project

    data = default_data(DEFAULT_BLOCKS["zone-libre"])
    data["background"] = legacy_background
    if legacy_background == "image":
        data["background_image"] = "/medias/legacy-background.webp"
    project = sections_to_project([{"id": 1, "type": "zone-libre", "position": 0, "effective": data}])
    project["theme_version"] = 3
    components = project["project_data"]["pages"][0]["frames"][0]["component"]["components"]
    component_data = json.loads(components[0]["attributes"]["data-sjd-data"])
    component_data.pop("section_background_color", None)
    components[0]["attributes"]["data-sjd-data"] = json.dumps(component_data, ensure_ascii=False, separators=(",", ":"))

    migrated = migrate_project(project)
    section = project_to_sections(migrated)[0]

    assert section["data"]["background"] == legacy_background
    assert section["data"]["section_background_color"] == "#f2f2f4"


@pytest.mark.parametrize("legacy_background", ["none", "paper", "obsidian", "accent", "gradient", "custom", "image"])
def test_theme_v4_zone_free_background_settings_survive_migration(legacy_background: str):
    from sujee_editor.editor.project import migrate_project

    data = default_data(DEFAULT_BLOCKS["zone-libre"])
    data.update(background=legacy_background, section_background_color="#123456")
    if legacy_background == "image":
        data["background_image"] = "/medias/legacy-background.webp"
    project = sections_to_project([{"id": 1, "type": "zone-libre", "position": 0, "effective": data}])
    project["theme_version"] = 4
    before = copy.deepcopy(project["project_data"])

    migrated = migrate_project(project)
    section = project_to_sections(migrated)[0]

    assert migrated["theme_version"] == THEME_VERSION == 6
    assert migrated["project_data"] == before
    assert section["data"]["background"] == legacy_background
    assert section["data"]["section_background_color"] == "#123456"


def test_theme_v5_home_hero_animation_choice_survives_migration():
    from sujee_editor.editor.project import migrate_project

    data = default_data(DEFAULT_BLOCKS["zone-libre"])
    data["background"] = "hero-gradient"
    project = sections_to_project([{"id": 1, "type": "zone-libre", "position": 0, "effective": data}])
    project["theme_version"] = 5
    before = copy.deepcopy(project["project_data"])

    migrated = migrate_project(project)
    section = project_to_sections(migrated)[0]

    assert migrated["theme_version"] == THEME_VERSION == 6
    assert migrated["project_data"] == before
    assert section["data"]["background"] == "hero-gradient"


@pytest.mark.parametrize("legacy_version", [1, 2, 3, 4, 5])
def test_migrate_legacy_theme_project_preserves_content_and_is_idempotent(legacy_version: int):
    from sujee_editor.editor.project import migrate_project

    project = _three_section_project()
    project["theme_version"] = legacy_version
    before = copy.deepcopy(project)

    migrated = migrate_project(project)

    assert project == before
    assert migrated["theme_version"] == THEME_VERSION == 6
    assert migrated["project_data"] == project["project_data"]
    assert migrate_project(migrated) == migrated
    assert [section["type"] for section in project_to_sections(migrated)] == [
        "chapter", "image-pleine-largeur", "citation"
    ]


def test_invalid_theme_v1_project_raises_without_mutation():
    from sujee_editor.editor.project import migrate_project

    project = _three_section_project()
    project["theme_version"] = 1
    project["project_data"]["pages"][0]["frames"][0]["component"]["components"][0]["type"] = "arbitrary"
    before = copy.deepcopy(project)

    with pytest.raises(ProjectError):
        migrate_project(project)

    assert project == before


def test_typed_rich_text_rejects_active_markup_and_sanitizes_attributes():
    source = _all_typed_sections()
    hero = next(section for section in source if section["type"] == "hero")
    hero["effective"]["title"] = "<script>alert(1)</script>"

    with pytest.raises(ProjectError, match="HTML rich non autorisé"):
        sections_to_project(source)

    hero["effective"]["title"] = '<em onclick="alert(1)">Titre</em>'
    result = project_to_sections(sections_to_project(source))
    saved_hero = next(section for section in result if section["type"] == "hero")
    assert saved_hero["data"]["title"] == "<em>Titre</em>"


def test_existing_small_tags_in_rich_text_survive_editor_round_trip():
    source = _all_typed_sections()
    text_section = next(section for section in source if section["type"] == "texte-riche")
    text_section["effective"]["body"] = "<p>Projet publié — <small>6 octobre 2025</small></p>"

    result = project_to_sections(sections_to_project(source))
    saved = next(section for section in result if section["type"] == "texte-riche")

    assert saved["data"]["body"] == text_section["effective"]["body"]


def test_project_data_rejects_external_nested_image_urls():
    source = _all_typed_sections()
    project = sections_to_project(source)
    components = project["project_data"]["pages"][0]["frames"][0]["component"]["components"]
    gallery_component = next(item for item in components if item["attributes"]["data-sjd-section"] == "galerie")
    data = json.loads(gallery_component["attributes"]["data-sjd-data"])
    data["images"][0]["src"] = "https://evil.example/image.png"
    gallery_component["attributes"]["data-sjd-data"] = json.dumps(data)

    with pytest.raises(ProjectError, match="image hors des médias locaux autorisés"):
        project_to_sections(project)
