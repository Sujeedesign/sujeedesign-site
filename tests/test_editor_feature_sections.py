from app import render as render_module
from sujee_editor.blocks import DEFAULT_BLOCKS, default_data
from sujee_editor.blocks.validate import validate_data


def test_zone_libre_image_stack_validates_local_images_and_rejects_remote_sources():
    block = DEFAULT_BLOCKS["zone-libre"]
    data = default_data(block)
    data["columns"][0]["elements"] = [{
        "type": "image-stack",
        "images": [
            {"src": "/medias/first.webp", "alt": "Première image"},
            {"src": "/assets/second.png", "alt": "Deuxième image"},
        ],
    }]

    assert validate_data(block, data) == []
    data["columns"][0]["elements"][0]["images"][1]["src"] = "https://example.org/image.png"
    assert any(error.rule == "unsafe_media" for error in validate_data(block, data))


def test_zone_libre_image_stack_rejects_malformed_image_collections():
    block = DEFAULT_BLOCKS["zone-libre"]
    empty_stack = default_data(block)
    empty_stack["columns"][0]["elements"] = [{"type": "image-stack", "images": []}]
    assert validate_data(block, empty_stack) == []  # Un bloc vide reste enregistrable pendant sa composition.

    cases = (
        ("not-a-list", "bad_item"),
        ([None], "bad_item"),
        ([{"src": []}], "unsafe_media"),
        ([{"src": f"/medias/{index}.webp", "alt": ""} for index in range(13)], "bad_item"),
    )
    for images, expected_rule in cases:
        data = default_data(block)
        data["columns"][0]["elements"] = [{"type": "image-stack", "images": images}]
        assert any(error.rule == expected_rule for error in validate_data(block, data))


def test_zone_libre_image_stack_renders_images_in_order_inside_a_vertical_container():
    section = {
        "id": 1,
        "type": "zone-libre",
        "data": {"columns": [{"span": "12", "elements": [{
            "type": "image-stack",
            "images": [
                {"src": "/medias/first.webp", "alt": "Première image"},
                {"src": "/medias/second.webp", "alt": "Deuxième image"},
            ],
        }]}]},
    }

    rendered = render_module.section_html(render_module.build_env(), section, envelopes=False)

    assert 'class="zone-libre__image-stack"' in rendered
    assert rendered.index('src="/medias/first.webp"') < rendered.index('src="/medias/second.webp"')
    assert 'alt="Première image"' in rendered and 'alt="Deuxième image"' in rendered


def test_every_section_exposes_safe_internal_and_external_spacing():
    names = {field.name for block in DEFAULT_BLOCKS.values() for field in block.fields}
    expected = {
        "padding_top", "padding_right", "padding_bottom", "padding_left",
        "margin_top", "margin_right", "margin_bottom", "margin_left",
    }
    assert expected <= names
    for block in DEFAULT_BLOCKS.values():
        data = default_data(block)
        assert all(data[name] is None for name in expected)
        data["padding_top"] = 48
        data["margin_bottom"] = 32
        assert validate_data(block, data) == []
        data["padding_top"] = 241
        assert any(error.field == "padding_top" and error.rule == "spacing_range" for error in validate_data(block, data))


def test_section_spacing_renders_as_validated_pixel_values_only():
    section = {"id": 1, "type": "chapter", "data": {
        "title": "Titre", "section_background": "custom", "section_background_color": "#123456",
        "padding_top": 48, "margin_bottom": 32,
    }}
    rendered = render_module.section_html(render_module.build_env(), section, envelopes=False)
    assert 'padding-top:48px' in rendered
    assert 'margin-bottom:32px' in rendered
    assert '--sjd-section-background:#123456' in rendered

    section["data"]["padding_top"] = "0px;position:fixed"
    rendered = render_module.section_html(render_module.build_env(), section, envelopes=False)
    assert "position:fixed" not in rendered
    assert 'padding-top:' not in rendered
