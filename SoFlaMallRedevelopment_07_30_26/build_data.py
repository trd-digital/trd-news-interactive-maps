"""Build data.geojson for the South Florida mall-redevelopment map.

Reads the source CSV, geocodes the addresses (via trd_common, cached), derives
the county for color-coding, orders the malls south->north by county, and writes
a clean GeoJSON the map loads. Re-runnable: geocoding hits geocode_cache.csv, so
it makes no API calls after the first run.

    /Users/afarence/opt/anaconda3/bin/python build_data.py
"""

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))  # repo root, for trd_common

from trd_common.geocode import Geocoder  # noqa: E402

CSV = HERE / "Map_Mall_Redevelopments_SFla - FOR_MAP.csv"

# South Florida's three counties, ordered south -> north for the map narrative.
COUNTY_BY_CITY = {
    "Doral": "Miami-Dade",
    "South Miami": "Miami-Dade",
    "Bal Harbour": "Miami-Dade",
    "Fort Lauderdale": "Broward",
    "Boynton Beach": "Palm Beach",
    "Boca Raton": "Palm Beach",
    "Wellington": "Palm Beach",
}
COUNTY_ORDER = {"Miami-Dade": 0, "Broward": 1, "Palm Beach": 2}


def city_of(full_address: str) -> str:
    # "1455 NW 107th Ave., Doral, FL 33172" -> "Doral"
    parts = [p.strip() for p in str(full_address).split(",")]
    return parts[1] if len(parts) > 1 else ""


def main():
    import pandas as pd

    df = pd.read_csv(CSV, dtype=str).fillna("")
    gc = Geocoder(cache_file=str(HERE / "geocode_cache.csv"))
    gc.geocode_frame(df, "full_address")

    df["county"] = df["full_address"].map(lambda a: COUNTY_BY_CITY.get(city_of(a), "Other"))
    df["__order"] = df["county"].map(lambda c: COUNTY_ORDER.get(c, 9))
    df = df.sort_values(["__order"], kind="stable").reset_index(drop=True)

    features = []
    for i, row in df.iterrows():
        if pd.isna(row["__lon"]) or pd.isna(row["__lat"]):
            continue
        features.append({
            "type": "Feature",
            "properties": {
                "n": i + 1,
                "mall": row["Mall"].strip(),
                "address": row["display_address"].strip(),
                "owner": row["owner"].strip(),
                "description": row["project description"].strip(),
                "county": row["county"],
            },
            "geometry": {"type": "Point", "coordinates": [float(row["__lon"]), float(row["__lat"])]},
        })

    out = {"type": "FeatureCollection", "features": features}
    (HERE / "data.geojson").write_text(json.dumps(out, indent=2) + "\n")
    print("Wrote %d features to data.geojson" % len(features))
    for f in features:
        p = f["properties"]
        print("  %d. [%s] %s" % (p["n"], p["county"], p["mall"]))


if __name__ == "__main__":
    main()
