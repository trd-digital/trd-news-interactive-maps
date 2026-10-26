/*!
 * pm-table.js — South Florida building permits table (one row per site).
 * Depends on: TRD theme.js, pm-core.js (PM).
 */
(function () {
  "use strict";

  var PAGE_SIZE = 25;
  var fmt = PM.fmt;
  var track = PM.tracker("sofla-permits-table");
  var params = new URLSearchParams(location.search);
  var app = PM.root(document.currentScript);

  var state = PM.stateFromUrl();
  var data = null;
  var rows = [];
  var view = params.get("tab") === "area" ? "area" : "list";
  var sort = params.get("tab") === "latest" ? { key: "date", dir: -1 } : { key: "value", dir: -1 };
  var areaSort = { key: "value", dir: -1 };
  var page = 0;
  var openId = null;

  PM.theme(null, track);

  var el = {
    kpis: app.querySelector(".cx-kpis"),
    searchbar: app.querySelector(".tx-searchbar"),
    filters: app.querySelector(".tx-filters"),
    searchWrap: app.querySelector(".tx-search-wrap"),
    results: app.querySelector(".tx-results"),
    chips: app.querySelector(".tx-active"),
    filterHost: app.querySelector(".tx-filter-host"),
    filterToggle: app.querySelector(".tx-filter-toggle"),
    tabs: app.querySelector(".tx-tabs"),
    summary: app.querySelector(".tx-summary"),
    asof: app.querySelector(".tx-asof"),
    table: app.querySelector(".tx-table"),
    thead: app.querySelector(".tx-table thead"),
    tbody: app.querySelector(".tx-table tbody"),
    cards: app.querySelector(".tx-cards"),
    area: app.querySelector(".tx-area"),
    pager: app.querySelector(".tx-pager"),
    loading: app.querySelector(".tx-loading"),
  };

  // ---------------------------------------------------------------- search
  el.searchWrap.insertAdjacentHTML("afterbegin", PM.searchHtml(state.q, window.innerWidth < 520 ? "Search permits" : "Search address, city, owner or permit #"));
  var input = el.searchWrap.querySelector(".tx-search-input");
  var box = PM.searchBox({
    input: input,
    panel: el.results,
    getData: function () { return data; },
    onQuery: function (q) {
      var s = PM.clone(state);
      s.q = q;
      onFilterChange(s, "search");
    },
    onPick: function (it) {
      var s = PM.clone(state);
      track("search_pick", it.kind);
      if (it.kind === "city" || it.kind === "hood") {
        if (it.kind === "city") { s.city = it.value; s.hood = null; } else s.hood = it.value;
        s.q = "";
        input.value = "";
        view = "list";
        onFilterChange(s, it.kind);
      } else if (it.kind === "owner") {
        s.q = it.value;
        input.value = it.value;
        onFilterChange(s, "owner");
      } else if (it.kind === "project") {
        reveal(it.row.id);
        if (it.row.located) peer.send("select", it.row.id);
      }
    },
  });

  var filters = PM.filterBar(el.filterHost, function () { return PM.clone(state); }, onFilterChange, {
    getData: function () { return data; },
  });
  el.filterToggle.addEventListener("click", function () {
    // Pinned, the filters have scrolled away: open them and scroll back.
    var stuck = el.searchbar.classList.contains("is-stuck");
    var open = stuck || !el.filters.classList.contains("is-open");
    el.filters.classList.toggle("is-open", open);
    el.filterToggle.setAttribute("aria-expanded", String(open));
    if (stuck) scrollToEl(el.searchbar, 0);
    if (open) track("filters", "open");
  });

  // Scroll this frame only. (scrollIntoView would also scroll the TRD
  // article around the frame.)
  function scrollToEl(node, offset) {
    var y = node.getBoundingClientRect().top + window.scrollY - (offset || 0);
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }

  // Pinned search row: publish its height, mark it while stuck.
  (function pinSearchbar() {
    var bar = el.searchbar, root = document.documentElement, queued = false;
    function measure() { root.style.setProperty("--tx-bar-h", bar.offsetHeight + "px"); }
    function check() {
      queued = false;
      bar.classList.toggle("is-stuck", window.scrollY > 0 && bar.getBoundingClientRect().top <= 0.5);
    }
    window.addEventListener("scroll", function () {
      if (!queued) { queued = true; requestAnimationFrame(check); }
    }, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(measure).observe(bar);
    else window.addEventListener("resize", measure);
    measure();
    check();
  })();

  function onFilterChange(next, why) {
    state = next;
    if (why !== "search") {
      box.set(state.q);
      if (!state.q) input.value = "";
      track("filter", why);
    }
    page = 0;
    openId = null;
    refresh();
    peer.send("filters", PM.clone(state));
  }

  // ------------------------------------------------------------------ tabs
  el.tabs.addEventListener("click", function (e) {
    var b = e.target.closest(".tx-tab");
    if (!b) return;
    var tab = b.getAttribute("data-tab");
    view = tab === "area" ? "area" : "list";
    if (tab !== "area") sort = tab === "biggest" ? { key: "value", dir: -1 } : { key: "date", dir: -1 };
    page = 0;
    track("tab", tab);
    refresh();
  });
  function renderTabs() {
    el.tabs.querySelectorAll(".tx-tab").forEach(function (b) {
      var tab = b.getAttribute("data-tab");
      var on = tab === "area" ? view === "area" : view === "list" && sort.dir === -1 && sort.key === (tab === "biggest" ? "value" : "date");
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });
  }

  // ------------------------------------------------------------------ sort
  var COLS = [
    { key: "date", label: "Latest permit", sortable: true },
    { key: "address", label: "Property", sortable: true },
    { key: "work", label: "Work", sortable: true, cls: "cx-col-type" },
    { key: "size", label: "Size", sortable: true },
    { key: "value", label: "Est. cost", sortable: true, num: true },
    { key: "newSqft", label: "New sq ft", sortable: true, num: true },
    { key: "permitCount", label: "Permits", sortable: true, num: true, cls: "cx-col-units" },
    { key: "status", label: "Status", sortable: true, cls: "cx-col-status" },
  ];
  var SIZE_RANK = { major: 3, mid: 2, small: 1, minor: 0, nocost: 0 };
  function sortVal(r, k) {
    if (k === "size") return SIZE_RANK[r.size] * 1e12 + (r.value || 0);
    if (k === "work") return PM.workLabel(r.work);
    return r[k];
  }
  function compare(a, b) {
    var k = sort.key, d = sort.dir, va = sortVal(a, k), vb = sortVal(b, k);
    if (va == null && vb == null) return tieBreak(a, b);
    if (va == null) return 1; // blanks last either way
    if (vb == null) return -1;
    var c = typeof va === "string" ? va.localeCompare(vb) : va === vb ? 0 : va < vb ? -1 : 1;
    return c ? c * d : tieBreak(a, b);
  }
  function tieBreak(a, b) {
    return sort.key === "date" ? (b.value || 0) - (a.value || 0) : b.date < a.date ? -1 : b.date > a.date ? 1 : 0;
  }
  function renderHead() {
    el.thead.innerHTML = "<tr>" + COLS.map(function (c) {
      var cls = c.num || c.cls ? ' class="' + [c.num ? "num" : "", c.cls || ""].join(" ").trim() + '"' : "";
      var active = sort.key === c.key;
      var aria = active ? ' aria-sort="' + (sort.dir < 0 ? "descending" : "ascending") + '"' : "";
      return '<th scope="col"' + cls + aria + '><button type="button" data-sort="' + c.key + '">' + c.label +
        '<span class="tx-sort-ind" aria-hidden="true">' + (active ? (sort.dir < 0 ? "▼" : "▲") : "") + "</span></button></th>";
    }).join("") + "</tr>";
  }
  el.thead.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-sort]");
    if (!b) return;
    var k = b.getAttribute("data-sort");
    var numeric = ["date", "value", "newSqft", "permitCount", "size"].indexOf(k) >= 0;
    sort = sort.key === k ? { key: k, dir: -sort.dir } : { key: k, dir: numeric ? -1 : 1 };
    page = 0;
    track("sort", k);
    refresh();
  });

  // ------------------------------------------------------------------ render
  function refresh() {
    if (!data) return;
    rows = PM.apply(data.rows, state, data.asOf).sort(compare);
    var pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (page >= pages) page = pages - 1;
    renderTabs();
    renderHead();
    renderKpis();
    renderSummary();
    el.table.hidden = view === "area";
    el.cards.hidden = view === "area";
    el.pager.hidden = view === "area";
    el.area.hidden = view !== "area";
    if (view === "area") renderArea();
    PM.activeChips(el.chips, state, function (s, why) {
      onFilterChange(s, why);
    });
    filters.render(); // always shown on desktop; collapsible on phones
    var n = PM.filterCount(state);
    var badge = el.filterToggle.querySelector(".tx-badge");
    badge.hidden = !n;
    badge.textContent = n;
    renderBody();
    renderPager(pages);
    el.asof.textContent = PM.asOfText(data) + " “Minor work” is work under $100,000 or with no cost given, such as repairs, unit remodels and trade permits. Floor area and units count only for new buildings and additions.";
  }

  function renderKpis() {
    var s = PM.summary(rows);
    var bySize = {};
    rows.forEach(function (r) { bySize[r.size] = (bySize[r.size] || 0) + 1; });
    var mix = PM.SIZES.filter(function (z) { return bySize[z.id]; }).map(function (z) {
      return '<i class="cx-size-bar" style="width:' + (bySize[z.id] / rows.length * 100).toFixed(2) + "%;background:var(--cx-" + z.id + ')" title="' +
        fmt.escape(z.long + ": " + bySize[z.id].toLocaleString("en-US")) + '"></i>';
    }).join("");
    var big = (bySize.major || 0) + (bySize.mid || 0);
    var jobs = rows.reduce(function (n, r) { return n + r.jobs.length; }, 0);
    el.kpis.innerHTML =
      kpi("Sites", s.count.toLocaleString("en-US"), big ? PM.plural(big, "major or mid-size", "major or mid-size") : "&nbsp;", rows.length ? '<span class="cx-mix" aria-hidden="true">' + mix + "</span>" : "") +
      kpi("Estimated cost", s.value ? fmt.moneyShort(s.value) : "—", s.value ? "Sum of job estimates" : "No costs listed") +
      kpi("New floor area", s.sqft ? fmt.numShort(s.sqft) + " sq ft" : "—", "New buildings and additions") +
      kpi("Permits", s.permits.toLocaleString("en-US"), jobs ? "Combined into " + PM.plural(jobs, "job") : "&nbsp;");
  }
  function kpi(label, value, sub, extra) {
    return '<div class="cx-kpi"><span class="cx-kpi-label">' + label + '</span><span class="cx-kpi-value">' + value + "</span>" +
      '<span class="cx-kpi-sub">' + sub + "</span>" + (extra || "") + "</div>";
  }

  function renderSummary() {
    var since = PM.since(state, data.asOf);
    el.summary.innerHTML = "<strong>" + PM.plural(rows.length, "site") + "</strong>" +
      (state.hood ? " in " + fmt.escape(state.hood) : state.city ? " in " + fmt.escape(state.city) : "") +
      (since ? " · latest permit since " + fmt.date(since, { month: "short", day: "numeric" }) : "");
  }

  function sizeCell(r) {
    return '<span class="cx-size cx-size-' + r.size + '">' + PM.SIZES[PM.SIZE_IDS.indexOf(r.size)].label + "</span>";
  }
  function workCell(r) {
    return '<span class="tx-cat"><i class="tx-swatch pm-swatch-' + r.work + '"></i>' + PM.workLabel(r.work).replace(/ or .*/, "") + "</span>";
  }
  function expandBody(r) {
    var img = PM.aerialUrl(r, 240, 130);
    var facts = PM.facts(r);
    return '<div class="tx-expand-grid">' +
      (img ? '<img class="tx-expand-img" loading="lazy" alt="Satellite view of ' + fmt.escape(r.address || "the site") + '" src="' + fmt.escape(img) + '">' : "") +
      '<div><dl class="tx-facts">' + facts.map(function (x) { return "<div><dt>" + x[0] + "</dt><dd>" + x[1] + "</dd></div>"; }).join("") + "</dl>" +
      PM.jobsHtml(r, 8) + actions(r) + "</div></div>";
  }
  function actions(r) {
    var out = "";
    if (r.parcelUrl) out += '<a class="tx-btn" href="' + fmt.escape(r.parcelUrl) + '" target="_blank" rel="noopener">Property record ↗</a>';
    if (r.located && peer.hasPeer("map")) out += '<button type="button" class="tx-btn" data-act="map" data-id="' + fmt.escape(r.id) + '">Show on map</button>';
    return out ? '<div class="tx-actions">' + out + "</div>" : "";
  }

  function renderBody() {
    var slice = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    if (!slice.length) {
      var msg = (state.q ? "No permits match “" + fmt.escape(state.q) + "”" + (PM.filterCount(state) ? " with these filters." : ".") : "No permits match these filters.") +
        (PM.isDefault(state) && state.sizes.indexOf("minor") >= 0 ? "" : ' <button type="button" class="tx-reset" data-act="widen">Search all permits, including minor work</button>');
      el.tbody.innerHTML = '<tr><td class="tx-empty" colspan="' + COLS.length + '">' + msg + "</td></tr>";
      el.cards.innerHTML = '<li class="tx-empty">' + msg + "</li>";
      return;
    }
    var html = "", cards = "";
    slice.forEach(function (r) {
      var open = r.id === openId;
      var addr = r.address ? fmt.escape(r.address) : '<span class="tx-muted">Address unavailable</span>';
      var place = fmt.escape(PM.placeLine(r) + (r.units.length === 1 ? " · Unit " + r.units[0] : r.units.length > 1 ? " · " + r.units.length + " units" : ""));
      html += '<tr class="tx-row' + (open ? " is-open" : "") + '" data-id="' + fmt.escape(r.id) + '" tabindex="0" aria-expanded="' + open + '">' +
        '<td class="tx-nowrap">' + fmt.date(r.date) + "</td>" +
        '<td><span class="tx-addr">' + addr + '<span class="tx-addr-sub">' + place + "</span></span></td>" +
        '<td class="cx-col-type">' + workCell(r) + "</td>" +
        '<td class="cx-size-cell">' + sizeCell(r) + "</td>" +
        '<td class="num"><strong>' + (r.value ? fmt.moneyShort(r.value) : '<span class="cx-dim">—</span>') + "</strong></td>" +
        '<td class="num">' + (r.newSqft ? fmt.num(r.newSqft) : '<span class="cx-dim">—</span>') + "</td>" +
        '<td class="num cx-col-units">' + fmt.num(r.permitCount) + "</td>" +
        '<td class="cx-col-status">' + (r.status ? fmt.escape(r.status) : '<span class="cx-dim">—</span>') + "</td></tr>";
      if (open) html += '<tr class="tx-expand"><td colspan="' + COLS.length + '">' + expandBody(r) + "</td></tr>";

      var meta = [r.newSqft ? fmt.numShort(r.newSqft) + " sq ft new" : "", r.permitCount > 1 ? PM.plural(r.permitCount, "permit") : "", r.status || ""].filter(Boolean);
      cards += '<li class="tx-card" data-id="' + fmt.escape(r.id) + '"><div class="tx-card-top"><span class="tx-addr">' + addr +
        '<span class="tx-addr-sub">' + place + "</span></span>" +
        '<span class="tx-card-price">' + (r.value ? fmt.moneyShort(r.value) : "—") + "</span></div>" +
        '<div class="tx-card-meta"><span>' + fmt.date(r.date) + "</span>" + workCell(r) + sizeCell(r) +
        (meta.length ? "<span>" + fmt.escape(meta.join(" · ")) + "</span>" : "") + "</div>" +
        "<details" + (open ? " open" : "") + "><summary>Details</summary>" + expandBody(r) + "</details></li>";
    });
    el.tbody.innerHTML = html;
    el.cards.innerHTML = cards;
  }

  // ---------------------------------------------------------------- by city
  // By city; inside one city (or the City of Miami), by neighborhood.
  var AREA_COLS = [
    { key: "name", label: "Area" },
    { key: "count", label: "Sites", num: true },
    { key: "value", label: "Est. cost", num: true },
    { key: "sqft", label: "New sq ft", num: true },
    { key: "top", label: "Largest project" },
  ];
  function renderArea() {
    var by = {};
    var byHood = !!state.city && (state.city === "Miami" || state.city === "Unincorporated Miami-Dade");
    rows.forEach(function (r) {
      var k = byHood ? r.hood || (state.city === "Miami" ? "Miami (no neighborhood)" : "No census place") : r.city || "City not known";
      var a = by[k] || (by[k] = { name: k, hood: byHood ? r.hood : null, cityName: byHood ? null : r.city, count: 0, value: 0, sqft: 0, top: null });
      a.count++;
      a.value += r.value || 0;
      a.sqft += r.newSqft || 0;
      if (!a.top || (r.value || 0) > (a.top.value || 0)) a.top = r;
    });
    var list = Object.keys(by).map(function (k) { return by[k]; });
    list.sort(function (a, b) {
      var k = areaSort.key;
      if (k === "name") return a.name.localeCompare(b.name) * areaSort.dir;
      if (k === "top") return ((a.top.value || 0) - (b.top.value || 0)) * areaSort.dir;
      return (a[k] - b[k]) * areaSort.dir || b.count - a.count;
    });
    el.area.innerHTML = '<table class="tx-table tx-area-table cx-hood-table"><thead><tr>' + AREA_COLS.map(function (c) {
      var active = areaSort.key === c.key;
      return '<th scope="col"' + (c.num ? ' class="num"' : "") + (active ? ' aria-sort="' + (areaSort.dir < 0 ? "descending" : "ascending") + '"' : "") +
        '><button type="button" data-asort="' + c.key + '">' + c.label + '<span class="tx-sort-ind" aria-hidden="true">' + (active ? (areaSort.dir < 0 ? "▼" : "▲") : "") + "</span></button></th>";
    }).join("") + "</tr></thead><tbody>" + list.map(function (a) {
      var pick = a.hood ? '<button type="button" data-hood="' + fmt.escape(a.hood) + '">' + fmt.escape(a.name) + "</button>"
        : a.cityName ? '<button type="button" data-city="' + fmt.escape(a.cityName) + '">' + fmt.escape(a.name) + "</button>" : '<span class="tx-muted">' + fmt.escape(a.name) + "</span>";
      return "<tr><td>" + pick + "</td>" +
        '<td class="num">' + a.count.toLocaleString("en-US") + "</td>" +
        '<td class="num"><strong>' + fmt.moneyShort(a.value) + "</strong></td>" +
        '<td class="num">' + (a.sqft ? fmt.numShort(a.sqft) : "—") + "</td>" +
        "<td>" + fmt.escape(a.top.address || "—") + ' <span class="tx-muted">' + (a.top.value ? fmt.moneyShort(a.top.value) : "") + "</span></td></tr>";
    }).join("") + '</tbody></table><p class="tx-area-note"><span class="tx-muted">' + (byHood
      ? (state.city === "Miami" ? "Neighborhoods are the City of Miami’s." : "Areas are census-designated places.") + " Tap a name to filter to it."
      : "Miami-Dade cities come from the property’s folio number. Pick Miami or Unincorporated Miami-Dade to see neighborhoods; tap a name to filter to it.") + "</span></p>";
  }
  el.area.addEventListener("click", function (e) {
    var s = e.target.closest("[data-asort]");
    if (s) {
      var k = s.getAttribute("data-asort");
      areaSort = areaSort.key === k ? { key: k, dir: -areaSort.dir } : { key: k, dir: k === "name" ? 1 : -1 };
      renderArea();
      return;
    }
    var b = e.target.closest("[data-hood], [data-city]");
    if (!b) return;
    var ns = PM.clone(state);
    if (b.hasAttribute("data-city")) {
      // Picking a city drills in: neighborhoods for Miami and the county.
      ns.city = b.getAttribute("data-city");
      ns.hood = null;
      if (ns.city !== "Miami" && ns.city !== "Unincorporated Miami-Dade") view = "list";
      track("area_pick", ns.city);
      onFilterChange(ns, "city");
      return;
    }
    ns.hood = b.getAttribute("data-hood");
    view = "list";
    track("area_pick", ns.hood);
    onFilterChange(ns, "hood");
  });

  // ------------------------------------------------------------------ pager
  function renderPager(pages) {
    var from = rows.length ? page * PAGE_SIZE + 1 : 0, to = Math.min(rows.length, (page + 1) * PAGE_SIZE);
    var nums = pageNumbers(page, pages);
    el.pager.innerHTML = "<span>" + from.toLocaleString("en-US") + "–" + to.toLocaleString("en-US") + " of " + rows.length.toLocaleString("en-US") + "</span>" +
      '<nav class="tx-pages" aria-label="Pages">' +
      '<button type="button" class="tx-chip" data-page="' + (page - 1) + '"' + (page === 0 ? " disabled" : "") + ' aria-label="Previous page">‹</button>' +
      nums.map(function (n) {
        return n === "…" ? '<span class="tx-muted" aria-hidden="true">…</span>'
          : '<button type="button" class="tx-chip' + (n === page ? " is-active" : "") + '" data-page="' + n + '"' + (n === page ? ' aria-current="page"' : "") + ">" + (n + 1) + "</button>";
      }).join("") +
      '<button type="button" class="tx-chip" data-page="' + (page + 1) + '"' + (page >= pages - 1 ? " disabled" : "") + ' aria-label="Next page">›</button></nav>';
  }
  function pageNumbers(p, n) {
    if (n <= 7) return Array.from({ length: n }, function (_, i) { return i; });
    var out = [0], a = Math.max(1, p - 1), b = Math.min(n - 2, p + 1);
    if (a > 1) out.push("…");
    for (var i = a; i <= b; i++) out.push(i);
    if (b < n - 2) out.push("…");
    out.push(n - 1);
    return out;
  }
  el.pager.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-page]");
    if (!b || b.disabled) return;
    page = +b.getAttribute("data-page");
    openId = null;
    refresh();
    scrollToEl(el.table, el.searchbar.offsetHeight);
  });

  // ------------------------------------------------------------------ rows
  function cssEscape(s) {
    return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"');
  }
  function toggleRow(id) {
    openId = openId === id ? null : id;
    if (openId) track("expand", id);
    renderBody();
  }
  el.tbody.addEventListener("click", function (e) {
    if (handleAction(e)) return;
    if (e.target.closest("a, summary, details")) return;
    var tr = e.target.closest("tr.tx-row");
    if (tr) toggleRow(tr.getAttribute("data-id"));
  });
  el.tbody.addEventListener("keydown", function (e) {
    var tr = e.target.closest("tr.tx-row");
    if (tr && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      toggleRow(tr.getAttribute("data-id"));
      var again = el.tbody.querySelector('tr.tx-row[data-id="' + cssEscape(tr.getAttribute("data-id")) + '"]');
      if (again) again.focus();
    }
  });
  el.cards.addEventListener("click", handleAction);
  function handleAction(e) {
    var b = e.target.closest("[data-act]");
    if (!b) return false;
    var act = b.getAttribute("data-act");
    if (act === "map") {
      peer.send("select", b.getAttribute("data-id"));
      track("show_on_map", b.getAttribute("data-id"));
    } else if (act === "widen") {
      var w = PM.defaultState();
      w.q = state.q;
      w.sizes = PM.SIZE_IDS.slice();
      onFilterChange(w, "widen");
    }
    return true;
  }

  // Show one project: widen filters if they hide it, then open its row.
  function reveal(id) {
    var r = data && data.byId[id];
    if (!r) return;
    if (!PM.apply([r], state, data.asOf).length) {
      var s = PM.defaultState();
      s.sizes = PM.SIZE_IDS.slice();
      state = s;
      box.set("");
      input.value = "";
      peer.send("filters", PM.clone(state));
    }
    view = "list";
    refresh();
    var i = rows.findIndex(function (x) { return x.id === id; });
    if (i < 0) return;
    page = Math.floor(i / PAGE_SIZE);
    openId = id;
    renderBody();
    renderPager(Math.max(1, Math.ceil(rows.length / PAGE_SIZE)));
    var tr = el.tbody.querySelector('tr.tx-row[data-id="' + cssEscape(id) + '"]') || el.cards.querySelector('li[data-id="' + cssEscape(id) + '"]');
    if (tr && tr.offsetParent) scrollToEl(tr, el.searchbar.offsetHeight + 60);
  }

  // ------------------------------------------------------------------ peer
  var peer = PM.link("table", function (msg) {
    if (!data) return;
    if (msg.type === "filters" && msg.payload) {
      state = msg.payload;
      box.set(state.q);
      input.value = state.q || "";
      page = 0;
      refresh();
    } else if (msg.type === "reveal") {
      reveal(msg.payload);
    } else if (msg.type === "hello" && !PM.isDefault(state)) {
      peer.send("filters", PM.clone(state));
    }
  });

  // ------------------------------------------------------------------ boot
  PM.load().then(function (d) {
    data = d;
    PM.resolveCity(state, data);
    el.loading.hidden = true;
    refresh();
    track("loaded", data.rows.length);
  }).catch(function () {
    el.loading.innerHTML = "<span>Building permits couldn’t load. Please try again later.</span>";
  });
})();
