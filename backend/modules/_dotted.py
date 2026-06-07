"""Load `{module}.{role}.py` files as importable submodules."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType


def load_dotted_submodule(package: str, package_dir: Path, role: str) -> ModuleType:
    module_slug = package.rsplit(".", 1)[-1]
    filename = f"{module_slug}.{role}.py"
    full_name = f"{package}.{role}"
    path = package_dir / filename

    if full_name in sys.modules:
        return sys.modules[full_name]

    if not path.is_file():
        raise ModuleNotFoundError(f"{full_name} ({path})")

    spec = importlib.util.spec_from_file_location(full_name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load {full_name} from {path}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[full_name] = module
    spec.loader.exec_module(module)
    return module
