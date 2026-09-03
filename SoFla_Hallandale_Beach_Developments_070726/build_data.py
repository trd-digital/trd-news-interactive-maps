"""Build data.geojson for the Hallandale Beach developments map.

Reads the source CSV, geocodes the addresses (via trd_common, cached), and
writes a clean numbered GeoJSON the map loads. The CSV's `full_address` is
street-only, so ", Hallandale Beach, FL 33009" is appended for geocoding.

Re-runnable: geocoding hits geocode_cache.csv, so repeat runs make no API calls.

    /Users/afarence/opt/anaconda3/bin/python build_data.py
"""

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))  # repo root, for trd_common

from trd_common.geocode import Geocoder  # noqa: E402

CSV = HERE / "Hallandale Beach Developments - Sheet1.csv"
SUFFIX = ", Hallandale Beach, FL 33009"


def main():
    import pandas as pd

    df = pd.read_csv(CSV, dtype=str).fillna("")
    gc = Geocoder(cache_file=str(HERE / "geocode_cache.csv"))
    gc.geocode_frame(df, "full_address", append_suffix=SUFFIX)

    features = []
    for i, row in df.iterrows():
        if pd.isna(row["__lon"]) or pd.isna(row["__lat"]):
            print("  !! geocode failed:", row["full_address"])
            continue
        features.append({
            "type": "Feature",
            "properties": {
                "n": i + 1,
                "project": row["project name"].strip(),
                "address": row["full_address"].strip(),
                "developer": row["developers"].strip(),
                "description": row["description"].strip(),
                "story": row["story_link"].strip(),
            },
            "geometry": {"type": "Point", "coordinates": [float(row["__lon"]), float(row["__lat"])]},
        })

    out = {"type": "FeatureCollection", "features": features}
    (HERE / "data.geojson").write_text(json.dumps(out, indent=2) + "\n")
    print("Wrote %d developments -> data.geojson" % len(features))
    for f in features:
        p = f["properties"]
        print("  %d. %s (%s)" % (p["n"], p["project"], p["developer"]))


if __name__ == "__main__":
    main()
