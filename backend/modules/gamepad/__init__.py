from pathlib import Path

from modules._dotted import load_dotted_submodule

_dir = Path(__file__).parent
_pkg = __name__

config = load_dotted_submodule(_pkg, _dir, "config")
utils = load_dotted_submodule(_pkg, _dir, "utils")
schema = load_dotted_submodule(_pkg, _dir, "schema")
module = load_dotted_submodule(_pkg, _dir, "module")
