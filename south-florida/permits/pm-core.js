/*!
 * pm-core.js — shared runtime for the South Florida building permits map and
 * table (south-florida-permits-{map,table}.html).
 *
 * Owns: loading the permits file and removing its duplication, the site /
 * job model, size tiers, the neighborhood lookup, the filter model and URL
 * presets, formatting, analytics, and map<->table sync between sibling
 * iframes on one TRD page.
 *
 * The permits file (sofla-multi-county-permits-map-data.geojson, one row per
 * permit from the City of Miami, Miami Beach and Miami-Dade County) is
 * produced upstream and served from static.therealdeal.com. `toPermit()` is
 * the only place that knows its field names.
 *
 * Duplication in the file, and what we do with it:
 *  - The City of Miami files every trade (electrical, plumbing, mechanical…)
 *    as its own sub-permit of one building permit (BD22025768 + 030E001), and
 *    each sub-permit repeats the building's floor area. Sub-permits are folded
 *    into one job per building permit: cost and floor area are the largest
 *    on the job, never a sum.
 *  - Condo units are separate parcels drawn on the same spot, and Miami-Dade
 *    County also issues permits on properties a city permits too. Everything
 *    at one map location is one site (one dot, one table row).
 *  - Repeated rows (same permit number twice) are dropped.
 *
 * Styling: transactions/tx.css (shared look) + construction/cx.css + pm.css.
 */
(function (global) {
  "use strict";

  var DATA_FILE = "https://static.therealdeal.com/interactive-maps/sofla-multi-county-permits-map-data.geojson";
  var PLACES_FILE = "construction/cx-places.json";
  var MAPBOX_TOKEN = "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";
  var NS = "trd-sofla-pm";
  var PAGE_RE = /south-florida-permits-(map|table)/;

  // Miami-Dade folio prefix = municipality (verified for transactions).
  var MUNICIPALITY = {
    "01": "Miami", "02": "Miami Beach", "03": "Coral Gables", "04": "Hialeah", "05": "Miami Springs",
    "06": "North Miami", "07": "North Miami Beach", "08": "Opa-locka", "09": "South Miami", "10": "Homestead",
    "11": "Miami Shores", "12": "Bal Harbour", "13": "Bay Harbor Islands", "14": "Surfside", "15": "West Miami",
    "16": "Florida City", "17": "Biscayne Park", "18": "El Portal", "19": "Golden Beach", "20": "Pinecrest",
    "21": "Indian Creek", "22": "Medley", "23": "North Bay Village", "24": "Key Biscayne", "25": "Sweetwater",
    "26": "Virginia Gardens", "27": "Hialeah Gardens", "28": "Aventura", "29": "Unincorporated Miami-Dade",
    "30": "Unincorporated Miami-Dade", "31": "Sunny Isles Beach", "32": "Miami Lakes", "33": "Palmetto Bay",
    "34": "Miami Gardens", "35": "Doral", "36": "Cutler Bay",
  };
  var UNINC = "Unincorporated Miami-Dade";
  // Who issued the permit (the file's Dataset field).
  var AGENCY = { "City of Miami": "City of Miami", "Miami Beach": "City of Miami Beach", "Miami-Dade County": "Miami-Dade County" };

  // What the permit is for. One color each on the map.
  var WORKS = [
    { id: "new", label: "New construction", short: "New" },
    { id: "addition", label: "Addition", short: "Addition" },
    { id: "renovation", label: "Renovation or repair", short: "Renovation" },
    { id: "demolition", label: "Demolition", short: "Demolition" },
  ];
  var WORK_IDS = WORKS.map(function (w) { return w.id; });
  var WORK_RANK = { new: 4, addition: 3, demolition: 2, renovation: 1 };
  var TYPES = ["Residential", "Commercial", "Mixed use", "Not specified"];

  // Project size. Floor area and units count only on new buildings and
  // additions: a renovation permit repeats the whole building's area and
  // unit count, so a kitchen remodel in a 300-unit tower is not a major job.
  var SIZES = [
    { id: "major", label: "Major", long: "Major projects", note: "$10M+, or a new building of 100,000+ sq ft or 50+ units" },
    { id: "mid", label: "Mid-size", long: "Mid-size projects", note: "$1M–$10M, or a new building of 10,000+ sq ft or 10+ units" },
    { id: "small", label: "Small", long: "Small projects", note: "$100K–$1M, or a smaller new building" },
    { id: "minor", label: "Minor work", long: "Minor work", note: "Under $100K or no cost given: repairs, unit remodels, trade work" },
  ];
  var SIZE_IDS = SIZES.map(function (s) { return s.id; });
  var DEFAULT_SIZES = ["major", "mid", "small"];
  var PERIODS = [
    { id: "30", label: "30 days", days: 30 },
    { id: "90", label: "90 days", days: 90 },
    { id: "all", label: "All", days: null },
  ];
  var STATUSES = [
    { id: "any", label: "Any" },
    { id: "open", label: "Open" },
    { id: "final", label: "Final" },
  ];

  // ------------------------------------------------------------------ format
  var fmt = {
    escape: function (s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    },
    money: function (n) {
      if (n == null || !isFinite(n)) return "—";
      return "$" + Math.round(n).toLocaleString("en-US");
    },
    moneyShort: function (n) {
      if (n == null || !isFinite(n)) return "—";
      if (n >= 1e9) return "$" + trim(n / 1e9, n >= 1e10 ? 1 : 2) + "B";
      if (n >= 1e6) return "$" + trim(n / 1e6, n >= 1e8 ? 0 : n >= 1e7 ? 1 : 2) + "M";
      if (n >= 1e3) return "$" + Math.round(n / 1e3) + "K";
      return "$" + Math.round(n);
    },
    num: function (n) {
      return n == null || !isFinite(n) ? "—" : Math.round(n).toLocaleString("en-US");
    },
    numShort: function (n) {
      if (n == null || !isFinite(n)) return "—";
      if (n >= 1e6) return trim(n / 1e6, 1) + "M";
      if (n >= 1e4) return Math.round(n / 1e3) + "K";
      return Math.round(n).toLocaleString("en-US");
    },
    date: function (iso, opts) {
      var d = parseISO(iso);
      if (!d) return "—";
      return d.toLocaleDateString("en-US", opts || { month: "short", day: "numeric", year: "numeric" });
    },
    dateShort: function (iso) {
      return fmt.date(iso, { month: "short", day: "numeric" });
    },
  };
  function trim(x, digits) {
    return String(+x.toFixed(digits));
  }
  function parseISO(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function isoOf(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  var KEEP_UPPER = /^(LLC|LLLP|LP|II|III|IV|USA|US|FL|NE|NW|SE|SW|N|S|E|W|PA|PLLC|ADU|AC|HVAC|SFR|ACLF|ATM|MEP|DBA|JV|TRS|INC)$/;
  function titleCase(s) {
    return String(s || "").toLowerCase().replace(/[a-z0-9'’]+/g, function (w) {
      var up = w.toUpperCase();
      if (KEEP_UPPER.test(up)) return up;
      if (/^(of|and|or|the|for|to|in|on|at|a|an)$/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).replace(/^./, function (c) { return c.toUpperCase(); });
  }
  // "6365 Collins Ave Unit: Ts-01 Miami Beach Fl 33141-9620" -> street and unit.
  function splitAddress(raw, city) {
    var s = String(raw || "").replace(/\s+/g, " ").trim();
    if (!s) return { street: null, unit: null };
    s = s.replace(/\s+(Fl|FL|Florida)\s+\d{5}(-\d{4})?$/, "");
    if (city) s = s.replace(new RegExp("\\s+" + city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i"), "");
    var unit = null;
    var m = /^(.*?)\s+(?:Unit:?|Apt\.?|Ste\.?|Suite|#)\s*([\w-]+)$/i.exec(s);
    if (m) { s = m[1]; unit = m[2]; }
    else {
      // "8900 Collins Ave 304", "701 S Miami Ave 316A", "3801 Collins Ave Th-1"
      m = /^(\d+[\w-]*\s.+?\b(?:Ave?|St|Rd|Blvd|Dr|Ct|Ter|Pl|Ln|Way|Cir|Hwy|Pkwy|Trl|Cswy|Plz|Path|Row|Ave))\s+([A-Za-z]{0,3}-?\d[\w-]*|[A-Z]{1,3})$/i.exec(s);
      if (m) { s = m[1]; unit = m[2]; }
    }
    s = s.replace(/(\d)(St|Nd|Rd|Th)\b/g, function (_, d, x) { return d + x.toLowerCase(); }).replace(/\bAv\b/g, "Ave").replace(/\b(Ne|Nw|Se|Sw)\b/g, function (d) { return d.toUpperCase(); });
    return { street: s, unit: unit ? unit.toUpperCase() : null };
  }
  function clean(s) {
    return String(s || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
  }
  function num(x) {
    var n = typeof x === "string" ? parseFloat(x.replace(/[^\d.\-]/g, "")) : x;
    return n == null || !isFinite(n) ? null : +n;
  }

  // ------------------------------------------------------------ classification
  function workOf(mainParcel, permitType) {
    var m = String(mainParcel || "").toUpperCase();
    if (/DEMOLI/.test(m) || permitType === "Demolition") return "demolition";
    if (/ADDITION/.test(m) && !/NEW CONSTRUCTION/.test(m)) return "addition";
    if (/NEW CONSTRUCTION|^NEW$|SHELL ONLY|FOUNDATION ONLY|PHASED PERMIT/.test(m) || permitType === "New Building") return "new";
    return "renovation";
  }
  var RES_RE = /\b(RESIDEN\w*|FAMILY|SINGLE FAM|CONDO\w*|APT|APARTMENT\w*|DUPLEX|TOWN ?HOUSE\w*|UNIT|UNITS|ADU|GUESTHOUSE|DWELLING|SFR)\b/;
  var COM_RE = /\b(OFFICE|RETAIL|RESTAURANT|HOTEL|MOTEL|WAREHOUSE|STORE ?FRONTS?|STORES?|BANKS?|HOSPITALS?|SCHOOL|GOVERNMENT|INDUSTRIAL|CHURCH\w*|CLINIC|MANUFACTUR\w*|TENANT|COMMERCIAL|SALON|BARBER|GAS|SERV STATION|SUPERMARKET|RECREATIONAL ESTABLISHMENT|ASSEMBLY|BAR|LOUNGE|NIGHT CLUB|STORAGE|UTILITIES|AUTO)\b/;
  // Type from the permit's own words. The City of Miami lists uses among its
  // work items ("MULTI-FAMILY (CONDO)|WINDOWS"); the county starts with the
  // use ("5 UNITS OR MORE - RESIDENTIAL, INT REMODEL"); Miami Beach's scope
  // names the building class.
  function typeOf(agency, mainParcel, desc) {
    var m = String(mainParcel || "").toUpperCase(), d = String(desc || "").toUpperCase();
    if (agency === "Miami Beach") {
      if (/^RESIDENTIAL|- RESIDENTIAL/.test(m)) return "Residential";
      if (RES_RE.test(d)) return "Residential";
      return /COMMERCIAL/.test(m) ? "Commercial" : "Not specified";
    }
    var text = agency === "Miami-Dade County" ? d.split(",")[0] : d;
    var r = RES_RE.test(text), c = COM_RE.test(text);
    return r && c ? "Mixed use" : r ? "Residential" : c ? "Commercial" : "Not specified";
  }
  function statusOf(s) {
    var t = String(s || "").toLowerCase();
    if (!t) return null;
    if (/^final/.test(t)) return { key: "final", label: "Final" };
    if (/active|issued|hold/.test(t)) return { key: "open", label: t === "hold" ? "On hold" : "Open" };
    return { key: "closed", label: titleCase(t) }; // expired, revoked, suspended
  }

  // ------------------------------------------------------------- permits
  function toPermit(f) {
    var p = f.properties || {};
    var c = f.geometry && f.geometry.coordinates;
    var agency = p.Dataset || "";
    var folio = String(p.Parcel_ID == null ? "" : p.Parcel_ID).replace(/\D/g, "");
    var county = p.County || "Miami-Dade";
    if (county === "Miami-Dade" && folio && folio.length < 13) folio = folio.padStart(13, "0"); // the leading 0 was lost
    var city = county === "Miami-Dade" ? MUNICIPALITY[folio.slice(0, 2)] || null : null;
    if (!city) city = agency === "Miami Beach" ? "Miami Beach" : agency === "City of Miami" ? "Miami" : null;
    var addr = splitAddress(p.Address, agency === "Miami Beach" ? "Miami Beach" : null);
    var lng = c && isFinite(c[0]) ? +c[0] : num(p.Longitude), lat = c && isFinite(c[1]) ? +c[1] : num(p.Latitude);
    var num_ = String(p.Permit_Number || "").trim();
    var cm = agency === "City of Miami" ? /^(BD\d{8})(.*)$/.exec(num_) : null;
    var desc = clean(p.Description);
    return {
      number: num_,
      job: cm ? "M:" + cm[1] : agency + ":" + num_,
      master: cm ? cm[1] : num_,
      trade: cm ? tradeOf(cm[2]) : null,
      agency: agency,
      county: county,
      folio: folio || null,
      city: city,
      street: addr.street,
      unit: addr.unit,
      work: workOf(p.MainParcel, p.PermitType),
      scope: p.MainParcel ? titleCase(p.MainParcel) : null,
      type: typeOf(agency, p.MainParcel, desc),
      status: statusOf(p.Status),
      issued: /^\d{4}-\d{2}-\d{2}/.test(p.Issued_Date || "") ? String(p.Issued_Date).slice(0, 10) : null,
      applied: /^\d{4}-\d{2}-\d{2}/.test(p.Applied_Date || "") ? String(p.Applied_Date).slice(0, 10) : null,
      cost: num(p.Total_Est_Cost) > 0 ? num(p.Total_Est_Cost) : null,
      sqft: num(p.Total_Est_SqFt) > 0 ? num(p.Total_Est_SqFt) : null,
      units: num(p.Num_Units) > 0 ? num(p.Num_Units) : null,
      floors: num(p.Num_Floors) > 0 ? num(p.Num_Floors) : null,
      owner: p.Owner ? clean(p.Owner) : null,
      desc: desc,
      lng: lng,
      lat: lat,
    };
  }
  // City of Miami sub-permit suffix "030E001" -> trade name.
  var TRADES = { B: "Building", E: "Electrical", P: "Plumbing", MA: "Mechanical", MB: "Mechanical", F: "Fire", PW: "Public works", BR: "Roofing", L: "Landscaping", PG: "Gas", IF: "Building", PH: "Building" };
  function tradeOf(suffix) {
    var m = /^\d{3}([A-Z]+)\d{3}$/.exec(suffix || "") || /^[A-Z]\d{2}([A-Z]+)\d{3}$/.exec(suffix || "");
    return m ? TRADES[m[1]] || "Other" : null;
  }
  // Miami-Dade, generously (the 27 City of Miami permits drawn near Lake
  // Okeechobee fall outside and are kept off the map).
  function inArea(p) {
    return p.lng != null && p.lat != null && p.lng > -80.95 && p.lng < -80.05 && p.lat > 25.1 && p.lat < 26.0;
  }

  // ------------------------------------------------------------------ jobs
  // One job per City of Miami building permit (its trade sub-permits folded
  // in) or per county / Miami Beach permit.
  function buildJobs(permits) {
    var by = {}, out = [];
    permits.forEach(function (p) {
      var j = by[p.job];
      if (!j) {
        j = by[p.job] = { id: p.job, number: p.master, agency: p.agency, permits: [], folios: {} };
        out.push(j);
      }
      j.permits.push(p);
      if (p.folio) j.folios[p.folio] = true;
    });
    out.forEach(function (j) {
      var ps = j.permits;
      // The building sub-permit (or the first) speaks for the job.
      var bld = ps.filter(function (p) { return p.trade === "Building"; });
      var lead = (bld.length ? bld : ps).slice().sort(function (a, b) { return (b.cost || 0) - (a.cost || 0) || (a.issued < b.issued ? -1 : 1); })[0];
      j.lead = lead;
      j.work = ps.reduce(function (w, p) { return WORK_RANK[p.work] > WORK_RANK[w] ? p.work : w; }, lead.work);
      j.scope = lead.scope;
      j.cost = max(ps, "cost");
      j.sqft = max(ps, "sqft");
      j.units = max(ps, "units");
      j.floors = max(ps, "floors");
      j.first = minStr(ps, "issued");
      j.latest = maxStr(ps, "issued");
      j.applied = minStr(ps, "applied");
      j.owner = (ps.filter(function (p) { return p.owner; })[0] || {}).owner || null;
      j.desc = lead.desc;
      j.street = lead.street;
      j.unit = lead.unit;
      j.type = mergeTypes(ps.map(function (p) { return p.type; }));
      var st = lead.status || (ps.filter(function (p) { return p.status; })[0] || {}).status || null;
      j.status = st;
      j.trades = uniq(ps.map(function (p) { return p.trade; }).filter(Boolean));
      j.subCount = ps.length;
      j.located = inArea(lead);
      j.lng = lead.lng;
      j.lat = lead.lat;
    });
    return out;
  }
  function max(list, k) {
    var m = null;
    list.forEach(function (x) { if (x[k] != null && (m == null || x[k] > m)) m = x[k]; });
    return m;
  }
  function minStr(list, k) {
    var m = null;
    list.forEach(function (x) { if (x[k] && (!m || x[k] < m)) m = x[k]; });
    return m;
  }
  function maxStr(list, k) {
    var m = null;
    list.forEach(function (x) { if (x[k] && (!m || x[k] > m)) m = x[k]; });
    return m;
  }
  function uniq(list) {
    var seen = {}, out = [];
    list.forEach(function (x) {
      var k = String(x).toLowerCase();
      if (!seen[k]) { seen[k] = true; out.push(x); }
    });
    return out;
  }
  function byCount(list) {
    var c = {};
    list.forEach(function (x) { c[x] = (c[x] || 0) + 1; });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a]; });
  }
  function mergeTypes(types) {
    var known = uniq(types.filter(function (t) { return t !== "Not specified"; }));
    if (!known.length) return "Not specified";
    if (known.length === 1) return known[0];
    return "Mixed use";
  }

  // ------------------------------------------------------------------ sites
  // Everything at one map location is one site. Off-map jobs group by parcel.
  function buildSites(jobs) {
    var by = {}, out = [];
    jobs.forEach(function (j) {
      var key = j.located ? "@" + j.lng.toFixed(5) + "," + j.lat.toFixed(5) : "f" + (Object.keys(j.folios)[0] || j.id);
      var s = by[key];
      if (!s) { s = by[key] = { key: key, jobs: [] }; out.push(s); }
      s.jobs.push(j);
    });
    return out.map(siteOf);
  }
  function siteOf(s) {
    var jobs = s.jobs.sort(function (a, b) { return (b.cost || 0) - (a.cost || 0) || (b.latest < a.latest ? -1 : 1); });
    var folios = {}, streets = {}, units = {}, agencies = {}, owners = {}, cities = {};
    jobs.forEach(function (j) {
      Object.keys(j.folios).forEach(function (f) { folios[f] = true; });
      j.permits.forEach(function (p) {
        if (p.street) streets[p.street] = (streets[p.street] || 0) + 1;
        if (p.unit) units[p.unit] = true;
        if (p.city) cities[p.city] = (cities[p.city] || 0) + 1;
      });
      agencies[j.agency] = true;
      if (j.owner) owners[j.owner] = (owners[j.owner] || 0) + 1;
    });
    var folioList = Object.keys(folios).sort();
    var big = jobs.filter(function (j) { return j.work === "new" || j.work === "addition"; });
    var r = {
      id: folioList[0] || jobs[0].id.replace(/\W+/g, "-"),
      folios: folioList,
      address: top(streets),
      streets: Object.keys(streets),
      units: Object.keys(units).sort(),
      city: top(cities) || null,
      county: jobs[0].permits[0].county,
      agencies: Object.keys(agencies),
      owners: Object.keys(owners).sort(function (a, b) { return owners[b] - owners[a]; }),
      jobs: jobs,
      permitCount: jobs.reduce(function (n, j) { return n + j.subCount; }, 0),
      // Jobs are distinct work, so their costs add up. Floor area and units
      // describe the building, so they never do.
      value: jobs.reduce(function (n, j) { return j.cost ? (n || 0) + j.cost : n; }, null),
      sqft: max(jobs, "sqft"),
      newSqft: max(big, "sqft"),
      newUnits: max(big.filter(function (j) { return j.agency === "Miami-Dade County"; }), "units"),
      floors: max(big, "floors"),
      work: jobs.reduce(function (w, j) { return !w || WORK_RANK[j.work] > WORK_RANK[w] ? j.work : w; }, null),
      type: mergeTypes(jobs.map(function (j) { return j.type; })),
      date: maxStr(jobs, "latest"),
      first: minStr(jobs, "first"),
      lng: jobs[0].lng,
      lat: jobs[0].lat,
      located: jobs[0].located,
      hood: null, // filled from cx-places.json
    };
    var sts = jobs.map(function (j) { return j.status; }).filter(Boolean);
    r.status = !sts.length ? null : sts.some(function (x) { return x.key === "open"; }) ? "Open"
      : sts.every(function (x) { return x.key === "final"; }) ? "Final" : sts[0].label;
    r.size = sizeOf(r);
    r.parcelUrl = r.county === "Miami-Dade" && r.folios.length === 1 && r.folios[0].length === 13
      ? "https://apps.miamidadepa.gov/PropertySearch/#/?folio=" + r.folios[0] : null;
    r.hay = [r.address, r.streets.join(" "), r.city, r.folios.join(" "), r.owners.join(" "),
      jobs.map(function (j) { return j.permits.map(function (p) { return p.number; }).join(" ") + " " + j.desc + " " + (j.scope || ""); }).join(" ")]
      .join(" ").toLowerCase();
    return r;
  }
  function top(counts) {
    var best = null;
    Object.keys(counts).forEach(function (k) { if (!best || counts[k] > counts[best]) best = k; });
    return best;
  }
  function sizeOf(r) {
    var v = r.value || 0, sq = r.newSqft || 0, u = r.newUnits || 0;
    if (v >= 1e7 || sq >= 1e5 || u >= 50) return "major";
    if (v >= 1e6 || sq >= 1e4 || u >= 10) return "mid";
    if (v >= 1e5 || sq > 0 || u > 0) return "small";
    return "minor";
  }

  // ------------------------------------------------------------------ places
  // City of Miami neighborhoods (city GIS) and census places for the
  // unincorporated county (shared with the construction map).
  var places = null;
  function loadPlaces() {
    if (!places) {
      places = fetch(PLACES_FILE).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }).then(function (fc) {
        return fc.features.map(function (f) {
          return { name: f.properties.name, kind: f.properties.kind, geom: f.geometry, bbox: bboxOf(f.geometry) };
        });
      });
    }
    return places;
  }
  function bboxOf(g) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    (function walk(c) {
      if (typeof c[0] === "number") {
        if (c[0] < b[0]) b[0] = c[0];
        if (c[1] < b[1]) b[1] = c[1];
        if (c[0] > b[2]) b[2] = c[0];
        if (c[1] > b[3]) b[3] = c[1];
      } else c.forEach(walk);
    })(g.coordinates);
    return b;
  }
  function inRing(ring, x, y) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function inPolygon(poly, x, y) {
    if (!inRing(poly[0], x, y)) return false;
    for (var k = 1; k < poly.length; k++) if (inRing(poly[k], x, y)) return false;
    return true;
  }
  function placeAt(list, x, y) {
    for (var i = 0; i < list.length; i++) {
      var p = list[i], b = p.bbox;
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      var polys = p.geom.type === "Polygon" ? [p.geom.coordinates] : p.geom.coordinates;
      for (var k = 0; k < polys.length; k++) if (inPolygon(polys[k], x, y)) return p;
    }
    return null;
  }
  var HOOD_RENAME = { CBD: "Downtown", MDCC: "Downtown (MDC)", "Omni/PAC": "Omni / Arts District", Roads: "The Roads" };
  function assignHoods(rows, list) {
    rows.forEach(function (r) {
      var p = r.located ? placeAt(list, r.lng, r.lat) : null;
      // A Miami neighborhood counts only inside the city; a census place only
      // in the unincorporated county.
      if (p && !(p.kind === "neighborhood" ? r.city === "Miami" : r.city === UNINC)) p = null;
      r.hood = p ? HOOD_RENAME[p.name] || p.name : null;
      r.hay += " " + (r.hood || "").toLowerCase();
    });
  }
  function placeLine(r) {
    if (r.hood) return r.hood + (r.city === "Miami" ? ", Miami" : "");
    return r.city || r.county || "";
  }

  // ------------------------------------------------------------------ load
  function dataUrl() {
    // Dev-only override so a local build can point at a saved copy.
    var q = new URLSearchParams(location.search);
    if (q.get("data") && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return q.get("data");
    return DATA_FILE;
  }
  function startTags() {
    if (typeof global.__pmLoadGtm !== "function") return;
    var go = function () { global.__pmLoadGtm(); };
    setTimeout(function () {
      if (global.requestIdleCallback) global.requestIdleCallback(go, { timeout: 2000 });
      else go();
    }, 0);
  }
  var loadPromise = null;
  function load() {
    if (loadPromise) return loadPromise;
    var placesP = loadPlaces().catch(function () { return []; });
    loadPromise = fetch(dataUrl(), { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (fc) {
      var seen = {}, dropped = 0;
      var permits = (fc.features || []).map(toPermit).filter(function (p) {
        if (!p.issued) return false;
        var k = p.agency + ":" + p.number;
        if (seen[k]) { dropped++; return false; }
        seen[k] = true;
        return true;
      });
      var jobs = buildJobs(permits);
      var rows = buildSites(jobs);
      return placesP.then(function (list) {
        assignHoods(rows, list);
        var byId = {};
        rows.forEach(function (r, i) {
          r._n = i;
          if (byId[r.id]) r.id = r.id + "-" + i; // two sites can't share a lead folio
          byId[r.id] = r;
          r.folios.forEach(function (f) { if (!byId[f]) byId[f] = r; }); // ?project=<any folio>
        });
        var cities = {};
        rows.forEach(function (r) { if (r.city) cities[r.city] = (cities[r.city] || 0) + 1; });
        return {
          rows: rows,
          byId: byId,
          permits: permits.length,
          jobs: jobs.length,
          dropped: dropped,
          agencies: byCount(permits.map(function (p) { return p.agency; })),
          cities: Object.keys(cities).sort(function (a, b) { return cities[b] - cities[a] || a.localeCompare(b); }),
          cityCounts: cities,
          asOf: maxStr(permits, "issued"),
          first: minStr(permits, "issued"),
        };
      });
    });
    loadPromise.then(startTags, startTags);
    return loadPromise;
  }

  // ------------------------------------------------------------------ state
  function defaultState() {
    return { period: "all", sizes: DEFAULT_SIZES.slice(), works: WORK_IDS.slice(), types: TYPES.slice(), city: null, status: "any", hood: null, q: "" };
  }
  function listParam(v, all) {
    if (!v) return null;
    var want = String(v).toLowerCase().split(",");
    var out = all.filter(function (x) { return want.indexOf(String(x).toLowerCase()) >= 0 || want.indexOf(slug(x)) >= 0; });
    return out.length ? out : null;
  }
  // URL presets: ?work=new,demolition ?type=residential ?size=major,mid
  // ?city=miami-beach ?period=30 ?status=open ?hood=Wynwood ?q=text
  function stateFromUrl(search) {
    var q = new URLSearchParams(search == null ? location.search : search);
    var s = defaultState();
    var w = listParam(q.get("work"), WORK_IDS);
    if (w) s.works = w;
    var t = listParam(q.get("type"), TYPES);
    if (t) s.types = t;
    var sz = listParam(q.get("size"), SIZE_IDS);
    if (sz) s.sizes = sz;
    if (q.get("city")) s.city = q.get("city").slice(0, 60);
    if (PERIODS.some(function (p) { return p.id === q.get("period"); })) s.period = q.get("period");
    if (STATUSES.some(function (p) { return p.id === q.get("status"); })) s.status = q.get("status");
    if (q.get("hood")) s.hood = q.get("hood");
    if (q.get("q")) s.q = q.get("q").slice(0, 100);
    return s;
  }
  // ?city= may be a slug ("miami-beach"); resolve it once the data is in.
  function resolveCity(state, data) {
    if (!state.city || !data) return state;
    var want = slug(state.city);
    var hit = data.cities.filter(function (c) { return slug(c) === want || c.toLowerCase() === state.city.toLowerCase(); })[0];
    state.city = hit || null;
    return state;
  }
  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  function isDefault(s) {
    return filterCount(s) === 0 && !s.q;
  }
  function filterCount(s) {
    var d = defaultState(), n = 0;
    if (s.period !== d.period) n++;
    if (s.sizes.join() !== d.sizes.join()) n++;
    if (s.works.length !== WORK_IDS.length) n++;
    if (s.types.length !== TYPES.length) n++;
    if (s.city) n++;
    if (s.status !== d.status) n++;
    if (s.hood) n++;
    return n;
  }
  function clone(s) {
    return JSON.parse(JSON.stringify(s));
  }
  function since(state, asOf) {
    var p = PERIODS.find(function (x) { return x.id === state.period; });
    if (!p || !p.days || !asOf) return null;
    var d = parseISO(asOf);
    d.setDate(d.getDate() - p.days + 1);
    return isoOf(d);
  }

  // opts.ignore: a key ("sizes", "works", ...) to leave out (legend counts).
  function apply(rows, state, asOf, opts) {
    opts = opts || {};
    var from = opts.ignore === "period" ? null : since(state, asOf);
    var q = opts.ignore === "q" ? "" : String(state.q || "").trim().toLowerCase();
    var words = q ? q.split(/\s+/) : [];
    return rows.filter(function (r) {
      if (from && r.date < from) return false;
      if (opts.ignore !== "sizes" && state.sizes.indexOf(r.size) < 0) return false;
      if (opts.ignore !== "works" && state.works.indexOf(r.work) < 0) return false;
      if (opts.ignore !== "types" && state.types.indexOf(r.type) < 0) return false;
      if (opts.ignore !== "city" && state.city && r.city !== state.city) return false;
      if (opts.ignore !== "hood" && state.hood && r.hood !== state.hood) return false;
      if (opts.ignore !== "status" && state.status !== "any") {
        if (state.status === "final" && r.status !== "Final") return false;
        if (state.status === "open" && r.status !== "Open") return false;
      }
      for (var i = 0; i < words.length; i++) if (r.hay.indexOf(words[i]) < 0) return false;
      return true;
    });
  }

  function summary(rows) {
    var s = { count: rows.length, value: 0, sqft: 0, units: 0, permits: 0 };
    rows.forEach(function (r) {
      s.value += r.value || 0;
      s.sqft += r.newSqft || 0;
      s.units += r.newUnits || 0;
      s.permits += r.permitCount;
    });
    return s;
  }
  function plural(n, one, many) {
    return n.toLocaleString("en-US") + " " + (n === 1 ? one : many || one + "s");
  }

  // ------------------------------------------------------------------ analytics
  function tracker(category) {
    return function (action, label) {
      if (!global.dataLayer) return;
      global.dataLayer.push({ event: "event_tracking", trd: { category: category, action: action, label: label == null ? "" : String(label) } });
    };
  }

  // -------------------------------------------------------------- sibling sync
  // Same pattern as the transactions and construction embeds: same-origin
  // sibling iframes on one TRD page reach each other through parent.frames.
  // On the combined page (south-florida-permits.html) the map and table run in
  // one window and talk through `local` instead.
  var local = [];
  function link(role, onMessage) {
    local.push({ role: role, onMessage: onMessage });
    function siblings() {
      var out = [];
      try {
        var frames = global.parent && global.parent !== global ? global.parent.frames : [];
        for (var i = 0; i < frames.length; i++) {
          var w = frames[i];
          if (w === global) continue;
          try {
            if (w.location.origin === location.origin && PAGE_RE.test(w.location.pathname)) out.push(w);
          } catch (e) { /* cross-origin frame */ }
        }
      } catch (e) {}
      return out;
    }
    global.addEventListener("message", function (ev) {
      if (ev.origin !== location.origin || !ev.data || ev.data.ns !== NS || ev.data.from === role) return;
      onMessage(ev.data);
    });
    var api = {
      send: function (type, payload) {
        local.forEach(function (l) {
          if (l.role === role) return;
          setTimeout(function () { l.onMessage({ ns: NS, from: role, type: type, payload: clone(payload), local: true }); }, 0);
        });
        siblings().forEach(function (w) {
          w.postMessage({ ns: NS, from: role, type: type, payload: payload }, location.origin);
        });
      },
      hasPeer: function (peerRole) {
        if (local.some(function (l) { return l.role === peerRole; })) return true;
        return siblings().some(function (w) { return w.location.pathname.indexOf("permits-" + peerRole) >= 0; });
      },
    };
    setTimeout(function () { api.send("hello", null); }, 0);
    return api;
  }

  // ------------------------------------------------------------- filter bar
  // Renders the shared filter groups into `el` (tx.css look); onChange(state).
  function filterBar(el, getState, onChange, opts) {
    opts = opts || {};
    function chip(group, value, label, active, title) {
      return '<button type="button" class="tx-chip' + (active ? " is-active" : "") + '" data-group="' + group + '" data-value="' +
        fmt.escape(value) + '" aria-pressed="' + active + '"' + (title ? ' title="' + fmt.escape(title) + '"' : "") + ">" + label + "</button>";
    }
    function group(label, key, inner, hint) {
      return '<div class="tx-group" data-key="' + key + '"><span class="tx-group-label">' + label + "</span>" +
        '<div class="tx-chips">' + inner + "</div>" + (hint ? '<p class="cx-hint">' + hint + "</p>" : "") + "</div>";
    }
    function counts(data, s, key, field) {
      var c = {};
      if (data) apply(data.rows, s, data.asOf, { ignore: key }).forEach(function (r) { c[r[field]] = (c[r[field]] || 0) + 1; });
      return c;
    }
    function n(c, k, data) {
      return data ? ' <span class="tx-n">' + (c[k] || 0).toLocaleString("en-US") + "</span>" : "";
    }
    function render() {
      var s = getState();
      var data = opts.getData ? opts.getData() : null;
      var sizeC = counts(data, s, "sizes", "size"), workC = counts(data, s, "works", "work"), typeC = counts(data, s, "types", "type");
      var html = '<div class="tx-filter-groups">';
      html += group("Latest permit", "period", PERIODS.map(function (p) {
        return chip("period", p.id, p.label, s.period === p.id);
      }).join(""));
      html += group("Work", "works", WORKS.map(function (w) {
        return chip("works", w.id, '<i class="tx-swatch pm-swatch-' + w.id + '"></i>' + w.label + n(workC, w.id, data),
          s.works.length < WORK_IDS.length && s.works.indexOf(w.id) >= 0);
      }).join(""));
      html += group("Project size", "sizes", SIZES.map(function (z) {
        return chip("sizes", z.id, z.label + n(sizeC, z.id, data), s.sizes.indexOf(z.id) >= 0, z.note);
      }).join(""), s.sizes.indexOf("minor") < 0 ? "Minor work (under $100K or no cost given) is hidden." : "");
      html += group("Property type", "types", TYPES.map(function (t) {
        return chip("types", t, t + n(typeC, t, data), s.types.length < TYPES.length && s.types.indexOf(t) >= 0);
      }).join(""), s.types.length < TYPES.length ? "Type is read from the permit’s description." : "");
      if (data && data.cities.length > 1) {
        var cityC = counts(data, s, "city", "city");
        html += '<div class="tx-group" data-key="city"><label class="tx-group-label" for="pm-city">City</label><div class="tx-chips">' +
          '<select id="pm-city" class="pm-select"><option value="">All of Miami-Dade</option>' +
          data.cities.map(function (c) {
            return '<option value="' + fmt.escape(c) + '"' + (s.city === c ? " selected" : "") + ">" + fmt.escape(c) + " (" + (cityC[c] || 0).toLocaleString("en-US") + ")</option>";
          }).join("") + "</select></div></div>";
      }
      html += group("Permit status", "status", STATUSES.map(function (x) {
        return chip("status", x.id, x.label, s.status === x.id);
      }).join(""), s.status !== "any" ? "Miami-Dade County permits don’t list a status, so they’re left out." : "");
      html += '<button type="button" class="tx-reset"' + (isDefault(s) ? " hidden" : "") + ">Reset</button></div>";
      el.innerHTML = html;
    }
    el.addEventListener("click", function (e) {
      var b = e.target.closest(".tx-chip");
      var s = getState();
      if (e.target.closest(".tx-reset")) {
        var d = defaultState();
        d.q = s.q;
        onChange(d, "reset");
        render();
        return;
      }
      if (!b) return;
      var g = b.getAttribute("data-group"), v = b.getAttribute("data-value");
      if (g === "period" || g === "status") s[g] = v;
      else if (g === "sizes") {
        // Sizes toggle independently (any non-empty mix).
        var has = s.sizes.indexOf(v) >= 0;
        var next = has ? s.sizes.filter(function (x) { return x !== v; }) : s.sizes.concat([v]);
        s.sizes = next.length ? SIZE_IDS.filter(function (x) { return next.indexOf(x) >= 0; }) : SIZE_IDS.slice();
      } else {
        var all = g === "works" ? WORK_IDS : TYPES;
        s[g] = toggleSet(s[g], v, all);
      }
      onChange(s, g + ":" + v);
      render();
    });
    el.addEventListener("change", function (e) {
      if (e.target.id !== "pm-city") return;
      var s = getState();
      s.city = e.target.value || null;
      if (s.hood) s.hood = null;
      onChange(s, "city:" + (s.city || "all"), { fit: true });
      render();
    });
    return { render: render };
  }
  // First click on an "all" set isolates the value; clicking the last one
  // restores everything.
  function toggleSet(current, v, all) {
    if (current.length === all.length) return [v];
    var has = current.indexOf(v) >= 0;
    var next = has ? current.filter(function (x) { return x !== v; }) : current.concat([v]);
    if (!next.length || next.length === all.length) return all.slice();
    return all.filter(function (x) { return next.indexOf(x) >= 0; });
  }
  function workLabel(id) {
    return (WORKS[WORK_IDS.indexOf(id)] || {}).label || id;
  }

  // Active-filter chips (removable), shared look with transactions.
  function activeChips(container, s, onChange) {
    var chips = [];
    var d = defaultState();
    if (s.q) chips.push(["q", "“" + s.q + "”"]);
    if (s.city) chips.push(["city", s.city]);
    if (s.hood) chips.push(["hood", s.hood]);
    if (s.period !== d.period) chips.push(["period", "Latest permit: " + PERIODS.find(function (p) { return p.id === s.period; }).label]);
    if (s.works.length !== WORK_IDS.length) chips.push(["works", s.works.map(workLabel).join(", ")]);
    if (s.sizes.join() !== d.sizes.join()) chips.push(["sizes", s.sizes.length === SIZE_IDS.length ? "All sizes incl. minor work" : s.sizes.map(function (x) { return SIZES[SIZE_IDS.indexOf(x)].label; }).join(", ")]);
    if (s.types.length !== TYPES.length) chips.push(["types", s.types.join(", ")]);
    if (s.status !== d.status) chips.push(["status", "Status: " + STATUSES.find(function (x) { return x.id === s.status; }).label]);
    container.hidden = !chips.length;
    container.innerHTML = chips.map(function (c) {
      return '<button type="button" class="tx-active-chip" data-clear="' + c[0] + '" aria-label="Remove filter: ' + fmt.escape(c[1]) + '">' +
        fmt.escape(c[1]) + ' <span class="tx-x" aria-hidden="true">×</span></button>';
    }).join("") + (chips.length > 1 ? '<button type="button" class="tx-clear-all" data-clear="all">Clear all</button>' : "");
    container.onclick = function (e) {
      var b = e.target.closest("[data-clear]");
      if (!b) return;
      var k = b.getAttribute("data-clear");
      var n = clone(s);
      if (k === "all") n = defaultState();
      else n[k] = d[k] && d[k].slice ? d[k].slice() : d[k];
      onChange(n, "clear:" + k);
    };
  }

  // ------------------------------------------------------------- search box
  // Text filter plus suggestions: cities and neighborhoods, owners, and
  // individual sites. onPick({kind, ...}); onQuery(text) as the reader types.
  function searchBox(o) {
    var input = o.input, panel = o.panel, items = [], active = -1, timer = null;
    function suggestions(q) {
      var data = o.getData();
      if (!data || q.length < 2) return [];
      var lq = q.toLowerCase(), out = [];
      var hoods = {}, owners = {};
      data.cities.forEach(function (c) {
        if (c.toLowerCase().indexOf(lq) >= 0 && out.length < 2) out.push({ kind: "city", value: c, title: c, sub: plural(data.cityCounts[c], "site") });
      });
      data.rows.forEach(function (r) {
        if (r.hood && r.hood.toLowerCase().indexOf(lq) >= 0) hoods[r.hood] = (hoods[r.hood] || 0) + 1;
        r.owners.forEach(function (n) {
          if (n.toLowerCase().indexOf(lq) >= 0) owners[n] = (owners[n] || 0) + 1;
        });
      });
      Object.keys(hoods).sort(function (a, b) { return hoods[b] - hoods[a]; }).slice(0, 3).forEach(function (h) {
        out.push({ kind: "hood", value: h, title: h, sub: plural(hoods[h], "site") });
      });
      Object.keys(owners).sort(function (a, b) { return owners[b] - owners[a]; }).slice(0, 3).forEach(function (n) {
        out.push({ kind: "owner", value: n, title: titleCase(n), sub: "Owner · " + plural(owners[n], "site") });
      });
      var digits = lq.replace(/\D/g, "");
      data.rows.filter(function (r) {
        return (r.address && r.address.toLowerCase().indexOf(lq) >= 0) ||
          (digits.length >= 6 && r.folios.some(function (f) { return f.indexOf(digits) >= 0; })) ||
          r.jobs.some(function (j) { return j.permits.some(function (p) { return p.number.toLowerCase().indexOf(lq) === 0; }); });
      }).sort(function (a, b) { return (b.value || 0) - (a.value || 0); }).slice(0, 5).forEach(function (r) {
        out.push({ kind: "project", row: r, title: r.address || "Folio " + r.folios[0], sub: placeLine(r) + " · " + (r.value ? fmt.moneyShort(r.value) : plural(r.permitCount, "permit")) });
      });
      return out;
    }
    function draw() {
      if (!items.length) { panel.hidden = true; input.setAttribute("aria-expanded", "false"); return; }
      panel.innerHTML = items.map(function (it, i) {
        return '<li role="option" id="pm-opt-' + i + '" class="' + (i === active ? "is-active" : "") + '" data-i="' + i + '"' +
          (i === active ? ' aria-selected="true"' : "") + '><span class="tx-sg-main"><span class="cx-sg-kind">' +
          (it.kind === "city" ? "City" : it.kind === "hood" ? "Area" : it.kind === "owner" ? "Owner" : "Site") + "</span>" + fmt.escape(it.title) +
          '</span><span class="tx-sg-sub">' + fmt.escape(it.sub) + "</span></li>";
      }).join("");
      panel.hidden = false;
      input.setAttribute("aria-expanded", "true");
      if (active >= 0) input.setAttribute("aria-activedescendant", "pm-opt-" + active);
      else input.removeAttribute("aria-activedescendant");
    }
    function pick(i) {
      var it = items[i];
      if (!it) return;
      items = [];
      draw();
      o.onPick(it);
    }
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", panel.id);
    input.setAttribute("aria-expanded", "false");
    panel.setAttribute("role", "listbox");
    input.addEventListener("input", function () {
      var q = input.value.trim();
      items = suggestions(q);
      active = -1;
      draw();
      clearTimeout(timer);
      timer = setTimeout(function () { o.onQuery(q); }, 200);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" && items.length) { active = (active + 1) % items.length; draw(); e.preventDefault(); }
      else if (e.key === "ArrowUp" && items.length) { active = (active - 1 + items.length) % items.length; draw(); e.preventDefault(); }
      else if (e.key === "Enter") {
        if (active >= 0) { e.preventDefault(); pick(active); }
        else { items = []; draw(); clearTimeout(timer); o.onQuery(input.value.trim()); }
      } else if (e.key === "Escape") {
        if (items.length) { items = []; draw(); } else if (input.value) { input.value = ""; o.onQuery(""); }
      }
    });
    input.addEventListener("blur", function () { setTimeout(function () { items = []; draw(); }, 150); });
    panel.addEventListener("mousedown", function (e) {
      var li = e.target.closest("li[data-i]");
      if (li) { e.preventDefault(); pick(+li.getAttribute("data-i")); }
    });
    return {
      set: function (q) { if (document.activeElement !== input) input.value = q || ""; },
      clear: function () { input.value = ""; },
    };
  }
  function searchHtml(q, placeholder) {
    return '<label class="tx-search"><span class="tx-sr">Search permits</span>' +
      '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4.5 4.5" /></svg>' +
      '<input class="tx-search-input" type="search" autocomplete="off" spellcheck="false" placeholder="' + fmt.escape(placeholder) + '" value="' + fmt.escape(q || "") + '" /></label>';
  }

  // ------------------------------------------------------------------ detail
  // Site facts shared by the map's side panel and the table's expanded row.
  function facts(r) {
    var rows = [];
    rows.push(["Latest permit", fmt.date(r.date) + (r.status ? ' <span class="tx-muted">· ' + fmt.escape(r.status) + "</span>" : "")]);
    var scale = [];
    if (r.newSqft) scale.push(fmt.num(r.newSqft) + " sq ft");
    if (r.newUnits) scale.push(plural(r.newUnits, "unit"));
    if (r.floors) scale.push(plural(r.floors, "floor"));
    if (scale.length) rows.push(["New building", scale.join(" · ")]);
    if (r.owners.length) rows.push(["Owner", r.owners.slice(0, 2).map(function (o) { return fmt.escape(titleCase(o)); }).join("<br>")]);
    if (r.units.length > 1) rows.push(["Units", plural(r.units.length, "unit") + ' <span class="tx-muted">with permits</span>']);
    rows.push(["Issued by", fmt.escape(r.agencies.map(function (a) { return AGENCY[a] || a; }).join(", "))]);
    if (r.folios.length === 1) rows.push(["Folio", fmt.escape(r.folios[0])]);
    else if (r.folios.length > 1) rows.push(["Folios", plural(r.folios.length, "parcel") + ' <span class="tx-muted">at this location</span>']);
    return rows;
  }
  // The jobs on a site, biggest first. Trade sub-permits show as a count.
  function jobsHtml(r, max) {
    max = max || 6;
    var list = r.jobs.slice(0, max).map(function (j) {
      var bits = [fmt.dateShort(j.latest), workLabel(j.work)];
      if (j.unit) bits.push("Unit " + j.unit);
      var extra = j.subCount > 1 ? " + " + plural(j.subCount - 1, "trade permit") : "";
      return '<li><span class="pm-job-head"><span class="tx-swatch pm-swatch-' + j.work + '"></span><strong>' + (j.cost ? fmt.moneyShort(j.cost) : '<span class="tx-muted">No cost given</span>') +
        "</strong> " + fmt.escape(bits.join(" · ")) + "</span>" +
        '<span class="pm-job-desc">' + fmt.escape(descShort(j)) + "</span>" +
        '<span class="pm-job-meta">' + fmt.escape(AGENCY[j.agency] || j.agency) + " #" + fmt.escape(j.number) + fmt.escape(extra) +
        (j.status ? " · " + fmt.escape(j.status.label) : "") + "</span></li>";
    }).join("");
    var more = r.jobs.length > max ? '<p class="tx-muted pm-more">+ ' + plural(r.jobs.length - max, "more job") + "</p>" : "";
    var title = r.jobs.length > 1 ? plural(r.jobs.length, "job") + ' <span class="tx-muted">(' + plural(r.permitCount, "permit") + ")</span>"
      : r.permitCount > 1 ? "Permits" : "Permit";
    return '<div class="pm-jobs"><p class="pm-jobs-title">' + title +
      '</p><ul>' + list + "</ul>" + more + "</div>";
  }
  // "5 UNITS OR MORE - RESIDENTIAL, INT REMODEL" / "A/C CENTRAL|WINDOWS|…"
  function descShort(j) {
    var d = j.desc || j.scope || "";
    var parts = d.split("|").map(function (x) { return x.trim(); }).filter(Boolean);
    var text = parts.slice(0, 3).join(" · ") + (parts.length > 3 ? " …" : "");
    text = /[a-z]/.test(text) ? text : titleCase(text);
    return text.length > 160 ? text.slice(0, 157) + "…" : text;
  }
  function sizeTag(r) {
    var z = SIZES[SIZE_IDS.indexOf(r.size)];
    return '<span class="tx-tag cx-size cx-size-' + r.size + '" title="' + fmt.escape(z.note) + '">' + z.label + "</span>";
  }
  function workTag(r) {
    return '<span class="tx-tag"><i class="tx-swatch pm-swatch-' + r.work + '"></i>' + workLabel(r.work) + "</span>";
  }
  function typeTag(r) {
    return r.type === "Not specified" ? "" : '<span class="tx-tag">' + fmt.escape(r.type) + "</span>";
  }
  function aerialUrl(r, w, h, zoom) {
    if (!r || !r.located) return null;
    var ll = r.lng.toFixed(5) + "," + r.lat.toFixed(5);
    return "https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/pin-s+eb6834(" + ll + ")/" +
      ll + "," + (zoom || 17) + ",0/" + w + "x" + h + "@2x?access_token=" + MAPBOX_TOKEN;
  }
  function agencyList(data) {
    var names = data.agencies.map(function (a) { return AGENCY[a] || a; });
    return names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : names[0] || "";
  }
  function asOfText(data) {
    return "Building permits issued " + fmt.date(data.first, { month: "short", day: "numeric" }) + " to " + fmt.date(data.asOf) +
      " by the " + agencyList(data) + ". City of Miami trade permits are combined with the building permit they belong to, and permits at the same address are shown together. Costs are the permits’ estimates.";
  }

  // ---------------------------------------------------------------- notices
  var toastTimer = null;
  function notify(container, text) {
    var t = container.querySelector(".tx-toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "tx-toast";
      t.setAttribute("role", "status");
      t.setAttribute("aria-live", "polite");
      container.appendChild(t);
    }
    t.innerHTML = "<span>" + fmt.escape(text) + '</span><button type="button" class="tx-toast-x" aria-label="Dismiss">×</button>';
    t.querySelector(".tx-toast-x").onclick = function () { t.hidden = true; };
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 6000);
  }

  // Theme: TRD's theme.js init() asks the parent page and sets <body
  // data-bs-theme>; mirror it onto <html> (tokens live on :root).
  // One handshake per window, however many views ask (the combined page).
  var themeApi = null, themeListeners = [];
  function theme(onChange, track) {
    if (onChange) themeListeners.push(onChange);
    if (themeApi) return themeApi;
    var current = null;
    function set(t) {
      if (t !== "dark" && t !== "light") return;
      var changed = t !== current;
      current = t;
      document.documentElement.setAttribute("data-bs-theme", t);
      document.body.setAttribute("data-bs-theme", t);
      if (changed) themeListeners.forEach(function (f) { f(t); });
    }
    // theme.js declares `const TrdTheme` (a global binding, not a window
    // property), so look it up by name.
    var trd = typeof TrdTheme === "function"
      ? TrdTheme({ updateCallback: function (t) { set(t); if (track) track("theme", t); } }) // eslint-disable-line no-undef
      : null;
    if (trd) trd.init();
    current = (trd && trd.get()) || (global.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-bs-theme", current);
    document.body.setAttribute("data-bs-theme", current);
    themeApi = { get: function () { return current; } };
    return themeApi;
  }
  // The view's root element: the script tag's data-root, else #tx-app.
  function root(script) {
    var id = (script && script.getAttribute("data-root")) || "tx-app";
    return document.getElementById(id);
  }

  global.PM = {
    root: root,
    MAPBOX_TOKEN: MAPBOX_TOKEN,
    WORKS: WORKS,
    WORK_IDS: WORK_IDS,
    TYPES: TYPES,
    SIZES: SIZES,
    SIZE_IDS: SIZE_IDS,
    PERIODS: PERIODS,
    fmt: fmt,
    titleCase: titleCase,
    load: load,
    toPermit: toPermit,
    buildJobs: buildJobs,
    buildSites: buildSites,
    splitAddress: splitAddress,
    placeLine: placeLine,
    defaultState: defaultState,
    stateFromUrl: stateFromUrl,
    resolveCity: resolveCity,
    isDefault: isDefault,
    filterCount: filterCount,
    clone: clone,
    since: since,
    apply: apply,
    summary: summary,
    plural: plural,
    tracker: tracker,
    link: link,
    filterBar: filterBar,
    activeChips: activeChips,
    searchBox: searchBox,
    searchHtml: searchHtml,
    facts: facts,
    jobsHtml: jobsHtml,
    sizeTag: sizeTag,
    workTag: workTag,
    workLabel: workLabel,
    typeTag: typeTag,
    aerialUrl: aerialUrl,
    asOfText: asOfText,
    notify: notify,
    theme: theme,
    slug: slug,
  };
})(window);
