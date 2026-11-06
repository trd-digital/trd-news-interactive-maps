"""Build south-florida-condo-reserve-studies.geojson from both SIRS filing lists.

Florida DBPR publishes condo Structural Integrity Reserve Study (SIRS)
filings as two lists:
  - before July 2025: SouthFloridaSIRS/Structural Integrity Reserve Study
    (SIRS) Reporting(DAwQFJ).xlsx  (has Project Type and DBPR project ID)
  - July 2025 on:     south-florida/_sirs/SIRS_<date>.xlsx  (newest file wins;
    no type, no ID, project name sometimes "Missing/Unknown")
Both are exactly as associations filled them out.

One feature per association (a condo association can file for several
projects, e.g. a master and its towers). Rows from either list are joined
when they share a cleaned association name + ZIP, or a cleaned project name
+ ZIP. Each feature says which period(s) it reported in.

Locations: neither list has a street address, so we geocode the project
name (often an address, "1060 BRICKELL, A CONDO") or the association name,
with city and ZIP. A result that lands on the ZIP's or the city's own
center is a fallback, not the building: kept, flagged `Location` = "ZIP
area" / "City area".

Run from the repo root with Anaconda python:
    /Users/afarence/opt/anaconda3/bin/python south-florida/_sirs/build_sirs.py
"""

import glob
import json
import math
import os
import re
import sys
import time
from collections import Counter, defaultdict

import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
HERE = os.path.join(ROOT, "south-florida", "_sirs")
OLD_XLSX = os.path.join(ROOT, "SouthFloridaSIRS", "Structural Integrity Reserve Study (SIRS) Reporting(DAwQFJ).xlsx")
OLD_GEOJSON = os.path.join(ROOT, "south-florida", "south-florida-condo-reserve-studies.geojson")
OUT = os.environ.get("SIRS_OUT", OLD_GEOJSON)
CACHE = os.path.join(HERE, "geocode_cache.json")

COUNTY = {"MIAMI-DADE": "Miami-Dade", "DADE": "Miami-Dade", "BROWARD": "Broward", "PALM BEACH": "Palm Beach"}
PRE, POST = "Before July 2025", "July 2025 or later"

# ------------------------------------------------------------------ cleaning
STOP = {"INC", "THE", "OF", "A", "AN", "CORP", "CORPORATION", "LLC", "ASSN", "CONDO", "COOP", "CO", "OP",
        "INCORPORATED", "NO", "NUMBER", "AT", "AND"}


def key(s):
    """Association/project name -> comparison key ('' when too generic)."""
    s = str(s or "").upper().replace("&", " AND ")
    if not s.strip() or s.strip() in ("MISSING/UNKNOWN", "NAN", "-"):
        return ""
    s = re.sub(r"\bASSOC(IATION|IATON|N|\.)?S?\b|\bASS'?N\b|ASSNINC\b", " ASSN ", s)
    s = re.sub(r"\bCONDOMIN?IUMS?\b|\bCONDOS?\b|\bACONDO\b", " CONDO ", s)
    s = re.sub(r"\bCO-?OP(ERATIVE)?\b", " COOP ", s)
    s = re.sub(r"\bPH\b\.?", " PHASE ", s)
    for w, d in (("BOULEVARD", "BLVD"), ("AVENUE", "AVE"), ("STREET", "ST"), ("DRIVE", "DR"), ("ROAD", "RD"), ("COURT", "CT"),
                 ("TERRACE", "TER"), ("PLACE", "PL"), ("LANE", "LN"), ("PARKWAY", "PKWY"), ("HIGHWAY", "HWY"),
                 ("NORTH", "N"), ("SOUTH", "S"), ("EAST", "E"), ("WEST", "W"), ("APARTMENTS", "APTS"), ("BUILDING", "BLDG")):
        s = re.sub(r"\b%s\b" % w, d, s)
    s = re.sub(r"\bSEC\b\.?", " SECTION ", s)
    for w, d in (("ONE", "1"), ("TWO", "2"), ("THREE", "3"), ("FOUR", "4"), ("FIVE", "5"), ("I", "1"), ("II", "2"), ("III", "3"), ("IV", "4")):
        s = re.sub(r"\b%s\b" % w, d, s)
    toks = [t for t in re.sub(r"[^A-Z0-9 ]", " ", s).split() if t not in STOP]
    k = " ".join(toks)
    return k if len(k.replace(" ", "")) >= 3 else ""


SUFFIXES = "BLVD|AVE|ST|DR|RD|CT|TER|PL|LN|PKWY|HWY|WAY|CIR|TRL|PLZ|CSWY"


def zip5(z):
    z = str(z or "").split("-")[0].split(".")[0].strip()
    return z.zfill(5)[:5] if z.isdigit() else ""


CITY_FIX = {
    "FT. LAUDERDALE": "Fort Lauderdale", "FT LAUDERDALE": "Fort Lauderdale", "FT. LAUDERDALE BY THE SEA": "Lauderdale-by-the-Sea",
    "LAUDERDALE BY THE SEA": "Lauderdale-by-the-Sea", "N MIAMI BEACH": "North Miami Beach", "N. MIAMI BEACH": "North Miami Beach",
    "N MIAMI": "North Miami", "N. MIAMI": "North Miami", "N PALM BEACH": "North Palm Beach", "N. PALM BEACH": "North Palm Beach",
    "MIAMI BCH": "Miami Beach", "W PALM BEACH": "West Palm Beach", "W. PALM BEACH": "West Palm Beach", "WPB": "West Palm Beach",
    "PALM BCH": "Palm Beach", "HALLANDALE": "Hallandale Beach", "SUNNY ISLES": "Sunny Isles Beach", "N. BAY VILLAGE": "North Bay Village",
    "BAL HARBOR": "Bal Harbour", "LAUDERDALE LAKES": "Lauderdale Lakes", "OPA LOCKA": "Opa-locka", "DEERFIELD": "Deerfield Beach",
}
SMALL = {"of", "the", "by", "and"}


def city_name(c):
    c = re.sub(r"\s+", " ", str(c or "")).strip().strip(",")
    c = re.sub(r",?\s+(FL|Fl|fl|Florida)\.?$", "", c).strip()
    if not c or c.upper() in ("NAN", "-"):
        return ""
    up = c.upper()
    if up in CITY_FIX:
        return CITY_FIX[up]
    words = c.lower().split(" ")
    return " ".join(w if (i and w in SMALL) else w[:1].upper() + w[1:] for i, w in enumerate(words)).replace("Mc ", "Mc")


JUNK = re.compile(r"^(MISSING/UNKNOWN|NAN|N/?A|NONE|-+|_+|SIRS( REPORT)?|UNKNOWN|TBD|\W*\d*\W*)$", re.I)


def display(s):
    """'ONE ISLAND PLACE CONDOMINIUM ASSOCIATION INC.' as filed, tidied; '' when it isn't a name."""
    s = re.sub(r"\s+", " ", str(s or "")).strip().strip(",")
    return "" if JUNK.match(s) or len(re.sub(r"[^A-Za-z]", "", s)) < 3 else s


# ------------------------------------------------------------------ inputs
def load():
    old = pd.read_excel(OLD_XLSX)
    old = old[old["County"].astype(str).str.upper().isin(COUNTY)].copy()
    old["period"] = PRE
    old = old.rename(columns={"Zip": "zip", "City": "city", "County": "county", "Project Name": "project",
                              "Association Name": "assoc", "Project Type": "ptype", "ID": "pid"})
    newest = sorted(glob.glob(os.path.join(HERE, "SIRS_*.xlsx")), key=os.path.getmtime)[-1]
    new = pd.read_excel(newest)
    new = new[new["County"].astype(str).str.upper().isin(COUNTY)].copy()
    new["period"] = POST
    new = new.rename(columns={"Zip Code": "zip", "City": "city", "County": "county", "Project Name": "project",
                              "Association Name": "assoc"})
    new["ptype"] = None
    new["pid"] = None
    rows = pd.concat([old, new], ignore_index=True)
    rows["county"] = rows["county"].astype(str).str.upper().map(COUNTY)
    rows["zip5"] = rows["zip"].map(zip5)
    rows["akey"] = rows["assoc"].map(key)
    rows["pkey"] = rows["project"].map(key)
    rows["cityc"] = rows["city"].map(city_name)
    before = len(rows)
    rows = rows.drop_duplicates(["period", "akey", "pkey", "zip5", "assoc", "project"])
    print(f"{os.path.basename(newest)}; rows: pre {len(old)}, post {len(new)}; exact repeats dropped {before - len(rows)}")
    return rows.reset_index(drop=True), os.path.basename(newest)


# ------------------------------------------------------------------ grouping
def group(rows):
    parent = list(range(len(rows)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    first = {}
    for i, r in rows.iterrows():
        keys = [("a", r.akey, r.zip5), ("p", r.pkey, r.zip5)]
        # Address-like names ("1060 BRICKELL") are specific enough to match on
        # city alone; filers sometimes give different ZIPs for one building.
        for k in (r.akey, r.pkey):
            if k and re.match(r"\d+ [A-Z]", k) and r.cityc:
                keys.append(("c", k, r.cityc.upper()))
                # "1000 ISLAND BLVD WILLIAMS ISLAND" and "1000 ISLAND BLVD": same street address.
                m = re.match(r"(\d+ (?:[NSEW] )?\w+ (?:%s))\b" % SUFFIXES, k)
                if m:
                    keys.append(("addr", m.group(1), r.cityc.upper()))
        for kind, k, z in keys:
            if not k or not z:
                continue
            kk = (kind, k, z)
            if kk in first:
                union(first[kk], i)
            else:
                first[kk] = i
    groups = defaultdict(list)
    for i in range(len(rows)):
        groups[find(i)].append(i)
    return [rows.loc[idx] for idx in groups.values()]


def most(vals):
    vals = [v for v in vals if v]
    return Counter(vals).most_common(1)[0][0] if vals else ""


def record(g):
    assocs = [display(a) for a in g["assoc"]]
    seen, projects = set(), []
    for p in sorted({display(p) for p in g["project"]} - {""}):
        k = re.sub(r"[^A-Z0-9]", "", p.upper())
        if k not in seen:
            seen.add(k)
            projects.append(p)
    periods = [p for p in (PRE, POST) if p in set(g["period"])]
    types = sorted({str(t).title() for t in g["ptype"] if isinstance(t, str) and t.strip() and t != "-"})
    pids = sorted({int(x) for x in g["pid"] if pd.notna(x) and str(x).strip().lstrip("-").isdigit()})
    name = most(assocs) or (projects[0] if projects else "")
    nk = re.sub(r"[^A-Z0-9]", "", name.upper())
    projects = [p for p in projects if re.sub(r"[^A-Z0-9]", "", p.upper()) != nk]
    return {
        "assoc": name,
        "assocs": sorted(set(a for a in assocs if a)),
        "projects": projects,
        "city": most(list(g["cityc"])),
        "zip": most(list(g["zip5"])),
        "county": most(list(g["county"])),
        "periods": periods,
        "types": types,
        "pids": pids,
        "filings": len(g),
    }


# ------------------------------------------------------------------ geocoding
class Geo:
    def __init__(self):
        self.cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
        self.client = None
        self.calls = 0

    def get(self, q):
        q = re.sub(r"\s+", " ", q).strip()
        k = q.lower()
        if k in self.cache:
            return self.cache[k]
        if self.client is None:
            from trd_common.env import ensure_loaded
            import googlemaps
            ensure_loaded()
            self.client = googlemaps.Client(key=os.environ["GOOGLE_MAPS_API_KEY"])
        res = None
        for attempt in range(3):
            try:
                res = self.client.geocode(q, region="us", components={"country": "US", "administrative_area": "FL"})
                break
            except Exception as e:  # noqa: BLE001
                print("  retry", q, e)
                time.sleep(1.5 * (attempt + 1))
        self.calls += 1
        out = None
        if res:
            r = res[0]
            loc = r["geometry"]["location"]
            out = {"lat": loc["lat"], "lng": loc["lng"], "types": r.get("types", []), "partial": bool(r.get("partial_match")),
                   "formatted": r.get("formatted_address", "")}
        self.cache[k] = out
        if self.calls % 100 == 0:
            self.save()
            print(f"  {self.calls} lookups")
        return out

    def save(self):
        json.dump(self.cache, open(CACHE, "w"), indent=0, sort_keys=True)


GEO = None


def dist_m(a, b):
    dy = (a[0] - b[0]) * 111320
    dx = (a[1] - b[1]) * 111320 * math.cos(math.radians(a[0]))
    return math.hypot(dx, dy)


PRECISE = {"premise", "subpremise", "street_address"}
STREET_ONLY = {"route", "intersection"}
NOT_HOME = {"atm", "bank", "finance", "store", "restaurant", "food", "school", "church", "place_of_worship", "hospital",
            "doctor", "health", "car_dealer", "car_repair", "gas_station", "shopping_mall", "supermarket", "lodging",
            "university", "park", "transit_station", "bus_station", "local_government_office", "city_hall", "post_office",
            "police", "fire_station", "library", "museum", "stadium", "parking", "storage", "real_estate_agency",
            "insurance_agency", "lawyer", "accounting", "travel_agency", "beauty_salon", "gym", "bar", "cafe"}
FALLBACK_TYPES = {"postal_code", "locality", "political", "administrative_area_level_2", "administrative_area_level_1",
                  "neighborhood", "sublocality", "colloquial_area"}


def main():
    rows, newest = load()
    groups = group(rows)
    recs = [record(g) for g in groups]
    print(f"associations: {len(recs)} (from {len(rows)} filings)")
    print("  periods:", Counter(" + ".join(r["periods"]) for r in recs))

    # Old coordinates by DBPR project ID (the current map's geocodes).
    old = json.load(open(OLD_GEOJSON))["features"] if os.path.exists(OLD_GEOJSON) else []
    by_pid = {}
    for f in old:
        p = f["properties"]
        if "ID" in p and p.get("ID") not in (None, ""):
            by_pid[int(p["ID"])] = f["geometry"]["coordinates"]

    global GEO
    geo = GEO = Geo()
    zc, cc = {}, {}
    feats = []
    for r in recs:
        if r["zip"] and r["zip"] not in zc:
            zc[r["zip"]] = geo.get(f"{r['zip']}, FL")
        ck = (r["city"], r["county"])
        if r["city"] and ck not in cc:
            cc[ck] = geo.get(f"{r['city']}, {r['county']} County, FL")
        name = next((p for p in r["projects"] if key(p)), "") or r["assoc"]
        coord, how = None, None
        old_c = next((by_pid[i] for i in r["pids"] if i in by_pid), None)
        q = f"{name}, {r['city']}, FL {r['zip']}"
        g = geo.get(q)
        if g:
            coord, how = (g["lat"], g["lng"]), set(g["types"])
        elif old_c:
            coord, how = (old_c[1], old_c[0]), set()
        if not coord:
            continue
        loc = "Building"
        z, c = zc.get(r["zip"]), cc.get(ck)
        if how and how <= FALLBACK_TYPES:
            loc = "ZIP area" if "postal_code" in how else "City area"
        elif z and dist_m(coord, (z["lat"], z["lng"])) < 60:
            loc = "ZIP area"
        elif c and dist_m(coord, (c["lat"], c["lng"])) < 60:
            loc = "City area"
        elif how and (how & STREET_ONLY) and not (how & PRECISE):
            loc = "Street"  # matched a street, not a building
        elif how and (how & NOT_HOME):
            loc = "Nearby place"  # matched a bank, store, school…
        if not (24.9 < coord[0] < 27.1 and -80.95 < coord[1] < -79.9):
            continue  # outside South Florida: a bad match
        feats.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(coord[1], 7), round(coord[0], 7)]},
            "properties": {
                "Association Name": r["assoc"],
                "Project Name": r["projects"][0] if r["projects"] else "",
                "Projects": r["projects"],
                "Other Names": [a for a in r["assocs"] if a != r["assoc"]],
                "Project Type": r["types"][0] if len(r["types"]) == 1 else ("Condominium" if not r["types"] else "Mixed"),
                "Type Listed": bool(r["types"]),
                "City": r["city"],
                "Zip": r["zip"],
                "County": r["county"],
                "Reported": r["periods"],
                "Filings": r["filings"],
                "Location": loc,
                "DBPR IDs": r["pids"],
            },
        })
    # One point holding 3+ associations whose names share no first word is a
    # generic hit (a city hall, a mall), not a building: mark approximate.
    by_pt = defaultdict(list)
    for f in feats:
        by_pt[tuple(round(x, 5) for x in f["geometry"]["coordinates"])].append(f)
    for fs in by_pt.values():
        if len(fs) < 3:
            continue
        firsts = Counter((key(f["properties"]["Project Name"] or f["properties"]["Association Name"]).split() or [""])[0] for f in fs)
        if firsts.most_common(1)[0][1] < len(fs) * 0.6:
            for f in fs:
                if f["properties"]["Location"] == "Building":
                    f["properties"]["Location"] = "Shared point"
    geo.save()
    dropped = len(recs) - len(feats)
    fc = {"type": "FeatureCollection", "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
          "sources": {"before_july_2025": os.path.basename(OLD_XLSX), "july_2025_on": newest}, "features": feats}
    json.dump(fc, open(OUT, "w"), separators=(",", ":"))
    print(f"wrote {len(feats)} features ({dropped} without a South Florida location); {geo.calls} Google lookups")
    print("  location:", Counter(f["properties"]["Location"] for f in feats))
    print("  county:", Counter(f["properties"]["County"] for f in feats))


if __name__ == "__main__":
    import atexit
    import signal

    # Keep finished lookups if the run is stopped part way.
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(1))
    atexit.register(lambda: GEO and GEO.save())
    main()
