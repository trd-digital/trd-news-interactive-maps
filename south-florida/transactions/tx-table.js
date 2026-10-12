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
  var rows = [];
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
    loading: app.querySelector(".tx-loading"),
  };

  var filters = TX.filterBar(el.filterHost, function () { return TX.serializeState(state); }, onFilterChange, {
    showCategories: true,
  });

  el.filterToggle.addEventListener("click", function () {
    var open = !el.filters.classList.contains("is-open");
    el.filters.classList.toggle("is-open", open);
    el.filterToggle.setAttribute("aria-expanded", String(open));
  });

  function onFilterChange(next, why) {
    state = next;
    if (why !== "search") track("filter", why);
    page = 0;
    refresh();
    peer.send("filters", TX.serializeState(state));
  }

  // ------------------------------------------------------------------ tabs
  el.tabs.addEventListener("click", function (e) {
    var b = e.target.closest(".tx-tab");
    if (!b) return;
    sort = b.getAttribute("data-tab") === "biggest" ? { key: "price", dir: -1 } : { key: "date", dir: -1 };
    page = 0;
    track("tab", b.getAttribute("data-tab"));
    refresh();
  });

  function renderTabs() {
    var latest = sort.key === "date" && sort.dir === -1;
    var biggest = sort.key === "price" && sort.dir === -1;
    el.tabs.querySelectorAll(".tx-tab").forEach(function (b) {
      var on = b.getAttribute("data-tab") === "latest" ? latest : biggest;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });
  }

  // ------------------------------------------------------------------ sort
  var COLS = [
    { key: "date", label: "Recorded", sortable: true },
    { key: "address", label: "Property", sortable: true },
    { key: "county", label: "County", sortable: true },
    { key: "category", label: "Type", sortable: true },
    { key: "price", label: "Price", sortable: true, num: true },
    { key: "buyer", label: "Buyer" },
    { key: "seller", label: "Seller" },
    { key: "financed", label: "Mortgage", sortable: true },
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
      var cls = c.num ? ' class="num"' : "";
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
    rows = TX.apply(data.rows, state, data.asOf).sort(compare);
    var pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (page >= pages) page = pages - 1;
    renderTabs();
    renderHead();
    renderSummary();
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
    return '<dl class="tx-dl">' + items.map(function (x) { return "<dt>" + x[0] + "</dt><dd>" + x[1] + "</dd>"; }).join("") + "</dl>";
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
      var msg = "No sales match these filters." + (TX.isDefault(state) ? "" : ' <button type="button" class="tx-reset" data-act="reset">Reset filters</button>');
      el.tbody.innerHTML = '<tr><td class="tx-empty" colspan="' + COLS.length + '">' + msg + "</td></tr>";
      el.cards.innerHTML = '<li class="tx-empty">' + msg + "</li>";
      return;
    }
    var html = "", cards = "";
    slice.forEach(function (r) {
      var open = r.id === openId;
      var addr = r.address ? fmt.escape(r.address) : '<span class="tx-muted">Address unavailable</span>';
      html += '<tr class="tx-row' + (open ? " is-open" : "") + '" data-id="' + fmt.escape(r.id) + '" tabindex="0" aria-expanded="' + open + '">' +
        "<td>" + fmt.date(r.date, { month: "short", day: "numeric" }) + "</td>" +
        '<td><span class="tx-addr">' + addr + '<span class="tx-addr-sub">' + fmt.escape(placeLine(r)) + "</span></span></td>" +
        "<td>" + fmt.escape(r.county) + "</td>" +
        "<td>" + catCell(r) + "</td>" +
        '<td class="num"><strong>' + fmt.money(r.price) + "</strong></td>" +
        '<td class="tx-party">' + fmt.escape(fmt.party(r.buyer)) + "</td>" +
        '<td class="tx-party">' + fmt.escape(fmt.party(r.seller)) + "</td>" +
        "<td>" + (r.financed ? (r.loan ? fmt.moneyShort(r.loan) : "Yes") : '<span class="tx-muted">—</span>') + "</td></tr>";
      if (open) html += '<tr class="tx-expand"><td colspan="' + COLS.length + '">' + detailList(r) + actions(r) + "</td></tr>";

      cards += '<li class="tx-card" data-id="' + fmt.escape(r.id) + '"><div class="tx-card-top"><span class="tx-addr">' + addr +
        '<span class="tx-addr-sub">' + fmt.escape([placeLine(r), r.county].filter(Boolean).join(" · ")) + "</span></span>" +
        '<span class="tx-card-price">' + fmt.moneyShort(r.price) + "</span></div>" +
        '<div class="tx-card-meta"><span>' + fmt.date(r.date) + "</span>" + catCell(r) +
        "<span>" + (r.financed ? "Financed" : "No mortgage recorded") + "</span></div>" +
        '<div class="tx-card-parties"><strong>Buyer:</strong> ' + fmt.escape(fmt.party(r.buyer)) +
        "<br><strong>Seller:</strong> " + fmt.escape(fmt.party(r.seller)) + "</div>" +
        "<details" + (open ? " open" : "") + "><summary>Details</summary>" + detailList(r) + actions(r) + "</details></li>";
    });
    el.tbody.innerHTML = html;
    el.cards.innerHTML = cards;
  }

  function renderPager(pages) {
    var from = rows.length ? page * PAGE_SIZE + 1 : 0;
    var to = Math.min(rows.length, (page + 1) * PAGE_SIZE);
    var nums = pageNumbers(page, pages);
    el.pager.innerHTML = "<span>" + from.toLocaleString("en-US") + "–" + to.toLocaleString("en-US") + " of " +
      rows.length.toLocaleString("en-US") + "</span>" +
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
  function reveal(id) {
    var i = rows.findIndex(function (r) { return r.id === id; });
    if (i < 0) return;
    page = Math.floor(i / PAGE_SIZE);
    openId = id;
    refresh();
    var tr = el.tbody.querySelector('tr.tx-row[data-id="' + cssEscape(id) + '"]') ||
      el.cards.querySelector('li[data-id="' + cssEscape(id) + '"]');
    if (tr) tr.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  // ------------------------------------------------------------------ CSV
  el.csv.hidden = !csvEnabled;
  el.csv.addEventListener("click", function () {
    var head = ["Recorded", "Address", "City", "ZIP", "County", "Type", "Price", "Buyer", "Seller", "Financed", "Mortgage", "Previous price", "Previous date", "Parcels", "Parcel ID", "Use code", "Property record"];
    var lines = [head].concat(rows.map(function (r) {
      return [r.date, r.address, r.city, r.zip, r.county, r.category, r.price, r.buyer, r.seller, r.financed ? "Yes" : "No",
        r.loan, r.prevPrice, r.prevDate, r.parcelCount, r.parcelId, r.useDetail, r.parcelUrl];
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
      page = 0;
      filters.render();
      refresh();
    } else if (msg.type === "select" || msg.type === "reveal") {
      if (msg.type === "reveal") reveal(msg.payload);
      else if (rows.some(function (r) { return r.id === msg.payload; })) {
        openId = msg.payload;
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
