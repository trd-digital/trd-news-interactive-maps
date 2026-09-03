"""Reusable Google Maps geocoding with a CSV cache.

Encapsulates the geocoding boilerplate that used to be copy-pasted into every
project notebook: API-key resolution, address normalization, an on-disk cache
(``norm_address,lat,lon``), throttling, and retry/backoff.

Typical notebook usage
----------------------
    import sys, pathlib
    sys.path.append(str(pathlib.Path.cwd().parent))   # repo root on path
    from trd_common.geocode import Geocoder

    gc = Geocoder()                       # key from %store / env, cache in cwd
    df = gc.geocode_frame(df, "Address",  # adds __lat / __lon / __geocode_status
                          append_suffix=", Riviera Beach, FL")

Or geocode a single address:
    lat, lon, status = gc.geocode("West Palm Beach, FL")

The cache file (default ``geocode_cache.csv`` in the working directory) is
compatible with the caches already sitting in the project folders, so existing
work is reused rather than re-billed.
"""

from __future__ import annotations

import math
import os
import re
import time

from .env import ensure_loaded

NAN = float("nan")

# Statuses returned alongside coordinates.
STATUS_OK = "OK"            # freshly geocoded from the API
STATUS_CACHE = "CACHE"      # served from the on-disk cache
STATUS_EMPTY = "EMPTY"      # blank / non-string input
STATUS_ZERO = "ZERO_RESULTS"  # API returned no match


def normalize_address(addr) -> str:
    """Cache key: lowercased, whitespace-collapsed address."""
    return " ".join(str(addr).strip().lower().split())


def resolve_api_key(api_key: str | None = None) -> str:
    """Find a Google Maps API key.

    Order: explicit argument, then ``GOOGLE_MAPS_API_KEY`` (from the real
    environment or the repo-root ``.env``), then an IPython ``%store``-d
    ``google_maps_API_Key`` (the convention used across the existing notebooks).
    """
    if api_key:
        return api_key

    ensure_loaded()  # pull repo-root .env into os.environ (once)
    env = os.getenv("GOOGLE_MAPS_API_KEY")
    if env:
        return env

    try:  # notebook %store fallback
        ip = get_ipython()  # type: ignore[name-defined]  # noqa: F821
        ip.run_line_magic("store", "-r google_maps_API_Key")
        stored = ip.user_ns.get("google_maps_API_Key")
        if stored:
            return stored
    except Exception:
        pass

    raise ValueError(
        "No Google Maps API key found. Pass api_key=..., set the "
        "GOOGLE_MAPS_API_KEY env var, or `%store google_maps_API_Key` in the "
        "notebook."
    )


class Geocoder:
    """Google Maps geocoder backed by a CSV cache.

    Parameters
    ----------
    api_key:
        Explicit key; if omitted it is resolved via :func:`resolve_api_key`.
    cache_file:
        CSV path for the ``norm_address,lat,lon`` cache. Loaded on init (if it
        exists) and written by :meth:`save_cache` / :meth:`geocode_frame`.
    requests_per_second:
        Throttle applied by :meth:`geocode_frame` to respect API quotas.
    """

    def __init__(
        self,
        api_key: str | None = None,
        cache_file: str = "geocode_cache.csv",
        requests_per_second: float = 5,
    ):
        import googlemaps  # imported lazily so importing the module is cheap

        self.client = googlemaps.Client(key=resolve_api_key(api_key))
        self.cache_file = cache_file
        self.requests_per_second = max(0.0, requests_per_second)
        self.cache: dict[str, tuple[float, float]] = {}
        self._load_cache()

    # ---- cache -----------------------------------------------------------
    def _load_cache(self) -> None:
        if not os.path.exists(self.cache_file):
            return
        import pandas as pd

        df = pd.read_csv(self.cache_file)
        df = df.dropna(subset=["norm_address"]).drop_duplicates("norm_address")
        self.cache = {
            row.norm_address: (row.lat, row.lon) for row in df.itertuples()
        }

    def save_cache(self) -> None:
        """Persist the in-memory cache to :attr:`cache_file`."""
        if not self.cache:
            return
        import pandas as pd

        pd.DataFrame(
            [{"norm_address": k, "lat": v[0], "lon": v[1]} for k, v in self.cache.items()]
        ).to_csv(self.cache_file, index=False)

    # ---- geocoding -------------------------------------------------------
    def geocode(
        self,
        addr,
        retry: int = 3,
        backoff: float = 1.6,
        force_regenerate: bool = False,
    ) -> tuple[float, float, str]:
        """Geocode a single address to ``(lat, lon, status)``.

        Cached hits return instantly. Misses hit the Google Maps API with
        ``retry`` attempts and exponential ``backoff``. Failures (and
        zero-result addresses) are cached as ``NaN`` so they aren't retried on
        every run; pass ``force_regenerate=True`` to bypass the cache.
        """
        if not isinstance(addr, str) or not addr.strip():
            return (NAN, NAN, STATUS_EMPTY)

        na = normalize_address(addr)
        if not force_regenerate and na in self.cache:
            lat, lon = self.cache[na]
            if not (_isnan(lat) or _isnan(lon)):
                return (lat, lon, STATUS_CACHE)

        import googlemaps

        last_status = "UNKNOWN"
        for attempt in range(retry):
            try:
                results = self.client.geocode(addr)
                if results:
                    loc = results[0]["geometry"]["location"]
                    lat, lon = loc["lat"], loc["lng"]
                    self.cache[na] = (lat, lon)
                    return (lat, lon, STATUS_OK)
                last_status = STATUS_ZERO
            except googlemaps.exceptions.ApiError as e:
                last_status = f"API_ERROR:{getattr(e, 'status', 'UNKNOWN')}"
            except googlemaps.exceptions.TransportError:
                last_status = "TRANSPORT"
            except Exception:
                last_status = "EXCEPTION"
            time.sleep(backoff ** attempt)

        self.cache[na] = (NAN, NAN)
        return (NAN, NAN, last_status)

    def geocode_frame(
        self,
        df,
        address_col: str,
        lat_col: str = "__lat",
        lon_col: str = "__lon",
        status_col: str = "__geocode_status",
        append_suffix: str | None = None,
        force_regenerate: bool = False,
        save: bool = True,
        verbose: bool = True,
    ):
        """Geocode every row of a DataFrame, throttled, with progress output.

        Adds ``lat_col`` / ``lon_col`` / ``status_col`` and returns the same
        DataFrame. ``append_suffix`` (e.g. ``", Riviera Beach, FL"``) is added
        to any address that doesn't already contain it — handy when the source
        data is street addresses without a city/state. The cache is saved on
        completion unless ``save=False``.
        """
        import pandas as pd

        if address_col not in df.columns:
            raise ValueError(
                f"Column {address_col!r} not found. Got: {df.columns.tolist()}"
            )

        addresses = df[address_col].astype(str).str.strip()
        if append_suffix:
            addresses = addresses.map(lambda s: _append_suffix(s, append_suffix))

        min_interval = 1.0 / self.requests_per_second if self.requests_per_second else 0.0
        lats, lons, statuses = [], [], []
        counts = {STATUS_OK: 0, STATUS_CACHE: 0, "FAIL": 0}
        last = 0.0
        n = len(addresses)

        for i, addr in enumerate(addresses, start=1):
            wait = last + min_interval - time.time()
            if wait > 0:
                time.sleep(wait)
            lat, lon, status = self.geocode(addr, force_regenerate=force_regenerate)
            counts[status if status in (STATUS_OK, STATUS_CACHE) else "FAIL"] += 1
            lats.append(lat)
            lons.append(lon)
            statuses.append(status)
            last = time.time()
            if verbose and (i % 5 == 0 or i == n):
                print(
                    f"[{i}/{n}] OK:{counts[STATUS_OK]} "
                    f"CACHE:{counts[STATUS_CACHE]} FAIL:{counts['FAIL']} "
                    f"(last={status})"
                )

        if save:
            self.save_cache()

        df[lat_col] = pd.to_numeric(lats, errors="coerce")
        df[lon_col] = pd.to_numeric(lons, errors="coerce")
        df[status_col] = statuses
        if verbose:
            mapped = df[lat_col].notna() & df[lon_col].notna()
            print(f"Rows with coordinates: {int(mapped.sum())} / {n}")
        return df


def _isnan(x) -> bool:
    try:
        return math.isnan(x)
    except TypeError:
        return False


def _append_suffix(addr: str, suffix: str) -> str:
    """Append ``suffix`` unless its city/state already appears in ``addr``."""
    if not isinstance(addr, str) or not addr.strip():
        return ""
    s = addr.strip()
    # Compare on the alphabetic tokens of the suffix (ignore punctuation).
    needle = re.sub(r"[^a-z ]", "", suffix.lower()).split()
    if needle and all(tok in s.lower() for tok in needle):
        return s
    return s + suffix
