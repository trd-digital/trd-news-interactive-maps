/*!
 * sr-table.js — South Florida condo reserve study (SIRS) table.
 * Depends on: TRD theme.js, sr-core.js (SR).
 */
(function () {
  "use strict";

  var PAGE_SIZE = 25;
  var fmt = SR.fmt;
  var track = SR.tracker("sofla-sirs-table");
  var params = new URLSearchParams(location.search);
  var app = document.getElementById("tx-app");

  var state = SR.stateFromUrl();
  var data = null;
  var rows = [];
  var view = params.get("tab") === "city" ? "city" : "list";
  var sort = params.get("tab") === "recent" ? { key: "period", dir: -1 } : { key: "name", dir: 1 };
  var citySort = { key: "count", dir: -1 };
  var page = 0;
  var openId = null;

  SR.theme(null, track);

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
  el.searchWrap.insertAdjacentHTML("afterbegin", SR.searchHtml(state.q, window.innerWidth < 520 ? "Search condos" : "Search condo, association, city or ZIP"));
  var input = el.searchWrap.querySelector(".tx-search-input");
  var box = SR.searchBox({
    input: input,
    panel: el.results,
    getData: function () { return data; },
    onQuery: function (q) {
      var s = SR.clone(state);
      s.q = q;
      onFilterChange(s, "search");
    },
    onPick: function (it) {
      track("search_pick", it.kind);
      if (it.kind === "city") {
        var s = SR.clone(state);
        s.city = it.value;
        s.q = "";
        input.value = "";
        view = "list";
        onFilterChange(s, "city");
      } else {
        reveal(it.row.id);
        if (it.row.located) peer.send("select", it.row.id);
      }
    },
  });
  var filters = SR.filterBar(el.filterHost, function () { return SR.clone(state); }, onFilterChange, { getData: function () { return data; } });
  el.filterToggle.addEventListener("click", function () {
    var stuck = el.searchbar.classList.contains("is-stuck");
    var open = stuck || !el.filters.classList.contains("is-open");
    el.filters.classList.toggle("is-open", open);
    el.filterToggle.setAttribute("aria-expanded", String(open));
    if (stuck) scrollToEl(el.searchbar, 0);
    if (open) track("filters", "open");
  });
  // Scroll this frame only (scrollIntoView would also scroll the TRD page).
  function scrollToEl(node, offset) {
    var y = node.getBoundingClientRect().top + window.scrollY - (offset || 0);
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }
  (function pinSearchbar() {
    var bar = el.searchbar, root = document.documentElement, queued = false;
    function measure() { root.style.setProperty("--tx-bar-h", bar.offsetHeight + "px"); }
    function check() {
      queued = false;
      bar.classList.toggle("is-stuck", window.scrollY > 0 && bar.getBoundingClientRect().top <= 0.5);
    }
    window.addEventListener("scroll", function () { if (!queued) { queued = true; requestAnimationFrame(check); } }, { passive: true });
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
    peer.send("filters", SR.clone(state));
  }

  // ------------------------------------------------------------------ tabs
  el.tabs.addEventListener("click", function (e) {
    var b = e.target.closest(".tx-tab");
    if (!b) return;
    var tab = b.getAttribute("data-tab");
    view = tab === "city" ? "city" : "list";
    if (tab === "name") sort = { key: "name", dir: 1 };
    if (tab === "recent") sort = { key: "period", dir: -1 };
    page = 0;
    track("tab", tab);
    refresh();
  });
  function renderTabs() {
    el.tabs.querySelectorAll(".tx-tab").forEach(function (b) {
      var tab = b.getAttribute("data-tab");
      var on = tab === "city" ? view === "city" : view === "list" && (tab === "name" ? sort.key === "name" && sort.dir === 1 : sort.key === "period" && sort.dir === -1);
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });
  }

  // ------------------------------------------------------------------ sort
  var COLS = [
    { key: "name", label: "Association" },
    { key: "city", label: "City" },
    { key: "county", label: "County", cls: "cx-col-type" },
    { key: "period", label: "Reported" },
    { key: "condos", label: "Condos", num: true, cls: "cx-col-units" },
  ];
  var PERIOD_RANK = { post: 3, both: 2, pre: 1 };
  function sortVal(r, k) {
    if (k === "period") return PERIOD_RANK[r.period];
    if (k === "condos") return Math.max(1, r.projects.length);
    return r[k];
  }
  function compare(a, b) {
    var k = sort.key, d = sort.dir, va = sortVal(a, k), vb = sortVal(b, k);
    if (va == null && vb == null) return a.name.localeCompare(b.name);
    if (va == null) return 1;
    if (vb == null) return -1;
    var c = typeof va === "string" ? va.localeCompare(vb) : va === vb ? 0 : va < vb ? -1 : 1;
    return c ? c * d : a.name.localeCompare(b.name);
  }
  function renderHead() {
    el.thead.innerHTML = "<tr>" + COLS.map(function (c) {
      var cls = c.num || c.cls ? ' class="' + [c.num ? "num" : "", c.cls || ""].join(" ").trim() + '"' : "";
      var active = sort.key === c.key;
      return '<th scope="col"' + cls + (active ? ' aria-sort="' + (sort.dir < 0 ? "descending" : "ascending") + '"' : "") + '><button type="button" data-sort="' + c.key + '">' + c.label +
        '<span class="tx-sort-ind" aria-hidden="true">' + (active ? (sort.dir < 0 ? "▼" : "▲") : "") + "</span></button></th>";
    }).join("") + "</tr>";
  }
  el.thead.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-sort]");
    if (!b) return;
    var k = b.getAttribute("data-sort");
    sort = sort.key === k ? { key: k, dir: -sort.dir } : { key: k, dir: k === "period" || k === "condos" ? -1 : 1 };
    page = 0;
    track("sort", k);
    refresh();
  });

  // ------------------------------------------------------------------ render
  function refresh() {
    if (!data) return;
    rows = SR.apply(data.rows, state).sort(compare);
    var pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (page >= pages) page = pages - 1;
    renderTabs();
    renderHead();
    renderKpis();
    el.summary.innerHTML = "<strong>" + SR.plural(rows.length, "association") + "</strong>" + (state.city ? " in " + fmt.escape(state.city) : "");
    el.table.hidden = view === "city";
    el.cards.hidden = view === "city";
    el.pager.hidden = view === "city";
    el.area.hidden = view !== "city";
    if (view === "city") renderCities();
    SR.activeChips(el.chips, state, function (s, why) { onFilterChange(s, why); });
    filters.render();
    var n = SR.filterCount(state);
    var badge = el.filterToggle.querySelector(".tx-badge");
    badge.hidden = !n;
    badge.textContent = n;
    renderBody();
    renderPager(pages);
    el.asof.textContent = SR.asOfText(data);
  }
  function renderKpis() {
    var by = { post: 0, both: 0, pre: 0 }, condos = 0;
    rows.forEach(function (r) { by[r.period]++; condos += Math.max(1, r.projects.length); });
    var since = by.post + by.both;
    var mix = SR.PERIODS.filter(function (p) { return by[p.id]; }).map(function (p) {
      return '<i class="cx-size-bar" style="width:' + (by[p.id] / rows.length * 100).toFixed(2) + "%;background:var(--sr-" + p.id + ')" title="' + fmt.escape(p.long + ": " + by[p.id].toLocaleString("en-US")) + '"></i>';
    }).join("");
    el.kpis.innerHTML =
      kpi("Associations", rows.length.toLocaleString("en-US"), "Reported a SIRS", rows.length ? '<span class="cx-mix" aria-hidden="true">' + mix + "</span>" : "") +
      kpi("Since July 2025", since.toLocaleString("en-US"), by.both ? by.both.toLocaleString("en-US") + " also reported before" : "&nbsp;") +
      kpi("Before July 2025 only", by.pre.toLocaleString("en-US"), "Not on the newer list") +
      kpi("Condos covered", condos.toLocaleString("en-US"), "Projects named in filings");
  }
  function kpi(label, value, sub, extra) {
    return '<div class="cx-kpi"><span class="cx-kpi-label">' + label + '</span><span class="cx-kpi-value">' + value + "</span>" +
      '<span class="cx-kpi-sub">' + sub + "</span>" + (extra || "") + "</div>";
  }
  function periodCell(r) {
    return '<span class="tx-cat"><i class="tx-swatch sr-swatch-' + r.period + '"></i>' + SR.periodLabel(r.period) + "</span>";
  }
  function expandBody(r) {
    return '<div><dl class="tx-facts">' + SR.facts(r).map(function (x) { return "<div><dt>" + x[0] + "</dt><dd>" + x[1] + "</dd></div>"; }).join("") + "</dl>" +
      SR.projectsHtml(r, 12) + actions(r) + "</div>";
  }
  function actions(r) {
    return r.located && peer.hasPeer("map") ? '<div class="tx-actions"><button type="button" class="tx-btn" data-act="map" data-id="' + fmt.escape(r.id) + '">Show on map</button></div>' : "";
  }
  function renderBody() {
    var slice = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    if (!slice.length) {
      var msg = (state.q ? "No associations match “" + fmt.escape(state.q) + "”." : "No associations match these filters.") +
        (SR.isDefault(state) ? "" : ' <button type="button" class="tx-reset" data-act="widen">Clear filters</button>');
      el.tbody.innerHTML = '<tr><td class="tx-empty" colspan="' + COLS.length + '">' + msg + "</td></tr>";
      el.cards.innerHTML = '<li class="tx-empty">' + msg + "</li>";
      return;
    }
    var html = "", cards = "";
    slice.forEach(function (r) {
      var open = r.id === openId;
      var sub = r.projects.length > 1 ? SR.plural(r.projects.length, "condo") : r.projects[0] && r.projects[0].toLowerCase() !== r.name.toLowerCase() ? r.projects[0] : "";
      var condos = Math.max(1, r.projects.length);
      html += '<tr class="tx-row' + (open ? " is-open" : "") + '" data-id="' + r.id + '" tabindex="0" aria-expanded="' + open + '">' +
        '<td><span class="tx-addr">' + fmt.escape(r.name) + (sub ? '<span class="tx-addr-sub">' + fmt.escape(sub) + "</span>" : "") + "</span></td>" +
        '<td class="tx-nowrap">' + fmt.escape(r.city || "—") + (r.zip ? ' <span class="tx-muted">' + r.zip + "</span>" : "") + "</td>" +
        '<td class="cx-col-type">' + fmt.escape(r.county || "—") + "</td>" +
        "<td>" + periodCell(r) + "</td>" +
        '<td class="num cx-col-units">' + condos + "</td></tr>";
      if (open) html += '<tr class="tx-expand"><td colspan="' + COLS.length + '">' + expandBody(r) + "</td></tr>";
      cards += '<li class="tx-card" data-id="' + r.id + '"><div class="tx-card-top"><span class="tx-addr">' + fmt.escape(r.name) +
        '<span class="tx-addr-sub">' + fmt.escape([r.city, r.zip].filter(Boolean).join(" ")) + "</span></span></div>" +
        '<div class="tx-card-meta">' + periodCell(r) + (sub ? "<span>" + fmt.escape(sub) + "</span>" : "") + "</div>" +
        "<details" + (open ? " open" : "") + "><summary>Details</summary>" + expandBody(r) + "</details></li>";
    });
    el.tbody.innerHTML = html;
    el.cards.innerHTML = cards;
  }

  // ------------------------------------------------------------------ by city
  var CITY_COLS = [
    { key: "name", label: "City" },
    { key: "count", label: "Associations", num: true },
    { key: "since", label: "Since July 2025", num: true },
    { key: "pre", label: "Before July 2025 only", num: true },
  ];
  function renderCities() {
    var by = {};
    rows.forEach(function (r) {
      var k = r.city || "City not given";
      var a = by[k] || (by[k] = { name: k, city: r.city, county: r.county, count: 0, since: 0, pre: 0 });
      a.count++;
      if (r.period === "pre") a.pre++;
      else a.since++;
    });
    var list = Object.keys(by).map(function (k) { return by[k]; });
    list.sort(function (a, b) {
      var k = citySort.key;
      if (k === "name") return a.name.localeCompare(b.name) * citySort.dir;
      return (a[k] - b[k]) * citySort.dir || a.name.localeCompare(b.name);
    });
    el.area.innerHTML = '<table class="tx-table tx-area-table cx-hood-table"><thead><tr>' + CITY_COLS.map(function (c) {
      var active = citySort.key === c.key;
      return '<th scope="col"' + (c.num ? ' class="num"' : "") + (active ? ' aria-sort="' + (citySort.dir < 0 ? "descending" : "ascending") + '"' : "") +
        '><button type="button" data-csort="' + c.key + '">' + c.label + '<span class="tx-sort-ind" aria-hidden="true">' + (active ? (citySort.dir < 0 ? "▼" : "▲") : "") + "</span></button></th>";
    }).join("") + "</tr></thead><tbody>" + list.map(function (a) {
      return "<tr><td>" + (a.city ? '<button type="button" data-city="' + fmt.escape(a.city) + '">' + fmt.escape(a.name) + "</button>" : '<span class="tx-muted">' + fmt.escape(a.name) + "</span>") +
        '<span class="tx-addr-sub">' + fmt.escape(a.county || "") + "</span></td>" +
        '<td class="num"><strong>' + a.count.toLocaleString("en-US") + "</strong></td>" +
        '<td class="num">' + a.since.toLocaleString("en-US") + "</td>" +
        '<td class="num">' + a.pre.toLocaleString("en-US") + "</td></tr>";
    }).join("") + '</tbody></table><p class="tx-area-note"><span class="tx-muted">Cities as associations filed them. Tap a name to filter to it.</span></p>';
  }
  el.area.addEventListener("click", function (e) {
    var s = e.target.closest("[data-csort]");
    if (s) {
      var k = s.getAttribute("data-csort");
      citySort = citySort.key === k ? { key: k, dir: -citySort.dir } : { key: k, dir: k === "name" ? 1 : -1 };
      renderCities();
      return;
    }
    var b = e.target.closest("[data-city]");
    if (!b) return;
    var ns = SR.clone(state);
    ns.city = b.getAttribute("data-city");
    view = "list";
    track("city_pick", ns.city);
    onFilterChange(ns, "city");
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
      var w = SR.defaultState();
      w.q = state.q;
      onFilterChange(w, "widen");
    }
    return true;
  }
  function reveal(id) {
    var r = data && data.byId[id];
    if (!r) return;
    if (!SR.apply([r], state).length) {
      state = SR.defaultState();
      box.set("");
      input.value = "";
      peer.send("filters", SR.clone(state));
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
  var peer = SR.link("table", function (msg) {
    if (!data) return;
    if (msg.type === "filters" && msg.payload) {
      state = msg.payload;
      box.set(state.q);
      input.value = state.q || "";
      page = 0;
      refresh();
    } else if (msg.type === "reveal") {
      reveal(msg.payload);
    } else if (msg.type === "hello" && !SR.isDefault(state)) {
      peer.send("filters", SR.clone(state));
    }
  });

  // ------------------------------------------------------------------ boot
  SR.load().then(function (d) {
    data = d;
    SR.resolveCity(state, data);
    el.loading.hidden = true;
    refresh();
    track("loaded", data.rows.length);
  }).catch(function () {
    el.loading.innerHTML = "<span>The reserve study filings couldn’t load. Please try again later.</span>";
  });
})();
