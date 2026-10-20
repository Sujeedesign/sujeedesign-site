from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "sujee_editor" / "editor" / "frontend"
ASSETS = ROOT / "sujee_editor" / "editor" / "static" / "visual"


def test_visual_editor_uses_a_pinned_bsd_grapesjs_core() -> None:
    package = json.loads((FRONTEND / "package.json").read_text(encoding="utf-8"))
    assert package["dependencies"]["grapesjs"] == "0.23.8"
    assert (FRONTEND / "package-lock.json").is_file()


def test_visual_editor_build_is_self_hosted_and_present() -> None:
    js_bundle = ASSETS / "visual-editor.js"
    css_bundle = ASSETS / "visual-editor.css"
    assert js_bundle.is_file(), "run npm ci && npm run build in the editor frontend"
    assert css_bundle.is_file(), "run npm ci && npm run build in the editor frontend"
    assert not (ASSETS / "index.html").exists(), "the development harness must not ship publicly"
    contents = js_bundle.read_text(encoding="utf-8") + css_bundle.read_text(encoding="utf-8")
    for remote_runtime in ("unpkg.com/grapesjs", "cdn.jsdelivr.net/npm/grapesjs", "studio-sdk"):
        assert remote_runtime not in contents
