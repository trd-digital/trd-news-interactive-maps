"""Build the South Florida campaign-money interactives' data from the Florida
Division of Elections exports.

Inputs (git-ignored, dropped in south-florida/ by hand):
  con_contributions_export.csv  contributions to candidates
  contributions_export.csv      contributions to political committees,
                                parties and party committees
Both have the same columns: Candidate/Committee, Date, Amount, Typ,
Contributor Name, Address, City State Zip, Occupation, Inkind Desc.

Outputs (south-florida/campaign/):
  cf-realestate.json  real estate donors, their gifts and recipients
                      (tracker + donor lookup)
  cf-networks.json    South Florida addresses that many donor companies
                      share (LLC networks)
  cf-zips.json        giving by South Florida ZIP code (donor map)
  cf-governor.json    the governor's race by month (race chart)

What counts:
  - Contributions dated Jan 1, 2025 on (the 2026 cycle). The candidates
    file has a few hundred older rows from earlier campaigns.
  - Checks, cash, money orders, in-kind and members' pooled dues (MUC).
    Not counted: refunds (REF), loans (LOA), interest (INT), transfers
    between a candidate's own accounts (COF) and blank rows (X).
  - Dates after the export date are typos and dropped.

Donors: the state gives no donor ID, so a donor is a cleaned name
(punctuation, "Inc."/"Inc", middle initials and Jr./Sr. removed); a
person is also split by ZIP code so two people with one name stay apart.

Real estate donors: by occupation ("Realtor", "Real estate developer"),
by name ("... Homes", "... Realty", "... Development Co.") and a short list
of known developers and homebuilders. Political committees that give are
real estate only when they're the industry's own (Realtors, home builders,
apartment associations).

Run from the repo root with Anaconda python:
    /Users/afarence/opt/anaconda3/bin/python south-florida/_campaign/build_campaign.py
"""

import json
import os
import re
from collections import Counter, defaultdict
from datetime import date

import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SF = os.path.join(ROOT, "south-florida")
OUT = os.path.join(SF, "campaign")
FILES = [("candidate", "con_contributions_export.csv"), ("committee", "contributions_export.csv")]
START = pd.Timestamp("2025-01-01")
KEEP_TYPES = {"CHE", "CH", "CAS", "MO", "INK", "MUC"}

# ------------------------------------------------------------------ names
CORP_RE = re.compile(
    r"\b(LLC|L L C|LLLP|LLP|LP|L P|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|PLLC|PA|P A|PC|TRUST|HOLDINGS|"
    r"PARTNERS|PARTNERSHIP|GROUP|ASSOCIATION|ASSOC|FUND|FOUNDATION|COMMITTEE|PAC|PARTY|UNION|LOCAL|COUNCIL|FEDERATION|"
    r"ENTERPRISES|CAPITAL|INVESTMENTS|VENTURES|PROPERTIES|MANAGEMENT|DEVELOPMENT|REALTORS|REALTY|HOMES|BUILDERS|BANK|"
    r"SERVICES|SOLUTIONS|INDUSTRIES|INTERNATIONAL|SYSTEMS|CONSULTING|STRATEGIES|CAMPAIGN|DEPARTMENT|STATE OF|CITY OF|"
    r"FRIENDS OF|TRIBE|CENTER|AMERICA|FLORIDA|USA|NEIGHBORHOODS|COMMUNITIES|ESTATES|RANCH|FARMS|LAND|REAL ESTATE|MASTEC)\b"
)
SUFFIX = [(r"\bL\s*L\s*C\b", "LLC"), (r"\bL\s*L\s*L\s*P\b", "LLLP"), (r"\bINCORPORATED\b", "INC"), (r"\bCORPORATION\b", "CORP"),
          (r"\bCOMPANY\b", "CO"), (r"\bLIMITED\b", "LTD"), (r"\bL\s+P\b", "LP"), (r"\bP\s+A\b", "PA")]


def squash(s):
    s = str(s or "").upper().replace("&", " AND ")
    s = re.sub(r"[^A-Z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def is_org(raw):
    return bool(CORP_RE.search(squash(raw)))


def org_key(raw):
    s = squash(raw)
    for a, b in SUFFIX:
        s = re.sub(a, b, s)
    s = re.sub(r"^THE ", "", s)
    return s


def person_key(raw):
    toks = squash(raw).split()
    keep = [t for i, t in enumerate(toks) if i == 0 or (len(t) > 1 and t not in ("JR", "SR", "II", "III", "IV", "MD", "ESQ", "DR", "MR", "MRS", "MS"))]
    return " ".join(keep)


KEEP_UPPER = {"LLC", "LLLP", "LLP", "LP", "NAR", "ICI", "PA", "PLLC", "PAC", "USA", "US", "FL", "II", "III", "IV", "NE", "NW", "SE", "SW", "MHK", "CREI",
              "PRH", "WCGM", "SG", "LT", "GLK", "TECO", "VGW", "DK", "GOPAC", "FTBA", "CCC", "NAIOP", "BOMA", "JR", "SR", "MD", "HB", "MF", "CEO"}
STREET_ABBR = {"ST", "BLVD", "DR", "RD", "CT", "PL", "LN", "PKWY", "HWY", "STE", "CSWY", "TRL", "SQ", "CTR", "BLDG", "MR", "MRS", "MS", "DR"}
PARTICLES = {"DE", "DEL", "DA", "DI", "LA", "LE", "VAN", "VON", "DOS", "DAS", "ST", "MAC"}


def title(s):
    def word(w):
        bare = re.sub(r"[^A-Z0-9]", "", w.upper())
        if bare in KEEP_UPPER or (bare.isalpha() and 2 <= len(bare) <= 5 and bare not in STREET_ABBR and not re.search(r"[AEIOUY]", bare)):
            return w.upper()
        if re.fullmatch(r"([A-Z]\.){2,}[A-Z]?", w.upper().rstrip(",")):
            return w.upper()
        if bare == "INC":
            return "Inc."
        if re.fullmatch(r"\d+(ST|ND|RD|TH)", bare):
            return w.lower()
        out = w[:1].upper() + w[1:].lower()
        out = re.sub(r"^(Mc|O')([a-z])", lambda m: m.group(1) + m.group(2).upper(), out)
        return re.sub(r"-([a-z])", lambda m: "-" + m.group(1).upper(), out)
    return " ".join(word(w) for w in str(s).split())


def person_display(raw):
    """'GRIFFIN KENNETH C.' -> 'Kenneth C. Griffin'; 'DE LA CRUZ JUAN' -> 'Juan De La Cruz'."""
    toks = str(raw).split()
    if len(toks) < 2:
        return title(raw)
    last = [toks[0]]
    i = 1
    while last[-1].upper().strip(".") in PARTICLES and i < len(toks) - 1:
        last.append(toks[i])
        i += 1
    rest = toks[i:]
    sfx = [t for t in rest if t.upper().strip(".,") in ("JR", "SR", "II", "III", "IV")]
    rest = [t for t in rest if t not in sfx]
    name = title(" ".join(rest + last))
    if sfx:
        name += " " + {"JR": "Jr.", "SR": "Sr."}.get(sfx[0].upper().strip(".,"), sfx[0].upper().strip(".,"))
    return name


# --------------------------------------------------------------- sectors
SECTORS = [
    ("realtors", "Realtors and brokers"),
    ("developers", "Developers and investors"),
    ("builders", "Homebuilders"),
    ("property", "Landlords and property managers"),
    ("groups", "Industry groups and PACs"),
    ("other", "Other real estate"),
]
OCC_NOT = re.compile(r"SOFTWARE|WEB |APP |APPLICATION|BUSINESS DEVELOP|GAME|FRONT END|BACK END|FULL STACK|PROGRAM|IT DEVELOP|PRODUCT DEVELOP|"
                     r"FUND ?RAIS|DEVELOPMENT DIRECTOR|DIRECTOR OF DEVELOPMENT|RESOURCE DEVELOP|ECONOMIC DEVELOP|CHILD|CURRICULUM|BODY ?BUILD|"
                     r"TEAM BUILD|BOAT ?BUILD|BUILDING INSPECT|BUILDING OFFICIAL|BUILDING MAINT|BUILDING ENGINEER|SIGN BUILD|LEASING CONSULTANT AUTO")
OCC_RULES = [
    ("realtors", re.compile(r"REALTOR|REAL ESTATE (AGENT|BROKER|SALES|ASSOCIATE|PROFESSIONAL|ADVISOR|CONSULTANT|LICENSEE)|BROKER ASSOCIATE|"
                            r"LICENSED REAL ESTATE|REAL ESTATE SALES|^BROKER$|RE BROKER|RE AGENT|REAL ESTATE LIC")),
    ("developers", re.compile(r"REAL ESTATE DEVELOP|^DEVELOPER$|LAND DEVELOP|PROPERTY DEVELOP|REAL ESTATE INVEST|REAL ESTATE (EXECUTIVE|OWNER|PRINCIPAL|"
                              r"CEO|PRESIDENT|PARTNER|ENTREPRENEUR)|HOTEL DEVELOP|DEVELOPER REAL|RE DEVELOP|REAL ESTATE DEV|CONDO DEVELOP")),
    ("builders", re.compile(r"HOME ?BUILD|^BUILDER$|HOMEBUILDING|RESIDENTIAL CONSTRUCTION|HOME BUILDING|BUILDER/DEVELOPER|BUILDER DEVELOPER")),
    ("property", re.compile(r"PROPERTY MANAG|PROPERTY OWNER|LANDLORD|APARTMENT|REAL ESTATE MANAG|PROPERTY INVEST|COMMERCIAL REAL ESTATE|"
                            r"PROPERTY MGMT|ASSET MANAGER REAL|RENTAL PROPERT|MULTIFAMILY|MULTI-FAMILY")),
    ("other", re.compile(r"REAL ESTATE|REALTY|APPRAIS|TITLE AGENT|TITLE INSURANCE|TITLE COMPANY|MORTGAGE|PROPERTY")),
]
# Known South Florida and statewide developers and homebuilders (names as filed).
KNOWN = [
    ("builders", r"LENNAR|G ?L HOMES|PULTE|D ?R HORTON|TOLL BROTHERS|MATTAMY|DREAM FINDERS|TAYLOR MORRISON|KB HOME|MERITAGE|MINTO|KOLTER|"
                 r"NEAL COMMUNITIES|NEAL LAND|STOCK DEVELOPMENT|ASHTON WOODS|DAVID WEEKLEY|CC HOMES|ICI HOMES|PARK SQUARE"),
    ("developers", r"13TH FLOOR|TERRA (GROUP|CITY|WORLD|HOLD|MANAGE)|RELATED (COMPANIES|GROUP|GROUP OF FLORIDA|URBAN)|WITKOFF|KITSON|HOUSING TRUST GROUP|"
                   r"CODINA|ESTATE COMPANIES|PROPERTY MARKETS GROUP|OKO GROUP|FORTUNE INTERNATIONAL|MAGELLAN DEVELOPMENT|CRESCENT HEIGHTS|"
                   r"ST JOE CO|SWIRE PROPERTIES|ALLAPATTAH|BLUENEST|RED APPLE|GARCIA DEVELOPMENT|FRISBIE GROUP|PINNACLE HOUSING|CARLISLE DEVELOPMENT|"
                   r"ATLANTIC PACIFIC|LYND|ROYAL PALM COMPANIES|CROCKER PARTNERS|BOCA RATON CITY CENTER|"
                   r"TWENTY NINE INDIGO|URBAN ROBOT|THE ALLEN MORRIS|ALLEN MORRIS|DACRA|LIONHEART CAPITAL|MERIDIAN|DEVELOPMENT PARTNERS"),
]
KNOWN = [(k, re.compile(r"\b(" + p + r")")) for k, p in KNOWN]
NAME_NOT = re.compile(r"ECONOMIC DEVELOPMENT|BUSINESS DEVELOPMENT|SOFTWARE|UNIVERSAL CITY DEVELOPMENT|WORKFORCE|SCHOOL DEVELOPMENT|CHILD|"
                      r"COMMUNITY DEVELOPMENT DISTRICT|TRANSPORTATION|ROAD BUILDERS|MASTEC|LEADERSHIP|YOUTH|DEVELOPMENTAL|HABITAT FOR|SOLAR|ENERGY|POWER|NEXTERA|TECO|DISNEY|"
                      r"STRONGER COMMUNITIES|STRONG COMMUNITIES|SAFE COMMUNITIES|HEALTHY COMMUNITIES|BUILDING A BETTER|BUILDING FLORIDA")
NAME_RULES = [
    ("groups", re.compile(r"REALTOR|HOME ?BUILDERS|BUILDERS ASSOC|APARTMENT ASSOC|NAIOP|BOMA|BUILDING OWNERS|LAND TITLE ASSOC|MORTGAGE BANKERS|"
                          r"COMMUNITY ASSOCIATIONS INSTITUTE|ASSOCIATED BUILDERS|ASSOCIATION OF REALTORS")),
    ("realtors", re.compile(r"\bREALTY\b|\bREAL ESTATE BROKER|\bSOTHEBY S INTERNATIONAL REALTY|COLDWELL BANKER|KELLER WILLIAMS|COMPASS FLORIDA|"
                            r"DOUGLAS ELLIMAN|RE MAX|EXP REALTY|ONE SOTHEBY")),
    ("builders", re.compile(r"\bHOMES\b|\bHOME BUILDERS?\b|\bHOMEBUILDERS?\b|\bBUILDERS\b")),
    ("developers", re.compile(r"\bDEVELOPMENT (CO|GROUP|CORP|PARTNERS|LLC|INC|COMPANY|CORPORATION|SERVICES)\b|\bDEVELOPERS?\b|\bDEVELOPMENT\b|"
                              r"\bLAND (CO|COMPANY|GROUP|PARTNERS|HOLDINGS|INVESTMENTS)\b")),
    ("property", re.compile(r"\bPROPERTIES\b|\bAPARTMENTS\b|\bMULTIFAMILY\b|PROPERTY MANAGEMENT|\bRESIDENTIAL\b|\bCOMMUNITIES\b|\bLANDLORD")),
    ("other", re.compile(r"\bREAL ESTATE\b|\bTITLE (CO|COMPANY|AGENCY|INSURANCE|SERVICES)\b|\bMORTGAGE\b")),
]
GROUP_ONLY = NAME_RULES[0][1]


def sector_of(name_sq, occ_sq, is_committee):
    if is_committee:
        return "groups" if GROUP_ONLY.search(name_sq) else None
    if NAME_NOT.search(name_sq):
        return None
    for k, rx in KNOWN:
        if rx.search(name_sq):
            return k
    for k, rx in NAME_RULES:
        if rx.search(name_sq):
            return k
    if occ_sq and not OCC_NOT.search(occ_sq):
        for k, rx in OCC_RULES:
            if rx.search(occ_sq):
                return k
    return None


# ------------------------------------------------------------ recipients
OFFICES = {"GOV": "Governor", "ATG": "Attorney General", "CFO": "Chief Financial Officer", "AGR": "Agriculture Commissioner",
           "STS": "State Senate", "STR": "State House", "CTJ": "Circuit judge", "STA": "State attorney", "PUB": "Public defender",
           "SEB": "School board", "ECW": "County court judge", "PLB": "Public Service Commission"}
KINDS = {"PAC": "Political committee", "PTY": "Party", "PAP": "Party caucus committee", "ECO": "Electioneering group"}
PARTIES = {"REP": "R", "DEM": "D", "NPA": "NPA", "LPF": "L", "NOP": "Nonpartisan", "IND": "I", "WRI": "Write-in", "GRE": "G"}


def parse_recipient(raw, src):
    raw = str(raw).strip()
    tags = re.findall(r"\(([A-Z]+)\)", raw)
    base = re.sub(r"\s*\([A-Z]+\)", "", raw).strip()
    if src == "candidate":
        party = PARTIES.get(tags[0], tags[0]) if len(tags) > 1 else None
        office = tags[-1] if tags else ""
        last, _, first = base.partition(",")
        first = re.sub(r"\s+", " ", first).strip()
        return {"name": (first + " " + last.strip()).strip(), "kind": "candidate", "party": party, "office": OFFICES.get(office, "Other office"),
                "code": office, "last": last.strip()}
    kind = tags[-1] if tags else "PAC"
    return {"name": base, "kind": "committee", "type": KINDS.get(kind, "Political committee"), "code": kind}


def full_committee_names(recips, contributor_names):
    """Committee names are cut at 40 characters; take the full name from the
    same committee giving to others, when it does."""
    by_prefix = defaultdict(Counter)
    for n, c in contributor_names.items():
        s = squash(n)
        if len(s) > 38:
            by_prefix[s[:30]][n] += c
    for r in recips.values():
        if r["kind"] != "committee" or len(r["name"]) < 39:
            continue
        s = squash(r["name"])
        best = None
        for full, c in by_prefix.get(s[:30], {}).items():
            if squash(full).startswith(s[: min(len(s), 38)]) and (best is None or c > best[1]):
                best = (full, c)
        if best:
            r["name"] = title(best[0]).replace(" Inc.", ", Inc.").replace(",,", ",")
    return recips


# --------------------------------------------------------------- addresses
STREET = [(r"\bNORTH ?WEST\b", "NW"), (r"\bNORTH ?EAST\b", "NE"), (r"\bSOUTH ?WEST\b", "SW"), (r"\bSOUTH ?EAST\b", "SE"),
          (r"\bNORTH\b", "N"), (r"\bSOUTH\b", "S"), (r"\bEAST\b", "E"), (r"\bWEST\b", "W"),
          (r"\bSTREET\b", "ST"), (r"\bAVENUE\b", "AVE"), (r"\bAV\b", "AVE"), (r"\bBOULEVARD\b", "BLVD"), (r"\bDRIVE\b", "DR"), (r"\bROAD\b", "RD"),
          (r"\bCOURT\b", "CT"), (r"\bPLACE\b", "PL"), (r"\bTERRACE\b", "TER"), (r"\bLANE\b", "LN"), (r"\bPARKWAY\b", "PKWY"), (r"\bHIGHWAY\b", "HWY"),
          (r"\bCIRCLE\b", "CIR"), (r"\bCAUSEWAY\b", "CSWY"), (r"\bPOST OFFICE BOX\b", "PO BOX"), (r"\bP O BOX\b", "PO BOX"), (r"\bPOB\b", "PO BOX"),
          (r"\b(\d+)(ST|ND|RD|TH)\b", r"\1")]


def address_key(addr):
    s = str(addr or "").upper().replace("#", " UNIT ")
    s = re.sub(r"\b([NS])\.?\s*([EW])\.?(?=\s)", r"\1\2", s)  # N.W. -> NW
    s = squash(s)
    s = re.split(r"\b(SUITE|STE|UNIT|APT|FLOOR|FL|PH|BLDG|RM|ROOM|NO)\b|#", s)[0].strip() if not s.startswith("PO BOX") else s
    for a, b in STREET:
        s = re.sub(a, b, s)
    # "2850 TIGERTAIL AVE 800": a bare unit number after the street type
    s = re.sub(r"\b(ST|AVE|BLVD|DR|RD|CT|PL|TER|LN|PKWY|HWY|CIR|CSWY|WAY)\s+\d+[A-Z]?$", r"\1", s)
    return re.sub(r"\s+", " ", s).strip()


def main():
    zips = {}
    city_of_zip = {}
    with open(os.path.join(SF, "south-florida-boundaries.geojson")) as f:
        for ft in json.load(f)["features"]:
            p = ft["properties"]
            if p["kind"] == "zip":
                zips[p["name"]] = p["county"]

    frames = []
    for src, fn in FILES:
        d = pd.read_csv(os.path.join(SF, fn), encoding="utf-8-sig", dtype=str, keep_default_na=False)
        d.columns = ["recip", "date", "amount", "typ", "name", "addr", "csz", "occ", "inkind"]
        d["src"] = src
        d["export"] = date.fromtimestamp(os.path.getmtime(os.path.join(SF, fn)))
        frames.append(d)
    d = pd.concat(frames, ignore_index=True)
    raw_rows = len(d)
    d["amt"] = pd.to_numeric(d.amount, errors="coerce").fillna(0.0)
    d["dt"] = pd.to_datetime(d.date.str.strip(), format="%m/%d/%Y", errors="coerce")
    d["typ"] = d.typ.str.strip()
    contributor_counts = Counter(d.name[d.name != ""])
    future = d.dt > pd.to_datetime(d.export)
    d = d[d.typ.isin(KEEP_TYPES) & (d.amt > 0) & (d.dt >= START) & ~future].copy()
    print(f"{raw_rows:,} rows -> {len(d):,} contributions ({int(future.sum())} future-dated typos dropped)")

    as_of = {src: d.dt[d.src == src].max().date().isoformat() for src, _ in FILES}
    first = d.dt.min().date().isoformat()

    # place
    m = d.csz.str.extract(r"^(.*?),\s*([A-Z]{2})\s+(\d{5})?")
    d["city"] = m[0].fillna("").str.strip()
    d["state"] = m[1].fillna("")
    d["zip"] = m[2].fillna("")
    d["sofla"] = d.zip.isin(zips.keys()) & (d.state == "FL")

    # recipients
    recips = {}
    for (raw, src), _ in d.groupby(["recip", "src"]).size().items():
        recips[raw] = parse_recipient(raw, src)
    full_committee_names(recips, contributor_counts)
    committee_keys = {org_key(r["name"])[:36] for r in recips.values() if r["kind"] == "committee"}

    # donors
    d["nsq"] = d.name.map(squash)
    d["occsq"] = d.occ.map(squash)
    d["org"] = d.name.map(is_org) | (d.occsq.str.contains(r"POLITICAL COMMITTEE|^PAC$|POLITICAL ORG|CORPORATION|^BUSINESS$"))
    d.loc[d.name == "", "org"] = True
    d["dkey"] = [("O|" + org_key(n)) if o else ("P|" + person_key(n) + "|" + z) for n, o, z in zip(d.name, d.org, d.zip)]
    d.loc[d.name == "", "dkey"] = "O|UNITEMIZED MEMBER DUES"
    d["committee"] = d.org & d.dkey.str[2:38].isin(committee_keys) | d.occsq.str.contains(r"POLITICAL COMMITTEE|^PAC$|POLITICAL ORG")
    d["public"] = d.nsq.str.startswith("STATE OF FLORIDA") | d.nsq.str.startswith("FLORIDA DEPARTMENT OF STATE")

    # sector per donor: the most common verdict over a donor's rows
    sec = [sector_of(n, o, c) for n, o, c in zip(d.nsq, d.occsq, d.committee)]
    d["sector_row"] = sec
    votes = d[d.sector_row.notna()].groupby("dkey").sector_row.agg(lambda s: Counter(s).most_common(1)[0][0])
    nrows = d.groupby("dkey").size()
    hits = d[d.sector_row.notna()].groupby("dkey").size()
    # A person counts when most of their rows say real estate (occupations vary).
    keep = votes[(hits / nrows.reindex(hits.index)) >= 0.5]
    d["sector"] = d.dkey.map(keep)
    d.loc[d.name == "", "sector"] = None

    os.makedirs(OUT, exist_ok=True)
    write_realestate(d, recips, as_of, first)
    write_networks(d, recips, as_of, first, zips)
    write_zips(d, recips, as_of, first, zips)
    write_governor(d, recips, as_of, first)


def dump(name, obj):
    path = os.path.join(OUT, name)
    with open(path, "w") as f:
        json.dump(obj, f, separators=(",", ":"), ensure_ascii=False)
    print(f"  {name}: {os.path.getsize(path) / 1e6:.2f} MB")


def donor_table(rows):
    """One record per donor key: display name, city, ZIP, occupation."""
    out = {}
    for k, g in rows.groupby("dkey"):
        raw = Counter(g.name).most_common(1)[0][0]
        org = bool(g.org.iloc[0])
        place = Counter(zip(g.city, g.state, g.zip)).most_common(1)[0][0]
        occ = Counter(o for o in g.occ if o.strip()).most_common(1)
        out[k] = {
            "name": "Members’ pooled dues" if raw == "" else (title(raw) if org else person_display(raw)),
            "org": org,
            "city": title(place[0]) if place[0] else "",
            "st": place[1],
            "zip": place[2],
            "occ": title(occ[0][0]) if occ else "",
        }
    return out


def recip_list(keys, recips):
    idx = {k: i for i, k in enumerate(keys)}
    out = []
    for k in keys:
        r = recips[k]
        o = {"n": r["name"], "k": "c" if r["kind"] == "candidate" else "p"}
        if r["kind"] == "candidate":
            o["o"] = r["office"]
            if r.get("party"):
                o["p"] = r["party"]
        else:
            o["t"] = r["type"]
        out.append(o)
    return idx, out


def day(ts):
    return (ts - START).days


def write_realestate(d, recips, as_of, first):
    re_ = d[d.sector.notna()].copy()
    donors = donor_table(re_)
    tot = re_.groupby("dkey").amt.sum().sort_values(ascending=False)
    dkeys = list(tot.index)
    didx = {k: i for i, k in enumerate(dkeys)}
    rkeys = list(re_.groupby("recip").amt.sum().sort_values(ascending=False).index)
    ridx, rlist = recip_list(rkeys, recips)
    sec_of = re_.groupby("dkey").sector.first()
    sofla_of = re_.groupby("dkey").sofla.agg(lambda s: bool(s.mean() >= 0.5))
    dl = []
    for k in dkeys:
        x = donors[k]
        o = {"n": x["name"], "s": sec_of[k]}
        if x["org"]:
            o["o"] = 1
        if x["city"]:
            o["c"] = x["city"] + (", " + x["st"] if x["st"] and x["st"] != "FL" else "")
        if x["zip"]:
            o["z"] = x["zip"]
        if x["occ"] and not x["org"]:
            o["j"] = x["occ"]
        if sofla_of[k]:
            o["f"] = 1
        dl.append(o)
    # Gifts: [donor, recipient, day since Jan 1 2025, amount]; same donor,
    # recipient and day are summed.
    g = re_.groupby(["dkey", "recip", "dt"]).amt.sum().reset_index()
    gifts = [[didx[a], ridx[b], day(c), round(float(v), 2)] for a, b, c, v in zip(g.dkey, g.recip, g.dt, g.amt)]
    gifts.sort(key=lambda x: (-x[2], -x[3]))
    total_all = round(float(d.amt.sum()), 2)
    dump("cf-realestate.json", {
        "asOf": as_of, "first": first, "start": START.date().isoformat(), "all": total_all,
        "sectors": [{"id": k, "label": v} for k, v in SECTORS],
        "donors": dl, "recipients": rlist, "gifts": gifts,
    })
    print(f"    real estate: {len(dl):,} donors, {len(gifts):,} gifts, ${re_.amt.sum() / 1e6:.1f}M of ${total_all / 1e6:.1f}M; "
          f"South Florida ${re_.amt[re_.sofla].sum() / 1e6:.1f}M")
    print(re_.groupby("sector").amt.sum().div(1e6).round(1).to_string())


def write_networks(d, recips, as_of, first, zips):
    """South Florida addresses that five or more donor companies list."""
    c = d[d.org & d.sofla & ~d.committee & ~d.public & (d.name != "")].copy()
    c["akey"] = c.addr.map(address_key) + "|" + c.zip
    c = c[c.akey.str.len() > 8]
    n = c.groupby("akey").dkey.nunique()
    keys = n[n >= 5].index
    c = c[c.akey.isin(keys)]
    donors = donor_table(c)
    sec = d[d.sector.notna()].groupby("dkey").sector.first()
    rkeys = list(c.groupby("recip").amt.sum().sort_values(ascending=False).index)
    ridx, rlist = recip_list(rkeys, recips)
    out = []
    for k, g in c.groupby("akey"):
        raw_addr = Counter(g.addr.str.strip()).most_common(1)[0][0]
        place = Counter(zip(g.city, g.zip)).most_common(1)[0][0]
        ents = []
        for dk, eg in g.groupby("dkey"):
            ents.append({"n": donors[dk]["name"], "t": round(float(eg.amt.sum()), 2), "g": int(len(eg)),
                         "s": sec.get(dk), "r": [ridx[r] for r in eg.groupby("recip").amt.sum().sort_values(ascending=False).index[:6]],
                         "d0": day(eg.dt.min()), "d1": day(eg.dt.max())})
        ents.sort(key=lambda e: -e["t"])
        by_r = g.groupby("recip").amt.sum().sort_values(ascending=False)
        # Same day, same recipient, several companies: a bundle.
        bundles = g.groupby(["recip", "dt"]).dkey.nunique()
        big = bundles[bundles >= 3]
        rs = sum(1 for e in ents if e["s"])
        out.append({
            "a": title(raw_addr), "c": title(place[0]), "z": place[1], "co": zips.get(place[1], ""),
            "n": len(ents), "t": round(float(g.amt.sum()), 2), "gc": int(len(g)),
            "re": rs, "r": [[ridx[r], round(float(v), 2)] for r, v in by_r.items()],
            "b": [[ridx[r], day(t), int(k2)] for (r, t), k2 in big.sort_values(ascending=False).head(5).items()],
            "e": ents,
        })
    out.sort(key=lambda x: (-x["n"], -x["t"]))
    dump("cf-networks.json", {"asOf": as_of, "first": first, "start": START.date().isoformat(), "recipients": rlist, "addresses": out})
    print(f"    networks: {len(out)} addresses with 5+ donor companies; top: " + "; ".join(f"{o['a']} ({o['n']})" for o in out[:5]))


def write_zips(d, recips, as_of, first, zips):
    s = d[d.sofla].copy()
    donors = donor_table(s[s.dkey.isin(s.groupby(["zip", "dkey"]).amt.sum().groupby(level=0, group_keys=False).nlargest(8).reset_index().dkey)])
    rk = s.groupby("recip").amt.sum().sort_values(ascending=False)
    top_r = set()
    out = {}
    for z, g in s.groupby("zip"):
        by_r = g.groupby("recip").amt.sum().nlargest(5)
        top_r.update(by_r.index)
        re_ = g[g.sector.notna()]
        party = g.recip.map(lambda r: recips[r].get("party"))
        out[z] = {
            "co": zips[z], "c": title(Counter(g.city).most_common(1)[0][0]),
            "t": round(float(g.amt.sum())), "g": int(len(g)), "dn": int(g.dkey.nunique()),
            "re": round(float(re_.amt.sum())), "rn": int(re_.dkey.nunique()),
            "R": round(float(g.amt[party == "R"].sum())), "D": round(float(g.amt[party == "D"].sum())),
            "cand": round(float(g.amt[g.src == "candidate"].sum())),
            "_r": list(by_r.items()),
        }
    rkeys = sorted(top_r, key=lambda r: -rk[r])
    ridx, rlist = recip_list(rkeys, recips)
    sec = s[s.sector.notna()].groupby("dkey").sector.first()
    for z, o in out.items():
        g = s[s.zip == z]
        by_d = g.groupby("dkey").amt.sum().nlargest(8)
        o["top"] = [[donors[k]["name"], round(float(v))] + ([sec[k]] if k in sec else []) for k, v in by_d.items()]
        o["rec"] = [[ridx[r], round(float(v))] for r, v in o.pop("_r")]
    dump("cf-zips.json", {"asOf": as_of, "first": first, "start": START.date().isoformat(), "recipients": rlist, "zips": out,
                          "total": round(float(s.amt.sum())), "re": round(float(s.amt[s.sector.notna()].sum()))})
    print(f"    zips: {len(out)} of {len(zips)} South Florida ZIPs; ${s.amt.sum() / 1e6:.1f}M")


def write_governor(d, recips, as_of, first):
    gov = [k for k, r in recips.items() if r["kind"] == "candidate" and r["code"] == "GOV"]
    g = d[d.recip.isin(gov)]
    tot = g.groupby("recip").amt.sum().sort_values(ascending=False)
    main = [k for k, v in tot.items() if v >= 250000]
    months = pd.period_range(START, pd.Timestamp(max(as_of.values())), freq="M")
    out = []
    for k in main:
        r = recips[k]
        last = squash(r["last"]).split()[0] if r["last"] else ""
        pacs = [p for p, x in recips.items() if x["kind"] == "committee" and re.fullmatch(r"FRIENDS OF [A-Z]+ " + re.escape(squash(r["last"])) + r"( PAC)?", squash(x["name"]))]
        series = {}
        for label, keys in (("campaign", [k]), ("pac", pacs)):
            sub = d[d.recip.isin(keys)]
            if not len(sub):
                continue
            m = sub.groupby(sub.dt.dt.to_period("M")).amt.sum().reindex(months, fill_value=0)
            series[label] = [round(float(v)) for v in m]
        c = g[g.recip == k]
        firstname = squash(r["name"]).split()[0]
        self_ = c.nsq.str.contains(r"\b" + re.escape(last) + r"\b") & c.nsq.str.contains(r"\b" + re.escape(firstname) + r"\b") & ~c.org
        indiv = c[~c.org & ~c.public]
        donor_tot = indiv.groupby("dkey").amt.sum()
        out.append({
            "n": r["name"], "p": r.get("party"), "pac": [recips[p]["name"] for p in pacs],
            "t": round(float(c.amt.sum())), "g": int(len(c)), "dn": int(c.dkey.nunique()),
            "sf": round(float(c.amt[c.sofla].sum())), "re": round(float(c.amt[c.sector.notna()].sum())),
            "fl": round(float(c.amt[c.state == "FL"].sum())),
            "small": round(float(c.amt[c.amt <= 200].sum())),
            "self": round(float(c.amt[self_].sum())), "pub": round(float(c.amt[c.public].sum())),
            "cos": round(float(c.amt[c.org & ~c.public & ~self_].sum())),
            "pt": round(float(d.amt[d.recip.isin(pacs)].sum())),
            "pre": round(float(d.amt[d.recip.isin(pacs) & d.sector.notna()].sum())),
            "psf": round(float(d.amt[d.recip.isin(pacs) & d.sofla].sum())),
            "med": float(c.amt.median()), "big": int((donor_tot >= 1000).sum()),
            "s": series,
        })
    others = [k for k in gov if k not in main]
    dump("cf-governor.json", {"asOf": as_of, "first": first, "start": START.date().isoformat(), "months": [str(p) for p in months],
                              "candidates": out, "others": {"n": len(others), "t": round(float(d.amt[d.recip.isin(others)].sum()))}})
    for o in out:
        print(f"    {o['n']} ({o['p']}): ${o['t'] / 1e6:.2f}M, PAC {o['pac']} ${o['pt'] / 1e6:.1f}M, SoFla {o['sf'] / max(o['t'], 1):.0%}, RE {o['re'] / max(o['t'], 1):.0%}")


if __name__ == "__main__":
    main()
