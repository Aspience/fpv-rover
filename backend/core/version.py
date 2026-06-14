"""Application version helpers."""

from __future__ import annotations

import os
from pathlib import Path

from core.config import REPO_ROOT

VERSION_FILE = REPO_ROOT / "version.txt"


def normalize_tag(tag: str) -> str:
    return tag.strip().removeprefix("v")


def _version_file_paths() -> tuple[Path, ...]:
    paths: list[Path] = []
    install_dir = os.environ.get("ROVER_OTA_INSTALL_DIR")
    if install_dir:
        paths.append(Path(install_dir) / "version.txt")
    paths.append(VERSION_FILE)
    return tuple(paths)


def read_version_file() -> str | None:
    for path in _version_file_paths():
        if path.is_file():
            text = path.read_text(encoding="utf-8").strip()
            if text:
                return text
    return None


def get_app_version(fallback: str = "0.0.0") -> str:
    from_file = read_version_file()
    if from_file is not None:
        return from_file
    return fallback
