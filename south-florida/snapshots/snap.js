/*!
 * snap.js — South Florida Market Snapshots.
 * One page for residential, commercial and all sales (the three
 * south-florida-snapshots-*.html files only pick the opening scope).
 * Depends on: TRD theme.js (TrdTheme), Chart.js 4 (history charts).
 *
 * Data (produced by the data side; this page only displays it):
 *   south-florida-snapshots-{residential,commercial}.json — rows of
 *     County × PHY_CITY × MACRO × MICRO × sale_qtr with price_sum,
 *     price_median, num_deals_size, …
 *   south-florida-snapshots-{residential,commercial,all}-medians.json —
 *     true medians per quarter for rollups, keys "County|City|Type", "*" = all.
 *
 * ?type=dashboard (the TRD dashboard card): summary cards only, a click opens
 * the full snapshots page, and the height is posted to the parent page.
 */
(function () {
  "use strict";

  var SNAPSHOTS_PAGE = "https://therealdeal.com/data/south-florida-market-snapshots/";
  var COUNTIES = ["Broward", "Miami-Dade", "Palm Beach"];
  var FEW = 10; // under this many sales a median is flagged "Few sales"
  var TINY = 3; // under this many, a place is hidden until asked for
  var SCOPES = {
    residential: { label: "Residential", files: ["residential"], medians: "residential" },
    commercial: { label: "Commercial", files: ["commercial"], medians: "commercial" },
    all: { label: "All sales", files: ["residential", "commercial"], medians: "all" },
  };
  // Short display names for the Florida DOR use codes in MICRO.
  var TYPE_LABELS = {
    "Single Family": "Single-family homes",
    "Condominiums": "Condos",
    "Cooperatives": "Co-ops",
    "Mobile Homes": "Mobile homes",
    "Residential Common Elements/Areas": "Common areas",
    "Vacant Residential": "Vacant residential land",
    "Vacant Commercial": "Vacant commercial land",
    "Multi-Family - Fewer Than 10 Units": "Multifamily, under 10 units",
    "Multi-Family - 10 Units Or More": "Multifamily, 10+ units",
    "Stores, One Story": "Stores, one story",
    "Office Buildings, Non-Professional Service Buildings, One Story": "Offices, one story",
    "Office Buildings, Non-Professional Service Buildings, Multi-Story": "Offices, multistory",
    "Professional Service Buildings": "Professional offices",
    "Mixed Use - Store And Office Or Store And Residential Combination": "Mixed use",
    "Hotels, Motels": "Hotels & motels",
    "Parking Lots (Commercial Or Patron), Mobile Home Parks": "Parking lots & mobile home parks",
    "Service Stations": "Gas stations",
    "Restaurants, Cafeterias": "Restaurants",
    "Drive-In Restaurants": "Drive-in restaurants",
    "Bulk Sale Of Condos": "Bulk condo sales",
    "Financial Institutions (Banks, Saving And Loan Companies, Mortgage Companies, Credit Services)": "Banks & lenders",
    "Community Shopping Centers": "Community shopping centers",
    "Regional Shopping Centers": "Regional shopping centers",
    "Supermarkets": "Supermarkets",
    "Department Stores": "Department stores",
    "Miscellaneous Residential (Migrant Camps, Boarding Homes, Etc.)": "Boarding homes & misc. residential",
    "Retirement Homes Not Eligible For Exemption": "Retirement homes",
    "Nightclubs, Cocktail Lounges, Bars": "Bars & nightclubs",
    "Golf Courses, Driving Ranges": "Golf courses",
    "Wholesale Outlets, Produce Houses, Manufacturing Outlets": "Wholesale outlets",
    "Insurance Company Offices": "Insurance offices",
    "Race Tracks (Horse, Auto, Or Dog)": "Race tracks",
    "Camps": "Camps",
  };
  function typeLabel(t) {
    if (t === "*") return "All types";
    if (TYPE_LABELS[t]) return TYPE_LABELS[t];
    if (/^Auto Sales/.test(t)) return "Auto dealers & garages";
    if (/^Airports/.test(t)) return "Airports, terminals & marinas";
    if (/^Repair Service/.test(t)) return "Repair shops & laundromats";
    if (/^Bowling/.test(t)) return "Bowling, rinks & arenas";
    if (/^Tourist Attractions/.test(t)) return "Attractions & fairgrounds";
    if (/^Enclosed Theaters/.test(t)) return "Theaters & auditoriums";
    return t.length > 40 ? t.split(",")[0] : t;
  }
  // How a PHY_CITY reads on a card.
  function placeName(county, city, short) {
    if (!city) return "City not recorded";
    if (/^(unincorporated( county)?|county of .*)$/i.test(city)) return (short ? "Uninc. " : "Unincorporated ") + county;
    return city;
  }

  // ---------------------------------------------------------------- format
  function money(n) {
    if (n == null || !isFinite(n)) return "–";
    var a = Math.abs(n);
    if (a >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
    if (a >= 1e6) return "$" + (n / 1e6).toFixed(a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2) + "M";
    if (a >= 1e3) {
      var k = Math.round(n / 1e3);
      return k >= 1000 ? "$1.00M" : "$" + k + "K";
    }
    return "$" + Math.round(n);
  }
  function num(n) {
    return n == null || !isFinite(n) ? "–" : Math.round(n).toLocaleString("en-US");
  }
  function qLabel(q, short) {
    var m = /^(\d{4})Q([1-4])$/.exec(q || "");
    if (!m) return q || "";
    return short ? "Q" + m[2] + " '" + m[1].slice(2) : "Q" + m[2] + " " + m[1];
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pct(cur, prev) {
    return cur != null && prev != null && isFinite(cur) && isFinite(prev) && prev > 0 ? (cur - prev) / prev : null;
  }
  // "▲ 9% vs Q4 2025" — only the arrow carries color.
  function chg(p, suffix) {
    if (p == null) return "";
    var v = Math.round(p * 100);
    if (!v) return '<span class="sn-chg flat">flat' + (suffix || "") + "</span>"; // under 1%: no arrow
    var cls = v > 0 ? "up" : "down";
    var arrow = v > 0 ? "▲" : "▼";
    return '<span class="sn-chg ' + cls + '"><i aria-hidden="true">' + arrow + "</i> " +
      '<span class="sn-sr">' + (v > 0 ? "up " : v < 0 ? "down " : "unchanged ") + "</span>" +
      Math.abs(v) + "%" + (suffix || "") + "</span>";
  }
  function median(list) {
    var x = list.filter(isFinite).sort(function (a, b) { return a - b; });
    var n = x.length;
    return n ? (n % 2 ? x[(n - 1) / 2] : (x[n / 2 - 1] + x[n / 2]) / 2) : null;
  }
  function norm(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  // ------------------------------------------------------------------ setup
  var root = document.getElementById("snap");
  var params = new URLSearchParams(location.search);
  var dashboard = params.get("type") === "dashboard" && window.self !== window.top;
  if (dashboard) document.body.classList.add("sn-dash");
  var scope = SCOPES[params.get("scope")] ? params.get("scope") : root.getAttribute("data-scope") || "all";

  var trdTheme = typeof TrdTheme === "function" ? TrdTheme({ updateCallback: function (t) { setTheme(t); } }) : null;
  function setTheme(t) {
    if (t !== "dark" && t !== "light") return;
    document.documentElement.setAttribute("data-bs-theme", t);
    document.body.setAttribute("data-bs-theme", t);
    if (openEntity) renderCharts(); // charts read their colors from the tokens
  }
  if (trdTheme) trdTheme.init();
  setTheme((trdTheme && trdTheme.get()) ||
    (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

  var el = {
    seg: root.querySelector(".sn-seg"),
    title: root.querySelector(".sn-title"),
    meta: root.querySelector(".sn-meta"),
    counties: root.querySelector(".sn-pills"),
    quarter: root.querySelector("#sn-quarter"),
    type: root.querySelector("#sn-type"),
    search: root.querySelector("#sn-search"),
    sort: root.querySelector("#sn-sort"),
    reset: root.querySelector(".sn-reset"),
    results: root.querySelector("#sn-results"),
    overview: root.querySelector(".sn-overview"),
    citiesH: root.querySelector(".sn-cities-h"),
    cities: root.querySelector(".sn-cities"),
    more: root.querySelector(".sn-more"),
    foot: root.querySelector(".sn-foot"),
    dashCap: root.querySelector(".sn-dash-cap"),
    filterBtn: root.querySelector(".sn-filter-btn"),
    controls: root.querySelector(".sn-controls"),
  };

  var state = { county: null, quarter: null, type: "*", q: "", sort: "deals", showTiny: false };
  var idx = null; // index for the current scope
  var openEntity = null; // entity whose detail is open
  var charts = [];

  // ------------------------------------------------------------------- data
  var cache = {};
  function getJson(url) {
    if (!cache[url]) {
      // no-cache = revalidate: a changed data file is never served stale
      // from the browser cache (an unchanged one costs a 304).
      cache[url] = fetch(url, { cache: "no-cache" }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      });
    }
    return cache[url];
  }
  var indexes = {};
  function loadScope(name) {
    if (indexes[name]) return indexes[name];
    var sc = SCOPES[name];
    var files = sc.files.map(function (f) { return getJson("south-florida-snapshots-" + f + ".json"); });
    var meds = getJson("south-florida-snapshots-" + sc.medians + "-medians.json").catch(function () { return null; });
    indexes[name] = Promise.all([Promise.all(files), meds]).then(function (res) {
      return buildIndex([].concat.apply([], res[0]), res[1] && res[1].quarters);
    });
    return indexes[name];
  }

  function buildIndex(raw, medians) {
    var agg = {}, quarters = {}, typeDeals = {}, places = {};
    function add(key, r) {
      var o = agg[key] || (agg[key] = { deals: 0, sum: 0, meds: [] });
      o.deals += r.deals;
      o.sum += r.sum;
      if (isFinite(r.median)) o.meds.push(r.median);
    }
    raw.forEach(function (x) {
      var r = {
        county: String(x.County || "").trim(),
        city: String(x.PHY_CITY || "").trim(),
        type: String(x.MICRO || "").trim(),
        q: String(x.sale_qtr || "").trim(),
        deals: +x.num_deals_size || 0,
        sum: +x.price_sum || 0,
        median: x.price_median == null ? NaN : +x.price_median,
      };
      if (!r.county || !/^\d{4}Q[1-4]$/.test(r.q) || !r.deals) return;
      quarters[r.q] = true;
      typeDeals[r.type] = (typeDeals[r.type] || 0) + r.deals;
      places[r.county + "|" + r.city] = { county: r.county, city: r.city };
      [r.type, "*"].forEach(function (t) {
        add(["C", r.county, r.city, r.q, t].join("|"), r);
        add(["K", r.county, r.q, t].join("|"), r);
        add(["S", r.q, t].join("|"), r);
      });
    });
    return {
      agg: agg,
      medians: medians || {},
      quarters: Object.keys(quarters).sort(),
      types: Object.keys(typeDeals).sort(function (a, b) { return typeDeals[b] - typeDeals[a]; }),
      places: Object.keys(places).map(function (k) { return places[k]; }),
    };
  }

  // Figures for one place, quarter and type; null when it had no sales.
  function stat(ent, q, type) {
    var key = ent.kind === "S" ? ["S", q, type] : ent.kind === "K" ? ["K", ent.county, q, type] : ["C", ent.county, ent.city, q, type];
    var o = idx.agg[key.join("|")];
    if (!o || !o.deals) return null;
    var mk = ent.kind === "S" ? "*|*|" + type : ent.kind === "K" ? ent.county + "|*|" + type : ent.county + "|" + ent.city + "|" + type;
    var tm = idx.medians[q] && idx.medians[q][mk];
    var med = isFinite(tm) ? tm : ent.kind === "C" && type !== "*" && o.meds.length === 1 ? o.meds[0] : median(o.meds);
    return { deals: o.deals, volume: o.sum, avg: o.sum / o.deals, median: med };
  }
  function prevQuarter(q) {
    var i = idx.quarters.indexOf(q);
    return i > 0 ? idx.quarters[i - 1] : null;
  }

  function entities() {
    var over = [{ kind: "S", key: "S", name: "South Florida", sub: "Miami-Dade, Broward & Palm Beach" }];
    COUNTIES.forEach(function (c) {
      over.push({ kind: "K", county: c, key: "K|" + c, name: c, sub: "County" });
    });
    if (state.county) over = over.filter(function (e) { return e.kind === "S" || e.county === state.county; });
    var cities = idx.places.filter(function (p) { return !state.county || p.county === state.county; }).map(function (p) {
      return { kind: "C", county: p.county, city: p.city, key: "C|" + p.county + "|" + p.city, name: placeName(p.county, p.city),
        short: placeName(p.county, p.city, true), sub: p.county + " County" };
    });
    return { over: over, cities: cities };
  }

  // ---------------------------------------------------------------- render
  // Median over the last 8 quarters up to the one shown, as a tiny line.
  function spark(ent) {
    var i = idx.quarters.indexOf(state.quarter);
    var qs = idx.quarters.slice(Math.max(0, i - 7), i + 1);
    var v = qs.map(function (q) { var s = stat(ent, q, state.type); return s ? s.median : null; });
    var have = v.filter(function (x) { return x != null && isFinite(x); });
    if (have.length < 3) return "";
    var lo = Math.min.apply(null, have), hi = Math.max.apply(null, have), W = 100, H = 24;
    var pts = [], last = null;
    v.forEach(function (x, j) {
      if (x == null || !isFinite(x)) return;
      var px = qs.length > 1 ? (j / (qs.length - 1)) * W : W / 2;
      var py = hi > lo ? H - 2 - ((x - lo) / (hi - lo)) * (H - 4) : H / 2;
      pts.push(px.toFixed(1) + "," + py.toFixed(1));
      last = [px, py];
    });
    return '<svg class="sn-spark" viewBox="-2 0 ' + (W + 4) + " " + H + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<polyline points="' + pts.join(" ") + '" vector-effect="non-scaling-stroke"/>' +
      // a zero-length round-capped line: stays a circle however the SVG stretches
      '<line x1="' + last[0].toFixed(1) + '" y1="' + last[1].toFixed(1) + '" x2="' + last[0].toFixed(1) + '" y2="' + last[1].toFixed(1) + '" vector-effect="non-scaling-stroke"/></svg>' +
      '<span class="sn-spark-cap">Median, last ' + qs.length + " quarters</span>";
  }

  function cardHtml(ent, s, prev) {
    var few = s.deals < FEW;
    var open = openEntity && openEntity.key === ent.key;
    var vsQ = prevQuarter(state.quarter);
    var lead = ent.kind === "S" && !dashboard;
    var title = ent.short && ent.short !== ent.name ? ' title="' + esc(ent.name) + '"' : "";
    return '<div class="sn-card' + (few ? " is-few" : "") + (lead ? " sn-lead" : "") + '" role="button" tabindex="0" data-key="' + esc(ent.key) + '" aria-expanded="' + open + '"' +
      (dashboard ? "" : ' aria-label="' + esc(ent.name) + ": show quarterly history" + '"') + ">" +
      '<div class="sn-card-top"><div><h3 class="sn-name"' + title + ">" + esc(ent.short || ent.name) + '</h3><div class="sn-sub">' + esc(ent.sub) + "</div></div>" +
      (few ? '<span class="sn-badge" title="Medians from fewer than ' + FEW + ' sales swing widely">Few sales</span>' : "") + "</div>" +
      '<div class="sn-medblock"><div class="sn-label">Median price</div><div class="sn-hero"><span class="sn-hero-v">' + money(s.median) + "</span>" +
      chg(prev && pct(s.median, prev.median), vsQ ? " vs " + qLabel(vsQ) : "") + "</div>" + (dashboard ? "" : '<div class="sn-trend">' + spark(ent) + "</div>") + "</div>" +
      '<div class="sn-stats">' +
      '<div class="sn-stat sn-stat-deals"><span class="sn-label">Sales</span><b>' + num(s.deals) + '</b><span class="sn-unit"> ' + (s.deals === 1 ? "sale" : "sales") + "</span>" + chg(prev && pct(s.deals, prev.deals)) + "</div>" +
      '<div class="sn-stat"><span class="sn-label">Volume</span><b>' + money(s.volume) + '</b><span class="sn-unit"> volume</span>' + chg(prev && pct(s.volume, prev.volume)) + "</div>" +
      '<div class="sn-stat"><span class="sn-label">Average</span><span class="sn-unit">avg </span><b>' + money(s.avg) + "</b></div>" +
      "</div></div>";
  }

  var SORTS = {
    deals: function (a, b) { return b.s.deals - a.s.deals; },
    volume: function (a, b) { return b.s.volume - a.s.volume; },
    median: function (a, b) { return (b.s.median || 0) - (a.s.median || 0); },
    change: function (a, b) { return (b.chg == null ? -1e9 : b.chg) - (a.chg == null ? -1e9 : a.chg); },
    name: function (a, b) { return a.ent.name.localeCompare(b.ent.name); },
  };

  function render() {
    if (!idx) return;
    var q = state.quarter, t = state.type, pq = prevQuarter(q);
    el.meta.innerHTML = "<strong>" + qLabel(q) + "</strong> · " + esc(typeLabel(t)) +
      '<span class="sn-meta-src"> · Deeds of $100,000 or more, each sale counted once · Source: Florida Department of Revenue tax rolls, updated quarterly</span>';
    if (el.dashCap) el.dashCap.textContent = qLabel(q) + " · " + (scope === "all" ? "All sales" : SCOPES[scope].label) + " · median price, change vs " + (pq ? qLabel(pq) : "prior quarter");
    var ents = entities();

    el.overview.innerHTML = ents.over.map(function (e) {
      var s = stat(e, q, t);
      return s ? cardHtml(e, s, pq && stat(e, pq, t)) : "";
    }).join("") || '<p class="sn-empty">No sales for this selection.</p>';

    if (!dashboard) {
      var needle = norm(state.q);
      var list = ents.cities.map(function (e) {
        var s = stat(e, q, t);
        var p = s && pq ? stat(e, pq, t) : null;
        return s ? { ent: e, s: s, p: p, chg: p ? pct(s.median, p.median) : null } : null;
      }).filter(function (x) {
        return x && (!needle || norm(x.ent.name).indexOf(needle) >= 0 || norm(x.ent.city).indexOf(needle) >= 0);
      });
      var tiny = list.filter(function (x) { return x.s.deals < TINY; });
      var shown = state.showTiny || needle ? list : list.filter(function (x) { return x.s.deals >= TINY; });
      shown.sort(function (a, b) {
        // "City not recorded" always last
        var na = !a.ent.city, nb = !b.ent.city;
        if (na !== nb) return na ? 1 : -1;
        return SORTS[state.sort](a, b) || a.ent.name.localeCompare(b.ent.name);
      });
      el.citiesH.firstChild.textContent = (state.county ? state.county + " cities" : "Cities") + " (" + shown.length + ")";
      el.cities.innerHTML = shown.map(function (x) { return cardHtml(x.ent, x.s, x.p); }).join("") ||
        '<p class="sn-empty">No cities match' + (needle ? " “" + esc(state.q) + "”" : "") + ".</p>";
      var hiddenTiny = state.showTiny || needle ? 0 : tiny.length;
      el.more.hidden = !hiddenTiny && !(state.showTiny && tiny.length && !needle);
      el.more.innerHTML = hiddenTiny
        ? '<button type="button" class="sn-linkbtn" data-act="tiny">Show ' + hiddenTiny + " more " + (hiddenTiny === 1 ? "place" : "places") + " with 1–" + (TINY - 1) + " sales</button>"
        : '<button type="button" class="sn-linkbtn" data-act="tiny">Hide places with 1–' + (TINY - 1) + " sales</button>";
      el.reset.hidden = isDefault();
      if (el.filterBtn) {
        var nf = (state.quarter !== idx.quarters[idx.quarters.length - 1]) + (state.type !== "*") + (state.sort !== "deals");
        var badge = el.filterBtn.querySelector(".sn-badge-n");
        badge.textContent = nf;
        badge.hidden = !nf;
      }
      syncControls();
    }
    // Re-open the detail if its place is still on screen.
    if (openEntity) {
      var card = root.querySelector('.sn-card[data-key="' + cssEsc(openEntity.key) + '"]');
      if (card) openDetail(openEntity, card, true);
      else closeDetail();
    }
    postHeight();
  }

  function isDefault() {
    return !state.county && state.quarter === idx.quarters[idx.quarters.length - 1] && state.type === "*" && !state.q && state.sort === "deals";
  }
  function cssEsc(s) {
    return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"');
  }

  // --------------------------------------------------------------- controls
  function buildControls() {
    el.seg.innerHTML = Object.keys(SCOPES).map(function (k) {
      return '<button type="button" data-scope="' + k + '" aria-pressed="' + (k === scope) + '">' + SCOPES[k].label + "</button>";
    }).join("");
    el.counties.innerHTML = [null].concat(COUNTIES).map(function (c) {
      return '<button type="button" class="sn-pill" data-county="' + (c || "") + '" aria-pressed="false">' + (c || "All counties") + "</button>";
    }).join("");
  }
  function fillSelects() {
    el.quarter.innerHTML = idx.quarters.slice().reverse().map(function (q) {
      return '<option value="' + q + '">' + qLabel(q) + "</option>";
    }).join("");
    el.type.innerHTML = '<option value="*">All types</option>' + idx.types.map(function (t) {
      return '<option value="' + esc(t) + '">' + esc(typeLabel(t)) + "</option>";
    }).join("");
  }
  function syncControls() {
    [].forEach.call(el.seg.children, function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-scope") === scope)); });
    [].forEach.call(el.counties.children, function (b) { b.setAttribute("aria-pressed", String((b.getAttribute("data-county") || null) === state.county)); });
    el.quarter.value = state.quarter;
    el.type.value = state.type;
    el.sort.value = state.sort;
    if (el.search.value !== state.q) el.search.value = state.q;
  }

  function setScope(name) {
    if (!SCOPES[name] || name === scope && idx) return Promise.resolve();
    scope = name;
    closeDetail();
    el.title.textContent = "South Florida Market Snapshots";
    try {
      var u = new URL(location.href);
      u.searchParams.set("scope", name);
      history.replaceState(null, "", u);
    } catch (e) {}
    return loadScope(name).then(function (ix) {
      idx = ix;
      fillSelects();
      if (idx.quarters.indexOf(state.quarter) < 0) state.quarter = idx.quarters[idx.quarters.length - 1];
      if (state.type !== "*" && idx.types.indexOf(state.type) < 0) state.type = "*";
      render();
    });
  }

  if (!dashboard) {
    el.seg.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-scope]");
      if (b) setScope(b.getAttribute("data-scope"));
    });
    el.counties.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-county]");
      if (!b) return;
      state.county = b.getAttribute("data-county") || null;
      render();
    });
    el.quarter.addEventListener("change", function () { state.quarter = el.quarter.value; render(); });
    el.type.addEventListener("change", function () { state.type = el.type.value; render(); });
    el.sort.addEventListener("change", function () { state.sort = el.sort.value; render(); });
    var searchTimer = null;
    el.search.addEventListener("input", function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { state.q = el.search.value; render(); }, 120);
    });
    if (el.filterBtn) el.filterBtn.addEventListener("click", function () {
      var open = !el.controls.classList.contains("is-open");
      el.controls.classList.toggle("is-open", open);
      el.filterBtn.setAttribute("aria-expanded", String(open));
    });
    el.reset.addEventListener("click", function () {
      state = { county: null, quarter: idx.quarters[idx.quarters.length - 1], type: "*", q: "", sort: "deals", showTiny: false };
      closeDetail();
      render();
    });
    el.more.addEventListener("click", function (e) {
      if (!e.target.closest("[data-act=tiny]")) return;
      state.showTiny = !state.showTiny;
      render();
    });
  }

  // ----------------------------------------------------------------- detail
  // Opens inline, right after the card (it spans the grid row; the cards
  // after it backfill — grid-auto-flow: dense), so it works the same in a
  // fixed frame, an auto-height frame or on its own.
  function entityByKey(key) {
    var ents = entities();
    return ents.over.concat(ents.cities).filter(function (e) { return e.key === key; })[0] || null;
  }
  function onCardActivate(card) {
    if (dashboard) {
      window.open(SNAPSHOTS_PAGE, "_blank", "noopener");
      return;
    }
    var key = card.getAttribute("data-key");
    if (openEntity && openEntity.key === key) {
      closeDetail();
      card.focus();
      return;
    }
    var ent = entityByKey(key);
    if (ent) openDetail(ent, card);
  }
  el.results.addEventListener("click", function (e) {
    var act = e.target.closest("[data-act]");
    if (act && act.closest(".sn-detail")) {
      var a = act.getAttribute("data-act");
      if (a === "close") { var k = openEntity && openEntity.key; closeDetail(); focusCard(k); }
      if (a === "csv") downloadCsv();
      return;
    }
    var card = e.target.closest(".sn-card");
    if (card) onCardActivate(card);
  });
  el.results.addEventListener("keydown", function (e) {
    var card = e.target.closest && e.target.closest(".sn-card");
    if (card && e.target === card && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onCardActivate(card);
    }
    if (e.key === "Escape" && openEntity) {
      var k = openEntity.key;
      closeDetail();
      focusCard(k);
    }
  });
  function focusCard(key) {
    var c = key && root.querySelector('.sn-card[data-key="' + cssEsc(key) + '"]');
    if (c) c.focus();
  }

  function series(ent) {
    return idx.quarters.map(function (q) { return { q: q, s: stat(ent, q, state.type) }; });
  }

  function openDetail(ent, card, quiet) {
    destroyCharts();
    var old = root.querySelector(".sn-detail");
    if (old) old.remove();
    [].forEach.call(root.querySelectorAll('.sn-card[aria-expanded="true"]'), function (c) { c.setAttribute("aria-expanded", "false"); });
    openEntity = ent;
    card.setAttribute("aria-expanded", "true");
    var s = stat(ent, state.quarter, state.type);
    var pq = prevQuarter(state.quarter);
    var p = pq && stat(ent, pq, state.type);
    var vs = pq ? " vs " + qLabel(pq) : "";
    function fig(label, v, c) {
      return '<div class="sn-fig"><span class="sn-label">' + label + "</span><b>" + v + "</b>" + (c || "") + "</div>";
    }
    var rows = series(ent).slice().reverse(); // newest first
    var d = document.createElement("section");
    d.className = "sn-detail";
    d.id = "sn-detail";
    d.setAttribute("aria-label", ent.name + " quarterly history");
    d.innerHTML =
      '<div class="sn-detail-top"><div><h3>' + esc(ent.name) + '</h3><div class="sn-sub">' + esc(ent.sub) + " · " + esc(typeLabel(state.type)) + " · " + qLabel(state.quarter) + "</div></div>" +
      '<div class="sn-detail-actions"><button type="button" class="sn-btn" data-act="csv">Download CSV</button>' +
      '<button type="button" class="sn-btn sn-x" data-act="close" aria-label="Close history">×</button></div></div>' +
      (s ? '<div class="sn-figs">' +
        fig("Median price", money(s.median), chg(p && pct(s.median, p.median), vs)) +
        fig("Sales", num(s.deals), chg(p && pct(s.deals, p.deals), vs)) +
        fig("Volume", money(s.volume), chg(p && pct(s.volume, p.volume), vs)) +
        fig("Average price", money(s.avg), chg(p && pct(s.avg, p.avg), vs)) + "</div>" : "") +
      '<div class="sn-charts">' +
      '<div class="sn-chart"><h4>Sales per quarter</h4><div class="sn-chart-box"><canvas aria-label="Sales per quarter, ' + esc(ent.name) + '" role="img"></canvas></div></div>' +
      '<div class="sn-chart"><h4>Price per quarter</h4><p class="sn-legend"><span><i></i>Median</span><span><i class="is-avg"></i>Average</span></p>' +
      '<div class="sn-chart-box"><canvas aria-label="Median and average price per quarter, ' + esc(ent.name) + '" role="img"></canvas></div></div>' +
      "</div>" +
      '<div class="sn-table-wrap"><table class="sn-table"><thead><tr><th scope="col">Quarter</th><th scope="col">Sales</th><th scope="col">Volume</th><th scope="col">Median</th><th scope="col">Average</th></tr></thead><tbody>' +
      rows.map(function (r, i) {
        var before = rows[i + 1] && rows[i + 1].s;
        function cell(v, f, key) {
          if (!r.s) return "<td>–</td>";
          var pc = before ? pct(r.s[key], before[key]) : null;
          var arrow = pc == null || Math.round(pc * 100) === 0 ? "" : pc > 0 ? '<i class="up" aria-label="up">▲</i>' : '<i class="down" aria-label="down">▼</i>';
          return "<td>" + f(v) + arrow + "</td>";
        }
        return '<tr' + (r.q === state.quarter ? ' class="is-sel"' : "") + "><td>" + qLabel(r.q) + "</td>" +
          cell(r.s && r.s.deals, num, "deals") + cell(r.s && r.s.volume, money, "volume") +
          cell(r.s && r.s.median, money, "median") + cell(r.s && r.s.avg, money, "avg") + "</tr>";
      }).join("") +
      "</tbody></table></div>";
    card.insertAdjacentElement("afterend", d);
    renderCharts();
    if (!quiet) scrollToDetail(d);
    postHeight();
  }

  // Scroll only this frame's own page so the history's title sits just
  // below the pinned header. (scrollIntoView would also scroll the TRD
  // article around the frame and tuck the title under the site's fixed
  // navigation bar.)
  function scrollToDetail(d) {
    var head = root.querySelector(".sn-head");
    var offset = (head && getComputedStyle(head).position === "sticky" ? head.offsetHeight : 0) + 8;
    var top = d.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function closeDetail() {
    destroyCharts();
    var d = root.querySelector(".sn-detail");
    if (d) d.remove();
    [].forEach.call(root.querySelectorAll('.sn-card[aria-expanded="true"]'), function (c) { c.setAttribute("aria-expanded", "false"); });
    openEntity = null;
    postHeight();
  }
  function destroyCharts() {
    charts.forEach(function (c) { c.destroy(); });
    charts = [];
  }

  function token(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  }
  function renderCharts() {
    destroyCharts();
    var d = root.querySelector(".sn-detail");
    if (!d || !openEntity || typeof Chart !== "function") return;
    var data = series(openEntity);
    var labels = data.map(function (x) { return qLabel(x.q, true); });
    var c = { series: token("--sn-series"), soft: token("--sn-series-soft"), text: token("--sn-text-2"), muted: token("--sn-text-3"), grid: token("--sn-border"), font: token("--sn-font") };
    var tick = { color: c.muted, font: { family: c.font, size: 11 } };
    var common = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { titleFont: { family: c.font }, bodyFont: { family: c.font } },
      },
      scales: {
        x: { grid: { display: false }, ticks: Object.assign({ maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, tick), border: { color: c.grid } },
      },
    };
    var canvases = d.querySelectorAll("canvas");
    // Label the selected quarter's value right on the chart.
    var selIdx = data.map(function (x) { return x.q; }).indexOf(state.quarter);
    function labelPlugin(fmtFn) {
      return {
        id: "snSelLabel",
        afterDatasetsDraw: function (chart) {
          if (selIdx < 0) return;
          var meta = chart.getDatasetMeta(0), pt = meta.data[selIdx], v = chart.data.datasets[0].data[selIdx];
          if (!pt || v == null) return;
          var ctx = chart.ctx, text = fmtFn(v);
          ctx.save();
          ctx.font = "700 11px " + c.font;
          ctx.fillStyle = c.text;
          var w = ctx.measureText(text).width;
          var x = Math.min(Math.max(pt.x, chart.chartArea.left + w / 2), chart.chartArea.right - w / 2);
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(text, x, Math.max(chart.chartArea.top + 11, pt.y - 6));
          ctx.restore();
        },
      };
    }
    var sel = data.map(function (x) { return x.q === state.quarter; });
    charts.push(new Chart(canvases[0], {
      type: "bar",
      data: { labels: labels, datasets: [{ label: "Sales", data: data.map(function (x) { return x.s ? x.s.deals : null; }),
        backgroundColor: sel.map(function (on) { return on ? c.series : c.soft; }), borderRadius: 3, maxBarThickness: 18 }] },
      plugins: [labelPlugin(num)],
      options: Object.assign({}, common, {
        plugins: Object.assign({}, common.plugins, { tooltip: Object.assign({}, common.plugins.tooltip, {
          callbacks: { title: function (it) { return qLabel(data[it[0].dataIndex].q); }, label: function (it) { return " " + num(it.raw) + " sales"; } } }) }),
        scales: { x: common.scales.x, y: { beginAtZero: true, grace: "14%", grid: { color: c.grid }, border: { display: false }, ticks: Object.assign({ maxTicksLimit: 5, precision: 0, callback: function (v) { return num(v); } }, tick) } },
      }),
    }));
    charts.push(new Chart(canvases[1], {
      type: "line",
      data: { labels: labels, datasets: [
        { label: "Median", data: data.map(function (x) { return x.s ? x.s.median : null; }), borderColor: c.series, backgroundColor: c.series,
          borderWidth: 2, tension: 0, pointRadius: sel.map(function (on) { return on ? 4 : 0; }), pointHoverRadius: 4, spanGaps: true },
        { label: "Average", data: data.map(function (x) { return x.s ? x.s.avg : null; }), borderColor: c.muted, backgroundColor: c.muted,
          borderWidth: 2, borderDash: [5, 4], tension: 0, pointRadius: 0, pointHoverRadius: 4, spanGaps: true },
      ] },
      plugins: [labelPlugin(money)],
      options: Object.assign({}, common, {
        plugins: Object.assign({}, common.plugins, { tooltip: Object.assign({}, common.plugins.tooltip, {
          callbacks: { title: function (it) { return qLabel(data[it[0].dataIndex].q); }, label: function (it) { return " " + it.dataset.label + ": " + money(it.raw); } } }) }),
        scales: { x: common.scales.x, y: { grace: "14%", grid: { color: c.grid }, border: { display: false }, ticks: Object.assign({ maxTicksLimit: 5, callback: function (v) { return money(v); } }, tick) } },
      }),
    }));
  }

  function downloadCsv() {
    if (!openEntity) return;
    var lines = [["Quarter", "Place", "County", "Property type", "Sales", "Volume", "Median price", "Average price"]];
    series(openEntity).forEach(function (x) {
      if (!x.s) return;
      lines.push([qLabel(x.q), openEntity.name, openEntity.county || "", typeLabel(state.type), x.s.deals, Math.round(x.s.volume), Math.round(x.s.median), Math.round(x.s.avg)]);
    });
    var csv = lines.map(function (r) {
      return r.map(function (v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(",");
    }).join("\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "trd-snapshots-" + norm(openEntity.name).replace(/ /g, "-") + "-" + (state.type === "*" ? scope : norm(typeLabel(state.type)).replace(/ /g, "-")) + ".csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  // ----------------------------------------------------- height for TRD pages
  // The TRD dashboard grows the card's frame to this height (min-height).
  function postHeight() {
    var h = el.results.offsetHeight;
    var origin = location.origin === "https://trd-digital.github.io" ? "https://therealdeal.com" : "http://localhost:3010";
    try {
      window.parent.postMessage({ updateHeight: h + 10, src: location.href }, origin);
    } catch (e) {}
  }
  window.addEventListener("resize", postHeight);
  window.addEventListener("load", postHeight);
  window.addEventListener("message", function (e) {
    if (e.data && (e.data.setTheme || e.data.theme)) return; // theme.js handles these
    postHeight();
  });

  // Header (title, quarter + source line, scope switch) is pinned to the top
  // of the frame (CSS); a shadow shows once content scrolls under it.
  var head = root.querySelector(".sn-head");
  if (!dashboard && head) {
    window.addEventListener("scroll", function () {
      head.classList.toggle("is-stuck", window.scrollY > 4); // the header starts at the top
    }, { passive: true });
    // Scrolled-to content (an opened history) lands below the pinned header.
    var pad = function () { document.documentElement.style.scrollPaddingTop = head.offsetHeight + 8 + "px"; };
    if (window.ResizeObserver) new ResizeObserver(pad).observe(head);
    pad();
  }

  // ------------------------------------------------------------------- boot
  buildControls();
  // Placeholder cards while the data loads, so the layout doesn't jump.
  var skel = function (n) { return new Array(n + 1).join('<div class="sn-card sn-skel" aria-hidden="true"><i></i><i></i><i></i></div>'); };
  el.overview.innerHTML = skel(4);
  if (!dashboard) el.overview.firstChild.classList.add("sn-lead");
  if (!dashboard) el.cities.innerHTML = skel(10);
  setScope(scope).catch(function () {
    el.overview.innerHTML = '<p class="sn-empty">The snapshot data couldn’t load. Please try again later.</p>';
  });
})();
