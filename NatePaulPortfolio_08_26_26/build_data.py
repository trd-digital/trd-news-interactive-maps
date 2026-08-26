"""Build data.geojson for the Nate Paul Austin portfolio map.

Reads the reporters' sheet (Travis CAD June 2025 assessor export + the
8/25/26 ownership check + notes), geocodes each situs address with Google Maps
via trd_common (cached in geocode_cache.csv) and writes ONE FEATURE PER PARCEL.

What ships (public-record + editorial fields only): address, TCAD prop_id,
status bucket, appraised values (June 2025 / 2026), current owner, the
Paul-linked entity that owned it per the June 2025 assessor roll, last deed
date, and a cleaned note. The raw "status (8.25.26 check)" text and the
reporters' working notes (voicemail follow-ups, "(link)", "No deed history?")
are NOT exported — see NOTE_OVERRIDES / STATUS_OVERRIDES below.

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

CSV = HERE / "Nate Paul Portfolio - Open Corporates - June 2025 Assessor.csv"
OUT = HERE / "data.geojson"
CACHE = HERE / "geocode_cache.csv"

# Status buckets — the map's categorical color. Keyed by the sheet's raw label
# (lower-cased prefix match, see bucket_status()).
STATUS_FORECLOSED = "Foreclosed"
STATUS_BOUGHT_BACK = "Foreclosed, then bought back"
STATUS_OWNED = "Still owned"
STATUS_ORDER = [STATUS_OWNED, STATUS_BOUGHT_BACK, STATUS_FORECLOSED]

# Per-parcel bucket overrides for rows whose raw label is a question rather
# than a status. 189103 (1808 E. Cesar Chavez): sheet says "FORECLOSED (but did
# NP buy it back????)"; the note says a bridge lender took it at auction and
# sold it to the current owner, so it maps to Foreclosed until confirmed.
STATUS_OVERRIDES = {
    "189103": STATUS_FORECLOSED,
}

# Cleaned notes for rows whose sheet note is internal (or needs a light edit).
# None → no note shown. Everything else passes through verbatim.
NOTE_OVERRIDES = {
    "189103": "Bridge lender Equity Secured Investments bought it at auction in Dec. 2025 and sold it to the current owner July 1.",
    "176237": "According to ABJ, the property was scheduled for foreclosure auction on Nov. 5, 2025, but the sale was postponed.",
    "388591": "Paradise Cove Marina on Lake Travis.",
    "854243": None,   # "No deed history"
    "826243": None,   # "No deed history"
    "408130": "The house at 814 Lavaca St. — the mailing address for most of the entities on this map.",
}

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
    if prop_id in STATUS_OVERRIDES:
        return STATUS_OVERRIDES[prop_id]
    r = clean(raw).lower()
    if r.startswith("still owned"):
        return STATUS_OWNED
    if "bought it back" in r:
        return STATUS_BOUGHT_BACK
    if r.startswith("foreclosed"):
        return STATUS_FORECLOSED
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
        v25 = money(row["appraised_val_June 2025"])
        v26 = money(row["appraised value 2026"])
        note = NOTE_OVERRIDES[pid] if pid in NOTE_OVERRIDES else clean(row["notes"])
        features.append({
            "type": "Feature",
            "properties": {
                "prop_id": pid,
                "address": display_address(row),
                "zip": clean(row["situs_zip"]),
                "status": bucket_status(row["status (8.25.26 check)"], pid),
                "val_2025": v25,
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

    # Pin radius: sqrt scale on the June 2025 appraisal, 5–22 px at full zoom.
    vals = [f["properties"]["val_2025"] or 0 for f in features]
    vmax = max(vals) or 1
    for f in features:
        v = f["properties"]["val_2025"] or 0
        f["properties"]["r"] = round(5 + 17 * math.sqrt(v / vmax), 2)

    spread(features)
    features.sort(key=lambda f: -(f["properties"]["val_2025"] or 0))

    out = {"type": "FeatureCollection", "features": features}
    OUT.write_text(json.dumps(out, indent=1) + "\n")
    print("Wrote %d parcels -> %s" % (len(features), OUT.name))
    for s in STATUS_ORDER:
        fs = [f for f in features if f["properties"]["status"] == s]
        print("  %-30s %2d parcels  $%s" % (s, len(fs), format(sum(f["properties"]["val_2025"] or 0 for f in fs), ",")))
    for f in features:
        p = f["properties"]
        print("  %-30s %-32s %s%s [%.5f, %.5f]" % (
            p["status"], p["address"], format(p["val_2025"] or 0, ","),
            " (approx)" if p["approx"] else (" (spread)" if p["spread"] else ""),
            f["geometry"]["coordinates"][1], f["geometry"]["coordinates"][0]))


if __name__ == "__main__":
    main()
