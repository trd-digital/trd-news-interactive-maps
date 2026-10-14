/*!
 * cx-table.js — South Florida construction pipeline table.
 * Depends on: TRD theme.js, cx-core.js (CX).
 */
(function () {
  "use strict";

  var PAGE_SIZE = 25;
  var fmt = CX.fmt;
  var track = CX.tracker("miami-construction-table");
  var params = new URLSearchParams(location.search);
  var app = document.getElementById("tx-app");

  var state = CX.stateFromUrl();
  var data = null;
  var rows = [];
  var view = params.get("tab") === "area" ? "area" : "list";
  var sort = params.get("tab") === "latest" ? { key: "date", dir: -1 } : { key: "value", dir: -1 };
  var areaSort = { key: "value", dir: -1 };
  var page = 0;
  var openId = null;

  CX.theme(null, track);

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
  el.searchWrap.insertAdjacentHTML("afterbegin", CX.searchHtml(state.q, window.innerWidth < 520 ? "Search projects" : "Search address, neighborhood, builder or permit #"));
  var input = el.searchWrap.querySelector(".tx-search-input");
  var box = CX.searchBox({
    input: input,
    panel: el.results,
    getData: function () { return data; },
    onQuery: function (q) {
      var s = CX.clone(state);
      s.q = q;
      onFilterChange(s, "search");
    },
    onPick: function (it) {
      var s = CX.clone(state);
      track("search_pick", it.kind);
      if (it.kind === "hood") {
        s.hood = it.value;
        s.q = "";
        input.value = "";
        view = "list";
        onFilterChange(s, "hood");
      } else if (it.kind === "firm") {
        s.q = it.value;
        input.value = it.value;
        onFilterChange(s, "firm");
      } else if (it.kind === "project") {
        reveal(it.row.id);
        if (it.row.located) peer.send("select", it.row.id);
      }
    },
  });

  var filters = CX.filterBar(el.filterHost, function () { return CX.clone(state); }, onFilterChange, {
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
    peer.send("filters", CX.clone(state));
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
    { key: "type", label: "Type", sortable: true, cls: "cx-col-type" },
    { key: "size", label: "Size", sortable: true },
    { key: "value", label: "Est. cost", sortable: true, num: true },
    { key: "sqft", label: "Sq ft", sortable: true, num: true },
    { key: "units", label: "Units", sortable: true, num: true, cls: "cx-col-units" },
    { key: "status", label: "Status", sortable: true, cls: "cx-col-status" },
  ];
  var SIZE_RANK = { major: 3, mid: 2, small: 1, minor: 0 };
  function sortVal(r, k) {
    if (k === "size") return SIZE_RANK[r.size] * 1e12 + (r.value || 0);
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
    var numeric = ["date", "value", "sqft", "units", "size"].indexOf(k) >= 0;
    sort = sort.key === k ? { key: k, dir: -sort.dir } : { key: k, dir: numeric ? -1 : 1 };
    page = 0;
    track("sort", k);
    refresh();
  });

  // ------------------------------------------------------------------ render
  function refresh() {
    if (!data) return;
    rows = CX.apply(data.rows, state, data.asOf).sort(compare);
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
    CX.activeChips(el.chips, state, function (s, why) {
      onFilterChange(s, why);
    });
    filters.render(); // always shown on desktop; collapsible on phones
    var n = CX.filterCount(state);
    var badge = el.filterToggle.querySelector(".tx-badge");
    badge.hidden = !n;
    badge.textContent = n;
    renderBody();
    renderPager(pages);
    el.asof.textContent = CX.asOfText(data) + " “Minor work” is permitted work with no new floor area, such as pools, fences and trade permits.";
  }

  function renderKpis() {
    var s = CX.summary(rows);
    var bySize = {};
    rows.forEach(function (r) { bySize[r.size] = (bySize[r.size] || 0) + 1; });
    var mix = CX.SIZES.filter(function (z) { return bySize[z.id]; }).map(function (z) {
      return '<i class="cx-size-bar" style="width:' + (bySize[z.id] / rows.length * 100).toFixed(2) + "%;background:var(--cx-" + z.id + ')" title="' +
        fmt.escape(z.long + ": " + bySize[z.id].toLocaleString("en-US")) + '"></i>';
    }).join("");
    var big = (bySize.major || 0) + (bySize.mid || 0);
    var withUnits = rows.filter(function (r) { return r.units; }).length;
    el.kpis.innerHTML =
      kpi("Projects", s.count.toLocaleString("en-US"), big ? CX.plural(big, "major or mid-size", "major or mid-size") : "&nbsp;", rows.length ? '<span class="cx-mix" aria-hidden="true">' + mix + "</span>" : "") +
      kpi("Estimated cost", fmt.moneyShort(s.value), "Sum of permit estimates") +
      kpi("Floor area", s.sqft ? fmt.numShort(s.sqft) + " sq ft" : "—", "Where permits list it") +
      kpi("Units", s.units ? fmt.num(s.units) : "—", withUnits ? "County permits only" : "Not listed on city permits");
  }
  function kpi(label, value, sub, extra) {
    return '<div class="cx-kpi"><span class="cx-kpi-label">' + label + '</span><span class="cx-kpi-value">' + value + "</span>" +
      '<span class="cx-kpi-sub">' + sub + "</span>" + (extra || "") + "</div>";
  }

  function renderSummary() {
    var since = CX.since(state, data.asOf);
    el.summary.innerHTML = "<strong>" + CX.plural(rows.length, "project") + "</strong>" +
      (state.hood ? " in " + fmt.escape(state.hood) : "") +
      (since ? " · latest permit since " + fmt.date(since, { month: "short", day: "numeric" }) : "");
  }

  function sizeCell(r) {
    return '<span class="cx-size cx-size-' + r.size + '">' + CX.SIZES[CX.SIZE_IDS.indexOf(r.size)].label + "</span>";
  }
  function typeCell(r) {
    return '<span class="tx-cat"><i class="tx-swatch" data-cat="' + (r.type === "Mixed use" ? "Land" : r.type) + '"></i>' + r.type + "</span>";
  }
  function expandBody(r) {
    var img = CX.aerialUrl(r, 240, 130);
    var facts = CX.facts(r);
    return '<div class="tx-expand-grid">' +
      (img ? '<img class="tx-expand-img" loading="lazy" alt="Satellite view of ' + fmt.escape(r.address || "the site") + '" src="' + fmt.escape(img) + '">' : "") +
      '<div><dl class="tx-facts">' + facts.map(function (x) { return "<div><dt>" + x[0] + "</dt><dd>" + x[1] + "</dd></div>"; }).join("") + "</dl>" +
      CX.workHtml(r, r.work.length <= 4) + actions(r) + "</div></div>";
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
      var msg = (state.q ? "No projects match “" + fmt.escape(state.q) + "”" + (CX.filterCount(state) ? " with these filters." : ".") : "No projects match these filters.") +
        (CX.isDefault(state) && state.sizes.indexOf("minor") >= 0 ? "" : ' <button type="button" class="tx-reset" data-act="widen">Search all projects and minor work</button>');
      el.tbody.innerHTML = '<tr><td class="tx-empty" colspan="' + COLS.length + '">' + msg + "</td></tr>";
      el.cards.innerHTML = '<li class="tx-empty">' + msg + "</li>";
      return;
    }
    var html = "", cards = "";
    slice.forEach(function (r) {
      var open = r.id === openId;
      var addr = r.address ? fmt.escape(r.address) : '<span class="tx-muted">Address unavailable</span>';
      var place = fmt.escape(CX.placeLine(r));
      html += '<tr class="tx-row' + (open ? " is-open" : "") + '" data-id="' + fmt.escape(r.id) + '" tabindex="0" aria-expanded="' + open + '">' +
        '<td class="tx-nowrap">' + fmt.date(r.date) + "</td>" +
        '<td><span class="tx-addr">' + addr + '<span class="tx-addr-sub">' + place + "</span></span></td>" +
        '<td class="cx-col-type">' + typeCell(r) + "</td>" +
        '<td class="cx-size-cell">' + sizeCell(r) + "</td>" +
        '<td class="num"><strong>' + (r.value ? fmt.moneyShort(r.value) : '<span class="cx-dim">—</span>') + "</strong></td>" +
        '<td class="num">' + (r.sqft ? fmt.num(r.sqft) : '<span class="cx-dim">—</span>') + "</td>" +
        '<td class="num cx-col-units">' + (r.units ? fmt.num(r.units) : '<span class="cx-dim">—</span>') + "</td>" +
        '<td class="cx-col-status">' + (r.status ? fmt.escape(r.status) : '<span class="cx-dim">—</span>') + "</td></tr>";
      if (open) html += '<tr class="tx-expand"><td colspan="' + COLS.length + '">' + expandBody(r) + "</td></tr>";

      var meta = [r.sqft ? fmt.numShort(r.sqft) + " sq ft" : "", r.units > 1 ? CX.plural(r.units, "unit") : "", r.status || ""].filter(Boolean);
      cards += '<li class="tx-card" data-id="' + fmt.escape(r.id) + '"><div class="tx-card-top"><span class="tx-addr">' + addr +
        '<span class="tx-addr-sub">' + place + "</span></span>" +
        '<span class="tx-card-price">' + (r.value ? fmt.moneyShort(r.value) : "—") + "</span></div>" +
        '<div class="tx-card-meta"><span>' + fmt.date(r.date) + "</span>" + typeCell(r) + sizeCell(r) +
        (meta.length ? "<span>" + fmt.escape(meta.join(" · ")) + "</span>" : "") + "</div>" +
        "<details" + (open ? " open" : "") + "><summary>Details</summary>" + expandBody(r) + "</details></li>";
    });
    el.tbody.innerHTML = html;
    el.cards.innerHTML = cards;
  }

  // ------------------------------------------------------- by neighborhood
  var AREA_COLS = [
    { key: "name", label: "Neighborhood" },
    { key: "count", label: "Projects", num: true },
    { key: "value", label: "Est. cost", num: true },
    { key: "sqft", label: "Sq ft", num: true },
    { key: "top", label: "Largest project" },
  ];
  function renderArea() {
    var by = {};
    rows.forEach(function (r) {
      var k = r.hood || (r.area === "City of Miami" ? "Miami (no neighborhood)" : "Unincorporated (no census place)");
      var a = by[k] || (by[k] = { name: k, hood: r.hood, count: 0, value: 0, sqft: 0, top: null, city: r.area === "City of Miami" });
      a.count++;
      a.value += r.value || 0;
      a.sqft += r.sqft || 0;
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
      return "<tr><td>" + (a.hood ? '<button type="button" data-hood="' + fmt.escape(a.hood) + '">' + fmt.escape(a.name) + "</button>" : '<span class="tx-muted">' + fmt.escape(a.name) + "</span>") +
        '<span class="tx-addr-sub">' + (a.city ? "City of Miami" : "Unincorporated") + "</span></td>" +
        '<td class="num">' + a.count.toLocaleString("en-US") + "</td>" +
        '<td class="num"><strong>' + fmt.moneyShort(a.value) + "</strong></td>" +
        '<td class="num">' + (a.sqft ? fmt.numShort(a.sqft) : "—") + "</td>" +
        "<td>" + fmt.escape(a.top.address || "—") + ' <span class="tx-muted">' + (a.top.value ? fmt.moneyShort(a.top.value) : "") + "</span></td></tr>";
    }).join("") + '</tbody></table><p class="tx-area-note"><span class="tx-muted">Neighborhoods are the City of Miami’s; outside the city, census-designated places. Tap a name to filter to it.</span></p>';
  }
  el.area.addEventListener("click", function (e) {
    var s = e.target.closest("[data-asort]");
    if (s) {
      var k = s.getAttribute("data-asort");
      areaSort = areaSort.key === k ? { key: k, dir: -areaSort.dir } : { key: k, dir: k === "name" ? 1 : -1 };
      renderArea();
      return;
    }
    var b = e.target.closest("[data-hood]");
    if (!b) return;
    var ns = CX.clone(state);
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
      var w = CX.defaultState();
      w.q = state.q;
      w.sizes = CX.SIZE_IDS.slice();
      onFilterChange(w, "widen");
    }
    return true;
  }

  // Show one project: widen filters if they hide it, then open its row.
  function reveal(id) {
    var r = data && data.byId[id];
    if (!r) return;
    if (!CX.apply([r], state, data.asOf).length) {
      var s = CX.defaultState();
      s.sizes = CX.SIZE_IDS.slice();
      state = s;
      box.set("");
      input.value = "";
      peer.send("filters", CX.clone(state));
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
  var peer = CX.link("table", function (msg) {
    if (!data) return;
    if (msg.type === "filters" && msg.payload) {
      state = msg.payload;
      box.set(state.q);
      input.value = state.q || "";
      page = 0;
      refresh();
    } else if (msg.type === "reveal") {
      reveal(msg.payload);
    } else if (msg.type === "hello" && !CX.isDefault(state)) {
      peer.send("filters", CX.clone(state));
    }
  });

  // ------------------------------------------------------------------ boot
  CX.load().then(function (d) {
    data = d;
    el.loading.hidden = true;
    refresh();
    track("loaded", data.rows.length);
  }).catch(function () {
    el.loading.innerHTML = "<span>Construction permits couldn’t load. Please try again later.</span>";
  });
})();
