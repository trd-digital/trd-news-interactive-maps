"""Turn a geocoded DataFrame into a GeoJSON FeatureCollection.

The other half of the data pipeline: after :class:`trd_common.geocode.Geocoder`
adds ``__lat`` / ``__lon`` columns, this writes the ``data.geojson`` a graphic
loads. Point geometry only (which is what the TRD maps use).
"""

from __future__ import annotations

import json


def frame_to_geojson(
    df,
    lon_col: str = "__lon",
    lat_col: str = "__lat",
    properties=None,
    drop_missing: bool = True,
):
    """Build a GeoJSON FeatureCollection (dict) from a DataFrame of points.

    Parameters
    ----------
    lon_col, lat_col:
        Coordinate columns (default matches ``Geocoder.geocode_frame`` output).
    properties:
        Columns to carry into each feature's ``properties``. Defaults to every
        column that isn't a coordinate and doesn't start with ``__`` (so the
        geocoder's internal ``__lat``/``__lon``/``__geocode_status`` are
        dropped, but your real data columns are kept).
    drop_missing:
        Skip rows without valid coordinates (the default) rather than emitting
        null-geometry features.
    """
    import pandas as pd

    if properties is None:
        properties = [
            c for c in df.columns if c not in (lon_col, lat_col) and not str(c).startswith("__")
        ]

    features = []
    for _, row in df.iterrows():
        lon, lat = row[lon_col], row[lat_col]
        if drop_missing and (pd.isna(lon) or pd.isna(lat)):
            continue
        props = {
            c: (None if pd.isna(row[c]) else row[c]) for c in properties
        }
        features.append(
            {
                "type": "Feature",
                "properties": props,
                "geometry": {"type": "Point", "coordinates": [float(lon), float(lat)]},
            }
        )

    return {"type": "FeatureCollection", "features": features}


def write_geojson(fc, path) -> int:
    """Write a FeatureCollection to ``path``; return the feature count."""
    with open(path, "w") as fh:
        json.dump(fc, fh)
    return len(fc.get("features", []))
