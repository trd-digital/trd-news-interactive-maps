/*!
 * cx-core.js — shared runtime for the South Florida construction pipeline
 * map, table and dashboard list (south-florida-construction-{map,table,list}).
 *
 * Owns: loading + cleaning the permits file, project-size tiers, the
 * neighborhood lookup, the filter model and URL presets, formatting,
 * analytics, and map<->table sync between sibling iframes on one TRD page.
 *
 * The permits file is produced upstream (TRD's pipeline, City of Miami and
 * Miami-Dade County permits) and served from static.therealdeal.com.
 * `normalize()` is the only place that knows its field names.
 *
 * Styling comes from transactions/tx.css (shared look) plus cx.css.
 */
(function (global) {
  "use strict";

  var DATA_FILE = "https://static.therealdeal.com/interactive-maps/miami-construction-map.geojson";
  var PLACES_FILE = "construction/cx-places.json";
  var MAPBOX_TOKEN = "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";
  var NS = "trd-sofla-cx";

  // Miami-Dade folio prefix = municipality (verified for transactions; the
  // permits file carries no city). Only 01 and 30 occur today.
  var MUNICIPALITY = {
    "01": "City of Miami", "02": "Miami Beach", "03": "Coral Gables", "04": "Hialeah", "05": "Miami Springs",
    "06": "North Miami", "07": "North Miami Beach", "08": "Opa-locka", "09": "South Miami", "10": "Homestead",
    "11": "Miami Shores", "12": "Bal Harbour", "13": "Bay Harbor Islands", "14": "Surfside", "15": "West Miami",
    "16": "Florida City", "17": "Biscayne Park", "18": "El Portal", "19": "Golden Beach", "20": "Pinecrest",
    "21": "Indian Creek", "22": "Medley", "23": "North Bay Village", "24": "Key Biscayne", "25": "Sweetwater",
    "26": "Virginia Gardens", "27": "Hialeah Gardens", "28": "Aventura", "29": "Unincorporated Miami-Dade",
    "30": "Unincorporated Miami-Dade", "31": "Sunny Isles Beach", "32": "Miami Lakes", "33": "Palmetto Bay",
    "34": "Miami Gardens", "35": "Doral", "36": "Cutler Bay",
  };
  var AREAS = ["City of Miami", "Unincorporated Miami-Dade"];
  var AREA_SHORT = { "City of Miami": "City of Miami", "Unincorporated Miami-Dade": "Unincorporated" };
  var TYPES = ["Residential", "Commercial", "Mixed use"];

  // Project size. The feed lists every property with a permit whose scope is
  // "new construction" — which, in the City of Miami's records, includes
  // pools, fences and trade permits on existing homes. Square footage is what
  // separates a building from that work.
  var SIZES = [
    { id: "major", label: "Major", long: "Major projects", note: "$10M+ or 100,000+ sq ft" },
    { id: "mid", label: "Mid-size", long: "Mid-size projects", note: "$1M–$10M or 10,000+ sq ft" },
    { id: "small", label: "Small", long: "Homes and small buildings", note: "Under $1M, with floor area" },
    { id: "minor", label: "Minor work", long: "Minor work", note: "Pools, fences, trade permits (no floor area)" },
  ];
  var SIZE_IDS = SIZES.map(function (s) { return s.id; });
  var DEFAULT_SIZES = ["major", "mid", "small"];
  var PERIODS = [
    { id: "30", label: "30 days", days: 30 },
    { id: "90", label: "90 days", days: 90 },
    { id: "365", label: "12 months", days: 365 },
    { id: "all", label: "All", days: null },
  ];
  var STATUSES = [
    { id: "any", label: "Any" },
    { id: "open", label: "Active or pending" },
    { id: "final", label: "Finaled" },
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
    month: function (ym) {
      var d = parseISO(ym + "-01");
      return d ? d.toLocaleDateString("en-US", { month: "short", year: "numeric" }) : ym;
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

  // "SINGLE FAM RES-CLUST-ZERO LOT-TOWN HOUSE" and "Railings - Metal|stairs - Wood"
  var KEEP_UPPER = /^(LLC|LLLP|LP|II|III|IV|USA|US|FL|NE|NW|SE|SW|N|S|E|W|PA|PLLC|ADU|AC|HVAC|CCFP|SFR|ACLF|BDA|ATM|MEP|DBA|JV)$/;
  function titleCase(s) {
    return String(s || "").toLowerCase().replace(/[a-z0-9'’]+/g, function (w) {
      var up = w.toUpperCase();
      if (KEEP_UPPER.test(up)) return up;
      if (/^(of|and|or|the|for|to|in|on|at|a|an)$/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).replace(/^./, function (c) { return c.toUpperCase(); });
  }
  // Street addresses keep their directionals and avoid "3Rd".
  function addressCase(s) {
    return String(s || "").toLowerCase().replace(/[a-z0-9'’]+/g, function (w) {
      var up = w.toUpperCase();
      if (/^(N|S|E|W|NE|NW|SE|SW)$/.test(up)) return up;
      if (/^\d/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    });
  }
  function firmName(s) {
    return titleCase(String(s).replace(/\\/g, "").replace(/\s+,/g, ",").replace(/\s+/g, " ").trim());
  }
  function decode(s) {
    var t = String(s || "");
    for (var i = 0; i < 3 && /&(amp|lt|gt|quot|#39);/.test(t); i++) {
      t = t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
    }
    return t;
  }
  // "<ul><li>A</li><li>B</li></ul>" -> ["A", "B"]
  function listOf(html) {
    if (!html) return [];
    var out = [];
    String(html).replace(/<li>([\s\S]*?)<\/li>/g, function (_, x) {
      x = decode(x).trim();
      if (x) out.push(x);
    });
    if (!out.length && !/<\w/.test(html)) out.push(decode(html).trim());
    return out.filter(Boolean);
  }
  function uniq(list) {
    var seen = {}, out = [];
    list.forEach(function (x) {
      var k = String(x).toLowerCase();
      if (!seen[k]) { seen[k] = true; out.push(x); }
    });
    return out;
  }

  // Proposed use (county permits only) in plain words.
  var USE_WORDS = {
    "SINGLE FAM RES-CLUST-ZERO LOT-TOWN HOUSE": "Single-family / townhouse",
    "5 UNITS OR MORE  - RESIDENTIAL": "Apartments (5+ units)",
    "APT BUILDING 3-4 UNITS": "Apartments (3–4 units)",
    "PAVING/OPEN LOTS": "Paving / open lot",
  };
  function useLabel(u) {
    if (!u) return null;
    var k = String(u).trim();
    return USE_WORDS[k] || titleCase(k.replace(/\s*-\s*/g, " - ").replace(/\//g, " / ").replace(/\s+/g, " "));
  }

  function sizeOf(r) {
    var v = r.value || 0, sq = r.sqft || 0, u = r.units || 0;
    if (v >= 1e7 || sq >= 1e5 || u >= 50) return "major";
    if (v >= 1e6 || sq >= 1e4 || u >= 10) return "mid";
    if (sq > 0 || u > 0) return "small";
    return "minor";
  }

  // ------------------------------------------------------------- normalize
  function normalize(f, i) {
    var p = f.properties || {};
    var c = f.geometry && f.geometry.coordinates;
    var folio = String(p.FolioNumber == null ? "" : p.FolioNumber).replace(/\D/g, "");
    if (folio && folio.length < 13) folio = folio.padStart(13, "0"); // City of Miami rows lost the leading 0
    var area = MUNICIPALITY[folio.slice(0, 2)] || "Miami-Dade";
    var pt = String(p.PropertyType || "");
    var type = /resid/i.test(pt) && /commer/i.test(pt) ? "Mixed use" : /commer/i.test(pt) ? "Commercial" : /resid/i.test(pt) ? "Residential" : "Mixed use";
    var num = function (x) {
      var n = typeof x === "string" ? parseFloat(x.replace(/[^\d.\-]/g, "")) : x;
      return n == null || !isFinite(n) ? null : +n;
    };
    var sqft = num(p.MaxSquareFootage);
    var units = num(p.MaxStructureUnits);
    var floors = num(p.MaxStructureFloors);
    var work = [];
    listOf(p.DetailDescriptionComments).forEach(function (d) {
      d.split("|").forEach(function (x) {
        x = x.replace(/\s+/g, " ").trim();
        if (x) work.push(x.charAt(0).toUpperCase() + x.slice(1));
      });
    });
    var status = p.LatestStatus ? titleCase(p.LatestStatus) : null;
    var r = {
      id: folio || "row-" + i,
      folio: folio || null,
      address: p.PropertyAddress ? addressCase(String(p.PropertyAddress).replace(/\s+/g, " ").trim()) : null,
      area: area,
      source: p.LatestPermitType === "BLDG" ? "county" : "city",
      type: type,
      value: num(p.MaxEstimatedValue),
      sqft: sqft > 0 ? sqft : null,
      units: units > 0 ? units : null,
      floors: floors > 0 ? floors : null,
      permitCount: num(p.PermitCount) || null,
      date: /^\d{4}-\d{2}-\d{2}/.test(p.LatestPermitIssuedDate || "") ? String(p.LatestPermitIssuedDate).slice(0, 10) : null,
      status: status,
      use: useLabel(p.LatestProposedUse),
      permits: uniq(listOf(p.PermitNumber)),
      work: uniq(work),
      contractors: uniq(listOf(p.ContractorName).map(firmName)),
      architects: uniq(listOf(p.ArchitectName).map(firmName)),
      lng: c && isFinite(c[0]) ? +c[0] : null,
      lat: c && isFinite(c[1]) ? +c[1] : null,
      hood: null, // filled from cx-places.json
    };
    r.located = r.lng != null && r.lat != null && r.lng < -79 && r.lng > -81.5 && r.lat > 24.4 && r.lat < 27.5;
    r.size = sizeOf(r);
    r.parcelUrl = folio && folio.length === 13 ? "https://apps.miamidadepa.gov/PropertySearch/#/?folio=" + folio : null;
    r.hay = [r.address, r.folio, r.permits.join(" "), r.contractors.join(" "), r.architects.join(" "), r.use, r.work.join(" ")]
      .join(" ").toLowerCase();
    return r;
  }

  // ------------------------------------------------------------------ places
  // City of Miami neighborhoods (city GIS) and census places for the
  // unincorporated county, simplified (cx-places.json, ~10 KB gzipped).
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
      // A neighborhood counts only inside the city; a census place only outside it.
      if (p && (p.kind === "neighborhood") !== (r.area === "City of Miami")) p = null;
      r.hood = p ? HOOD_RENAME[p.name] || p.name : null;
      r.hay += " " + (r.hood || "").toLowerCase() + " " + r.area.toLowerCase();
    });
  }
  function placeLine(r) {
    return r.hood ? r.hood + (r.area === "City of Miami" ? ", Miami" : "") : r.area === "City of Miami" ? "Miami" : r.area;
  }

  // ------------------------------------------------------------------ load
  function dataUrl() {
    // Dev-only override so a local build can point at a saved copy.
    var q = new URLSearchParams(location.search);
    if (q.get("data") && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return q.get("data");
    return DATA_FILE;
  }
  function startTags() {
    if (typeof global.__cxLoadGtm !== "function") return;
    var go = function () { global.__cxLoadGtm(); };
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
      var rows = (fc.features || []).map(normalize).filter(function (r) { return r.date; });
      return placesP.then(function (list) {
        assignHoods(rows, list);
        var asOf = rows.reduce(function (m, r) { return r.date > m ? r.date : m; }, "");
        var byId = {};
        rows.forEach(function (r, i) { r._n = i; byId[r.id] = r; });
        return { rows: rows, byId: byId, asOf: asOf, first: rows.reduce(function (m, r) { return !m || r.date < m ? r.date : m; }, ""), gaps: coverageGaps(rows) };
      });
    });
    loadPromise.then(startTags, startTags);
    return loadPromise;
  }

  // Months inside the covered span with almost no permits (the feed paused
  // Apr–Aug 2026). Shown as a note so an empty stretch isn't read as a lull.
  function coverageGaps(rows) {
    var counts = {};
    rows.forEach(function (r) { var m = r.date.slice(0, 7); counts[m] = (counts[m] || 0) + 1; });
    var months = Object.keys(counts).sort();
    if (months.length < 3) return [];
    var all = [], d = parseISO(months[0] + "-01"), end = parseISO(months[months.length - 1] + "-01");
    while (d <= end) { all.push(isoOf(d).slice(0, 7)); d.setMonth(d.getMonth() + 1); }
    var vals = all.map(function (m) { return counts[m] || 0; }).sort(function (a, b) { return a - b; });
    var med = vals[vals.length >> 1];
    var thin = all.slice(1, -1).filter(function (m) { return (counts[m] || 0) < Math.max(3, med * 0.15); });
    // Group consecutive thin months into ranges; report runs of 2+.
    var runs = [], run = null;
    thin.forEach(function (m) {
      var prev = run && run[run.length - 1];
      if (prev && all.indexOf(m) === all.indexOf(prev) + 1) run.push(m);
      else { run = [m]; runs.push(run); }
    });
    return runs.filter(function (x) { return x.length >= 2; }).map(function (x) { return { from: x[0], to: x[x.length - 1] }; });
  }
  function gapText(gaps) {
    if (!gaps || !gaps.length) return "";
    return gaps.map(function (g) {
      var a = parseISO(g.from + "-01"), b = parseISO(g.to + "-01");
      var sameYear = a.getFullYear() === b.getFullYear();
      return a.toLocaleDateString("en-US", sameYear ? { month: "short" } : { month: "short", year: "numeric" }) + "–" +
        b.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }).join(" and ");
  }

  // ------------------------------------------------------------------ state
  function defaultState() {
    return { period: "all", sizes: DEFAULT_SIZES.slice(), types: TYPES.slice(), areas: AREAS.slice(), status: "any", hood: null, q: "" };
  }
  function listParam(v, all) {
    if (!v) return null;
    var want = String(v).toLowerCase().split(",");
    var out = all.filter(function (x) { return want.indexOf(String(x).toLowerCase()) >= 0 || want.indexOf(slug(x)) >= 0; });
    return out.length ? out : null;
  }
  function stateFromUrl(search) {
    var q = new URLSearchParams(search == null ? location.search : search);
    var s = defaultState();
    // ?property-type=residential is what the TRD dashboard card uses.
    var t = listParam(q.get("type") || q.get("property-type"), TYPES);
    if (t) s.types = t;
    var sz = listParam(q.get("size"), SIZE_IDS);
    if (sz) s.sizes = sz;
    var ar = listParam(q.get("area"), AREAS);
    if (ar) s.areas = ar;
    if (PERIODS.some(function (p) { return p.id === q.get("period"); })) s.period = q.get("period");
    if (STATUSES.some(function (p) { return p.id === q.get("status"); })) s.status = q.get("status");
    if (q.get("hood")) s.hood = q.get("hood");
    if (q.get("q")) s.q = q.get("q").slice(0, 100);
    return s;
  }
  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  function isDefault(s) {
    var d = defaultState();
    return s.period === d.period && s.status === d.status && !s.hood && !s.q &&
      s.sizes.join() === d.sizes.join() && s.types.length === TYPES.length && s.areas.length === AREAS.length;
  }
  function filterCount(s) {
    var d = defaultState(), n = 0;
    if (s.period !== d.period) n++;
    if (s.sizes.join() !== d.sizes.join()) n++;
    if (s.types.length !== TYPES.length) n++;
    if (s.areas.length !== AREAS.length) n++;
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

  // opts.ignore: a key ("sizes", "types", ...) to leave out (legend counts).
  function apply(rows, state, asOf, opts) {
    opts = opts || {};
    var from = opts.ignore === "period" ? null : since(state, asOf);
    var q = opts.ignore === "q" ? "" : String(state.q || "").trim().toLowerCase();
    var words = q ? q.split(/\s+/) : [];
    return rows.filter(function (r) {
      if (from && r.date < from) return false;
      if (opts.ignore !== "sizes" && state.sizes.indexOf(r.size) < 0) return false;
      if (opts.ignore !== "types" && state.types.indexOf(r.type) < 0) return false;
      if (opts.ignore !== "areas" && state.areas.indexOf(r.area) < 0) return false;
      if (opts.ignore !== "hood" && state.hood && r.hood !== state.hood) return false;
      if (opts.ignore !== "status" && state.status !== "any") {
        var st = String(r.status || "").toLowerCase();
        if (state.status === "final" && st !== "final") return false;
        if (state.status === "open" && !(st === "active" || st === "hold")) return false;
      }
      for (var i = 0; i < words.length; i++) if (r.hay.indexOf(words[i]) < 0) return false;
      return true;
    });
  }

  function summary(rows) {
    var s = { count: rows.length, value: 0, sqft: 0, units: 0 };
    rows.forEach(function (r) {
      s.value += r.value || 0;
      s.sqft += r.sqft || 0;
      s.units += r.units || 0;
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
  // Same pattern as the transactions embeds: same-origin sibling iframes on
  // one TRD page reach each other through window.parent.frames.
  function link(role, onMessage) {
    function siblings() {
      var out = [];
      try {
        var frames = global.parent && global.parent !== global ? global.parent.frames : [];
        for (var i = 0; i < frames.length; i++) {
          var w = frames[i];
          if (w === global) continue;
          try {
            if (w.location.origin === location.origin && /south-florida-construction-(map|table)/.test(w.location.pathname)) out.push(w);
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
        siblings().forEach(function (w) {
          w.postMessage({ ns: NS, from: role, type: type, payload: payload }, location.origin);
        });
      },
      hasPeer: function (peerRole) {
        return siblings().some(function (w) { return w.location.pathname.indexOf("construction-" + peerRole) >= 0; });
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
    function render() {
      var s = getState();
      var data = opts.getData ? opts.getData() : null;
      var sizeCounts = {};
      if (data) apply(data.rows, s, data.asOf, { ignore: "sizes" }).forEach(function (r) { sizeCounts[r.size] = (sizeCounts[r.size] || 0) + 1; });
      var html = '<div class="tx-filter-groups">';
      html += group("Latest permit", "period", PERIODS.map(function (p) {
        return chip("period", p.id, p.label, s.period === p.id);
      }).join(""));
      html += group("Project size", "sizes", SIZES.map(function (z) {
        return chip("sizes", z.id, z.label + (data ? ' <span class="tx-n">' + (sizeCounts[z.id] || 0).toLocaleString("en-US") + "</span>" : ""),
          s.sizes.indexOf(z.id) >= 0, z.note);
      }).join(""), s.sizes.indexOf("minor") < 0 ? "Minor work (pools, fences, trade permits with no floor area) is hidden." : "");
      html += group("Type", "types", TYPES.filter(function (t) {
        return t !== "Mixed use" || !data || data.rows.some(function (r) { return r.type === t; });
      }).map(function (t) {
        return chip("types", t, '<i class="tx-swatch" data-cat="' + (t === "Mixed use" ? "Land" : t) + '"></i>' + t,
          s.types.length < TYPES.length && s.types.indexOf(t) >= 0);
      }).join(""));
      html += group("Area", "areas", AREAS.map(function (a) {
        return chip("areas", a, a, s.areas.length < AREAS.length && s.areas.indexOf(a) >= 0);
      }).join(""));
      html += group("Permit status", "status", STATUSES.map(function (x) {
        return chip("status", x.id, x.label, s.status === x.id);
      }).join(""), s.status !== "any" ? "Status is recorded for City of Miami permits only." : "");
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
        var all = g === "types" ? TYPES : AREAS;
        s[g] = toggleSet(s[g], v, all);
      }
      onChange(s, g + ":" + v);
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

  // Active-filter chips (removable), shared look with transactions.
  function activeChips(container, s, onChange) {
    var chips = [];
    var d = defaultState();
    if (s.q) chips.push(["q", "“" + s.q + "”"]);
    if (s.hood) chips.push(["hood", s.hood]);
    if (s.period !== d.period) chips.push(["period", "Latest permit: " + PERIODS.find(function (p) { return p.id === s.period; }).label]);
    if (s.sizes.join() !== d.sizes.join()) chips.push(["sizes", s.sizes.length === SIZE_IDS.length ? "All sizes incl. minor work" : s.sizes.map(function (x) { return SIZES[SIZE_IDS.indexOf(x)].label; }).join(", ")]);
    if (s.types.length !== TYPES.length) chips.push(["types", s.types.join(", ")]);
    if (s.areas.length !== AREAS.length) chips.push(["areas", s.areas.map(function (a) { return AREA_SHORT[a]; }).join(", ")]);
    if (s.status !== d.status) chips.push(["status", STATUSES.find(function (x) { return x.id === s.status; }).label]);
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
  // Text filter plus suggestions: neighborhoods, builders/architects, and
  // individual projects. onPick({kind, ...}); onQuery(text) as the reader types.
  function searchBox(o) {
    var input = o.input, panel = o.panel, items = [], active = -1, timer = null;
    function suggestions(q) {
      var data = o.getData();
      if (!data || q.length < 2) return [];
      var lq = q.toLowerCase(), out = [];
      var hoods = {}, firms = {};
      data.rows.forEach(function (r) {
        if (r.hood && r.hood.toLowerCase().indexOf(lq) >= 0) hoods[r.hood] = (hoods[r.hood] || 0) + 1;
        r.contractors.concat(r.architects).forEach(function (n) {
          if (n.toLowerCase().indexOf(lq) >= 0) firms[n] = (firms[n] || 0) + 1;
        });
      });
      Object.keys(hoods).sort(function (a, b) { return hoods[b] - hoods[a]; }).slice(0, 4).forEach(function (h) {
        out.push({ kind: "hood", value: h, title: h, sub: plural(hoods[h], "project") });
      });
      Object.keys(firms).sort(function (a, b) { return firms[b] - firms[a]; }).slice(0, 3).forEach(function (n) {
        out.push({ kind: "firm", value: n, title: n, sub: "Builder or architect · " + plural(firms[n], "project") });
      });
      data.rows.filter(function (r) {
        return (r.address && r.address.toLowerCase().indexOf(lq) >= 0) || (r.folio && r.folio.indexOf(lq.replace(/\D/g, "") || "x") === 0) ||
          r.permits.some(function (p) { return p.toLowerCase().indexOf(lq) === 0; });
      }).sort(function (a, b) { return (b.value || 0) - (a.value || 0); }).slice(0, 5).forEach(function (r) {
        out.push({ kind: "project", row: r, title: r.address || "Folio " + r.folio, sub: placeLine(r) + " · " + fmt.moneyShort(r.value) });
      });
      return out;
    }
    function draw() {
      if (!items.length) { panel.hidden = true; input.setAttribute("aria-expanded", "false"); return; }
      panel.innerHTML = items.map(function (it, i) {
        return '<li role="option" id="cx-opt-' + i + '" class="' + (i === active ? "is-active" : "") + '" data-i="' + i + '"' +
          (i === active ? ' aria-selected="true"' : "") + '><span class="tx-sg-main"><span class="cx-sg-kind">' +
          (it.kind === "hood" ? "Area" : it.kind === "firm" ? "Firm" : "Project") + "</span>" + fmt.escape(it.title) +
          '</span><span class="tx-sg-sub">' + fmt.escape(it.sub) + "</span></li>";
      }).join("");
      panel.hidden = false;
      input.setAttribute("aria-expanded", "true");
      if (active >= 0) input.setAttribute("aria-activedescendant", "cx-opt-" + active);
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
    return '<label class="tx-search"><span class="tx-sr">Search projects</span>' +
      '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4.5 4.5" /></svg>' +
      '<input class="tx-search-input" type="search" autocomplete="off" spellcheck="false" placeholder="' + fmt.escape(placeholder) + '" value="' + fmt.escape(q || "") + '" /></label>';
  }

  // ------------------------------------------------------------------ detail
  // Project facts shared by the map's side panel and the table's expanded row.
  function facts(r) {
    var rows = [];
    rows.push(["Latest permit", fmt.date(r.date) + (r.status ? ' <span class="tx-muted">· ' + fmt.escape(r.status) + "</span>" : "")]);
    if (r.use) rows.push(["Proposed use", fmt.escape(r.use)]);
    var scale = [];
    if (r.sqft) scale.push(fmt.num(r.sqft) + " sq ft");
    if (r.units) scale.push(plural(r.units, "unit"));
    if (r.floors) scale.push(plural(r.floors, "floor"));
    if (scale.length) rows.push(["Size", scale.join(" · ")]);
    if (r.permitCount) rows.push(["Permits", plural(r.permitCount, "permit") + " on this property"]);
    if (r.contractors.length) rows.push(["Contractors", listHtml(r.contractors, 4)]);
    if (r.architects.length) rows.push(["Architects", listHtml(r.architects, 3)]);
    if (r.folio) rows.push(["Folio", fmt.escape(r.folio)]);
    return rows;
  }
  function listHtml(list, max) {
    var shown = list.slice(0, max).map(fmt.escape).join("<br>");
    return list.length > max ? shown + '<br><span class="tx-muted">+ ' + (list.length - max) + " more</span>" : shown;
  }
  // Permit work items (fences, wiring, "new building"…), folded away: on a
  // tower they run to dozens of trade items.
  function workHtml(r, open) {
    if (!r.work.length) return "";
    return '<details class="cx-work"' + (open ? " open" : "") + '><summary>Permit work items <span class="tx-muted">(' + r.work.length + ")</span></summary><ul>" +
      r.work.map(function (w) { return "<li>" + fmt.escape(w) + "</li>"; }).join("") + "</ul></details>";
  }
  function sizeTag(r) {
    var z = SIZES[SIZE_IDS.indexOf(r.size)];
    return '<span class="tx-tag cx-size cx-size-' + r.size + '" title="' + fmt.escape(z.note) + '">' + z.label + "</span>";
  }
  function typeTag(r) {
    return '<span class="tx-tag"><i class="tx-swatch" data-cat="' + (r.type === "Mixed use" ? "Land" : r.type) + '"></i>' + r.type + "</span>";
  }
  function aerialUrl(r, w, h, zoom) {
    if (!r || !r.located) return null;
    var ll = r.lng.toFixed(5) + "," + r.lat.toFixed(5);
    return "https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/pin-s+eb6834(" + ll + ")/" +
      ll + "," + (zoom || 17) + ",0/" + w + "x" + h + "@2x?access_token=" + MAPBOX_TOKEN;
  }
  function asOfText(data) {
    var t = "City of Miami and unincorporated Miami-Dade permits through " + fmt.date(data.asOf) +
      ". Values are the permits’ estimated construction cost";
    var g = gapText(data.gaps);
    if (g) t += ". Few permits were recorded for " + g + ", when the permit feed was paused";
    return t + ".";
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
  function theme(onChange, track) {
    var current = null;
    function set(t) {
      if (t !== "dark" && t !== "light") return;
      var changed = t !== current;
      current = t;
      document.documentElement.setAttribute("data-bs-theme", t);
      document.body.setAttribute("data-bs-theme", t);
      if (changed && onChange) onChange(t);
    }
    var trd = typeof global.TrdTheme === "function"
      ? global.TrdTheme({ updateCallback: function (t) { set(t); if (track) track("theme", t); } })
      : null;
    if (trd) trd.init();
    current = (trd && trd.get()) || (global.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-bs-theme", current);
    document.body.setAttribute("data-bs-theme", current);
    return { get: function () { return current; } };
  }

  global.CX = {
    MAPBOX_TOKEN: MAPBOX_TOKEN,
    AREAS: AREAS,
    TYPES: TYPES,
    SIZES: SIZES,
    SIZE_IDS: SIZE_IDS,
    PERIODS: PERIODS,
    fmt: fmt,
    load: load,
    normalize: normalize,
    sizeOf: sizeOf,
    placeLine: placeLine,
    defaultState: defaultState,
    stateFromUrl: stateFromUrl,
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
    workHtml: workHtml,
    sizeTag: sizeTag,
    typeTag: typeTag,
    aerialUrl: aerialUrl,
    asOfText: asOfText,
    gapText: gapText,
    notify: notify,
    theme: theme,
    slug: slug,
  };
})(window);
