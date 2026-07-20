#!/usr/bin/env python3
"""CLI wrapper around silence_core."""

from __future__ import annotations

import sys
from pathlib import Path

# Allow running without installing the package (local checkout).
_REPO_ROOT = Path(__file__).resolve().parents[2]
_CORE = _REPO_ROOT / "packages" / "silence_core"
if _CORE.exists() and str(_CORE) not in sys.path:
    sys.path.insert(0, str(_CORE))

from silence_core.cli import main

if __name__ == "__main__":
    sys.exit(main())
