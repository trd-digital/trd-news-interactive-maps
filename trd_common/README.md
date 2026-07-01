# trd_common

Shared, reusable code for the TRD interactive maps projects — so common
operations (geocoding, data cleaning, geojson helpers, etc.) live in one place
instead of being copy-pasted into a notebook in every project folder.

## Usage from a project notebook

From a notebook in any project directory, add the repo root to the path and
import:

```python
import sys, pathlib
sys.path.append(str(pathlib.Path.cwd().parent))  # repo root

from trd_common import geocode  # example
```

## API keys

Copy `.env.example` (repo root) to `.env` and fill in your keys. `.env` is
git-ignored. `trd_common` loads it automatically, so `Geocoder()` finds
`GOOGLE_MAPS_API_KEY` with no extra setup:

```python
from trd_common.geocode import Geocoder
gc = Geocoder()   # key pulled from .env / environment
```

Resolution order for the key: explicit `Geocoder(api_key=...)` → environment /
`.env` (`GOOGLE_MAPS_API_KEY`) → notebook `%store google_maps_API_Key`.

## Notes

- This package is tracked in git; `.env` (secrets) is not.
