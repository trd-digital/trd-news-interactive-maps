"""Build south-florida/south-florida-boundaries.geojson for the transactions map.

City (incorporated place) and ZIP (ZCTA) outlines for Miami-Dade, Broward and
Palm Beach counties, from the US Census TIGERweb REST services. Simplified so
the file stays small; it is loaded on demand when a reader searches a city or
ZIP, never on page load.

Run with the Anaconda python (shapely/geopandas):
    python south-florida/transactions/build_boundaries.py
"""
import json
import sys
from pathlib import Path

import geopandas as gpd
import requests

TIGER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb"
PLACES = TIGER + "/Places_CouSub_ConCity_SubMCD/MapServer/4/query"  # Incorporated Places (current)
ZCTAS = TIGER + "/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/1/query"  # 2020 ZCTAs (current)
COUNTIES = TIGER + "/State_County/MapServer/1/query"  # Counties (current)
COUNTY_FIPS = {"086": "Miami-Dade", "011": "Broward", "099": "Palm Beach"}
BBOX = "-80.95,25.1,-79.95,27.0"
SIMPLIFY_M = 25  # metres; invisible at city/ZIP zoom levels
OUT = Path(__file__).resolve().parents[1] / "south-florida-boundaries.geojson"


def fetch(url, where, fields):
    params = {
        "where": where, "geometry": BBOX, "geometryType": "esriGeometryEnvelope", "inSR": 4326,
        "spatialRel": "esriSpatialRelIntersects", "outFields": fields, "outSR": 4326,
        "returnGeometry": "true", "f": "geojson", "resultRecordCount": 2000,
    }
    r = requests.get(url, params=params, timeout=120)
    r.raise_for_status()
    gdf = gpd.GeoDataFrame.from_features(r.json()["features"], crs=4326)
    print(f"  {url.split('/')[-4]} layer: {len(gdf)} features", file=sys.stderr)
    return gdf


def main():
    counties = fetch(COUNTIES, "STATE='12' AND COUNTY IN ('086','011','099')", "COUNTY,NAME")
    counties["county"] = counties["COUNTY"].map(COUNTY_FIPS)
    counties = counties[["county", "geometry"]].to_crs(3086)  # Florida GDL Albers (metres)

    def assign_county(gdf):
        gdf = gdf.to_crs(3086)
        # County with the largest overlap (a few places straddle county lines).
        inter = gpd.overlay(gdf.reset_index(), counties, how="intersection", keep_geom_type=True)
        inter["a"] = inter.area
        best = inter.sort_values("a").groupby("index").tail(1).set_index("index")["county"]
        gdf["county"] = best
        return gdf[gdf["county"].notna()]

    places = fetch(PLACES, "STATE='12'", "NAME,BASENAME,LSADC")
    places = assign_county(places)
    places["kind"], places["name"] = "city", places["BASENAME"]

    zctas = fetch(ZCTAS, "1=1", "ZCTA5,BASENAME")
    zctas = assign_county(zctas)
    zctas["kind"], zctas["name"] = "zip", zctas["BASENAME"]

    gdf = gpd.GeoDataFrame(
        list(places[["kind", "name", "county", "geometry"]].itertuples(index=False))
        + list(zctas[["kind", "name", "county", "geometry"]].itertuples(index=False)),
        columns=["kind", "name", "county", "geometry"], crs=3086,
    )
    gdf["geometry"] = gdf.geometry.simplify(SIMPLIFY_M, preserve_topology=True)
    gdf = gdf[~gdf.geometry.is_empty].to_crs(4326)

    fc = json.loads(gdf.to_json(drop_id=True))
    for f in fc["features"]:  # 5 decimals ~ 1 m
        f["geometry"] = json.loads(json.dumps(f["geometry"]), parse_float=lambda x: round(float(x), 5))
    fc["source"] = "US Census Bureau TIGERweb: Incorporated Places (current) and 2020 ZCTAs; simplified ~25 m"
    OUT.write_text(json.dumps(fc, separators=(",", ":")))
    n_city = sum(1 for f in fc["features"] if f["properties"]["kind"] == "city")
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB): {n_city} cities, {len(fc['features']) - n_city} ZIPs", file=sys.stderr)


if __name__ == "__main__":
    main()
