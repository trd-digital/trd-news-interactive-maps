/*!
 * tx-table.js — South Florida Live Transactions table.
 * Depends on: TRD theme.js (TrdTheme), tx-core.js (TX).
 */
(function () {
  "use strict";

  var PAGE_SIZE = 25;
  var fmt = TX.fmt;
  var track = TX.tracker("south-florida-transactions-table");
  var params = new URLSearchParams(location.search);
  var app = document.getElementById("tx-app");

  var state = TX.stateFromUrl();
  var data = null;
  var rows = []; // filtered deeds (summary, CSV)
  var entries = []; // display rows: deeds + grouped assemblages
  var focusMember = null; // member deed highlighted inside an open assemblage
  var view = params.get("tab") === "area" ? "area" : "list"; // "list" | "area"
  var areaSort = { key: "volume", dir: -1 };
  var areaAll = false;
  var sort = params.get("tab") === "biggest" ? { key: "price", dir: -1 } : { key: "date", dir: -1 };
  var page = 0;
  var openId = null;
  // CSV export is opt-in per embed (?csv=1): giving away the full sales list
  // is an editorial/business call, not a default.
  var csvEnabled = params.get("csv") === "1";

  // ------------------------------------------------------------------ theme
  // See tx-map.js: theme.js init() mirrors the parent page's theme onto <body>.
  var trdTheme = typeof TrdTheme === "function" ? TrdTheme({ updateCallback: function (t) { setTheme(t); track("theme", t); } }) : null;
  function setTheme(t) {
    if (t !== "dark" && t !== "light") return;
    document.documentElement.setAttribute("data-bs-theme", t);
    document.body.setAttribute("data-bs-theme", t);
  }
  if (trdTheme) trdTheme.init();
  setTheme((trdTheme && trdTheme.get()) ||
    (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

  // ------------------------------------------------------------------ DOM
  var el = {
    filters: app.querySelector(".tx-filters"),
    searchWrap: app.querySelector(".tx-search-wrap"),
    results: app.querySelector(".tx-results"),
    chips: app.querySelector(".tx-active"),
    filterHost: app.querySelector(".tx-filter-host"),
    filterToggle: app.querySelector(".tx-filter-toggle"),
    tabs: app.querySelector(".tx-tabs"),
    summary: app.querySelector(".tx-summary"),
    csv: app.querySelector(".tx-csv"),
    asof: app.querySelector(".tx-asof"),
    thead: app.querySelector(".tx-table thead"),
    tbody: app.querySelector(".tx-table tbody"),
    cards: app.querySelector(".tx-cards"),
    pager: app.querySelector(".tx-pager"),
    insights: app.querySelector(".tx-insights"),
    insightsToggle: app.querySelector(".tx-insights-toggle"),
    insightsRange: app.querySelector(".tx-insights-range"),
    pulse: app.querySelector(".tx-pulse"),
    deals: app.querySelector(".tx-deals"),
    area: app.querySelector(".tx-area"),
    table: app.querySelector(".tx-table"),
    loading: app.querySelector(".tx-loading"),
  };

  var filters = TX.filterBar(el.filterHost, function () { return TX.serializeState(state); }, onFilterChange, {
    showCategories: true,
    getData: function () {
      return data ? { rows: data.rows, asOf: data.asOf, windowDays: data.meta.windowDays } : null;
    },
  });

  el.searchWrap.insertAdjacentHTML("afterbegin", TX.searchHtml(state.q));
  var box = TX.search.searchBox({
    input: el.searchWrap.querySelector(".tx-search-input"),
    panel: el.results,
    getBase: function () {
      return data ? TX.apply(data.rows, state, data.asOf, { ignoreQuery: true }) : [];
    },
    getAll: function () {
      return data ? data.rows : [];
    },
    onQuery: function (q) {
      var s = TX.serializeState(state);
      s.q = q;
      onFilterChange(s, "search");
    },
    onPick: function (it) {
      var s = TX.serializeState(state);
      track("search_pick", it.kind);
      if (it.kind === "widen") {
        var w = TX.defaultState();
        w.q = it.q;
        w.days = 60;
        onFilterChange(w, "search_widen");
        filters.render();
      } else if (it.kind === "city" || it.kind === "zip") {
        s.place = { kind: it.kind, value: it.value, label: it.label };
        s.q = "";
        box.set("");
        onFilterChange(s, "place");
      } else if (it.kind === "party") {
        s.party = { key: it.key, label: it.label };
        s.q = "";
        box.set("");
        onFilterChange(s, "party");
      } else if (it.kind === "sale") {
        reveal(it.row.id);
        if (it.row.located) peer.send("select", it.row.id);
      }
    },
    placeholder: { wide: "Search address, city, ZIP, buyer or seller", narrow: "Search sales" },
  });

  el.filterToggle.addEventListener("click", function () {
    var open = !el.filters.classList.contains("is-open");
    el.filters.classList.toggle("is-open", open);
    el.filterToggle.setAttribute("aria-expanded", String(open));
  });

  function onFilterChange(next, why) {
    state = next;
    box && box.set(state.q);
    if (why !== "search") track("filter", why);
    page = 0;
    refresh();
    peer.send("filters", TX.serializeState(state));
  }

  // ------------------------------------------------------------------ tabs
  el.tabs.addEventListener("click", function (e) {
    var b = e.target.closest(".tx-tab");
    if (!b) return;
    var tab = b.getAttribute("data-tab");
    view = tab === "area" ? "area" : "list";
    if (tab !== "area") sort = tab === "biggest" ? { key: "price", dir: -1 } : { key: "date", dir: -1 };
    page = 0;
    track("tab", b.getAttribute("data-tab"));
    refresh();
  });

  function renderTabs() {
    var latest = view === "list" && sort.key === "date" && sort.dir === -1;
    var biggest = view === "list" && sort.key === "price" && sort.dir === -1;
    el.tabs.querySelectorAll(".tx-tab").forEach(function (b) {
      var tab = b.getAttribute("data-tab");
      var on = tab === "area" ? view === "area" : tab === "latest" ? latest : biggest;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });
  }

  // ------------------------------------------------------------------ sort
  var COLS = [
    { key: "date", label: "Recorded", sortable: true },
    { key: "address", label: "Property", sortable: true },
    { key: "county", label: "County", sortable: true, cls: "col-county" },
    { key: "category", label: "Type", sortable: true },
    { key: "price", label: "Price", sortable: true, num: true },
    { key: "buyer", label: "Buyer" },
    { key: "seller", label: "Seller" },
    { key: "financed", label: "Mortgage", sortable: true, cls: "col-mortgage" },
  ];

  function compare(a, b) {
    var k = sort.key, d = sort.dir;
    var va = a[k], vb = b[k];
    if (va == null && vb == null) return tieBreak(a, b);
    if (va == null) return 1; // blanks last either way
    if (vb == null) return -1;
    var c = typeof va === "string" ? va.localeCompare(vb) : va === vb ? 0 : va < vb ? -1 : 1;
    return c ? c * d : tieBreak(a, b);
  }
  function tieBreak(a, b) {
    return sort.key === "price" ? (b.date < a.date ? -1 : b.date > a.date ? 1 : 0) : b.price - a.price;
  }

  function renderHead() {
    el.thead.innerHTML = "<tr>" + COLS.map(function (c) {
      var cls = c.num || c.cls ? ' class="' + [c.num ? "num" : "", c.cls || ""].join(" ").trim() + '"' : "";
      if (!c.sortable) return "<th scope=\"col\"" + cls + ">" + c.label + "</th>";
      var active = sort.key === c.key;
      var aria = active ? ' aria-sort="' + (sort.dir < 0 ? "descending" : "ascending") + '"' : "";
      return "<th scope=\"col\"" + cls + aria + '><button type="button" data-sort="' + c.key + '">' + c.label +
        '<span class="tx-sort-ind" aria-hidden="true">' + (active ? (sort.dir < 0 ? "▼" : "▲") : "") + "</span></button></th>";
    }).join("") + "</tr>";
  }
  el.thead.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-sort]");
    if (!b) return;
    var k = b.getAttribute("data-sort");
    // Numbers and dates start descending (biggest / newest first); text ascending.
    sort = sort.key === k ? { key: k, dir: -sort.dir } : { key: k, dir: k === "price" || k === "date" || k === "financed" ? -1 : 1 };
    page = 0;
    track("sort", k);
    refresh();
  });

  // ------------------------------------------------------------------ render
  function refresh() {
    if (!data) return;
    rows = TX.apply(data.rows, state, data.asOf);
    entries = TX.toEntries(rows, data).sort(compare);
    var pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
    if (page >= pages) page = pages - 1;
    renderTabs();
    renderHead();
    renderSummary();
    renderInsights();
    el.table.hidden = view === "area";
    el.cards.hidden = view === "area";
    el.pager.hidden = view === "area";
    el.area.hidden = view !== "area";
    if (view === "area") renderArea();
    TX.search.activeChips(el.chips, state, function (s, why) {
      onFilterChange(s, why);
      filters.render();
    }, { asOf: data.asOf });
    filters.drawCharts();
    var badge = el.filterToggle.querySelector(".tx-badge");
    var n = filterCount();
    badge.hidden = !n;
    badge.textContent = n;
    renderBody();
    renderPager(pages);
  }

  function renderSummary() {
    var s = TX.summary(rows);
    var med = median(rows.map(function (r) { return r.price; }));
    el.summary.innerHTML = "<strong>" + s.count.toLocaleString("en-US") + "</strong> " + (s.count === 1 ? "sale" : "sales") +
      (s.count ? " · <strong>" + fmt.moneyShort(s.total) + "</strong> total · median " + fmt.moneyShort(med) : "");
    el.csv.disabled = !rows.length;
  }

  // ------------------------------------------------------- market overview
  var insightsOpen = TX.prefs.get("insights-open", window.innerWidth > 720);
  function setInsightsOpen(open) {
    insightsOpen = open;
    el.insights.classList.toggle("is-collapsed", !open);
    el.insightsToggle.setAttribute("aria-expanded", String(open));
  }
  setInsightsOpen(insightsOpen);
  el.insightsToggle.addEventListener("click", function () {
    setInsightsOpen(!insightsOpen);
    TX.prefs.set("insights-open", insightsOpen);
    track("insights", insightsOpen ? "open" : "close");
    if (insightsOpen) renderInsights();
  });

  function renderInsights() {
    el.insightsRange.textContent = TX.dateRangeLabel(state, data.asOf) + (TX.isDefault(state) ? "" : " · filtered");
    if (!insightsOpen) return;
    TX.insights.pulse(el.pulse, {
      rows: data.rows, state: state, asOf: data.asOf,
      onCounties: function (cs) {
        var s = TX.serializeState(state);
        s.counties = cs;
        onFilterChange(s, "pulse_counties");
        filters.render();
      },
    });
    TX.insights.topDeals(el.deals, entries, function (id) {
      track("top_deal", id);
      view = "list";
      reveal(id);
      var r = data.byId[id];
      if (data.assemblages[id]) peer.send("assemblage", id);
      else if (r && r.located) peer.send("select", id);
    });
  }

  // ---------------------------------------------------------------- by area
  var AREA_COLS = [
    { key: "area", label: "Area" },
    { key: "county", label: "County", cls: "col-county" },
    { key: "count", label: "Sales", num: true },
    { key: "volume", label: "Volume", num: true },
    { key: "median", label: "Median price", num: true },
    { key: "financed", label: "Financed", num: true, cls: "col-mortgage" },
    { key: "top", label: "Biggest sale", cls: "col-top" },
  ];
  function renderArea() {
    var list = TX.insights.areaRows(rows);
    var k = areaSort.key;
    list.sort(function (a, b) {
      var va = k === "area" ? (a.city || "~") : k === "top" ? a.top.price : a[k];
      var vb = k === "area" ? (b.city || "~") : k === "top" ? b.top.price : b[k];
      if (typeof va === "string") return va.localeCompare(vb) * areaSort.dir;
      return ((va || 0) - (vb || 0)) * areaSort.dir;
    });
    var shown = areaAll ? list : list.slice(0, 25);
    if (!list.length) {
      el.area.innerHTML = '<p class="tx-empty">No sales match these filters.</p>';
      return;
    }
    el.area.innerHTML = '<table class="tx-table tx-area-table"><thead><tr>' + AREA_COLS.map(function (c) {
      var active = areaSort.key === c.key;
      return '<th scope="col" class="' + [c.num ? "num" : "", c.cls || ""].join(" ").trim() + '"' +
        (active ? ' aria-sort="' + (areaSort.dir < 0 ? "descending" : "ascending") + '"' : "") +
        '><button type="button" data-area-sort="' + c.key + '">' + c.label +
        '<span class="tx-sort-ind" aria-hidden="true">' + (active ? (areaSort.dir < 0 ? "▼" : "▲") : "") + "</span></button></th>";
    }).join("") + "</tr></thead><tbody>" + shown.map(function (a) {
      var clickable = !!a.city;
      return '<tr class="' + (clickable ? "tx-row" : "") + '"' + (clickable ? ' tabindex="0" data-city="' + fmt.escape(a.city) + '"' : "") + ">" +
        '<td><span class="tx-addr">' + (a.city ? fmt.escape(a.city) : '<span class="tx-muted">City not recorded</span>') + "</span></td>" +
        '<td class="col-county">' + fmt.escape(a.county) + "</td>" +
        '<td class="num">' + a.count.toLocaleString("en-US") + "</td>" +
        '<td class="num"><strong>' + fmt.moneyShort(a.volume) + "</strong></td>" +
        '<td class="num">' + fmt.moneyShort(a.median) + "</td>" +
        '<td class="num col-mortgage">' + (a.financed == null ? "—" : Math.round(a.financed * 100) + "%") + "</td>" +
        '<td class="col-top"><span class="tx-addr-sub">' + fmt.moneyShort(a.top.price) + " · " + fmt.escape(a.top.address || "Address unavailable") + "</span></td></tr>";
    }).join("") + "</tbody></table>" +
      '<p class="tx-area-note">' + (list.length > 25 && !areaAll ? '<button type="button" class="tx-btn" data-area-all>Show all ' + list.length + " areas</button> " : "") +
      (list.some(function (a) { return !a.city; }) ? '<span class="tx-muted">Miami-Dade records don’t include a city yet, so its sales are grouped by county. Tap a city to filter to it.</span>' : '<span class="tx-muted">Tap a city to filter to it.</span>') + "</p>";
  }
  el.area.addEventListener("click", function (e) {
    var s = e.target.closest("[data-area-sort]");
    if (s) {
      var k = s.getAttribute("data-area-sort");
      areaSort = areaSort.key === k ? { key: k, dir: -areaSort.dir } : { key: k, dir: k === "area" || k === "county" ? 1 : -1 };
      renderArea();
      return;
    }
    if (e.target.closest("[data-area-all]")) { areaAll = true; renderArea(); return; }
    var tr = e.target.closest("tr[data-city]");
    if (tr) pickCity(tr.getAttribute("data-city"));
  });
  el.area.addEventListener("keydown", function (e) {
    var tr = e.target.closest("tr[data-city]");
    if (tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); pickCity(tr.getAttribute("data-city")); }
  });
  function pickCity(city) {
    var s = TX.serializeState(state);
    s.place = { kind: "city", value: city, label: city };
    view = "list";
    track("area_pick", city);
    onFilterChange(s, "area");
  }

  function filterCount() {
    var d = TX.defaultState(), n = 0;
    if (state.days !== d.days) n++;
    if (state.price !== d.price) n++;
    if (state.financed !== d.financed) n++;
    if (state.counties.length !== d.counties.length) n++;
    if (state.categories.length !== d.categories.length) n++;
    return n;
  }

  function median(a) {
    if (!a.length) return null;
    a = a.slice().sort(function (x, y) { return x - y; });
    var m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  function placeLine(r) {
    return [r.city, r.zip].filter(Boolean).join(" ");
  }

  function catCell(r) {
    return '<span class="tx-cat"><i class="tx-swatch" data-cat="' + r.category + '"></i>' + r.category + "</span>";
  }

  function detailList(r) {
    var items = [];
    if (r.financed && r.loan) items.push(["Mortgage", fmt.money(r.loan) + (r.price ? ' <span class="tx-muted">(' + Math.round((r.loan / r.price) * 100) + "% of price)</span>" : "")]);
    else items.push(["Mortgage", r.financed ? "Recorded" : "None recorded with the deed"]);
    if (TX.hasPrevSale(r)) {
      var chg = (r.price - r.prevPrice) / r.prevPrice;
      items.push(["Previous sale", fmt.money(r.prevPrice) + (r.prevDate ? " · " + fmt.date(r.prevDate) : "") +
        (isFinite(chg) && Math.abs(chg) < 20 ? ' <span class="tx-muted">(' + (chg >= 0 ? "+" : "") + Math.round(chg * 100) + "%)</span>" : "")]);
    }
    if (r.parcelCount > 1) items.push(["Parcels", r.parcelCount + " parcels in one deal"]);
    if (r.useDetail) items.push(["County use code", fmt.escape(fmt.title(r.useDetail))]);
    if (r.parcelId) items.push(["Parcel ID", fmt.escape(r.parcelId)]);
    if (r.instrument) items.push(["Deed instrument #", fmt.escape(r.instrument)]);
    return '<dl class="tx-facts">' + items.map(function (x) { return "<div><dt>" + x[0] + "</dt><dd>" + x[1] + "</dd></div>"; }).join("") + "</dl>";
  }

  // Aerial thumbnail (when the sale is mapped) beside the facts.
  function expandBody(r) {
    var img = TX.aerialUrl(r, 240, 130);
    return '<div class="tx-expand-grid">' +
      (img ? '<img class="tx-expand-img" loading="lazy" alt="Satellite view of ' + fmt.escape(r.address || "the property") + '" src="' + fmt.escape(img) + '">' : "") +
      "<div>" + detailList(r) + actions(r) + "</div></div>";
  }

  function actions(r) {
    var out = "";
    if (r.parcelUrl) out += '<a class="tx-btn" href="' + fmt.escape(r.parcelUrl) + '" target="_blank" rel="noopener">Property record ↗</a>';
    if (r.located && peer.hasPeer("map")) out += '<button type="button" class="tx-btn" data-act="map" data-id="' + fmt.escape(r.id) + '">Show on map</button>';
    return out ? '<div class="tx-actions">' + out + "</div>" : "";
  }

  function renderBody() {
    var slice = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    if (!slice.length) {
      var searching = state.q || state.place || state.party;
      var narrowed = filterCount() > 0 || state.bbox;
      var what = state.q ? "“" + fmt.escape(state.q) + "”" : state.place ? fmt.escape(state.place.label) : state.party ? fmt.escape(state.party.label) : "";
      var msg = searching
        ? "No sales match " + what + (narrowed ? " with these filters." : " in the last " + state.days + " days.") +
          (narrowed ? ' <button type="button" class="tx-reset" data-act="widen">Search all sales</button>' : "")
        : "No sales match these filters." + (TX.isDefault(state) ? "" : ' <button type="button" class="tx-reset" data-act="reset">Reset filters</button>');
      el.tbody.innerHTML = '<tr><td class="tx-empty" colspan="' + COLS.length + '">' + msg + "</td></tr>";
      el.cards.innerHTML = '<li class="tx-empty">' + msg + "</li>";
      return;
    }
    var html = "", cards = "";
    slice.forEach(function (r) {
      if (r.kind === "assemblage") {
        var a = renderAssemblage(r);
        html += a.row;
        cards += a.card;
        return;
      }
      var open = r.id === openId;
      var addr = r.address ? fmt.escape(r.address) : '<span class="tx-muted">Address unavailable</span>';
      html += '<tr class="tx-row' + (open ? " is-open" : "") + '" data-id="' + fmt.escape(r.id) + '" tabindex="0" aria-expanded="' + open + '">' +
        '<td class="tx-nowrap">' + fmt.date(r.date, { month: "short", day: "numeric" }) + "</td>" +
        '<td><span class="tx-addr">' + addr + '<span class="tx-addr-sub">' + fmt.escape(placeLine(r)) +
        '<span class="tx-sub-county">' + (placeLine(r) ? " · " : "") + fmt.escape(r.county) + " County</span></span></span></td>" +
        '<td class="tx-nowrap col-county">' + fmt.escape(r.county) + "</td>" +
        "<td>" + catCell(r) + "</td>" +
        '<td class="num"><strong>' + fmt.money(r.price) + "</strong></td>" +
        partyCells(r) +
        '<td class="col-mortgage">' + (r.financed ? (r.loan ? fmt.moneyShort(r.loan) : "Yes") : '<span class="tx-muted">—</span>') + "</td></tr>";
      if (open) html += '<tr class="tx-expand"><td colspan="' + COLS.length + '">' + expandBody(r) + "</td></tr>";

      cards += '<li class="tx-card" data-id="' + fmt.escape(r.id) + '"><div class="tx-card-top"><span class="tx-addr">' + addr +
        '<span class="tx-addr-sub">' + fmt.escape([placeLine(r), r.county].filter(Boolean).join(" · ")) + "</span></span>" +
        '<span class="tx-card-price">' + fmt.moneyShort(r.price) + "</span></div>" +
        '<div class="tx-card-meta"><span>' + fmt.date(r.date) + "</span>" + catCell(r) +
        "<span>" + (r.financed ? "Financed" : "No mortgage recorded") + "</span></div>" +
        '<div class="tx-card-parties">' + cardParties(r) + "</div>" +
        "<details" + (open ? " open" : "") + "><summary>Details</summary>" + expandBody(r) + "</details></li>";
    });
    el.tbody.innerHTML = html;
    el.cards.innerHTML = cards;
  }

  // One grouped row for a same-day assemblage; expanding lists every deed.
  function renderAssemblage(a) {
    var open = a.id === openId;
    var n = a.members.length;
    var badge = '<span class="tx-assm">' + fmt.escape(a.label) + "</span>";
    var lead = a.lead.address ? fmt.escape(a.lead.address) : "Address unavailable";
    var more = " + " + (n - 1) + " more";
    var anyMapped = a.members.some(function (m) { return m.located; });
    var membersHtml =
      '<p class="tx-assm-note">' + (a.type === "building"
        ? "Units in one building recorded to the same " + (a.partiesDirected ? "buyer" : "party") + " on " + fmt.date(a.date)
        : "Adjacent parcels recorded to related " + (a.partiesDirected ? "buyers" : "parties") + " on " + fmt.date(a.date)) +
      ", each on its own deed. The total adds up the individual deed prices.</p>" +
      '<table class="tx-members"><thead><tr><th scope="col">Property</th><th scope="col" class="num">Price</th>' + (a.partiesDirected ? '<th scope="col">Buyer</th><th scope="col">Seller</th>' : '<th scope="col" colspan="2">Parties</th>') + '<th scope="col"><span class="tx-sr">Links</span></th></tr></thead><tbody>' +
      a.members.map(function (m) {
        var links = "";
        if (m.parcelUrl) links += '<a href="' + fmt.escape(m.parcelUrl) + '" target="_blank" rel="noopener">Record ↗</a> ';
        if (m.located && peer.hasPeer("map")) links += '<button type="button" class="tx-linkbtn" data-act="map" data-id="' + fmt.escape(m.id) + '">Map</button>';
        return '<tr' + (m.id === focusMember ? ' class="is-focus"' : "") + ' data-member="' + fmt.escape(m.id) + '"><td>' + (m.address ? fmt.escape(m.address) : '<span class="tx-muted">Address unavailable</span>') +
          '<span class="tx-addr-sub">' + fmt.escape(m.category) + (m.date !== a.date ? " · " + fmt.dateShort(m.date) : "") + "</span></td>" +
          '<td class="num">' + fmt.money(m.price) + "</td>" +
          partyCells(m) + "<td>" + links + "</td></tr>";
      }).join("") + "</tbody></table>" +
      (anyMapped && peer.hasPeer("map") ? '<div class="tx-actions"><button type="button" class="tx-btn" data-act="map-assemblage" data-id="' + fmt.escape(a.id) + '">Show all on map</button></div>' : "");

    var row = '<tr class="tx-row tx-row-assm' + (open ? " is-open" : "") + '" data-id="' + fmt.escape(a.id) + '" tabindex="0" aria-expanded="' + open + '">' +
      "<td>" + fmt.date(a.date, { month: "short", day: "numeric" }) + "</td>" +
      '<td><span class="tx-addr">' + badge + lead + '<span class="tx-addr-sub">' + more +
      '<span class="tx-sub-county"> · ' + fmt.escape(a.county) + "</span></span></span></td>" +
      '<td class="tx-nowrap col-county">' + fmt.escape(a.county) + "</td>" +
      "<td>" + catCell(a) + "</td>" +
      '<td class="num"><strong>' + fmt.money(a.price) + '</strong><span class="tx-addr-sub">combined</span></td>' +
      (a.partiesDirected
        ? '<td class="tx-party">' + fmt.escape(TX.partySummary(a.buyers, "buyer")) + "</td>" +
          '<td class="tx-party">' + fmt.escape(TX.partySummary(a.sellers, "seller")) + "</td>"
        : '<td class="tx-party" colspan="2"><span class="tx-muted">Parties:</span> ' + fmt.escape(TX.partySummary(a.parties, "party")) + "</td>") +
      '<td class="col-mortgage">' + (a.financed ? "Some" : '<span class="tx-muted">—</span>') + "</td></tr>";
    if (open) row += '<tr class="tx-expand"><td colspan="' + COLS.length + '">' + membersHtml + "</td></tr>";

    var card = '<li class="tx-card" data-id="' + fmt.escape(a.id) + '">' + badge +
      '<div class="tx-card-top"><span class="tx-addr">' + lead + '<span class="tx-addr-sub">' + more + " · " + fmt.escape(a.county) + "</span></span>" +
      '<span class="tx-card-price">' + fmt.moneyShort(a.price) + '<span class="tx-addr-sub">combined</span></span></div>' +
      '<div class="tx-card-meta"><span>' + fmt.date(a.date) + "</span>" + catCell(a) + "</div>" +
      '<div class="tx-card-parties">' + (a.partiesDirected
        ? "<strong>Buyers:</strong> " + fmt.escape(TX.partySummary(a.buyers, "buyer")) +
          "<br><strong>Sellers:</strong> " + fmt.escape(TX.partySummary(a.sellers, "seller"))
        : "<strong>Parties:</strong> " + fmt.escape(TX.partySummary(a.parties, "party"))) + "</div>" +
      "<details" + (open ? " open" : "") + "><summary>All " + n + " deeds</summary>" + membersHtml + "</details></li>";
    return { row: row, card: card };
  }

  // Buyer + Seller cells, or one spanning "Parties" cell when roles are unknown.
  function partyCells(r) {
    if (r.partiesDirected) {
      return '<td class="tx-party">' + fmt.escape(fmt.party(r.buyer)) + "</td>" +
        '<td class="tx-party">' + fmt.escape(fmt.party(r.seller)) + "</td>";
    }
    return '<td class="tx-party" colspan="2" title="' + fmt.escape(TX.PARTY_NOTE) + '"><span class="tx-muted">Parties:</span> ' +
      fmt.escape(TX.partyLine(r)) + "</td>";
  }

  function cardParties(r) {
    if (r.partiesDirected) {
      return "<strong>Buyer:</strong> " + fmt.escape(fmt.party(r.buyer)) + "<br><strong>Seller:</strong> " + fmt.escape(fmt.party(r.seller));
    }
    return "<strong>Parties:</strong> " + fmt.escape(TX.partyLine(r));
  }

  function renderPager(pages) {
    var from = entries.length ? page * PAGE_SIZE + 1 : 0;
    var to = Math.min(entries.length, (page + 1) * PAGE_SIZE);
    var nums = pageNumbers(page, pages);
    el.pager.innerHTML = "<span>" + from.toLocaleString("en-US") + "–" + to.toLocaleString("en-US") + " of " +
      entries.length.toLocaleString("en-US") + "</span>" +
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
    var out = [0];
    var a = Math.max(1, p - 1), b = Math.min(n - 2, p + 1);
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
    app.scrollIntoView({ block: "start" });
  });

  function toggleRow(id) {
    openId = openId === id ? null : id;
    focusMember = null;
    if (openId) track("expand", id);
    renderBody();
  }

  el.tbody.addEventListener("click", function (e) {
    if (handleAction(e)) return;
    if (e.target.closest("a")) return;
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
    } else if (act === "map-assemblage") {
      peer.send("assemblage", b.getAttribute("data-id"));
      track("show_assemblage_on_map", b.getAttribute("data-id"));
    } else if (act === "widen") {
      // Keep what they searched for; drop everything else that narrows it.
      var w = TX.defaultState();
      w.q = state.q;
      w.place = state.place;
      w.party = state.party;
      w.days = 60;
      onFilterChange(w, "widen");
      filters.render();
    } else if (act === "reset") {
      onFilterChange(TX.defaultState(), "reset");
      filters.render();
    }
    return true;
  }

  function cssEscape(s) {
    return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"');
  }

  // Map asked to reveal a sale: jump to its page and open it.
  function entryIdFor(id) {
    var r = data.byId[id];
    return r && r.assemblageId && data.assemblages[r.assemblageId] ? r.assemblageId : id;
  }

  function reveal(id) {
    if (view === "area") { view = "list"; refresh(); }
    var eid = entryIdFor(id);
    var i = entries.findIndex(function (e) { return e.id === eid; });
    if (i < 0) return;
    page = Math.floor(i / PAGE_SIZE);
    openId = eid;
    focusMember = eid !== id ? id : null;
    renderBody();
    renderPager(Math.max(1, Math.ceil(entries.length / PAGE_SIZE)));
    var tr = el.tbody.querySelector('tr.tx-row[data-id="' + cssEscape(eid) + '"]') ||
      el.cards.querySelector('li[data-id="' + cssEscape(eid) + '"]');
    if (tr) tr.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  // ------------------------------------------------------------------ CSV
  el.csv.hidden = !csvEnabled;
  el.csv.addEventListener("click", function () {
    var head = ["Recorded", "Address", "City", "ZIP", "County", "Type", "Price", "Buyer", "Seller", "Financed", "Mortgage", "Previous price", "Previous date", "Parcels", "Parcel ID", "Use code", "Property record", "Assemblage", "Buyer/seller roles verified"];
    var lines = [head].concat(rows.map(function (r) {
      return [r.date, r.address, r.city, r.zip, r.county, r.category, r.price, r.buyer, r.seller, r.financed ? "Yes" : "No",
        r.loan, r.prevPrice, r.prevDate, r.parcelCount, r.parcelId, r.useDetail, r.parcelUrl, r.assemblageId, r.partiesDirected ? "Yes" : "No"];
    })).map(function (cols) {
      return cols.map(function (v) {
        v = v == null ? "" : String(v);
        if (/^[=+\-@]/.test(v)) v = "'" + v; // keep spreadsheets from evaluating cells
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(",");
    });
    var blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "trd-south-florida-sales-" + data.asOf + ".csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    track("csv", rows.length);
  });

  // ------------------------------------------------------------------ peer
  var peer = TX.link("table", function (msg) {
    if (!data) return;
    if (msg.type === "filters" && msg.payload) {
      state = msg.payload;
      box.cancel();
      box.set(state.q);
      page = 0;
      filters.render();
      refresh();
    } else if (msg.type === "select" || msg.type === "reveal") {
      if (msg.type === "reveal") reveal(msg.payload);
      else if (rows.some(function (r) { return r.id === msg.payload; })) {
        openId = entryIdFor(msg.payload);
        focusMember = openId !== msg.payload ? msg.payload : null;
        renderBody();
      }
    } else if (msg.type === "hello" && !TX.isDefault(state)) {
      peer.send("filters", TX.serializeState(state));
    }
  });

  // ------------------------------------------------------------------ boot
  TX.load()
    .then(function (d) {
      data = d;
      data.byId = {};
      data.rows.forEach(function (r) { data.byId[r.id] = r; });
      el.asof.textContent = TX.asOfText(data) + ". Deeds of $100,000 or more recorded in Miami-Dade, Broward and Palm Beach counties.";
      el.loading.hidden = true;
      refresh();
      var sale = params.get("sale");
      if (sale) reveal(sale);
      track("loaded", data.rows.length);
    })
    .catch(function () {
      el.loading.innerHTML = "<span>Sales data couldn’t load. Please try again later.</span>";
    });
})();
