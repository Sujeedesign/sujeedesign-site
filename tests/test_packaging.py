"""Le conteneur doit contenir tout ce que l'application importe.

Vécu le 17 octobre : `sujee_editor` vivait dans le dépôt mais pas dans l'image
(le Dockerfile ne copiait que `app`, `theme` et `seed`), donc le conteneur de
recette mourait à l'import alors que les 334 tests locaux passaient. Ce test
compare ce que le code importe à la racine du dépôt avec ce que le Dockerfile
copie.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCKERFILE = ROOT / "Dockerfile"
SOURCE_DIRS = ("app", "sujee_editor")

IMPORT_LINE = re.compile(r"^\s*(?:from\s+([A-Za-z_][\w]*)|import\s+([A-Za-z_][\w]*))", re.M)
COPY_LINE = re.compile(r"^COPY\s+(?:--\S+\s+)*(\S+)", re.M)


def top_level_names() -> set[str]:
    """Noms importés à la racine depuis `app/` et `sujee_editor/`."""
    names: set[str] = set()
    for directory in SOURCE_DIRS:
        for path in sorted((ROOT / directory).rglob("*.py")):
            for match in IMPORT_LINE.finditer(path.read_text(encoding="utf-8")):
                name = match.group(1) or match.group(2)
                names.add(name)
    return names


def repo_packages(names: set[str]) -> set[str]:
    """Ceux de ces noms qui sont des paquets du dépôt (pas des dépendances)."""
    return {name for name in names if (ROOT / name / "__init__.py").is_file()}


def copied_roots() -> set[str]:
    roots: set[str] = set()
    for target in COPY_LINE.findall(DOCKERFILE.read_text(encoding="utf-8")):
        cleaned = target.lstrip("./").rstrip("/")
        roots.add(cleaned.split("/")[0])
    return roots


def test_dockerfile_copies_every_repo_package() -> None:
    packages = repo_packages(top_level_names())
    assert "sujee_editor" in packages, "l'application n'importe plus le paquet de l'éditeur"
    missing = sorted(packages - copied_roots())
    assert not missing, f"paquets du dépôt absents de l'image : {missing}"


def test_theme_and_seed_are_copied() -> None:
    copied = copied_roots()
    assert {"app", "theme", "seed"} <= copied


def test_the_package_is_importable() -> None:
    """Le paquet vit à la racine du dépôt : il doit être importable sans installation."""
    assert str(ROOT) in sys.path or (ROOT / "sujee_editor" / "__init__.py").is_file()
    import sujee_editor

    assert sujee_editor.DEFAULT_BLOCKS, "le registre de blocs est vide"
