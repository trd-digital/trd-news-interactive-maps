"""Build data.geojson for the Nate Paul Austin portfolio map.

Reads the reporters' final sheet (Travis CAD parcel export with 2026 appraised
values in "Stat" + the 9/1/26 status + "*blurbs for the map*"), geocodes each situs address with Google Maps
via trd_common (cached in geocode_cache.csv) and writes ONE FEATURE PER PARCEL.

What ships (public-record + editorial fields only): address, TCAD prop_id,
status bucket, 2026 appraised value, current owner, the Paul-linked entity
that owned it per the June 2025 assessor roll, last deed date, and the sheet's
"*blurbs for the map*" text. The "informal notes (not for map)" column is NOT
exported. Trailing asterisks on the sheet's status labels (undefined footnote)
are stripped before bucketing.

    /Users/afarence/opt/anaconda3/bin/python build_data.py
"""

from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
sys.path.insert(0, str(REPO))

CSV = HERE / "Nate Paul Portfolio - Open Corporates - Final List.csv"
OUT = HERE / "data.geojson"
CACHE = HERE / "geocode_cache.csv"

# Status buckets — the map's categorical color. The sheet's 9/1/26 labels
# (lower-cased, trailing "*" stripped, "company"/"entity" variants merged) map
# onto these four; see bucket_status().
STATUS_OWNED = "Owned by Paul-affiliated entity"
STATUS_BOUGHT_BACK = "Sold at foreclosure, then bought back"
STATUS_AUCTION = "Sold at foreclosure auction"
STATUS_SOLD = "Sold"
STATUS_ORDER = [STATUS_OWNED, STATUS_BOUGHT_BACK, STATUS_AUCTION, STATUS_SOLD]

# Street-name fixes for geocoding + display (assessor abbreviations).
STREET_FIX = {
    "U S HY 183": "US Hwy 183",
    "CAPITAL OF TX HY": "Capital of Texas Hwy",
}
SUFFIX = {"AVE": "Ave.", "ST": "St.", "RD": "Rd.", "DR": "Dr.", "BLVD": "Blvd.", "LN": "Ln.", "": ""}
PREFIX = {"N": "N.", "S": "S.", "E": "E.", "W": "W.", "": ""}

# Geocode-query overrides by prop_id. 176237 (Galleria Oaks): Google resolves
# "13376 N US Hwy 183" to Leander; US 183 is signed Research Blvd there.
GEOCODE_OVERRIDES = {
    "176237": "13376 Research Blvd, Austin, TX 78750",
}

# Two parcels that share (or nearly share) a geocoded point get nudged apart
# so every pin is clickable. ~22 m ring; recorded as `spread: true`.
SPREAD_M = 22.0


def clean(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()


def money(s):
    s = clean(s).replace("$", "").replace(",", "")
    return int(float(s)) if s else None


def ordinal(n):
    n = int(n)
    if 10 <= n % 100 <= 20:
        suf = "th"
    else:
        suf = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return "%d%s" % (n, suf)


def title_words(s):
    return " ".join(w.capitalize() if not w.isdigit() else w for w in s.split())


def street_display(row):
    st = clean(row["situs_street"])
    st = STREET_FIX.get(st, title_words(st))
    if st.isdigit():
        st = ordinal(st)
    parts = [PREFIX.get(clean(row["situs_street_prefx"]), clean(row["situs_street_prefx"])), st,
             SUFFIX.get(clean(row["situs_street_suffix"]), clean(row["situs_street_suffix"]))]
    return " ".join(p for p in parts if p)


def display_address(row):
    num, unit = clean(row["situs_num"]), clean(row["situs_unit"])
    s = street_display(row)
    if num:
        s = num + " " + s
    if unit:
        s += " #" + unit
    return s


def geocode_address(row):
    num = clean(row["situs_num"])
    st = clean(row["situs_street"])
    st = STREET_FIX.get(st, st)
    parts = [num, clean(row["situs_street_prefx"]), st, clean(row["situs_street_suffix"])]
    return " ".join(p for p in parts if p) + ", Austin, TX " + clean(row["situs_zip"])


def bucket_status(raw, prop_id):
    r = clean(raw).rstrip("*").strip().lower()
    if r.startswith("currently owned"):
        return STATUS_OWNED
    if "bought it back" in r:
        return STATUS_BOUGHT_BACK
    if r.startswith("sold at foreclosure"):
        return STATUS_AUCTION
    if r == "sold":
        return STATUS_SOLD
    raise ValueError("unrecognized status %r for prop_id %s" % (raw, prop_id))


def iso_date(s):
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", clean(s))
    return m.group(0) if m else ""


def spread(features):
    """Nudge coincident/near-coincident points onto a small ring."""
    groups = {}
    for f in features:
        lon, lat = f["geometry"]["coordinates"]
        key = (round(lat, 4), round(lon, 4))   # ~11 m buckets
        groups.setdefault(key, []).append(f)
    for key, fs in groups.items():
        if len(fs) < 2:
            continue
        lat0 = sum(f["geometry"]["coordinates"][1] for f in fs) / len(fs)
        lon0 = sum(f["geometry"]["coordinates"][0] for f in fs) / len(fs)
        dlat = SPREAD_M / 111_320.0
        dlon = SPREAD_M / (111_320.0 * math.cos(math.radians(lat0)))
        for i, f in enumerate(fs):
            a = 2 * math.pi * i / len(fs)
            f["geometry"]["coordinates"] = [round(lon0 + dlon * math.cos(a), 6), round(lat0 + dlat * math.sin(a), 6)]
            f["properties"]["spread"] = True


def main():
    import pandas as pd
    from trd_common.geocode import Geocoder

    df = pd.read_csv(CSV, dtype=str).fillna("")
    geo = Geocoder(cache_file=str(CACHE))

    features = []
    for _, row in df.iterrows():
        pid = clean(row["prop_id"])
        addr = GEOCODE_OVERRIDES.get(pid) or geocode_address(row)
        lat, lon, status = geo.geocode(addr)
        if not (isinstance(lat, float) and lat == lat):
            print("  !! geocode failed:", addr, status)
            continue
        v26 = money(row["Stat"])
        note = clean(row["*blurbs for the map*"])
        features.append({
            "type": "Feature",
            "properties": {
                "prop_id": pid,
                "address": display_address(row),
                "zip": clean(row["situs_zip"]),
                "status": bucket_status(row["status (as of 9/1/26)"], pid),
                "val_2026": v26,
                "owner": clean(row["current owner"]),
                "np_entity": clean(row["py_owner_name"]),
                "deed_date": iso_date(row["deed_date"]),
                "prop_type": "Personal property" if clean(row["prop_type_cd"]) == "P" else "Real property",
                "note": note or "",
                "approx": not clean(row["situs_num"]),
                "spread": False,
            },
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
        })
    geo.save_cache()

    # Pin radius: sqrt scale on the 2026 appraisal, 5–22 px at full zoom.
    vals = [f["properties"]["val_2026"] or 0 for f in features]
    vmax = max(vals) or 1
    for f in features:
        v = f["properties"]["val_2026"] or 0
        f["properties"]["r"] = round(5 + 17 * math.sqrt(v / vmax), 2)

    spread(features)
    features.sort(key=lambda f: -(f["properties"]["val_2026"] or 0))

    out = {"type": "FeatureCollection", "features": features}
    OUT.write_text(json.dumps(out, indent=1) + "\n")
    print("Wrote %d parcels -> %s" % (len(features), OUT.name))
    for s in STATUS_ORDER:
        fs = [f for f in features if f["properties"]["status"] == s]
        print("  %-30s %2d parcels  $%s" % (s, len(fs), format(sum(f["properties"]["val_2026"] or 0 for f in fs), ",")))
    for f in features:
        p = f["properties"]
        print("  %-30s %-32s %s%s [%.5f, %.5f]" % (
            p["status"], p["address"], format(p["val_2026"] or 0, ","),
            " (approx)" if p["approx"] else (" (spread)" if p["spread"] else ""),
            f["geometry"]["coordinates"][1], f["geometry"]["coordinates"][0]))


if __name__ == "__main__":
    main()
