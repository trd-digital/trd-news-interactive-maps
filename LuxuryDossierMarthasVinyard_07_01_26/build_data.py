"""Build the data files for the Martha's Vineyard Luxury Dossier map.

Outputs:
  regions.geojson  — the 6 Martha's Vineyard town polygons (Census TIGERweb),
                     with a `town` name and A-F `letter` matching the dossier.
  places.geojson   — notable places from places_source.json, geocoded from
                     `address` (via trd_common) or passed through from curated
                     `lat`/`lng`.

Re-runnable: the town boundaries are cached in _raw_towns.geojson and geocoding
hits geocode_cache.csv, so repeat runs make no network calls.

    /Users/afarence/opt/anaconda3/bin/python build_data.py
"""

import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))  # repo root, for trd_common

from trd_common.geocode import Geocoder  # noqa: E402

RAW_TOWNS = HERE / "_raw_towns.geojson"

# Dossier A-F order for the six Martha's Vineyard towns (Gosnold, the Elizabeth
# Islands, is in Dukes County but is not the Vineyard and is dropped).
TOWN_LETTER = {
    "Edgartown": "A",
    "Oak Bluffs": "B",
    "Tisbury": "C",
    "West Tisbury": "D",
    "Chilmark": "E",
    "Aquinnah": "F",
}

TIGERWEB = (
    "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/"
    "Places_CouSub_ConCity_SubMCD/MapServer/1/query"
)


def fetch_towns():
    """Dukes County (MA) subdivisions as GeoJSON; cached to _raw_towns.geojson."""
    if RAW_TOWNS.exists():
        return json.loads(RAW_TOWNS.read_text())
    params = urllib.parse.urlencode({
        "where": "STATE='25' AND COUNTY='007'",
        "outFields": "NAME,BASENAME",
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "geojson",
    })
    with urllib.request.urlopen(TIGERWEB + "?" + params, timeout=60) as r:
        data = json.loads(r.read())
    RAW_TOWNS.write_text(json.dumps(data))
    return data


def build_regions():
    raw = fetch_towns()
    feats = []
    for f in raw["features"]:
        town = f["properties"].get("BASENAME", "").strip()
        if town not in TOWN_LETTER:  # drops Gosnold
            continue
        feats.append({
            "type": "Feature",
            "properties": {"town": town, "letter": TOWN_LETTER[town]},
            "geometry": f["geometry"],
        })
    feats.sort(key=lambda x: x["properties"]["letter"])
    out = {"type": "FeatureCollection", "features": feats}
    (HERE / "regions.geojson").write_text(json.dumps(out))
    print("Wrote %d town regions -> regions.geojson" % len(feats))
    for f in feats:
        print("  %s. %s" % (f["properties"]["letter"], f["properties"]["town"]))


def build_places():
    src = json.loads((HERE / "places_source.json").read_text())["places"]
    gc = Geocoder(cache_file=str(HERE / "geocode_cache.csv"))

    feats = []
    for p in src:
        if "lat" in p and "lng" in p:
            lat, lng, status = p["lat"], p["lng"], "CURATED"
        else:
            lat, lng, status = gc.geocode(p["address"])
            if lat != lat or lng != lng:  # NaN => geocode failed
                print("  !! geocode failed for %s (%s)" % (p["name"], p.get("address")))
                continue
        props = {k: v for k, v in p.items() if k not in ("lat", "lng")}
        props["_geo"] = status
        feats.append({
            "type": "Feature",
            "properties": props,
            "geometry": {"type": "Point", "coordinates": [float(lng), float(lat)]},
        })
    gc.save_cache()
    out = {"type": "FeatureCollection", "features": feats}
    (HERE / "places.geojson").write_text(json.dumps(out, indent=2) + "\n")
    print("Wrote %d places -> places.geojson" % len(feats))
    for f in feats:
        pr = f["properties"]
        print("  [%s] %s (%s)%s" % (
            pr["category"], pr["name"], pr["town"],
            " ~approx" if pr.get("approximate") else "",
        ))


if __name__ == "__main__":
    build_regions()
    build_places()
