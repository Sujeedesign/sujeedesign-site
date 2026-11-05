"""Vignettes des vidéos Instagram : rattrapage des posts importés sans poster.

Les premières vidéos ont été importées alors que l'image n'avait pas ffmpeg :
la grille affichait des rectangles noirs. `backfill_instagram_posters` comble
ces manques au démarrage.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import repo
from app.admin import backfill_instagram_posters

pytestmark = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg absent")


def _video(path: Path) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=black:s=160x160:d=1",
            "-pix_fmt",
            "yuv420p",
            str(path),
        ],
        check=True,
        timeout=60,
    )


def _conn(client: TestClient):
    from app import db, settings  # noqa: PLC0415

    conn = db.connect(Path(client.app.state.db_path))  # type: ignore[attr-defined]
    db.init_db(conn)
    return conn


def test_vignette_creee_pour_une_video_sans_poster(client: TestClient) -> None:
    media = Path(client.app.state.media_dir)  # type: ignore[attr-defined]
    media.mkdir(parents=True, exist_ok=True)
    _video(media / "clip.mp4")
    conn = _conn(client)
    try:
        post_id = repo.add_instagram_post(
            conn,
            {"kind": "video", "src": "/medias/clip.mp4", "poster": "", "caption": ""},
        )
        conn.commit()
        assert post_id is not None

        created = backfill_instagram_posters(conn, media)
        assert created == 1

        row = repo.get_instagram_post(conn, post_id)
        assert row is not None
        poster = str(row["poster"])
        assert poster.startswith("/medias/")
        assert (media / Path(poster).name).is_file()
    finally:
        conn.close()


def test_poster_deja_present_non_touche(client: TestClient) -> None:
    media = Path(client.app.state.media_dir)  # type: ignore[attr-defined]
    media.mkdir(parents=True, exist_ok=True)
    conn = _conn(client)
    try:
        post_id = repo.add_instagram_post(
            conn,
            {"kind": "video", "src": "/medias/absent.mp4", "poster": "/medias/deja.jpg", "caption": ""},
        )
        conn.commit()
        assert post_id is not None
        assert backfill_instagram_posters(conn, media) == 0
    finally:
        conn.close()
