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
  var CATEGORIES = ["Residential", "Commercial", "Multifamily", "Land", "Other"];
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
  var DAYS = [7, 14, 30];
  var PRICE_PRESETS = [
    { id: "all", label: "All prices", min: 0 },
    { id: "1m", label: "$1M+", min: 1e6 },
    { id: "5m", label: "$5M+", min: 5e6 },
    { id: "10m", label: "$10M+", min: 1e7 },
  ];
  var FINANCED = [
    { id: "any", label: "Any" },
    { id: "financed", label: "Financed" },
    { id: "cash", label: "No mortgage recorded" },
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
      parcelId: p.parcel_id || null,
      parcelUrl: p.parcel_url || null,
      parcelCount: +p.parcel_count || 1,
      assemblageId: p.assemblage_id || null,
      lng: located ? +g[0] : null,
      lat: located ? +g[1] : null,
      located: located,
    };
    row._search = [row.address, row.city, row.zip, row.buyer, row.seller, row.parcelId]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return row;
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

  // "MM Real Estate Acquisitions LLC + 2 related buyers"
  function partySummary(list, noun) {
    if (!list.length) return "—";
    var first = fmt.party(list[0]);
    return list.length === 1 ? first : first + " + " + (list.length - 1) + " related " + noun + (list.length > 2 ? "s" : "");
  }

  // ------------------------------------------------------------ filter model
  function defaultState() {
    return {
      days: 30,
      counties: COUNTIES.slice(),
      categories: CATEGORIES.slice(),
      price: "all",
      financed: "any",
      q: "",
    };
  }

  // URL presets let the dashboard / article embeds open a specific view:
  //   ?property-type=residential|commercial|land (comma list ok)
  //   ?county=miami-dade|broward|palm-beach   ?days=7|14|30
  //   ?min-price=1m|5m|10m   ?financed=financed|cash   ?q=text   ?sale=<id>
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
    var fin = q.get("financed");
    if (fin === "financed" || fin === "cash") s.financed = fin;
    if (q.get("q")) s.q = q.get("q");
    return s;
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
  }

  function minPrice(state) {
    var p = PRICE_PRESETS.find(function (x) { return x.id === state.price; });
    return p ? p.min : 0;
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
    var min = minPrice(state);
    var q = (state.q || "").trim().toLowerCase();
    var terms = q ? q.split(/\s+/) : [];
    return rows.filter(function (r) {
      if (r.date < from) return false;
      if (r.price < min) return false;
      if (state.counties.indexOf(r.county) < 0) return false;
      if (!opts.ignoreCategory && state.categories.indexOf(r.category) < 0) return false;
      if (state.financed === "financed" && !r.financed) return false;
      if (state.financed === "cash" && r.financed) return false;
      for (var i = 0; i < terms.length; i++) if (r._search.indexOf(terms[i]) < 0) return false;
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
      var html = "";
      if (!opts.noSearch) html += searchHtml(s.q, opts.searchPlaceholder);
      html += '<div class="tx-filter-groups">';

      html += group("Period", "days", DAYS.map(function (d) {
        return chip("days", d, d + " days", s.days === d);
      }).join(""));
      html += group("County", "county", COUNTIES.map(function (c) {
        return chip("county", c, c, s.counties.length < COUNTIES.length && s.counties.indexOf(c) >= 0);
      }).join(""));
      html += group("Price", "price", PRICE_PRESETS.map(function (p) {
        return chip("price", p.id, p.label, s.price === p.id);
      }).join(""));
      if (opts.showCategories) {
        html += group("Type", "category", CATEGORIES.map(function (c) {
          return chip("category", c, '<i class="tx-swatch" data-cat="' + c + '"></i>' + c,
            s.categories.length < CATEGORIES.length && s.categories.indexOf(c) >= 0);
        }).join(""));
      }
      html += group("Mortgage", "financed", FINANCED.map(function (f) {
        return chip("financed", f.id, f.label, s.financed === f.id);
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
      var input = el.querySelector(".tx-search-input");
      if (input) {
        bindSearch(input, getState, function (s) {
          onChange(s, "search");
          var reset = el.querySelector(".tx-reset");
          if (reset) reset.hidden = isDefault(s);
        });
      }
      el.querySelectorAll(".tx-chip").forEach(function (b) {
        b.addEventListener("click", function () {
          var s = getState();
          var g = b.getAttribute("data-group");
          var v = b.getAttribute("data-value");
          if (g === "days") s.days = +v;
          if (g === "price") s.price = v;
          if (g === "financed") s.financed = v;
          // County / type chips: nothing selected == all. Clicking narrows to
          // that one; clicking more adds; clicking the last active one resets.
          if (g === "county") s.counties = toggleSet(s.counties, v, COUNTIES);
          if (g === "category") s.categories = toggleSet(s.categories, v, CATEGORIES);
          onChange(s, g + ":" + v);
          render();
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
      '<input type="search" class="tx-search-input" placeholder="' + fmt.escape(placeholder || "Search address, buyer, seller") +
      '" value="' + fmt.escape(q || "") + '" aria-label="Search sales" autocomplete="off" spellcheck="false" />' +
      "</div>";
  }

  // Debounced live search: updates state.q and calls onChange(state).
  function bindSearch(input, getState, onChange) {
    var timer = null;
    input.addEventListener("input", function () {
      clearTimeout(timer);
      var v = input.value;
      timer = setTimeout(function () {
        var s = getState();
        s.q = v;
        onChange(s);
      }, 150);
    });
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
    if (lag.length) {
      t += " (" + lag.map(function (c) {
        return c + " through " + fmt.dateShort(data.latestByCounty[c]);
      }).join(", ") + ")";
    }
    return t;
  }

  // Some county feeds report the current deed as the "previous sale". Only
  // show a previous sale that is genuinely different from this one.
  function hasPrevSale(r) {
    if (!r.prevPrice || r.prevPrice <= 0) return false;
    if (r.prevDate && r.prevDate >= r.date) return false;
    if (r.prevPrice === r.price && (!r.prevDate || r.prevDate === r.date)) return false;
    return true;
  }

  global.TX = {
    hasPrevSale: hasPrevSale,
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
    bindSearch: bindSearch,
    summary: summary,
    asOfText: asOfText,
    slug: slug,
  };
})(window);
