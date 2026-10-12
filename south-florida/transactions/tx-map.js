/*!
 * tx-map.js — South Florida Live Transactions map.
 * Depends on: mapbox-gl, TRD theme.js (TrdTheme), tx-core.js (TX).
 */
(function () {
  "use strict";

  var TOKEN = "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";
  var STYLES = { light: "mapbox://styles/mapbox/light-v11", dark: "mapbox://styles/mapbox/dark-v11" };
  var SOFLA_BOUNDS = [[-80.95, 25.1], [-79.95, 27.0]];

  var GROUPS = [
    { id: "residential", label: "Residential", cats: ["Residential"] },
    { id: "commercial", label: "Commercial & multifamily", cats: ["Commercial", "Multifamily"] },
    { id: "land", label: "Land", cats: ["Land"] },
    { id: "other", label: "Other / unclassified", cats: ["Other"] },
  ];
  // Must match --tx-* tokens in tx.css (validated light/dark steps).
  var COLORS = {
    light: { residential: "#2a78d6", commercial: "#eb6834", land: "#1baf7a", other: "#9a9993", ring: "#ffffff", sel: "#111111" },
    dark: { residential: "#3987e5", commercial: "#d95926", land: "#199e70", other: "#8a8984", ring: "#212121", sel: "#ffffff" },
  };

  // Circle area tracks price (sqrt), so a $10M sale reads ~3x a $1M sale, not 10x.
  var PRICE_STOPS = [1e5, 1e6, 1e7, 1e8];
  var RADIUS_BY_ZOOM = {
    8: [1.5, 2.5, 5, 10],
    11: [2.5, 4, 8, 15],
    14: [4, 6.5, 12, 22],
  };
  function radiusExpr(extra) {
    extra = extra || 0;
    var price = ["to-number", ["get", "price"], 0];
    var expr = ["interpolate", ["linear"], ["zoom"]];
    Object.keys(RADIUS_BY_ZOOM).forEach(function (z) {
      var r = RADIUS_BY_ZOOM[z];
      var inner = ["interpolate", ["linear"], ["sqrt", price]];
      PRICE_STOPS.forEach(function (p, i) {
        inner.push(Math.sqrt(p), r[i] + extra);
      });
      expr.push(+z, inner);
    });
    return expr;
  }
  function radiusAt(zoom, price) {
    var zs = Object.keys(RADIUS_BY_ZOOM).map(Number);
    function at(z) {
      var r = RADIUS_BY_ZOOM[z];
      var s = Math.sqrt(price);
      for (var i = 1; i < PRICE_STOPS.length; i++) {
        var a = Math.sqrt(PRICE_STOPS[i - 1]), b = Math.sqrt(PRICE_STOPS[i]);
        if (s <= b || i === PRICE_STOPS.length - 1) {
          var t = Math.max(0, Math.min(1, (s - a) / (b - a)));
          return r[i - 1] + t * (r[i] - r[i - 1]);
        }
      }
    }
    if (zoom <= zs[0]) return at(zs[0]);
    for (var j = 1; j < zs.length; j++) {
      if (zoom <= zs[j]) {
        var t = (zoom - zs[j - 1]) / (zs[j] - zs[j - 1]);
        return at(zs[j - 1]) + t * (at(zs[j]) - at(zs[j - 1]));
      }
    }
    return at(zs[zs.length - 1]);
  }

  var fmt = TX.fmt;
  var track = TX.tracker("south-florida-transactions-map");
  var params = new URLSearchParams(location.search);
  var isEmbed = window.self !== window.top;
  var app = document.getElementById("tx-app");
  var compact = params.get("view") === "dashboard" || window.innerHeight < 450;
  if (compact) app.classList.add("tx-compact");

  var state = TX.stateFromUrl();
  var data = null;
  var visible = [];
  var map = null;
  var selectedId = null;
  var selectedAid = null; // open assemblage: all members get the selection ring
  var hoverPopup = null;
  var theme = "light";

  // ------------------------------------------------------------------ theme
  // TRD's theme.js owns the theme: init() reads the OS setting, then (in an
  // iframe) asks the parent page with {getTheme:true} and applies the parent's
  // {setTheme:"dark"|"light"} reply to <body data-bs-theme>. We mirror it onto
  // <html> and restyle the map.
  var trdTheme = typeof TrdTheme === "function"
    ? TrdTheme({
        updateCallback: function (t) {
          setTheme(t);
          track("theme", t);
        },
      })
    : null;
  function setTheme(t) {
    if (t !== "dark" && t !== "light") return;
    var changed = t !== theme;
    theme = t;
    document.documentElement.setAttribute("data-bs-theme", t);
    document.body.setAttribute("data-bs-theme", t);
    if (map && changed) map.setStyle(STYLES[t]); // style.load re-adds our layers
  }
  if (trdTheme) trdTheme.init();
  theme = (trdTheme && trdTheme.get()) ||
    (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-bs-theme", theme);
  document.body.setAttribute("data-bs-theme", theme);

  // ------------------------------------------------------------------ DOM
  var el = {
    topbar: app.querySelector(".tx-topbar"),
    count: app.querySelector(".tx-count"),
    filterToggle: app.querySelector(".tx-filter-toggle"),
    filterPanel: app.querySelector(".tx-filter-panel"),
    results: app.querySelector(".tx-results"),
    legend: app.querySelector(".tx-legend"),
    note: app.querySelector(".tx-mapnote"),
    detail: app.querySelector(".tx-detail"),
    loading: app.querySelector(".tx-loading"),
  };

  // Search lives in the top bar; filter chips in the dropdown panel.
  el.topbar.insertAdjacentHTML("afterbegin", TX.searchHtml(state.q, "Search address, buyer, seller"));
  var searchEl = el.topbar.querySelector(".tx-search");
  var searchInput = searchEl.querySelector("input");
  TX.bindSearch(searchInput, getState, function (s) {
    onFilterChange(s, "search");
  });
  var filters = TX.filterBar(el.filterPanel, getState, onFilterChange, { noSearch: true, showCategories: false });

  function getState() {
    return TX.serializeState(state);
  }

  el.filterToggle.addEventListener("click", function () {
    var open = el.filterPanel.hidden;
    el.filterPanel.hidden = !open;
    el.filterToggle.setAttribute("aria-expanded", String(open));
    if (open) track("filters", "open");
  });
  document.addEventListener("click", function (e) {
    if (!el.filterPanel.hidden && !el.filterPanel.contains(e.target) && !el.filterToggle.contains(e.target)) {
      el.filterPanel.hidden = true;
      el.filterToggle.setAttribute("aria-expanded", "false");
    }
    if (!el.results.hidden && !el.results.contains(e.target) && !searchEl.contains(e.target)) {
      el.results.hidden = true;
    }
  });

  // ------------------------------------------------------------- filtering
  function onFilterChange(next, why) {
    state = next;
    if (why !== "search") track("filter", why);
    refresh();
    peer.send("filters", TX.serializeState(state));
    if (why === "search") renderResults();
  }

  function activeFilterCount() {
    var d = TX.defaultState(), n = 0;
    if (state.days !== d.days) n++;
    if (state.price !== d.price) n++;
    if (state.financed !== d.financed) n++;
    if (state.counties.length !== d.counties.length) n++;
    return n;
  }

  function refresh(opts) {
    if (!data) return;
    visible = TX.apply(data.rows, state, data.asOf);
    var located = visible.filter(function (r) { return r.located; });
    var sum = TX.summary(visible);
    var catLabel = state.categories.length === 1 ? state.categories[0].toLowerCase() + " " : "";
    el.count.innerHTML = "<strong>" + sum.count.toLocaleString("en-US") + "</strong> " + catLabel +
      (sum.count === 1 ? "sale" : "sales") +
      (compact ? " · last " + state.days + " days" : "") +
      (sum.count ? '<span class="tx-count-total"> · ' + fmt.moneyShort(sum.total) + "</span>" : "");
    var n = activeFilterCount();
    el.filterToggle.querySelector(".tx-badge").hidden = !n;
    el.filterToggle.querySelector(".tx-badge").textContent = n;
    var unmapped = visible.length - located.length;
    var unclassified = typeFilterGaps();
    el.note.textContent = compact
      ? "Recorded through " + fmt.date(data.asOf) + (unclassified.length ? " · " + unclassified.join(", ") + " not yet classified by type" : " · Source: county records")
      : TX.asOfText(data) +
      (unmapped ? " · " + unmapped.toLocaleString("en-US") + " sale" + (unmapped === 1 ? "" : "s") +
        " without a mappable address " + (unmapped === 1 ? "is" : "are") + " listed in the table" : "") +
      (unclassified.length ? " · " + unclassified.join(" and ") + " sales aren’t classified by type yet, so type filters leave them out" : "");
    renderLegend();
    setSource(located);
    if (opts && opts.fit) fitTo(located);
  }

  // Counties whose rows are all "Other" (no use code at the source) vanish
  // under any type filter — say so instead of silently dropping them.
  function typeFilterGaps() {
    if (state.categories.length === TX.CATEGORIES.length || state.categories.indexOf("Other") >= 0) return [];
    return TX.COUNTIES.filter(function (c) {
      return state.counties.indexOf(c) >= 0 && data.unclassifiedCounties.indexOf(c) >= 0;
    });
  }

  function toFeatures(rows) {
    return {
      type: "FeatureCollection",
      features: rows.map(function (r) {
        return {
          type: "Feature",
          id: r._n,
          geometry: { type: "Point", coordinates: [r.lng, r.lat] },
          properties: { id: r.id, price: r.price, cg: r.colorGroup, aid: r.assemblageId || "" },
        };
      }),
    };
  }

  function setSource(rows) {
    if (!map || !map.getSource("tx")) return;
    map.getSource("tx").setData(toFeatures(rows));
  }

  function fitTo(rows) {
    if (!map || !rows.length) return;
    var b = new mapboxgl.LngLatBounds();
    rows.forEach(function (r) { b.extend([r.lng, r.lat]); });
    map.fitBounds(b, { padding: compact ? 24 : 48, maxZoom: 14, duration: 0 });
  }

  // ------------------------------------------------------------------ legend
  function renderLegend() {
    var base = TX.apply(data.rows, state, data.asOf, { ignoreCategory: true });
    var counts = {};
    base.forEach(function (r) { counts[r.colorGroup] = (counts[r.colorGroup] || 0) + 1; });
    var all = state.categories.length === TX.CATEGORIES.length;
    var html = '<button type="button" class="tx-legend-toggle" aria-expanded="false">Legend</button>' +
      '<div class="tx-legend-body"><p class="tx-legend-title">Property type</p><div class="tx-legend-cats">';
    GROUPS.forEach(function (g) {
      var on = all || g.cats.some(function (c) { return state.categories.indexOf(c) >= 0; });
      html += '<button type="button" class="tx-legend-cat' + (on ? "" : " is-off") + '" data-group="' + g.id +
        '" aria-pressed="' + on + '" title="Show only ' + fmt.escape(g.label) + '">' +
        '<i class="tx-swatch" data-cat="' + g.cats[0] + '"></i>' + fmt.escape(g.label) +
        '<span class="tx-n">' + (counts[g.id] || 0).toLocaleString("en-US") + "</span></button>";
    });
    html += "</div>";
    if (!compact) {
      var z = map ? map.getZoom() : 10;
      html += '<div class="tx-legend-sizes" aria-label="Circle size shows sale price">';
      [[1e6, "$1M"], [1e7, "$10M"], [1e8, "$100M"]].forEach(function (s) {
        var d = Math.max(4, Math.round(radiusAt(z, s[0]) * 2));
        html += '<span class="tx-legend-size"><i style="width:' + d + "px;height:" + d + 'px"></i>' + s[1] + "</span>";
      });
      html += "</div>";
    }
    html += "</div>";
    var wasOpen = el.legend.classList.contains("is-open");
    el.legend.innerHTML = html;
    el.legend.querySelector(".tx-legend-toggle").setAttribute("aria-expanded", String(wasOpen));
  }

  el.legend.addEventListener("click", function (e) {
    var t = e.target.closest(".tx-legend-toggle");
    if (t) {
      var open = !el.legend.classList.contains("is-open");
      el.legend.classList.toggle("is-open", open);
      t.setAttribute("aria-expanded", String(open));
      return;
    }
    var b = e.target.closest(".tx-legend-cat");
    if (!b) return;
    var g = GROUPS.find(function (x) { return x.id === b.getAttribute("data-group"); });
    var all = state.categories.length === TX.CATEGORIES.length;
    var on = state.categories.filter(function (c) { return g.cats.indexOf(c) < 0; });
    var cats;
    if (all) cats = g.cats.slice(); // first click isolates the group
    else if (g.cats.some(function (c) { return state.categories.indexOf(c) >= 0; })) cats = on; // turn off
    else cats = state.categories.concat(g.cats); // turn on
    if (!cats.length || cats.length === TX.CATEGORIES.length) cats = TX.CATEGORIES.slice();
    var next = getState();
    next.categories = TX.CATEGORIES.filter(function (c) { return cats.indexOf(c) >= 0; });
    onFilterChange(next, "legend:" + g.id);
  });

  // ------------------------------------------------------------------ search
  var activeResult = -1;
  function renderResults() {
    var q = (state.q || "").trim();
    activeResult = -1;
    if (q.length < 2 || document.activeElement !== searchInput) {
      el.results.hidden = true;
      return;
    }
    var ql = q.toLowerCase();
    var hits = visible.slice().sort(function (a, b) {
      var as = (a.address || "").toLowerCase().indexOf(ql) === 0 ? 0 : 1;
      var bs = (b.address || "").toLowerCase().indexOf(ql) === 0 ? 0 : 1;
      return as - bs || b.price - a.price;
    }).slice(0, 8);
    if (!hits.length) {
      el.results.innerHTML = '<li class="tx-r-empty">No sales match “' + fmt.escape(q) +
        "” with the current filters.</li>";
    } else {
      el.results.innerHTML = hits.map(function (r, i) {
        return '<li><button type="button" data-id="' + fmt.escape(r.id) + '" data-i="' + i + '">' +
          '<span class="tx-r-title">' + fmt.escape(r.address || "Address unavailable") + "</span>" +
          '<span class="tx-r-sub">' + fmt.moneyShort(r.price) + " · " + fmt.dateShort(r.date) + " · " +
          fmt.escape([r.city, r.county].filter(Boolean).join(", ")) +
          (r.located ? "" : " · not on map") + "</span></button></li>";
      }).join("");
    }
    el.results.hidden = false;
  }
  searchInput.addEventListener("focus", renderResults);
  searchInput.addEventListener("keydown", function (e) {
    var items = el.results.querySelectorAll("button[data-id]");
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!items.length) return;
      e.preventDefault();
      activeResult = (activeResult + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items.forEach(function (b, i) { b.classList.toggle("is-active", i === activeResult); });
    } else if (e.key === "Enter") {
      var pick = items[Math.max(0, activeResult)];
      if (pick) pick.click();
    } else if (e.key === "Escape") {
      el.results.hidden = true;
    }
  });
  el.results.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-id]");
    if (!b) return;
    el.results.hidden = true;
    track("search_select", b.getAttribute("data-id"));
    select(b.getAttribute("data-id"), { fly: true, announce: true });
  });

  // ------------------------------------------------------------------ detail
  function rowById(id) {
    return data && data.byId[id];
  }

  function select(id, opts) {
    opts = opts || {};
    var r = rowById(id);
    if (!r) return;
    selectedId = id;
    selectedAid = null;
    renderDetail(r);
    highlight();
    if (opts.fly && r.located && map) {
      map.flyTo({
        center: [r.lng, r.lat],
        zoom: Math.max(map.getZoom(), 15),
        padding: detailPadding(),
        duration: opts.instant ? 0 : 900,
        essential: true,
      });
    }
    if (opts.announce) peer.send("select", id);
  }

  function detailPadding() {
    var narrow = window.innerWidth <= 600;
    return narrow
      ? { top: 0, bottom: Math.round(window.innerHeight * 0.45), left: 0, right: 0 }
      : { top: 0, bottom: 0, left: 0, right: 360 };
  }

  function clearSelection() {
    selectedId = null;
    selectedAid = null;
    el.detail.hidden = true;
    highlight();
  }

  function renderDetail(r) {
    var place = [r.city, r.zip].filter(Boolean).join(" ");
    var sub = [place, r.county + " County"].filter(Boolean).join(" · ");
    var tags = '<span class="tx-tag"><i class="tx-swatch" data-cat="' + r.category + '"></i>' + r.category + "</span>";
    if (r.parcelCount > 1) tags += '<span class="tx-tag">' + r.parcelCount + " parcels</span>";
    tags += '<span class="tx-tag">' + (r.financed ? "Financed" : "No mortgage recorded") + "</span>";
    if (!r.located) tags += '<span class="tx-tag">Not on map</span>';
    var asm = r.assemblageId && data.assemblages[r.assemblageId];

    var rows = [
      ["Recorded", fmt.date(r.date)],
      ["Buyer", fmt.escape(fmt.party(r.buyer))],
      ["Seller", fmt.escape(fmt.party(r.seller))],
    ];
    if (r.financed && r.loan) rows.push(["Mortgage", fmt.money(r.loan) + (r.price ? ' <span class="tx-muted">(' + Math.round((r.loan / r.price) * 100) + "% of price)</span>" : "")]);
    if (TX.hasPrevSale(r)) {
      var chg = r.prevPrice > 0 ? (r.price - r.prevPrice) / r.prevPrice : null;
      rows.push(["Previous sale", fmt.money(r.prevPrice) + (r.prevDate ? " · " + fmt.date(r.prevDate) : "") +
        (chg != null && isFinite(chg) && Math.abs(chg) < 20 ? ' <span class="tx-muted">(' + (chg >= 0 ? "+" : "") + Math.round(chg * 100) + "%)</span>" : "")]);
    }
    if (r.useDetail) rows.push(["County use code", fmt.escape(fmt.title(r.useDetail))]);
    if (r.parcelId) rows.push(["Parcel ID", fmt.escape(r.parcelId)]);

    var actions = "";
    if (r.parcelUrl) {
      actions += '<a class="tx-btn" href="' + fmt.escape(r.parcelUrl) + '" target="_blank" rel="noopener">Property record ↗</a>';
    }
    if (peer.hasPeer("table")) {
      actions += '<button type="button" class="tx-btn" data-act="table">Show in table</button>';
    }

    el.detail.innerHTML =
      '<div class="tx-detail-head"><h2 id="tx-detail-title">' + fmt.escape(r.address || "Address unavailable") +
      '<span class="tx-sub">' + fmt.escape(sub) + "</span></h2>" +
      '<button type="button" class="tx-close" aria-label="Close">×</button></div>' +
      '<div class="tx-detail-body"><div class="tx-price">' + fmt.money(r.price) + "</div>" +
      '<div class="tx-tags">' + tags + "</div>" +
      (asm ? '<button type="button" class="tx-assm-link" data-act="assemblage" data-aid="' + fmt.escape(asm.id) + '">' +
        '<span class="tx-assm">Assemblage</span>One of ' + asm.members.length + " deeds recorded together · " +
        fmt.moneyShort(asm.price) + " combined ›</button>" : "") +
      '<dl class="tx-dl">' + rows.map(function (x) { return "<dt>" + x[0] + "</dt><dd>" + x[1] + "</dd>"; }).join("") + "</dl>" +
      (actions ? '<div class="tx-actions">' + actions + "</div>" : "") + "</div>";
    el.detail.setAttribute("aria-labelledby", "tx-detail-title");
    el.detail.hidden = false;
    el.detail.querySelector(".tx-close").focus({ preventScroll: true });
  }

  function renderStack(list) {
    list = list.slice().sort(function (a, b) { return b.date < a.date ? -1 : b.date > a.date ? 1 : b.price - a.price; });
    var r0 = list[0];
    var total = list.reduce(function (s, r) { return s + r.price; }, 0);
    selectedId = null;
    highlight();
    el.detail.innerHTML =
      '<div class="tx-detail-head"><h2 id="tx-detail-title">' + list.length + " sales at this location" +
      '<span class="tx-sub">' + fmt.escape(stripUnit(r0.address) || "") + " · " + fmt.moneyShort(total) + " total</span></h2>" +
      '<button type="button" class="tx-close" aria-label="Close">×</button></div>' +
      '<div class="tx-detail-body"><ul class="tx-stack">' + list.map(function (r) {
        return '<li><button type="button" data-pick="' + fmt.escape(r.id) + '"><span class="tx-r-title">' +
          fmt.escape(r.address || "Address unavailable") + " <strong>" + fmt.moneyShort(r.price) + "</strong></span>" +
          '<span class="tx-r-sub">' + fmt.date(r.date) + " · " + fmt.escape(r.category) + "</span></button></li>";
      }).join("") + "</ul></div>";
    el.detail.setAttribute("aria-labelledby", "tx-detail-title");
    el.detail.hidden = false;
    el.detail.querySelector(".tx-close").focus({ preventScroll: true });
  }

  // "6345 Collins Ave 822" -> "6345 Collins Ave" for a building heading.
  function stripUnit(a) {
    return a ? a.replace(/\s+(#|unit|apt|ph)?\s*[A-Z]?-?\d+[A-Z]?$/i, "") : a;
  }

  el.detail.addEventListener("click", function (e) {
    var pick = e.target.closest("[data-pick]");
    if (pick) {
      track("select", pick.getAttribute("data-pick"));
      select(pick.getAttribute("data-pick"), { announce: true });
      return;
    }
    if (e.target.closest(".tx-close")) {
      clearSelection();
      return;
    }
    var asmBtn = e.target.closest('[data-act="assemblage"]');
    if (asmBtn) {
      track("open_assemblage", asmBtn.getAttribute("data-aid"));
      openAssemblage(asmBtn.getAttribute("data-aid"), { announce: true });
      return;
    }
    if (e.target.closest('[data-act="table-assemblage"]')) {
      var a = data.assemblages[selectedAid];
      if (a) peer.send("reveal", a.lead.id);
      return;
    }
    if (e.target.closest('[data-act="table"]')) {
      peer.send("reveal", selectedId);
      track("show_in_table", selectedId);
    }
    if (e.target.closest("a.tx-btn")) track("property_record", selectedId);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !el.detail.hidden) clearSelection();
  });

  function highlight() {
    if (!map || !map.getLayer("tx-selected")) return;
    map.setFilter("tx-selected", selectedAid
      ? ["==", ["get", "aid"], selectedAid]
      : ["==", ["get", "id"], selectedId || ""]);
  }

  // Assemblage panel: every member deed, combined total, all rings on.
  function openAssemblage(aid, opts) {
    opts = opts || {};
    var a = data.assemblages[aid];
    if (!a) return;
    selectedAid = aid;
    selectedId = null;
    highlight();
    var mapped = a.members.filter(function (r) { return r.located; });
    el.detail.innerHTML =
      '<div class="tx-detail-head"><h2 id="tx-detail-title"><span class="tx-assm">Assemblage · ' + a.members.length + " deeds</span><br>" +
      fmt.escape(a.lead.address || "Address unavailable") + " and " + (a.members.length - 1) + " more" +
      '<span class="tx-sub">' + fmt.escape(a.county) + " · recorded " + fmt.date(a.date) + "</span></h2>" +
      '<button type="button" class="tx-close" aria-label="Close">×</button></div>' +
      '<div class="tx-detail-body"><div class="tx-price">' + fmt.money(a.price) + ' <span class="tx-muted" style="font-size:13px;font-weight:400">combined</span></div>' +
      '<p class="tx-assm-note">Separate deeds recorded together. The total adds up the individual deed prices.' +
      (mapped.length < a.members.length ? " " + (a.members.length - mapped.length) + " without a mappable address." : "") + "</p>" +
      '<dl class="tx-dl"><dt>Buyers</dt><dd>' + a.buyers.map(function (b) { return fmt.escape(fmt.party(b)); }).join("<br>") +
      "</dd><dt>Sellers</dt><dd>" + a.sellers.map(function (s) { return fmt.escape(fmt.party(s)); }).join("<br>") + "</dd></dl>" +
      '<ul class="tx-stack" style="margin-top:12px">' + a.members.map(function (r) {
        return '<li><button type="button" data-pick="' + fmt.escape(r.id) + '"><span class="tx-r-title">' +
          fmt.escape(r.address || "Address unavailable") + " <strong>" + fmt.moneyShort(r.price) + "</strong></span>" +
          '<span class="tx-r-sub">' + fmt.escape(fmt.party(r.buyer)) + (r.located ? "" : " · not on map") + "</span></button></li>";
      }).join("") + "</ul>" +
      (peer.hasPeer("table") ? '<div class="tx-actions"><button type="button" class="tx-btn" data-act="table-assemblage">Show in table</button></div>' : "") +
      "</div>";
    el.detail.setAttribute("aria-labelledby", "tx-detail-title");
    el.detail.hidden = false;
    el.detail.querySelector(".tx-close").focus({ preventScroll: true });
    if (mapped.length && map) {
      var b = new mapboxgl.LngLatBounds();
      mapped.forEach(function (r) { b.extend([r.lng, r.lat]); });
      map.fitBounds(b, { padding: addPad(detailPadding()), maxZoom: 16, duration: opts.instant ? 0 : 900 });
    }
    if (opts.announce) peer.send("select", a.lead.id);
  }

  function addPad(p) {
    return { top: 60 + p.top, bottom: 60 + p.bottom, left: 60 + p.left, right: 60 + p.right };
  }

  // ------------------------------------------------------------------ map
  function addLayers() {
    var c = COLORS[theme];
    if (!map.getSource("tx")) {
      map.addSource("tx", {
        type: "geojson",
        data: toFeatures(visible.filter(function (r) { return r.located; })),
      });
    }
    var color = ["match", ["get", "cg"], "residential", c.residential, "commercial", c.commercial, "land", c.land, c.other];
    map.addLayer({
      id: "tx-points",
      type: "circle",
      source: "tx",
      paint: {
        "circle-radius": radiusExpr(),
        "circle-color": color,
        "circle-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0.82],
        "circle-stroke-color": ["case", ["boolean", ["feature-state", "hover"], false], c.sel, c.ring],
        "circle-stroke-width": [
          "interpolate", ["linear"], ["zoom"],
          8, ["case", ["boolean", ["feature-state", "hover"], false], 2, 0.5],
          12, ["case", ["boolean", ["feature-state", "hover"], false], 2, 1],
        ],
      },
      layout: { "circle-sort-key": ["-", 0, ["get", "price"]] }, // small sales draw on top of big ones
    });
    map.addLayer({
      id: "tx-selected",
      type: "circle",
      source: "tx",
      filter: ["==", ["get", "id"], selectedId || ""],
      paint: {
        "circle-radius": radiusExpr(4),
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": c.sel,
        "circle-stroke-width": 2.5,
      },
    });
  }

  function declutter() {
    (map.getStyle().layers || []).forEach(function (l) {
      if (/poi|transit|airport/.test(l.id) && l.type === "symbol") map.setLayoutProperty(l.id, "visibility", "none");
    });
  }

  function initMap() {
    mapboxgl.accessToken = TOKEN;
    map = new mapboxgl.Map({
      container: "tx-map",
      style: STYLES[theme],
      bounds: SOFLA_BOUNDS,
      maxBounds: [[-82.2, 24.3], [-78.8, 27.9]],
      minZoom: 7,
      attributionControl: false,
      cooperativeGestures: isEmbed,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    map.touchZoomRotate.disableRotation();
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.__txMap = map; // dev/test hook
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    if (!compact) map.addControl(new mapboxgl.FullscreenControl(), "top-right");

    map.on("style.load", function () {
      declutter();
      addLayers();
      highlight();
    });

    var hoverId = null;
    var canHover = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
    map.on("mousemove", "tx-points", function (e) {
      var f = e.features[0];
      if (!f) return;
      map.getCanvas().style.cursor = "pointer";
      if (hoverId !== null && hoverId !== f.id) map.setFeatureState({ source: "tx", id: hoverId }, { hover: false });
      hoverId = f.id;
      map.setFeatureState({ source: "tx", id: hoverId }, { hover: true });
      if (!canHover) return;
      var r = rowById(f.properties.id);
      if (!r) return;
      if (!hoverPopup) {
        hoverPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: "tx-tip", offset: 12, maxWidth: "260px" });
      }
      hoverPopup
        .setLngLat(f.geometry.coordinates)
        .setHTML("<strong>" + fmt.escape(r.address || "Address unavailable") + "</strong>" +
          fmt.moneyShort(r.price) + " <span>· " + fmt.dateShort(r.date) + " · " + fmt.escape(r.category) +
          (r.assemblageId && data.assemblages[r.assemblageId] ? " · 1 of " + data.assemblages[r.assemblageId].members.length + " deeds in an assemblage" : "") + "</span>")
        .addTo(map);
    });
    map.on("mouseleave", "tx-points", function () {
      map.getCanvas().style.cursor = "";
      if (hoverId !== null) map.setFeatureState({ source: "tx", id: hoverId }, { hover: false });
      hoverId = null;
      if (hoverPopup) hoverPopup.remove();
    });
    map.on("click", function (e) {
      // Pick the smallest hit (it is drawn on top) within a finger-sized box.
      var pad = canHover ? 3 : 10;
      var feats = map.queryRenderedFeatures([[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]], { layers: ["tx-points"] });
      if (!feats.length) {
        if (!el.detail.hidden) clearSelection();
        return;
      }
      feats.sort(function (a, b) { return a.properties.price - b.properties.price; });
      var id = feats[0].properties.id;
      if (hoverPopup) hoverPopup.remove();
      // Condo buildings stack many sales on one coordinate — list them all.
      var here = feats[0].geometry.coordinates.join(",");
      var stacked = {};
      feats.forEach(function (f) {
        if (f.geometry.coordinates.join(",") === here) stacked[f.properties.id] = true;
      });
      var ids = Object.keys(stacked);
      if (ids.length > 1) {
        var r0 = rowById(id);
        var all = visible.filter(function (r) { return r.located && r.lng === r0.lng && r.lat === r0.lat; });
        track("select_stack", all.length);
        renderStack(all);
        return;
      }
      track("select", id);
      select(id, { announce: true });
    });
    map.on("zoomend", function () {
      if (data) renderLegend();
    });
    return new Promise(function (resolve) {
      map.on("load", resolve);
    });
  }

  // ------------------------------------------------------------------ peer
  var peer = TX.link("map", function (msg) {
    if (!data) return;
    if (msg.type === "filters" && msg.payload) {
      state = msg.payload;
      filters.render();
      searchInput.value = state.q || "";
      refresh();
    } else if (msg.type === "select" || msg.type === "reveal") {
      var r = rowById(msg.payload);
      if (r) select(msg.payload, { fly: true });
    } else if (msg.type === "assemblage") {
      openAssemblage(msg.payload);
    } else if (msg.type === "hello" && !TX.isDefault(state)) {
      peer.send("filters", TX.serializeState(state));
    }
  });

  // ------------------------------------------------------------------ boot
  function showError(msg) {
    el.loading.innerHTML = '<span>' + fmt.escape(msg) + "</span>";
    el.loading.hidden = false;
  }

  var mapReady;
  if (!window.mapboxgl || !mapboxgl.supported || !mapboxgl.supported()) {
    showError("This map needs WebGL, which your browser doesn’t support. The sales table on this page lists every sale.");
    return;
  }
  try {
    mapReady = initMap();
  } catch (e) {
    showError("The map couldn’t load. The sales table on this page lists every sale.");
    return;
  }

  Promise.all([TX.load(), mapReady])
    .then(function (res) {
      data = res[0];
      data.byId = {};
      data.unclassifiedCounties = TX.COUNTIES.filter(function (c) {
        var rs = data.rows.filter(function (r) { return r.county === c; });
        return rs.length && rs.every(function (r) { return r.category === "Other"; });
      });
      data.rows.forEach(function (r, i) {
        r._n = i;
        data.byId[r.id] = r;
      });
      el.loading.hidden = true;
      refresh({ fit: !params.get("sale") });
      var sale = params.get("sale");
      if (sale && rowById(sale)) select(sale, { fly: true, instant: true });
      track("loaded", data.rows.length);
    })
    .catch(function () {
      showError("Sales data couldn’t load. Please try again later.");
    });
})();
