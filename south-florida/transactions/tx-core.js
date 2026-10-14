/*!
 * tx-core.js — shared runtime for the South Florida Live Transactions map and
 * table embeds (south-florida-transactions-map.html / -table.html).
 *
 * Owns: loading + normalizing the clean transactions file, the filter model,
 * URL presets, formatting, analytics, and map<->table sync between sibling
 * iframes on the same TRD page.
 *
 * The data file is produced by CatchUpScrapers. `normalize()` is the single
 * place that knows its field names — if the producer's schema changes, edit
 * only that function.
 */
(function (global) {
  "use strict";

  var DATA_FILE = "south-florida-transactions.json";
  // Public (pk.) Mapbox token — the same one the existing TRD data maps use;
  // shared by the map and the static aerial thumbnails.
  var MAPBOX_TOKEN = "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";
  var NS = "trd-sofla-tx";

  var COUNTIES = ["Miami-Dade", "Broward", "Palm Beach"];
  // Counties whose scraped deeds don't record which party is the grantor:
  // roughly half of Miami-Dade rows have buyer/seller flipped (Oct 2026), so
  // the UI shows "Parties" without roles. A producer `party_direction` field
  // ("verified" | "unknown") overrides this per row once it exists.
  var UNDIRECTED_COUNTIES = ["Miami-Dade"];
  var PARTY_NOTE = "County records for this sale don’t yet say which party bought and which sold.";
  var CATEGORIES = ["Residential", "Commercial", "Multifamily", "Land", "Other"];

  // County property-record links. Each pattern below was opened in a browser
  // and confirmed to land on the right property. Links show for NO county
  // until EVERY county has a verified pattern (editorial rule: all or none),
  // and a row's URL must match its county's pattern exactly.
  // All three verified Oct 11 2026: format checked on every row, plus nine
  // random links opened in a browser and matched to the row's address.
  //   Miami-Dade  13-digit folio with leading zeros
  //   Broward     12-character BCPA folio (may contain letters)
  //   Palm Beach  17-digit parcel control number
  var PROPERTY_LINKS = {
    "Miami-Dade": /^https:\/\/apps\.miamidadepa\.gov\/PropertySearch\/#\/\?folio=\d{13}$/,
    Broward: /^https:\/\/bcpa\.net\/RecInfo\.asp\?URL_Folio=[0-9A-Z]{12}$/,
    "Palm Beach": /^https:\/\/pbcpao\.gov\/Property\/Details\?parcelId=\d{17}$/,
  };
  // Links also require the LOADED file to carry a verified link for every
  // county (see load()), so stale data can never show one county's links alone.
  // Miami-Dade folios start with a two-digit municipality code; the feed has
  // no city for Miami-Dade, so derive it (verified Oct 2026 against county
  // records: 03 Coral Gables, 16 Florida City, 30 unincorporated, 35 Doral…).
  var MD_MUNICIPALITY = {
    "01": "Miami", "02": "Miami Beach", "03": "Coral Gables", "04": "Hialeah", "05": "Miami Springs",
    "06": "North Miami", "07": "North Miami Beach", "08": "Opa-locka", "09": "South Miami", "10": "Homestead",
    "11": "Miami Shores", "12": "Bal Harbour", "13": "Bay Harbor Islands", "14": "Surfside", "15": "West Miami",
    "16": "Florida City", "17": "Biscayne Park", "18": "El Portal", "19": "Golden Beach", "20": "Pinecrest",
    "21": "Indian Creek", "22": "Medley", "23": "North Bay Village", "24": "Key Biscayne", "25": "Sweetwater",
    "26": "Virginia Gardens", "27": "Hialeah Gardens", "28": "Aventura", "30": "Unincorporated Miami-Dade",
    "31": "Sunny Isles Beach", "32": "Miami Lakes", "33": "Palmetto Bay", "34": "Miami Gardens", "35": "Doral",
    "36": "Cutler Bay",
  };

  // Property types readers search for, matched against the county use codes
  // (category + use description). Keys are stable for URLs (?use=condo).
  var USE_TYPES = {
    condo: { label: "Condos", test: function (r) { return r.category === "Residential" && /condo/i.test(r.useDetail || ""); } },
    townhouse: { label: "Townhouses", test: function (r) { return /townh/i.test(r.useDetail || "") && !/vacant/i.test(r.useDetail || ""); } },
    "single-family": { label: "Single-family homes", test: function (r) { return /single fam|zero lot|cluster home|guest house/i.test(r.useDetail || ""); } },
    multifamily: { label: "Multifamily & apartments", test: function (r) { return r.category === "Multifamily" || /multi-?family|apartment/i.test(r.useDetail || ""); } },
    office: { label: "Office", test: function (r) { return /office/i.test(r.useDetail || ""); } },
    retail: { label: "Retail", test: function (r) { return /retail|store|shopping/i.test(r.useDetail || ""); } },
    industrial: { label: "Industrial & warehouse", test: function (r) { return /warehous|industrial|flex|manufact|distribut/i.test(r.useDetail || ""); } },
    hotel: { label: "Hotels & motels", test: function (r) { return /hotel|motel/i.test(r.useDetail || ""); } },
    land: { label: "Land", test: function (r) { return r.category === "Land" || /vacant/i.test(r.useDetail || ""); } },
  };

  // What a real parcel ID looks like per county (digits only). Anything else
  // (corrupted folios, deed numbers) is not shown or searched as a parcel.
  var PARCEL_ID = { "Miami-Dade": /^\d{13}$/, Broward: /^[0-9A-Z]{12}$/, "Palm Beach": /^\d{17}$/ };
  // Map color groups. A dense point map can only carry three distinguishable
  // hues (dataviz all-pairs gate), so Multifamily shares Commercial's color
  // and Other is a neutral. Filters still split all five categories.
  var COLOR_GROUP = {
    Residential: "residential",
    Commercial: "commercial",
    Multifamily: "commercial",
    Land: "land",
    Other: "other",
  };
  var DAYS = [7, 14, 30, 60];
  var PRICE_PRESETS = [
    { id: "all", label: "All prices", min: 0 },
    { id: "1m", label: "$1M+", min: 1e6 },
    { id: "5m", label: "$5M+", min: 5e6 },
    { id: "10m", label: "$10M+", min: 1e7 },
  ];
  var FINANCED = [
    { id: "any", label: "Any" },
    { id: "financed", label: "Financed" },
    { id: "cash", label: "No mortgage", title: "No mortgage recorded with the deed" },
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
    date: function (iso, opts) {
      var d = parseISO(iso);
      if (!d) return "—";
      return d.toLocaleDateString("en-US", opts || { month: "short", day: "numeric", year: "numeric" });
    },
    dateShort: function (iso) {
      return fmt.date(iso, { month: "short", day: "numeric" });
    },
    // "LAST,FIRST; LAST2,FIRST2" (Broward) -> "First Last; First2 Last2"
    party: function (s) {
      if (!s) return "—";
      return String(s)
        .split(/\s*;\s*/)
        .filter(Boolean)
        .map(function (part) {
          var m = part.match(/^([^,]+),\s*(.+)$/);
          if (m && !/\b(LLC|INC|LP|LLLP|LTD|CORP|TRUST|BANK|ASSOCIATION)\b/i.test(part)) {
            part = m[2] + " " + m[1];
          }
          return titleCase(part, true);
        })
        .join("; ");
    },
    title: titleCase,
  };

  function trim(x, digits) {
    return String(+x.toFixed(digits));
  }

  var KEEP_UPPER = /^(LLC|LLLP|LP|LTD|II|III|IV|USA|US|FL|NE|NW|SE|SW|N|S|E|W|PA|PLLC|REIT|HOA|JV|TRS?)$/;
  var STREET_SUFFIX = /^(st|rd|dr|blvd|ln|ct|hwy|pkwy|pl|sq|trl|xing|cswy|hwy)$/;
  // names=true: also keep initialisms in caps ("MM Real Estate", "PB S Ocean
  // Blvd Owner", "3M") — any vowel-less word or letter+digit token. Not used
  // for addresses, where vowel-less words are street suffixes (St, Rd, Blvd).
  function titleCase(s, names) {
    if (!s) return "";
    return String(s)
      .toLowerCase()
      .replace(/\b([a-z0-9])([a-z0-9']*)/g, function (w, a, b) {
        var word = a + b, up = word.toUpperCase();
        if (KEEP_UPPER.test(up)) return up;
        if (/^\d+(st|nd|rd|th)$/.test(word)) return word; // 5th, 23rd
        if (/\d/.test(word) && /[a-z]/.test(word)) return up; // A1A, 3M, I95
        if (names && !/[aeiouy]/.test(word) && !STREET_SUFFIX.test(word)) return up; // MM, PB, VCC
        return /[a-z]/.test(a) ? a.toUpperCase() + b : word;
      });
  }

  function parseISO(iso) {
    if (!iso) return null;
    var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }

  // --------------------------------------------------------------- normalize
  // Map one producer row to the shape the UI uses. Keep this the ONLY place
  // that reads producer field names.
  function normalize(f, i) {
    var p = f.properties || {};
    var g = f.geometry && f.geometry.coordinates;
    // A row without an address can only have been placed on a county/city
    // centroid, so never draw it — it stays in the table as "not on map".
    var located = p.location_status !== "unavailable" && !!p.address &&
      Array.isArray(g) && isFinite(g[0]) && isFinite(g[1]);
    var cat = CATEGORIES.indexOf(p.use_category) >= 0 ? p.use_category : "Other";
    var row = {
      id: String(p.id != null ? p.id : i),
      address: p.address && !/^(data not found|not found|unknown|n\/?a|none)$/i.test(String(p.address).trim()) ? fmt.title(p.address) : null,
      city: p.city ? fmt.title(p.city) : null, // Miami-Dade filled from the folio below
      zip: p.zip || null,
      county: p.county,
      price: +p.price,
      date: p.date,
      buyer: p.buyer || null,
      seller: p.seller || null,
      category: cat,
      colorGroup: COLOR_GROUP[cat],
      useDetail: p.use_detail || null,
      financed: !!p.financed,
      loan: p.loan != null ? +p.loan : null,
      prevPrice: p.prev_price != null ? +p.prev_price : null,
      prevDate: p.prev_date || null,
      parcelId: validParcel(p.county, p.parcel_id, p.parcel_url),
      parcelUrl: null, // set in load() once every county is known to have links
      _linkCandidate: p.parcel_url && PROPERTY_LINKS[p.county] && PROPERTY_LINKS[p.county].test(p.parcel_url) ? p.parcel_url : null,
      parcelCount: +p.parcel_count || 1,
      assemblageId: p.assemblage_id || null,
      instrument: p.instrument_number ? String(p.instrument_number) : null,
      partiesDirected: p.party_direction ? p.party_direction !== "unknown" : UNDIRECTED_COUNTIES.indexOf(p.county) < 0,
      lng: located ? +g[0] : null,
      lat: located ? +g[1] : null,
      located: located,
    };
    if (!row.city && row.county === "Miami-Dade" && row.parcelId) {
      row.city = MD_MUNICIPALITY[String(row.parcelId).slice(0, 2)] || null;
    }
    return row;
  }

  function validParcel(county, id, url) {
    if (!id) return null;
    var digits = String(id).replace(/[^0-9A-Za-z]+/g, "").toUpperCase();
    if (!PARCEL_ID[county] || !PARCEL_ID[county].test(digits)) return null;
    // Older Miami-Dade folios were mangled by a float round-trip and some
    // still have 13 digits, so length alone can't vouch for them. Trust one
    // only when it comes with the verified county URL carrying that folio.
    if (county === "Miami-Dade") {
      var m = url && PROPERTY_LINKS[county].test(url) && url.match(/folio=(\d{13})$/);
      if (!m || m[1] !== digits) return null;
    }
    return String(id);
  }

  function dataUrl() {
    // Dev-only override so a local build can point at a stand-in file.
    var q = new URLSearchParams(location.search);
    if (q.get("data") && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return q.get("data");
    return DATA_FILE;
  }

  function startTags() {
    if (typeof global.__txLoadGtm !== "function") return;
    var go = function () { global.__txLoadGtm(); };
    setTimeout(function () { // after the views' own .then() has rendered
      if (global.requestIdleCallback) global.requestIdleCallback(go, { timeout: 2000 });
      else go();
    }, 0);
  }

  // The feed is published three ways from one build: the full 60-day file, and
  // the same sales split into -recent (date >= split_at, the default 30-day
  // view) and -older. The pages load -recent first, render, then fetch -older
  // in the background; any mismatch (missing part, different generated_at)
  // falls back to the full file.
  var RECENT_FILE = DATA_FILE.replace(".json", "-recent.json");
  var OLDER_FILE = DATA_FILE.replace(".json", "-older.json");

  function fetchJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }
  function rowsOf(fc) {
    return (fc.features || []).map(normalize).filter(function (r) {
      return r.price > 0 && r.date;
    });
  }

  function build(fc) {
    var rows = rowsOf(fc);
    var linksOk = COUNTIES.every(function (cty) {
      return rows.some(function (r) { return r.county === cty && r._linkCandidate; });
    });
    rows.forEach(function (r) {
      r.parcelUrl = linksOk ? r._linkCandidate : null;
    });
    if (TX.search) TX.search.indexRows(rows);
    var latest = {};
    var counties = fc.counties || {};
    Object.keys(counties).forEach(function (c) {
      if (counties[c] && counties[c].latest_record_date) latest[c] = counties[c].latest_record_date;
    });
    if (!Object.keys(latest).length) {
      rows.forEach(function (r) {
        if (!latest[r.county] || r.date > latest[r.county]) latest[r.county] = r.date;
      });
    }
    var asOf = Object.keys(latest).reduce(function (m, k) {
      return latest[k] > m ? latest[k] : m;
    }, "");
    var meta = {
      generatedAt: fc.generated_at || null,
      windowDays: fc.window_days || null,
      minPrice: fc.min_price || null,
      topDeals: fc.top_deals || [],
    };
    return {
      rows: rows, meta: meta, latestByCounty: latest, asOf: asOf, assemblages: indexAssemblages(rows),
      linksOk: linksOk, splitAt: fc.split_at || null, // set while the older part is still loading
    };
  }

  var loadPromise = null, restPromise = null, restListeners = [];
  function load() {
    if (loadPromise) return loadPromise;
    var override = dataUrl() !== DATA_FILE;
    loadPromise = (override ? fetchJson(dataUrl()).then(build) : fetchJson(RECENT_FILE).then(function (fc) {
      if (!fc.split_at) throw new Error("no split_at");
      return build(fc);
    }).catch(function () {
      return fetchJson(DATA_FILE).then(build);
    })).then(function (d) {
      if (!d.splitAt) d.splitAt = null;
      return d;
    });
    loadPromise.then(function (d) {
      currentData = d;
      // After the views' own .then() has rendered: older sales, then tags.
      setTimeout(function () {
        (d.splitAt ? loadRest(d) : Promise.resolve()).then(startTags, startTags);
      }, 0);
    }, startTags);
    return loadPromise;
  }

  // Points file: each recent sale's location, price, date, county and type
  // (~140 KB, the same build as -recent), so the map can draw dots before the
  // full sales file arrives. Optional: any failure just means no early dots.
  var POINTS_FILE = DATA_FILE.replace(".json", "-points.json");
  var pointsPromise = null;
  function loadPoints() {
    if (pointsPromise) return pointsPromise;
    if (dataUrl() !== DATA_FILE) return (pointsPromise = Promise.reject(new Error("data override")));
    pointsPromise = fetchJson(POINTS_FILE).then(function (pf) {
      var c = {};
      (pf.columns || []).forEach(function (k, i) { c[k] = i; });
      if (!Array.isArray(pf.rows) || ["id", "lng", "lat", "price", "date", "county"].some(function (k) { return c[k] == null; })) {
        throw new Error("unexpected points file");
      }
      // Rows without coordinates (unmapped sales) are kept as located:false,
      // so counts can match the full file when the producer includes them.
      var rows = pf.rows.map(function (a) {
        var cat = CATEGORIES.indexOf(a[c.use_category]) >= 0 ? a[c.use_category] : "Other";
        var lng = a[c.lng] == null ? NaN : +a[c.lng], lat = a[c.lat] == null ? NaN : +a[c.lat];
        return {
          id: String(a[c.id]), lng: lng, lat: lat, price: +a[c.price], date: a[c.date],
          county: a[c.county], category: cat, colorGroup: COLOR_GROUP[cat], located: isFinite(lng) && isFinite(lat),
        };
      }).filter(function (r) { return r.price > 0 && r.date; });
      return {
        generatedAt: pf.generated_at || null, splitAt: pf.split_at || null, rows: rows,
        hasUnmapped: rows.some(function (r) { return !r.located; }),
      };
    });
    return pointsPromise;
  }

  // Fetch the sales before split_at and fold them into `d` (a new rows array,
  // so caches keyed on it reset), then tell the views.
  function loadRest(d) {
    if (restPromise) return restPromise;
    restPromise = fetchJson(OLDER_FILE).then(function (fc) {
      if (!fc.generated_at || fc.generated_at !== d.meta.generatedAt || fc.split_at !== d.splitAt) throw new Error("parts differ");
      var older = rowsOf(fc);
      older.forEach(function (r) { r.parcelUrl = d.linksOk ? r._linkCandidate : null; });
      var asm = indexAssemblages(older);
      Object.keys(asm).forEach(function (k) { d.assemblages[k] = asm[k]; });
      d.rows = d.rows.concat(older);
      if (TX.search) TX.search.indexRows(d.rows);
    }).catch(function () {
      return fetchJson(DATA_FILE).then(function (fc) {
        var full = build(fc);
        ["rows", "meta", "latestByCounty", "asOf", "assemblages", "linksOk"].forEach(function (k) { d[k] = full[k]; });
      });
    }).then(function () {
      d.splitAt = null;
      restListeners.forEach(function (fn) { fn(d); });
    }, function () {
      d.splitAt = null; // give up: show what we have without "loading" notes
      d.restFailed = true;
      restListeners.forEach(function (fn) { fn(d); });
    });
    return restPromise;
  }
  // Views call this to re-render once the older sales are in.
  function onRest(fn) { restListeners.push(fn); }
  // True while sales dated before `iso` are still on their way.
  var currentData = null;
  function pendingBefore(iso) {
    return !!(currentData && currentData.splitAt && iso && iso < currentData.splitAt);
  }

  // ------------------------------------------------------------ assemblages
  // Same-day assemblages: separate deeds (own buyer LLC, seller, price) that
  // were recorded together. They stay separate rows in the data; the UI shows
  // them as one grouped entry with a COMBINED total. Only groups of 2+.
  function indexAssemblages(rows) {
    var by = {};
    rows.forEach(function (r) {
      if (r.assemblageId) (by[r.assemblageId] = by[r.assemblageId] || []).push(r);
    });
    var out = {};
    Object.keys(by).forEach(function (id) {
      var m = by[id];
      if (m.length < 2) {
        m[0].assemblageId = null;
        return;
      }
      // The feed groups by county + record date + buyer name stem, which also
      // catches builders' daily closings and iBuyer batches miles apart. Only
      // a tight cluster is an assemblage; anything wider stays as single deeds.
      var span = spanKm(m);
      if (span > ASSEMBLAGE_MAX_KM) {
        m.forEach(function (r) { r.assemblageId = null; });
        return;
      }
      m.sort(function (a, b) { return b.price - a.price; });
      out[id] = assemblage(id, m, span != null && span < SAME_BUILDING_KM ? "building" : "assemblage");
    });
    return out;
  }

  var ASSEMBLAGE_MAX_KM = 0.5;
  var SAME_BUILDING_KM = 0.03;

  // Largest distance between any two mappable members (null if < 2 mappable).
  function spanKm(members) {
    var pts = members.filter(function (r) { return r.located; });
    if (pts.length < 2) return null;
    var max = 0;
    for (var i = 0; i < pts.length; i++) {
      for (var j = i + 1; j < pts.length; j++) {
        var kx = 111.32 * Math.cos((pts[i].lat * Math.PI) / 180);
        var d = Math.hypot((pts[j].lng - pts[i].lng) * kx, (pts[j].lat - pts[i].lat) * 110.57);
        if (d > max) max = d;
      }
    }
    return max;
  }

  function uniq(list) {
    var seen = {}, out = [];
    list.forEach(function (x) {
      if (x && !seen[x]) {
        seen[x] = true;
        out.push(x);
      }
    });
    return out;
  }

  function assemblage(id, members, type) {
    var cats = uniq(members.map(function (r) { return r.category; }));
    var lead = members[0];
    return {
      kind: "assemblage",
      type: type, // "assemblage" (adjacent parcels) | "building" (units in one building)
      label: type === "building" ? "Building purchase · " + members.length + " units" : "Assemblage · " + members.length + " deeds",
      id: id,
      members: members,
      price: members.reduce(function (s, r) { return s + r.price; }, 0),
      date: members.reduce(function (d, r) { return r.date > d ? r.date : d; }, ""),
      county: uniq(members.map(function (r) { return r.county; })).join(" / "),
      category: cats.length === 1 ? cats[0] : "Mixed",
      colorGroup: cats.length === 1 ? lead.colorGroup : "other",
      buyers: uniq(members.map(function (r) { return r.buyer; })),
      sellers: uniq(members.map(function (r) { return r.seller; })),
      parties: uniq(members.reduce(function (l, r) { return l.concat([r.buyer, r.seller]); }, [])),
      partiesDirected: members.every(function (r) { return r.partiesDirected; }),
      financed: members.some(function (r) { return r.financed; }),
      lead: lead,
      address: lead.address,
    };
  }

  // Turn filtered deeds into display entries: a deed in an assemblage pulls in
  // its whole group (once); everything else stays a single-deed entry.
  function toEntries(rows, data) {
    var seen = {}, out = [];
    rows.forEach(function (r) {
      var a = r.assemblageId && data.assemblages[r.assemblageId];
      if (a) {
        if (seen[a.id]) return;
        seen[a.id] = true;
        out.push(a);
      } else {
        out.push(r);
      }
    });
    return out;
  }

  // Label/value pairs for a deed's parties; roles only when the county
  // records them reliably.
  function partyRows(r) {
    if (r.partiesDirected) {
      return [["Buyer", fmt.escape(fmt.party(r.buyer))], ["Seller", fmt.escape(fmt.party(r.seller))]];
    }
    return [["Parties", [r.buyer, r.seller].filter(Boolean).map(function (x) { return fmt.escape(fmt.party(x)); }).join("<br>") +
      '<span class="tx-addr-sub">' + PARTY_NOTE + "</span>"]];
  }

  // One-line party text for lists: "Buyer Name" or "Name A · Name B".
  function partyLine(r) {
    return r.partiesDirected ? fmt.party(r.buyer) : [r.buyer, r.seller].filter(Boolean).map(fmt.party).join(" · ");
  }

  // "MM Real Estate Acquisitions LLC + 2 related buyers"
  function partySummary(list, noun) {
    if (!list.length) return "—";
    var first = fmt.party(list[0]);
    if (list.length === 1) return first;
    var n = list.length - 1;
    // Undirected "parties" mix both sides of the deals, so they aren't "related".
    if (noun === "party") return first + " + " + n + (n === 1 ? " other" : " others");
    return first + " + " + n + " related " + noun + (n > 1 ? "s" : "");
  }

  // ------------------------------------------------------------ filter model
  function defaultState() {
    return {
      days: 30,
      counties: COUNTIES.slice(),
      categories: CATEGORIES.slice(),
      price: "all", // preset id, or "custom" with priceMin/priceMax
      priceMin: null,
      priceMax: null,
      financed: "any",
      q: "",
      place: null, // { kind: "city"|"zip", value, label }
      party: null, // { key, label } — a buyer/seller name
      bbox: null, // [west, south, east, north] — "Search this area" / a searched place
      bboxLabel: null, // e.g. "Miami Beach, FL 33139" when bbox came from search
      useType: null, // key of USE_TYPES (condo, office, …)
      dateFrom: null, // custom record-date range from the timeline brush (ISO);
      dateTo: null, //   overrides `days` when set
    };
  }

  // URL presets let the dashboard / article embeds open a specific view:
  //   ?property-type=residential|commercial|land (comma list ok)
  //   ?county=miami-dade|broward|palm-beach   ?days=7|14|30
  //   ?min-price=1m|5m|10m|<dollars>   ?max-price=<dollars>
  //   ?financed=financed|cash   ?q=text   ?city=<name>   ?zip=<zip>   ?sale=<id>
  function stateFromUrl(search) {
    var q = new URLSearchParams(search || location.search);
    var s = defaultState();
    var pt = q.get("property-type");
    if (pt) {
      var cats = pt.split(",").map(function (x) {
        return CATEGORIES.find(function (c) {
          return c.toLowerCase() === x.trim().toLowerCase();
        });
      }).filter(Boolean);
      if (cats.length) s.categories = cats;
    }
    var county = q.get("county");
    if (county) {
      var cs = county.split(",").map(function (x) {
        return COUNTIES.find(function (c) {
          return slug(c) === slug(x);
        });
      }).filter(Boolean);
      if (cs.length) s.counties = cs;
    }
    var days = +q.get("days");
    if (DAYS.indexOf(days) >= 0) s.days = days;
    var mp = (q.get("min-price") || "").toLowerCase();
    if (PRICE_PRESETS.some(function (p) { return p.id === mp; })) s.price = mp;
    else if (parsePrice(mp) || parsePrice(q.get("max-price"))) {
      s.price = "custom";
      s.priceMin = parsePrice(mp);
      s.priceMax = parsePrice(q.get("max-price"));
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(q.get("from") || "")) s.dateFrom = q.get("from");
    if (/^\d{4}-\d{2}-\d{2}$/.test(q.get("to") || "")) s.dateTo = q.get("to");
    if (s.dateFrom && s.dateTo && s.dateFrom > s.dateTo) { var t = s.dateFrom; s.dateFrom = s.dateTo; s.dateTo = t; }
    if (q.get("city")) s.place = { kind: "city", value: fmt.title(q.get("city")), label: fmt.title(q.get("city")) };
    if (/^\d{5}$/.test(q.get("zip") || "")) s.place = { kind: "zip", value: q.get("zip"), label: "ZIP " + q.get("zip") };
    if (USE_TYPES[q.get("use")]) s.useType = q.get("use");
    var fin = q.get("financed");
    if (fin === "financed" || fin === "cash") s.financed = fin;
    if (q.get("q")) s.q = q.get("q");
    return s;
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
  }

  function minPrice(state) {
    if (state.price === "custom") return state.priceMin || 0;
    var p = PRICE_PRESETS.find(function (x) { return x.id === state.price; });
    return p ? p.min : 0;
  }
  function maxPrice(state) {
    return state.price === "custom" && state.priceMax ? state.priceMax : Infinity;
  }

  // "1.5m", "$500K", "2,000,000", "750" (thousands assumed below 10,000) -> dollars
  function parsePrice(v) {
    var info = parsePriceInfo(v);
    return info && info.value ? info.value : null;
  }

  // Detailed parse for the range inputs: { value, scaled } when readable,
  // { error: true } when not, null when empty. Accepts "1.5m", "$500K",
  // "2,000,000", "2 million", "750 thousand". A bare number under 10,000 is
  // read as thousands ("750" -> $750K) and flagged so the UI can say so.
  function parsePriceInfo(v) {
    var raw = String(v == null ? "" : v).trim();
    if (!raw) return null;
    var s = raw.toLowerCase().replace(/[$,]/g, "").replace(/\s+/g, " ")
      .replace(/\s*(million|mil|mm)$/, "m").replace(/\s*(thousand|grand)$/, "k").replace(/\s*(billion|bn)$/, "b")
      .replace(/\s+/g, "");
    var m = s.match(/^(\d+(?:\.\d+)?|\.\d+)(k|m|b)?$/);
    if (!m) return { error: true };
    var n = parseFloat(m[1]) * ({ k: 1e3, m: 1e6, b: 1e9 }[m[2]] || 1);
    var scaled = false;
    if (!m[2] && n > 0 && n < 10000) {
      n *= 1000;
      scaled = true;
    }
    return n > 0 ? { value: n, scaled: scaled } : { error: true };
  }

  function priceLabel(state) {
    if (state.price !== "custom") {
      var p = PRICE_PRESETS.find(function (x) { return x.id === state.price; });
      return p ? p.label : "";
    }
    if (state.priceMin && state.priceMax) return fmt.moneyShort(state.priceMin) + "–" + fmt.moneyShort(state.priceMax);
    if (state.priceMin) return fmt.moneyShort(state.priceMin) + "+";
    if (state.priceMax) return "Up to " + fmt.moneyShort(state.priceMax);
    return "All prices";
  }

  // Days are counted back from the newest record date in the data, not from
  // today, so a weekend or a late county never empties the view.
  function cutoff(asOf, days) {
    var d = parseISO(asOf) || new Date();
    d.setDate(d.getDate() - days + 1);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function pad(n) {
    return n < 10 ? "0" + n : "" + n;
  }
  function isoAdd(iso, days) {
    var d = parseISO(iso);
    d.setDate(d.getDate() + days);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  // Effective [from, to] for a state (custom range or last N days).
  function dateRange(state, asOf) {
    return [state.dateFrom || cutoff(asOf, state.days), state.dateTo || asOf];
  }
  // Fit a custom date range (from a link) into the loaded window: clamp it,
  // or drop it if it misses the window entirely. Returns true if changed.
  function fitDates(state, asOf, windowDays) {
    if (!state.dateFrom && !state.dateTo) return false;
    var lo = cutoff(asOf, windowDays || 60), from = state.dateFrom, to = state.dateTo;
    if ((to && to < lo) || (from && from > asOf)) { state.dateFrom = state.dateTo = null; }
    else {
      if (from && from < lo) state.dateFrom = lo;
      if (to && to > asOf) state.dateTo = asOf;
    }
    return from !== state.dateFrom || to !== state.dateTo;
  }
  function dateRangeLabel(state, asOf) {
    var r = dateRange(state, asOf);
    return fmt.dateShort(r[0]) + "–" + fmt.dateShort(r[1]);
  }

  // Earliest record date per county; counties starting after `from`.
  var coverageCache = null;
  function coverageGaps(rows, from, counties) {
    if (pendingBefore(from)) return [];
    if (!coverageCache || coverageCache.rows !== rows) {
      var start = {};
      rows.forEach(function (r) { if (!start[r.county] || r.date < start[r.county]) start[r.county] = r.date; });
      coverageCache = { rows: rows, start: start };
    }
    var minStart = Object.keys(coverageCache.start).reduce(function (m, k) { var v = coverageCache.start[k]; return !m || v < m ? v : m; }, "");
    return (counties || COUNTIES).filter(function (c) {
      var st = coverageCache.start[c];
      // Only flag a county whose data starts well after the others (>2 days).
      return st && st > from && st > isoAdd(minStart, 2);
    }).map(function (c) { return { county: c, start: coverageCache.start[c] }; });
  }

  // Price histogram bin edges (log-ish, readable round numbers).
  var PRICE_EDGES = [1e5, 1.5e5, 2e5, 3e5, 4e5, 5e5, 7.5e5, 1e6, 1.5e6, 2e6, 3e6, 5e6, 7.5e6, 1e7, 1.5e7, 2.5e7, 5e7, 1e8, 1e10];

  function apply(rows, state, asOf, opts) {
    opts = opts || {};
    var from = opts.ignoreDate ? "" : state.dateFrom || cutoff(asOf, state.days);
    var to = opts.ignoreDate || !state.dateTo ? "9999" : state.dateTo;
    var min = opts.ignorePrice ? 0 : minPrice(state), max = opts.ignorePrice ? Infinity : maxPrice(state);
    var q = opts.ignoreQuery ? "" : (state.q || "").trim();
    var place = opts.ignoreQuery ? null : state.place;
    var party = opts.ignoreQuery ? null : state.party;
    var bb = opts.ignoreBbox ? null : state.bbox;
    var placeCity = place && place.kind === "city" ? place.value.toLowerCase() : null;
    // Only Broward records carry a ZIP; with outlines loaded a ZIP search
    // also matches sales located inside that ZIP in every county.
    var zipShape = place && place.kind === "zip" ? boundaryFor(place) : null;
    var cityShape = place && place.kind === "city" ? boundaryFor(place) : null;
    return rows.filter(function (r) {
      if (r.date < from || r.date > to) return false;
      if (r.price < min || r.price > max) return false;
      if (state.counties.indexOf(r.county) < 0) return false;
      if (!opts.ignoreCategory && state.categories.indexOf(r.category) < 0) return false;
      if (state.financed === "financed" && !r.financed) return false;
      if (state.financed === "cash" && r.financed) return false;
      if (place) {
        if (placeCity) {
          // The record's city, or — when it has none — inside the city outline.
          if ((r.city || "").toLowerCase() !== placeCity && !(!r.city && cityShape && r.located && inFeature(cityShape, r.lng, r.lat))) return false;
        }
        else if (r.zip !== place.value && !(zipShape && r.located && inFeature(zipShape, r.lng, r.lat))) return false;
      }
      if (party && r._partyKeys.indexOf(party.key) < 0) return false;
      if (state.useType && USE_TYPES[state.useType] && !USE_TYPES[state.useType].test(r)) return false;
      if (bb && !(r.located && r.lng >= bb[0] && r.lng <= bb[2] && r.lat >= bb[1] && r.lat <= bb[3])) return false;
      if (q && !TX.search.rowMatches(r, q)) return false;
      return true;
    });
  }

  function isDefault(state) {
    var d = defaultState();
    return (
      state.days === d.days &&
      state.price === d.price &&
      state.financed === d.financed &&
      !state.q &&
      !state.place &&
      !state.party &&
      !state.bbox &&
      !state.dateFrom &&
      !state.useType &&
      state.counties.length === d.counties.length &&
      state.categories.length === d.categories.length
    );
  }

  // --------------------------------------------------------------- analytics
  function tracker(category) {
    return function (action, label) {
      if (!global.dataLayer) return;
      global.dataLayer.push({
        event: "event_tracking",
        trd: { category: category, action: action, label: label == null ? "" : String(label) },
      });
    };
  }

  // -------------------------------------------------------------- sibling sync
  // The TRD data page embeds the map and the table as two iframes from this
  // same origin. Siblings can reach each other through window.parent.frames
  // without any help from the (cross-origin) parent, which scopes the link to
  // exactly one page — two open TRD tabs never cross-talk.
  function link(role, onMessage) {
    function siblings() {
      var out = [];
      try {
        var frames = global.parent && global.parent !== global ? global.parent.frames : [];
        for (var i = 0; i < frames.length; i++) {
          var w = frames[i];
          if (w === global) continue;
          try {
            if (w.location.origin === location.origin && /south-florida-transactions-(map|table)/.test(w.location.pathname)) {
              out.push(w);
            }
          } catch (e) {
            /* cross-origin frame (ads, etc.) — skip */
          }
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
        return siblings().some(function (w) {
          return w.location.pathname.indexOf("transactions-" + peerRole) >= 0;
        });
      },
    };
    // Announce ourselves so a peer that loaded first can send its state.
    setTimeout(function () {
      api.send("hello", null);
    }, 0);
    return api;
  }

  function serializeState(s) {
    return JSON.parse(JSON.stringify(s));
  }

  // ------------------------------------------------------------- filter bar
  // Shared filter UI. Renders into `el`; calls onChange(newState) live.
  function filterBar(el, getState, onChange, opts) {
    opts = opts || {};

    function chip(group, value, label, active, extra) {
      return (
        '<button type="button" class="tx-chip' + (active ? " is-active" : "") + (extra || "") +
        '" data-group="' + group + '" data-value="' + fmt.escape(value) + '" aria-pressed="' + active + '">' +
        label + "</button>"
      );
    }

    function render() {
      var s = getState();
      var html = '<div class="tx-filter-groups">';

      html += group("Period", "days", DAYS.map(function (d) {
        return chip("days", d, d + " days", !s.dateFrom && s.days === d);
      }).join("") + (opts.getData ? '<div class="tx-chart tx-timeline" aria-hidden="false"></div><p class="tx-chart-cap"></p>' : ""));
      html += group("County", "county", COUNTIES.map(function (c) {
        return chip("county", c, c, s.counties.length < COUNTIES.length && s.counties.indexOf(c) >= 0);
      }).join(""));
      html += group("Price", "price", PRICE_PRESETS.map(function (p) {
        return chip("price", p.id, p.label, s.price === p.id);
      }).join("") +
        (opts.getData ? '<div class="tx-chart tx-hist"></div>' : "") +
        '<div class="tx-range"><label><span class="tx-sr">Minimum price</span><input class="tx-range-in" data-end="min" inputmode="decimal" placeholder="Min, e.g. 500k" value="' +
        (s.price === "custom" && s.priceMin ? fmt.escape(fmt.moneyShort(s.priceMin)) : "") + '" /></label><span aria-hidden="true">–</span>' +
        '<label><span class="tx-sr">Maximum price</span><input class="tx-range-in" data-end="max" inputmode="decimal" placeholder="Max, e.g. 2m" value="' +
        (s.price === "custom" && s.priceMax ? fmt.escape(fmt.moneyShort(s.priceMax)) : "") + '" /></label></div>' +
        '<p class="tx-range-msg" aria-live="polite"></p>');
      if (opts.showCategories) {
        html += group("Type", "category", CATEGORIES.map(function (c) {
          return chip("category", c, '<i class="tx-swatch" data-cat="' + c + '"></i>' + c,
            s.categories.length < CATEGORIES.length && s.categories.indexOf(c) >= 0);
        }).join(""));
      }
      html += group("Mortgage", "financed", FINANCED.map(function (f) {
        return chip("financed", f.id, f.label, s.financed === f.id, f.title ? '" title="' + fmt.escape(f.title) : "");
      }).join(""));
      html += '<button type="button" class="tx-reset"' + (isDefault(s) ? " hidden" : "") + ">Reset</button>";
      html += "</div>";
      el.innerHTML = html;
      wire();
    }

    function group(label, key, inner) {
      return '<div class="tx-group" data-key="' + key + '"><span class="tx-group-label">' + label + "</span>" +
        '<div class="tx-chips">' + inner + "</div></div>";
    }

    function wire() {
      var rangeTimer = null;
      var msg = el.querySelector(".tx-range-msg");
      var minIn = el.querySelector('[data-end="min"]');
      var maxIn = el.querySelector('[data-end="max"]');
      function say(text, kind, action) {
        msg.className = "tx-range-msg" + (kind ? " is-" + kind : "");
        msg.innerHTML = text ? fmt.escape(text) + (action ? ' <button type="button" class="tx-msg-btn">' + fmt.escape(action.label) + "</button>" : "") : "";
        msg.setAttribute("role", kind === "error" ? "alert" : "status");
        if (action) msg.querySelector(".tx-msg-btn").onclick = action.run;
      }
      // strict: also report unreadable input (on Enter / leaving the field,
      // not mid-typing).
      function commit(strict) {
        var lo = parsePriceInfo(minIn.value);
        var hi = parsePriceInfo(maxIn.value);
        minIn.removeAttribute("aria-invalid");
        maxIn.removeAttribute("aria-invalid");
        var bad = [lo && lo.error ? minIn : null, hi && hi.error ? maxIn : null].filter(Boolean);
        if (bad.length) {
          if (strict) {
            bad.forEach(function (i) { i.setAttribute("aria-invalid", "true"); });
            var v0 = bad[0].value.trim();
            say(/\d.*\s*(-|–|to)\s*.*\d/i.test(v0)
              ? "Put the minimum and maximum in separate boxes."
              : "Couldn’t read “" + v0 + "”. Try 500k, 2.5m or 2,000,000.", "error");
          }
          return;
        }
        var loV = lo && lo.value, hiV = hi && hi.value;
        if (loV && hiV && loV > hiV) {
          minIn.setAttribute("aria-invalid", "true");
          maxIn.setAttribute("aria-invalid", "true");
          say("Min (" + fmt.moneyShort(loV) + ") is higher than max (" + fmt.moneyShort(hiV) + ").", "error", {
            label: "Swap to " + fmt.moneyShort(hiV) + "–" + fmt.moneyShort(loV),
            run: function () {
              var t = minIn.value;
              minIn.value = maxIn.value;
              maxIn.value = t;
              commit(true);
            },
          });
          return;
        }
        var s = getState();
        s.price = loV || hiV ? "custom" : "all";
        s.priceMin = loV || null;
        s.priceMax = hiV || null;
        el.querySelectorAll('.tx-chip[data-group="price"]').forEach(function (ch) {
          var on = ch.getAttribute("data-value") === s.price;
          ch.classList.toggle("is-active", on);
          ch.setAttribute("aria-pressed", String(on));
        });
        var notes = [];
        [[lo, minIn], [hi, maxIn]].forEach(function (pair) {
          if (pair[0] && pair[0].scaled) notes.push("Read “" + pair[1].value.trim() + "” as " + fmt.moneyShort(pair[0].value) + ".");
        });
        if (loV || hiV) notes.unshift("Showing sales " + priceLabel(s) + ".");
        say(notes.join(" "), loV || hiV ? "ok" : "");
        onChange(s, "price:custom");
      }
      [minIn, maxIn].forEach(function (inp) {
        inp.addEventListener("input", function () {
          clearTimeout(rangeTimer);
          rangeTimer = setTimeout(function () { commit(false); }, 700);
        });
        inp.addEventListener("keydown", function (e) {
          if (e.key === "Enter") { clearTimeout(rangeTimer); commit(true); }
        });
        inp.addEventListener("change", function () {
          clearTimeout(rangeTimer);
          commit(true);
        });
      });
      el.querySelectorAll(".tx-chip").forEach(function (b) {
        b.addEventListener("click", function () {
          var s = getState();
          var g = b.getAttribute("data-group");
          var v = b.getAttribute("data-value");
          if (g === "days") { s.days = +v; s.dateFrom = null; s.dateTo = null; }
          if (g === "price") { s.price = v; s.priceMin = null; s.priceMax = null; }
          if (g === "financed") s.financed = v;
          // County / type chips: nothing selected == all. Clicking narrows to
          // that one; clicking more adds; clicking the last active one resets.
          if (g === "county") s.counties = toggleSet(s.counties, v, COUNTIES);
          if (g === "category") s.categories = toggleSet(s.categories, v, CATEGORIES);
          onChange(s, g + ":" + v);
          render();
          var again = el.querySelector('.tx-chip[data-group="' + g + '"][data-value="' + v + '"]');
          if (again) again.focus();
        });
      });
      var reset = el.querySelector(".tx-reset");
      reset.addEventListener("click", function () {
        onChange(defaultState(), "reset");
        render();
      });
    }

    // Timeline (daily sales) + price histogram; both are brushes that set the
    // same filters as the chips/inputs. Redrawn on every data change.
    function drawCharts() {
      if (!opts.getData || !TX.charts) return;
      var d = opts.getData();
      if (!d) return;
      var s = getState();
      var tl = el.querySelector(".tx-timeline");
      if (tl) {
        var base = apply(d.rows, s, d.asOf, { ignoreDate: true });
        var first = isoAdd(d.asOf, -(d.windowDays || 60) + 1);
        var days = [];
        for (var iso = first; iso <= d.asOf; iso = isoAdd(iso, 1)) days.push({ iso: iso, n: 0, v: 0 });
        var idx = {};
        days.forEach(function (x, i) { idx[x.iso] = i; });
        base.forEach(function (r) { var i = idx[r.date]; if (i != null) { days[i].n++; days[i].v += r.price; } });
        var range = dateRange(s, d.asOf);
        var i0 = idx[range[0]], i1 = idx[range[1]];
        TX.charts.barBrush(tl, {
          bins: days.map(function (x) {
            return { value: x.n, tip: "<strong>" + fmt.date(x.iso, { weekday: "short", month: "short", day: "numeric" }) + "</strong>" +
              x.n.toLocaleString("en-US") + (x.n === 1 ? " sale" : " sales") + (x.n ? " · " + fmt.moneyShort(x.v) : "") };
          }),
          selected: i0 != null ? [i0, i1 != null ? i1 : days.length - 1] : null,
          ticks: [0, Math.floor(days.length / 2), days.length - 1].map(function (i) { return { i: i, label: fmt.dateShort(days[i].iso) }; }),
          ariaLabel: "Sales per day. Drag across days to pick a date range.",
          onBrush: function (a, b) {
            var ns = getState();
            if (a == null) { ns.dateFrom = null; ns.dateTo = null; }
            else { ns.dateFrom = days[a].iso; ns.dateTo = days[b].iso; }
            onChange(ns, "timeline");
            render();
          },
        });
        var cap = el.querySelector(".tx-chart-cap");
        if (cap) {
          // Counties whose records begin after the window starts are undercounted.
          var gaps = coverageGaps(d.rows, range[0], s.counties);
          cap.textContent = (s.dateFrom ? "Showing " + dateRangeLabel(s, d.asOf) + " · drag the chart to change, tap a period to reset" : "Sales per day · drag across days to pick dates") +
            (gaps.length ? ". Note: " + gaps.map(function (g) { return g.county + " records start " + fmt.dateShort(g.start); }).join(", ") + ", so earlier days undercount " + (gaps.length > 1 ? "them" : "it") + "." : "");
          cap.classList.toggle("is-warn", !!gaps.length);
        }
      }
      var hi = el.querySelector(".tx-hist");
      if (hi) {
        var pb = apply(d.rows, s, d.asOf, { ignorePrice: true });
        var E = PRICE_EDGES;
        var bins = E.slice(0, -1).map(function (lo, i) { return { lo: lo, hi: E[i + 1], n: 0 }; });
        pb.forEach(function (r) {
          for (var i = bins.length - 1; i >= 0; i--) if (r.price >= bins[i].lo) { bins[i].n++; break; }
        });
        // Highlight the bins inside the current price filter.
        var lo = minPrice(s), hiP = maxPrice(s);
        var sel = null;
        if (lo || hiP !== Infinity) {
          var a = 0, b = bins.length - 1;
          while (a < b && bins[a].hi <= lo) a++;
          while (b > a && hiP !== Infinity && bins[b].lo >= hiP) b--;
          sel = [a, b];
        }
        TX.charts.barBrush(hi, {
          height: 56,
          bins: bins.map(function (x, i) {
            return { value: x.n, tip: "<strong>" + fmt.moneyShort(x.lo) + (i === bins.length - 1 ? "+" : "–" + fmt.moneyShort(x.hi)) + "</strong>" + x.n.toLocaleString("en-US") + (x.n === 1 ? " sale" : " sales") };
          }),
          selected: sel,
          ticks: [{ i: 0, label: "$100K" }, { i: 7, label: "$1M" }, { i: 13, label: "$10M" }, { i: bins.length - 1, label: "$100M+" }],
          ariaLabel: "Sales by price. Drag across bars to pick a price range.",
          onBrush: function (a, b) {
            var ns = getState();
            if (a == null) { ns.price = "all"; ns.priceMin = null; ns.priceMax = null; }
            else {
              ns.price = "custom";
              ns.priceMin = a === 0 ? null : bins[a].lo;
              ns.priceMax = b === bins.length - 1 ? null : bins[b].hi;
              if (!ns.priceMin && !ns.priceMax) ns.price = "all";
            }
            onChange(ns, "histogram");
            render();
            var m = el.querySelector(".tx-range-msg");
            if (m && a != null && ns.price === "custom") { m.className = "tx-range-msg is-ok"; m.textContent = "Showing sales " + priceLabel(ns) + "."; }
          },
        });
      }
    }

    var baseRender = render;
    render = function () {
      baseRender();
      drawCharts();
    };
    render();
    return { render: function () { render(); }, drawCharts: drawCharts };
  }

  function searchHtml(q, placeholder) {
    return '<div class="tx-search">' +
      '<svg aria-hidden="true" viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l4.5 4.5"/></svg>' +
      '<input type="search" class="tx-search-input" enterkeyhint="search" placeholder="' + fmt.escape(placeholder || "Search address, city, ZIP, buyer or seller") +
      '" value="' + fmt.escape(q || "") + '" aria-label="Search sales" autocomplete="off" spellcheck="false" />' +
      "</div>";
  }

  function toggleSet(current, v, all) {
    var isAll = current.length === all.length;
    if (isAll) return [v];
    var has = current.indexOf(v) >= 0;
    var next = has ? current.filter(function (x) { return x !== v; }) : current.concat([v]);
    if (!next.length || next.length === all.length) return all.slice();
    return all.filter(function (x) { return next.indexOf(x) >= 0; });
  }

  // ---------------------------------------------------------------- notices
  // A short, polite status message (no alerts/dialogs): <div class="tx-toast">.
  var toastTimer = null;
  function notify(container, text, opts) {
    opts = opts || {};
    var t = container.querySelector(".tx-toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "tx-toast";
      t.setAttribute("role", "status");
      t.setAttribute("aria-live", "polite");
      container.appendChild(t);
    }
    t.innerHTML = '<span>' + fmt.escape(text) + "</span>" +
      (opts.action ? '<button type="button" class="tx-msg-btn">' + fmt.escape(opts.action.label) + "</button>" : "") +
      '<button type="button" class="tx-toast-x" aria-label="Dismiss">×</button>';
    if (opts.action) t.querySelector(".tx-msg-btn").onclick = function () { t.hidden = true; opts.action.run(); };
    t.querySelector(".tx-toast-x").onclick = function () { t.hidden = true; };
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, opts.ms || 6000);
  }

  // ------------------------------------------------------------ summary line
  function summary(rows) {
    var total = 0;
    for (var i = 0; i < rows.length; i++) total += rows[i].price;
    return {
      count: rows.length,
      total: total,
      text: rows.length.toLocaleString("en-US") + (rows.length === 1 ? " sale" : " sales") +
        (rows.length ? " · " + fmt.moneyShort(total) + " total" : ""),
    };
  }

  function asOfText(data) {
    var lag = COUNTIES.filter(function (c) {
      return data.latestByCounty[c] && data.latestByCounty[c] < data.asOf;
    });
    var t = "Recorded through " + fmt.date(data.asOf);
    var undirected = data.rows.some(function (r) { return !r.partiesDirected; });
    if (lag.length) {
      t += " (" + lag.map(function (c) {
        return c + " through " + fmt.dateShort(data.latestByCounty[c]);
      }).join(", ") + ")";
    }
    if (undirected) t += ". Buyer and seller roles aren’t yet available for Miami-Dade deeds";
    return t;
  }

  // Only show a previous sale a reader can interpret: it needs a date (Palm
  // Beach's feed has none, and a third of its undated "previous sales" are
  // decades-old or nominal), a real price (not a $100 family transfer), and
  // it must not be this same deed echoed back.
  var MIN_PREV_PRICE = 10000;
  function hasPrevSale(r) {
    if (!r.prevPrice || r.prevPrice < MIN_PREV_PRICE || !r.prevDate) return false;
    if (r.prevDate >= r.date) return false;
    if (r.prevPrice === r.price && (!r.prevDate || r.prevDate === r.date)) return false;
    // A "prior" within 30 days at nearly the same price is almost always this
    // deed itself (its sale date precedes its record date), not a quick flip.
    var gap = (Date.parse(r.date) - Date.parse(r.prevDate)) / 864e5;
    if (gap <= 30 && Math.abs(r.prevPrice - r.price) / r.price <= 0.02) return false;
    // More than 30x in under 20 years is almost always a partial interest,
    // a single unit of a later-assembled site or a nominal transfer (e.g. a
    // $112.6M hotel "previously sold" for $300,100 in 2012), not this property.
    if (r.price / r.prevPrice > 30 && gap < 20 * 365.25) return false;
    return true;
  }

  // --------------------------------------------------------------- boundaries
  // City and ZIP outlines (Census TIGERweb, simplified; built by
  // build_boundaries.py). Loaded on demand — only when a city/ZIP is searched.
  var BOUNDARY_FILE = "south-florida-boundaries.geojson";
  var boundaries = { loaded: false, promise: null, city: {}, zip: {} };
  function cityKey(s) {
    return String(s || "").toLowerCase().replace(/[^a-z]/g, "");
  }
  function loadBoundaries() {
    if (boundaries.promise) return boundaries.promise;
    boundaries.promise = fetch(BOUNDARY_FILE).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (fc) {
      fc.features.forEach(function (f) {
        f.bbox = geomBBox(f.geometry);
        var p = f.properties;
        if (p.kind === "city") boundaries.city[cityKey(p.name)] = f;
        else boundaries.zip[p.name] = f;
      });
      boundaries.loaded = true;
      return boundaries;
    }).catch(function (e) {
      boundaries.promise = null; // allow a retry later
      throw e;
    });
    return boundaries.promise;
  }
  function boundaryFor(place) {
    if (!place || !boundaries.loaded) return null;
    return place.kind === "zip" ? boundaries.zip[place.value] || null : boundaries.city[cityKey(place.value)] || null;
  }
  function geomBBox(g) {
    var b = [180, 90, -180, -90];
    (g.type === "Polygon" ? [g.coordinates] : g.coordinates).forEach(function (poly) {
      poly[0].forEach(function (pt) {
        if (pt[0] < b[0]) b[0] = pt[0];
        if (pt[1] < b[1]) b[1] = pt[1];
        if (pt[0] > b[2]) b[2] = pt[0];
        if (pt[1] > b[3]) b[3] = pt[1];
      });
    });
    return b;
  }
  // Even-odd ray casting over a (Multi)Polygon, holes included.
  function inFeature(f, lng, lat) {
    var b = f.bbox;
    if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) return false;
    var polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    var inside = false;
    polys.forEach(function (rings) {
      rings.forEach(function (ring) {
        for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
          if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
        }
      });
    });
    return inside;
  }

  // Satellite thumbnail of a sale (Mapbox Static Images), pin at the parcel.
  function aerialUrl(r, w, h, zoom) {
    if (!r || !r.located) return null;
    var ll = r.lng.toFixed(5) + "," + r.lat.toFixed(5);
    return "https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/pin-s+eb6834(" + ll + ")/" +
      ll + "," + (zoom || 17) + ",0/" + w + "x" + h + "@2x?access_token=" + MAPBOX_TOKEN;
  }

  // Per-viewer UI preferences (not shared, not required to work).
  var prefs = {
    get: function (k, dflt) {
      try {
        var v = global.localStorage.getItem("trd-sofla-tx:" + k);
        return v == null ? dflt : JSON.parse(v);
      } catch (e) {
        return dflt;
      }
    },
    set: function (k, v) {
      try { global.localStorage.setItem("trd-sofla-tx:" + k, JSON.stringify(v)); } catch (e) {}
    },
  };

  global.TX = {
    MAPBOX_TOKEN: MAPBOX_TOKEN,
    loadPoints: loadPoints,
    aerialUrl: aerialUrl,
    loadBoundaries: loadBoundaries,
    boundaryFor: boundaryFor,
    boundaries: boundaries,
    inFeature: inFeature,
    prefs: prefs,
    hasPrevSale: hasPrevSale,
    partyRows: partyRows,
    partyLine: partyLine,
    PARTY_NOTE: PARTY_NOTE,
    toEntries: toEntries,
    partySummary: partySummary,
    COUNTIES: COUNTIES,
    CATEGORIES: CATEGORIES,
    COLOR_GROUP: COLOR_GROUP,
    USE_TYPES: USE_TYPES,
    DAYS: DAYS,
    fmt: fmt,
    load: load,
    fitDates: fitDates,
    loadRest: function () { return loadPromise ? loadPromise.then(loadRest) : load().then(loadRest); },
    onRest: onRest,
    pendingBefore: pendingBefore,
    pendingNote: function (st, asOf) { return pendingBefore(dateRange(st, asOf)[0]) ? '<span class="tx-pending"> · loading older sales…</span>' : ""; },
    defaultState: defaultState,
    stateFromUrl: stateFromUrl,
    apply: apply,
    isDefault: isDefault,
    tracker: tracker,
    link: link,
    serializeState: serializeState,
    filterBar: filterBar,
    searchHtml: searchHtml,
    priceLabel: priceLabel,
    dateRange: dateRange,
    dateRangeLabel: dateRangeLabel,
    coverageGaps: coverageGaps,
    isoAdd: isoAdd,
    isoToDate: parseISO,
    parsePrice: parsePrice,
    parsePriceInfo: parsePriceInfo,
    notify: notify,
    summary: summary,
    asOfText: asOfText,
    slug: slug,
  };
})(window);
