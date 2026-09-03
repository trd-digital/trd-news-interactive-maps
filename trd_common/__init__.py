"""Shared, tracked tooling for the TRD interactive maps projects.

Public names are imported lazily (PEP 562): the first time you access one, its
submodule is loaded. This keeps `import trd_common` cheap (no pandas/googlemaps
until needed) and avoids the re-import warning when running a submodule with
`python -m trd_common.<sub>`.
"""

import importlib

# public name -> submodule that defines it
_EXPORTS = {
    "Geocoder": "geocode",
    "normalize_address": "geocode",
    "resolve_api_key": "geocode",
    "load_dotenv": "env",
    "find_dotenv": "env",
    "frame_to_geojson": "geojson",
    "write_geojson": "geojson",
    "new_graphic": "scaffold",
    "status_of": "sync",
    "status_all": "sync",
    "sync_graphic": "sync",
}

__all__ = sorted(_EXPORTS)


def __getattr__(name):
    module = _EXPORTS.get(name)
    if module is None:
        raise AttributeError("module %r has no attribute %r" % (__name__, name))
    return getattr(importlib.import_module("." + module, __name__), name)


def __dir__():
    return sorted(list(globals().keys()) + __all__)
