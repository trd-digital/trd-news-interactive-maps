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
  //   Miami-Dade  verified Oct 2026 (needs the 13-digit folio, leading zeros)
  //   Palm Beach  verified Oct 2026
  //   Broward     no folio in the feed yet (its parcel_id is a deed number)
  var PROPERTY_LINKS = {
    "Miami-Dade": /^https:\/\/apps\.miamidadepa\.gov\/PropertySearch\/#\/\?folio=\d{13}$/,
    "Palm Beach": /^https:\/\/pbcpao\.gov\/Property\/Details\?parcelId=\d{17}$/,
    Broward: null,
  };
  var LINKS_ENABLED = COUNTIES.every(function (c) { return !!PROPERTY_LINKS[c]; });
  // What a real parcel ID looks like per county (digits only). Anything else
  // (corrupted folios, deed numbers) is not shown or searched as a parcel.
  var PARCEL_ID = { "Miami-Dade": /^\d{13}$/, Broward: /^\d{12}$/, "Palm Beach": /^\d{17}$/ };
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
      address: p.address ? fmt.title(p.address) : null,
      city: p.city ? fmt.title(p.city) : null,
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
      parcelUrl: LINKS_ENABLED && p.parcel_url && PROPERTY_LINKS[p.county] && PROPERTY_LINKS[p.county].test(p.parcel_url) ? p.parcel_url : null,
      parcelCount: +p.parcel_count || 1,
      assemblageId: p.assemblage_id || null,
      partiesDirected: p.party_direction ? p.party_direction !== "unknown" : UNDIRECTED_COUNTIES.indexOf(p.county) < 0,
      lng: located ? +g[0] : null,
      lat: located ? +g[1] : null,
      located: located,
    };
    return row;
  }

  function validParcel(county, id, url) {
    if (!id) return null;
    var digits = String(id).replace(/\D+/g, "");
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

  var loadPromise = null;
  function load() {
    if (loadPromise) return loadPromise;
    loadPromise = fetch(dataUrl())
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (fc) {
        var rows = (fc.features || []).map(normalize).filter(function (r) {
          return r.price > 0 && r.date;
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
        return { rows: rows, meta: meta, latestByCounty: latest, asOf: asOf, assemblages: indexAssemblages(rows) };
      });
    return loadPromise;
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
    if (q.get("city")) s.place = { kind: "city", value: fmt.title(q.get("city")), label: fmt.title(q.get("city")) };
    if (/^\d{5}$/.test(q.get("zip") || "")) s.place = { kind: "zip", value: q.get("zip"), label: "ZIP " + q.get("zip") };
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
    if (v == null) return null;
    var m = String(v).toLowerCase().replace(/[$,\s]/g, "").match(/^(\d+(?:\.\d+)?)(k|m|b)?$/);
    if (!m) return null;
    var n = parseFloat(m[1]) * ({ k: 1e3, m: 1e6, b: 1e9 }[m[2]] || 1);
    if (!m[2] && n > 0 && n < 10000) n *= 1000;
    return n > 0 ? n : null;
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

  function apply(rows, state, asOf, opts) {
    opts = opts || {};
    var from = cutoff(asOf, state.days);
    var min = minPrice(state), max = maxPrice(state);
    var q = opts.ignoreQuery ? "" : (state.q || "").trim();
    var place = opts.ignoreQuery ? null : state.place;
    var party = opts.ignoreQuery ? null : state.party;
    var bb = opts.ignoreBbox ? null : state.bbox;
    var placeCity = place && place.kind === "city" ? place.value.toLowerCase() : null;
    return rows.filter(function (r) {
      if (r.date < from) return false;
      if (r.price < min || r.price > max) return false;
      if (state.counties.indexOf(r.county) < 0) return false;
      if (!opts.ignoreCategory && state.categories.indexOf(r.category) < 0) return false;
      if (state.financed === "financed" && !r.financed) return false;
      if (state.financed === "cash" && r.financed) return false;
      if (place) {
        if (placeCity ? (r.city || "").toLowerCase() !== placeCity : r.zip !== place.value) return false;
      }
      if (party && r._partyKeys.indexOf(party.key) < 0) return false;
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
        return chip("days", d, d + " days", s.days === d);
      }).join(""));
      html += group("County", "county", COUNTIES.map(function (c) {
        return chip("county", c, c, s.counties.length < COUNTIES.length && s.counties.indexOf(c) >= 0);
      }).join(""));
      html += group("Price", "price", PRICE_PRESETS.map(function (p) {
        return chip("price", p.id, p.label, s.price === p.id);
      }).join("") +
        '<div class="tx-range"><label><span class="tx-sr">Minimum price</span><input class="tx-range-in" data-end="min" inputmode="decimal" placeholder="Min, e.g. 500k" value="' +
        (s.price === "custom" && s.priceMin ? fmt.escape(fmt.moneyShort(s.priceMin)) : "") + '" /></label><span aria-hidden="true">–</span>' +
        '<label><span class="tx-sr">Maximum price</span><input class="tx-range-in" data-end="max" inputmode="decimal" placeholder="Max, e.g. 2m" value="' +
        (s.price === "custom" && s.priceMax ? fmt.escape(fmt.moneyShort(s.priceMax)) : "") + '" /></label></div>');
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
      el.querySelectorAll(".tx-range-in").forEach(function (inp) {
        function commit() {
          var s = getState();
          var lo = parsePrice(el.querySelector('[data-end="min"]').value);
          var hi = parsePrice(el.querySelector('[data-end="max"]').value);
          if (lo && hi && lo > hi) { var t = lo; lo = hi; hi = t; }
          s.price = lo || hi ? "custom" : "all";
          s.priceMin = lo;
          s.priceMax = hi;
          el.querySelectorAll('.tx-chip[data-group="price"]').forEach(function (c) {
            var on = c.getAttribute("data-value") === s.price;
            c.classList.toggle("is-active", on);
            c.setAttribute("aria-pressed", String(on));
          });
          onChange(s, "price:custom");
        }
        inp.addEventListener("input", function () {
          clearTimeout(rangeTimer);
          rangeTimer = setTimeout(commit, 500);
        });
        inp.addEventListener("keydown", function (e) {
          if (e.key === "Enter") { clearTimeout(rangeTimer); commit(); }
        });
      });
      el.querySelectorAll(".tx-chip").forEach(function (b) {
        b.addEventListener("click", function () {
          var s = getState();
          var g = b.getAttribute("data-group");
          var v = b.getAttribute("data-value");
          if (g === "days") s.days = +v;
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

    render();
    return { render: render };
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
    return true;
  }

  global.TX = {
    hasPrevSale: hasPrevSale,
    partyRows: partyRows,
    partyLine: partyLine,
    PARTY_NOTE: PARTY_NOTE,
    toEntries: toEntries,
    partySummary: partySummary,
    COUNTIES: COUNTIES,
    CATEGORIES: CATEGORIES,
    COLOR_GROUP: COLOR_GROUP,
    DAYS: DAYS,
    fmt: fmt,
    load: load,
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
    parsePrice: parsePrice,
    summary: summary,
    asOfText: asOfText,
    slug: slug,
  };
})(window);
