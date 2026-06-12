"""Application version helpers."""

from __future__ import annotations

from core.config import REPO_ROOT

VERSION_FILE = REPO_ROOT / "version.txt"


def normalize_tag(tag: str) -> str:
    return tag.strip().removeprefix("v")


def read_version_file() -> str | None:
    if not VERSION_FILE.is_file():
        return None
    text = VERSION_FILE.read_text(encoding="utf-8").strip()
    return text or None


def get_app_version(fallback: str = "0.0.0") -> str:
    from_file = read_version_file()
    if from_file is not None:
        return from_file
    return fallback
