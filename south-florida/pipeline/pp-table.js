/*!
 * pp-table.js — South Florida project-pipeline table (Live Local, condo filings).
 * Depends on: TRD theme.js, a PP_CONFIG file, pp-core.js (PP).
 */
(function () {
  "use strict";

  var CFG = PP.CFG, T = CFG.table;
  var PAGE_SIZE = 25;
  var fmt = PP.fmt;
  var track = PP.tracker("table");
  var params = new URLSearchParams(location.search);
  var app = document.getElementById("tx-app");

  var state = PP.stateFromUrl();
  var data = null;
  var rows = [];
  var tab = T.tabs.filter(function (t) { return t.id === params.get("tab"); })[0] || T.tabs[0];
  var sort = tab.sort ? PP.clone(tab.sort) : PP.clone(T.tabs[0].sort);
  var groupSort = { key: "count", dir: -1 };
  var page = 0;
  var openId = null;

  PP.theme(null, track);

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
  el.searchWrap.insertAdjacentHTML("afterbegin", PP.searchHtml(state.q, window.innerWidth < 520 ? CFG.searchShort : CFG.searchLong));
  var input = el.searchWrap.querySelector(".tx-search-input");
  var box = PP.searchBox({
    input: input,
    panel: el.results,
    getData: function () { return data; },
    onQuery: function (q) {
      var s = PP.clone(state);
      s.q = q;
      onFilterChange(s, "search");
    },
    onPick: function (it) {
      track("search_pick", it.kind);
      if (it.kind === "city") {
        var s = PP.clone(state);
        s.city = it.value;
        s.q = "";
        input.value = "";
        toList();
        onFilterChange(s, "city");
      } else {
        reveal(it.row.id);
        if (it.row.located) peer.send("select", it.row.id);
      }
    },
  });
  var filters = PP.filterBar(el.filterHost, function () { return PP.clone(state); }, onFilterChange, { getData: function () { return data; } });
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
    peer.send("filters", PP.clone(state));
  }

  // ------------------------------------------------------------------ tabs
  el.tabs.innerHTML = T.tabs.map(function (t) {
    return '<button type="button" class="tx-tab" role="tab" data-tab="' + t.id + '">' + fmt.escape(t.label) + "</button>";
  }).join("");
  function toList() {
    if (!tab.group) return;
    tab = T.tabs[0];
    sort = PP.clone(tab.sort);
  }
  el.tabs.addEventListener("click", function (e) {
    var b = e.target.closest(".tx-tab");
    if (!b) return;
    tab = T.tabs.filter(function (t) { return t.id === b.getAttribute("data-tab"); })[0];
    if (tab.sort) sort = PP.clone(tab.sort);
    page = 0;
    track("tab", tab.id);
    refresh();
  });
  function renderTabs() {
    el.tabs.querySelectorAll(".tx-tab").forEach(function (b) {
      var t = T.tabs.filter(function (x) { return x.id === b.getAttribute("data-tab"); })[0];
      var on = tab.group ? t === tab : !t.group && t.sort.key === sort.key && t.sort.dir === sort.dir;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });
  }

  // ------------------------------------------------------------------ sort
  function col(k) {
    return T.cols.filter(function (c) { return c.key === k; })[0];
  }
  function sortVal(r, k) {
    var c = col(k);
    return c && c.sort ? c.sort(r) : r[k];
  }
  function compare(a, b) {
    var k = sort.key, d = sort.dir, va = sortVal(a, k), vb = sortVal(b, k);
    if (va instanceof Date) va = +va;
    if (vb instanceof Date) vb = +vb;
    if (va == null && vb == null) return a.name.localeCompare(b.name);
    if (va == null) return 1;
    if (vb == null) return -1;
    var c = typeof va === "string" ? va.localeCompare(vb) : va === vb ? 0 : va < vb ? -1 : 1;
    return c ? c * d : a.name.localeCompare(b.name);
  }
  function renderHead() {
    el.thead.innerHTML = "<tr>" + T.cols.map(function (c) {
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
    sort = sort.key === k ? { key: k, dir: -sort.dir } : { key: k, dir: col(k).dir || 1 };
    page = 0;
    track("sort", k);
    refresh();
  });

  // ------------------------------------------------------------------ render
  function refresh() {
    if (!data) return;
    rows = PP.apply(data.rows, state).sort(compare);
    var pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (page >= pages) page = pages - 1;
    var grouped = !!tab.group;
    renderTabs();
    renderHead();
    el.kpis.innerHTML = T.kpis(rows, data, kpi);
    el.summary.innerHTML = "<strong>" + PP.plural(rows.length, CFG.noun.one, CFG.noun.many) + "</strong>" + (state.city ? " in " + fmt.escape(state.city) : "");
    el.table.hidden = grouped;
    el.cards.hidden = grouped;
    el.pager.hidden = grouped;
    el.area.hidden = !grouped;
    if (grouped) renderGroups();
    PP.activeChips(el.chips, state, function (s, why) { onFilterChange(s, why); }, data);
    filters.render();
    var n = PP.filterCount(state);
    var badge = el.filterToggle.querySelector(".tx-badge");
    badge.hidden = !n;
    badge.textContent = n;
    renderBody();
    renderPager(pages);
    el.asof.innerHTML = CFG.note(data, false);
  }
  function kpi(label, value, sub, extra) {
    return '<div class="cx-kpi"><span class="cx-kpi-label">' + label + '</span><span class="cx-kpi-value">' + value + "</span>" +
      '<span class="cx-kpi-sub">' + (sub || "&nbsp;") + "</span>" + (extra || "") + "</div>";
  }
  function expandBody(r) {
    return "<div>" + CFG.detail(r, "row") + actions(r) +
      (r.offMap ? '<p class="tx-muted pp-desc">Not on the map: its address places it outside Miami-Dade, Broward and Palm Beach.</p>' : "") + "</div>";
  }
  function actions(r) {
    return r.located && peer.hasPeer("map") ? '<div class="tx-actions"><button type="button" class="tx-btn" data-act="map" data-id="' + fmt.escape(r.id) + '">Show on map</button></div>' : "";
  }
  function renderBody() {
    var slice = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    if (!slice.length) {
      var msg = (state.q ? "No " + CFG.noun.many + " match “" + fmt.escape(state.q) + "”." : "No " + CFG.noun.many + " match these filters.") +
        (PP.isDefault(state) ? "" : ' <button type="button" class="tx-reset" data-act="widen">Clear filters</button>');
      el.tbody.innerHTML = '<tr><td class="tx-empty" colspan="' + T.cols.length + '">' + msg + "</td></tr>";
      el.cards.innerHTML = '<li class="tx-empty">' + msg + "</li>";
      return;
    }
    var html = "", cards = "";
    slice.forEach(function (r) {
      var open = r.id === openId;
      html += '<tr class="tx-row' + (open ? " is-open" : "") + '" data-id="' + r.id + '" tabindex="0" aria-expanded="' + open + '">' +
        T.cols.map(function (c) {
          var cls = [c.num ? "num" : "", c.cls || ""].join(" ").trim();
          return "<td" + (cls ? ' class="' + cls + '"' : "") + ">" + c.cell(r) + "</td>";
        }).join("") + "</tr>";
      if (open) html += '<tr class="tx-expand"><td colspan="' + T.cols.length + '">' + expandBody(r) + "</td></tr>";
      cards += '<li class="tx-card" data-id="' + r.id + '"><div class="tx-card-top"><span class="tx-addr">' + fmt.escape(r.name) +
        '<span class="tx-addr-sub">' + fmt.escape(r.sub || "") + "</span></span>" + (T.cardValue ? '<span class="tx-card-price">' + T.cardValue(r) + "</span>" : "") + "</div>" +
        '<div class="tx-card-meta">' + T.cardMeta(r) + "</div>" +
        "<details" + (open ? " open" : "") + "><summary>Details</summary>" + expandBody(r) + "</details></li>";
    });
    el.tbody.innerHTML = html;
    el.cards.innerHTML = cards;
  }

  // ------------------------------------------------------------------ grouped view
  function renderGroups() {
    var G = tab.group, by = {};
    rows.forEach(function (r) {
      var k = G.keyOf(r);
      if (!k) return;
      (by[k] = by[k] || []).push(r);
    });
    var list = Object.keys(by).map(function (k) {
      var a = { name: k, rows: by[k], count: by[k].length };
      G.cols.forEach(function (c) { a[c.key] = c.val(by[k]); });
      return a;
    });
    list.sort(function (a, b) {
      var k = groupSort.key;
      if (k === "name") return a.name.localeCompare(b.name) * groupSort.dir;
      return ((a[k] || 0) - (b[k] || 0)) * groupSort.dir || a.name.localeCompare(b.name);
    });
    var cols = [{ key: "name", label: G.label }, { key: "count", label: G.countLabel || CFG.noun.manyCap, num: true }].concat(G.cols.map(function (c) { return { key: c.key, label: c.label, num: true }; }));
    var none = rows.length - list.reduce(function (n, a) { return n + a.count; }, 0);
    el.area.innerHTML = '<table class="tx-table tx-area-table cx-hood-table"><thead><tr>' + cols.map(function (c) {
      var active = groupSort.key === c.key;
      return '<th scope="col"' + (c.num ? ' class="num"' : "") + (active ? ' aria-sort="' + (groupSort.dir < 0 ? "descending" : "ascending") + '"' : "") +
        '><button type="button" data-gsort="' + c.key + '">' + c.label + '<span class="tx-sort-ind" aria-hidden="true">' + (active ? (groupSort.dir < 0 ? "▼" : "▲") : "") + "</span></button></th>";
    }).join("") + "</tr></thead><tbody>" + list.map(function (a) {
      return '<tr><td><button type="button" data-gpick="' + fmt.escape(a.name) + '">' + fmt.escape(a.name) + "</button>" +
        (G.sub ? '<span class="tx-addr-sub">' + fmt.escape(G.sub(a.rows) || "") + "</span>" : "") + "</td>" +
        '<td class="num"><strong>' + a.count.toLocaleString("en-US") + "</strong></td>" +
        G.cols.map(function (c) { return '<td class="num">' + (c.fmt ? c.fmt(a[c.key]) : fmt.num(a[c.key])) + "</td>"; }).join("") + "</tr>";
    }).join("") + '</tbody></table><p class="tx-area-note"><span class="tx-muted">' + fmt.escape(G.note) +
      (none ? " " + PP.plural(none, CFG.noun.one, CFG.noun.many) + " without one " + (none === 1 ? "isn’t" : "aren’t") + " listed." : "") + "</span></p>";
  }
  el.area.addEventListener("click", function (e) {
    var s = e.target.closest("[data-gsort]");
    if (s) {
      var k = s.getAttribute("data-gsort");
      groupSort = groupSort.key === k ? { key: k, dir: -groupSort.dir } : { key: k, dir: k === "name" ? 1 : -1 };
      renderGroups();
      return;
    }
    var b = e.target.closest("[data-gpick]");
    if (!b) return;
    var ns = tab.group.pick(PP.clone(state), b.getAttribute("data-gpick"));
    track("group_pick", b.getAttribute("data-gpick"));
    toList();
    onFilterChange(ns, "group");
  });

  // ------------------------------------------------------------------ pager
  function renderPager(pages) {
    el.pager.hidden = el.pager.hidden || pages < 2;
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
    var a = e.target.closest("a[href]");
    if (a) { track("link", a.href); return true; }
    var b = e.target.closest("[data-act]");
    if (!b) return false;
    var act = b.getAttribute("data-act");
    if (act === "map") {
      peer.send("select", b.getAttribute("data-id"));
      track("show_on_map", b.getAttribute("data-id"));
    } else if (act === "widen") {
      var w = PP.defaultState();
      w.q = state.q;
      onFilterChange(w, "widen");
    }
    return true;
  }
  function reveal(id) {
    var r = data && data.byId[id];
    if (!r) return;
    if (!PP.apply([r], state).length) {
      state = PP.defaultState();
      box.set("");
      input.value = "";
      peer.send("filters", PP.clone(state));
    }
    toList();
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
  var peer = PP.link("table", function (msg) {
    if (!data) return;
    if (msg.type === "filters" && msg.payload) {
      state = msg.payload;
      box.set(state.q);
      input.value = state.q || "";
      page = 0;
      refresh();
    } else if (msg.type === "reveal") {
      reveal(msg.payload);
    } else if (msg.type === "hello" && !PP.isDefault(state)) {
      peer.send("filters", PP.clone(state));
    }
  });

  // ------------------------------------------------------------------ boot
  PP.load().then(function (d) {
    data = d;
    PP.resolve(state, data);
    el.loading.hidden = true;
    refresh();
    track("loaded", data.rows.length);
  }).catch(function () {
    el.loading.innerHTML = "<span>" + fmt.escape(CFG.loadError) + "</span>";
  });
})();
