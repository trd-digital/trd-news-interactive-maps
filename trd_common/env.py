"""Tiny, dependency-free ``.env`` loader.

Finds the repo-root ``.env`` (walking up from this file) and loads any
``KEY=value`` pairs into ``os.environ`` without overwriting values already set
in the real environment. No third-party dependency required, so it behaves the
same under every interpreter used across the projects.
"""

from __future__ import annotations

import os
from pathlib import Path

_loaded = False


def find_dotenv(start: Path | None = None) -> Path | None:
    """Return the nearest ``.env`` at or above ``start`` (default: this package)."""
    here = (start or Path(__file__).resolve().parent)
    for directory in [here, *here.parents]:
        candidate = directory / ".env"
        if candidate.is_file():
            return candidate
    return None


def load_dotenv(path: str | os.PathLike | None = None, override: bool = False) -> bool:
    """Load ``.env`` into ``os.environ``.

    Existing environment variables win unless ``override=True``. Returns True if
    a file was found and read. Called automatically the first time a key is
    resolved; safe to call directly too.
    """
    global _loaded
    dotenv_path = Path(path) if path else find_dotenv()
    if not dotenv_path or not dotenv_path.is_file():
        return False

    for raw in dotenv_path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and (override or key not in os.environ):
            os.environ[key] = value

    _loaded = True
    return True


def ensure_loaded() -> None:
    """Load ``.env`` once per process (idempotent)."""
    if not _loaded:
        load_dotenv()
