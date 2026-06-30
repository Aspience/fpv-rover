from pathlib import Path

from modules._dotted import load_dotted_submodule

_dir = Path(__file__).parent
_pkg = __name__

config = load_dotted_submodule(_pkg, _dir, "config")
schema = load_dotted_submodule(_pkg, _dir, "schema")
service = load_dotted_submodule(_pkg, _dir, "service")
module = load_dotted_submodule(_pkg, _dir, "module")
