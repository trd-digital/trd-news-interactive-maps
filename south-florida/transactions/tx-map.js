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
    chips: app.querySelector(".tx-active"),
    areaBtn: app.querySelector(".tx-area-btn"),
    legend: app.querySelector(".tx-legend"),
    note: app.querySelector(".tx-mapnote"),
    detail: app.querySelector(".tx-detail"),
    empty: app.querySelector(".tx-empty-map"),
    mapWrap: app.querySelector(".tx-map-wrap"),
    loading: app.querySelector(".tx-loading"),
  };

  // Search lives in the top bar; filter chips in the dropdown panel.
  el.topbar.insertAdjacentHTML("afterbegin", TX.searchHtml(state.q));
  var searchInput = el.topbar.querySelector(".tx-search-input");
  var box = TX.search.searchBox({
    input: searchInput,
    panel: el.results,
    getBase: function () {
      return data ? TX.apply(data.rows, state, data.asOf, { ignoreQuery: true }) : [];
    },
    getAll: function () {
      return data ? data.rows : [];
    },
    onQuery: function (q, committed) {
      var s = getState();
      s.q = q;
      onFilterChange(s, committed ? "search_enter" : "search", { fit: committed });
    },
    onPick: onPick,
    geocode: compact ? null : geocode,
    placeholder: { wide: "Search address, city, ZIP, buyer or seller", narrow: "Search sales" },
  });
  var filters = TX.filterBar(el.filterPanel, getState, onFilterChange, { showCategories: false });

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
  });

  // A pick from the suggestion list.
  function onPick(it) {
    var s = getState();
    track("search_pick", it.kind);
    if (it.kind === "text") {
      onFilterChange(s, "search_all", { fit: true });
    } else if (it.kind === "widen") {
      var w = TX.defaultState();
      w.q = it.q;
      w.days = 60;
      onFilterChange(w, "search_widen", { fit: true });
      filters.render();
    } else if (it.kind === "city" || it.kind === "zip") {
      s.place = { kind: it.kind, value: it.value, label: it.label };
      s.q = "";
      box.set("");
      onFilterChange(s, "place", { fit: true });
    } else if (it.kind === "party") {
      s.party = { key: it.key, label: it.label };
      s.q = "";
      box.set("");
      onFilterChange(s, "party", { fit: true });
    } else if (it.kind === "sale") {
      select(it.row.id, { fly: true, announce: true });
    } else if (it.kind === "geo") {
      goTo(it);
    }
  }

  // ------------------------------------------------------------- filtering
  function onFilterChange(next, why, opts) {
    state = next;
    if (why !== "search") track("filter", why);
    refresh(opts && opts.fit ? { fit: true, animate: true } : null);
    peer.send("filters", TX.serializeState(state));
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
      (sum.count === 1 ? "sale" : "sales") + (state.bbox ? (state.bboxLabel ? " in " + fmt.escape(state.bboxLabel) : " in this area") : "") +
      (compact ? " · last " + state.days + " days" : "") +
      (sum.count ? '<span class="tx-count-total"> · ' + fmt.moneyShort(sum.total) + "</span>" : "");
    var n = activeFilterCount();
    el.filterToggle.querySelector(".tx-badge").hidden = !n;
    el.filterToggle.querySelector(".tx-badge").textContent = n;
    var unmapped = visible.length - located.length;
    var unclassified = typeFilterGaps();
    TX.search.activeChips(el.chips, state, function (s, why) {
      box.set(s.q);
      onFilterChange(s, why);
      filters.render();
    });
    if (!state.bbox) showAreaButton(false);
    setNote(compact
      ? "Recorded through " + fmt.date(data.asOf) + (unclassified.length ? " · " + unclassified.join(", ") + " not yet classified by type" : " · Source: county records")
      : TX.asOfText(data) +
      (unmapped ? " · " + unmapped.toLocaleString("en-US") + " sale" + (unmapped === 1 ? "" : "s") +
        " without a mappable address " + (unmapped === 1 ? "is" : "are") + " listed in the table" : "") +
      (unclassified.length ? " · " + unclassified.join(" and ") + " sales aren’t classified by type yet, so type filters leave them out" : ""));
    renderEmpty(visible.length, located.length);
    renderLegend();
    setSource(located);
    if (opts && opts.fit) fitTo(located, opts.animate);
  }

  // Card over the map when nothing matches, with the obvious way out.
  function renderEmpty(n, mapped) {
    var el2 = el.empty;
    if (!data || mapped) {
      el2.hidden = true;
      return;
    }
    var html, act;
    if (n && !mapped) {
      html = n === 1
        ? "<strong>This sale has no mappable address.</strong>It’s listed in the sales table."
        : "<strong>None of these " + n.toLocaleString("en-US") + " sales have a mappable address.</strong>They’re listed in the sales table.";
    } else if (state.bbox) {
      html = "<strong>No sales " + (state.bboxLabel ? "in " + fmt.escape(state.bboxLabel) : "in this area") + "</strong>with the current filters.";
      act = { label: "Clear area", run: function () { var s = getState(); s.bbox = null; s.bboxLabel = null; onFilterChange(s, "empty_clear_area"); } };
    } else {
      html = "<strong>No sales match these filters.</strong>Try a longer period or a wider price range.";
      act = { label: "Reset filters", run: function () { box.set(""); onFilterChange(TX.defaultState(), "empty_reset", { fit: true }); filters.render(); } };
    }
    el2.innerHTML = '<p>' + html + "</p>" + (act ? '<button type="button" class="tx-btn">' + act.label + "</button>" : "");
    if (act) el2.querySelector("button").onclick = act.run;
    el2.hidden = false;
  }

  // One line by default; "More" expands when the note doesn't fit.
  function setNote(text) {
    el.note.innerHTML = '<span class="tx-note-text"></span><button type="button" class="tx-note-more" hidden aria-expanded="false">More</button>';
    var t = el.note.querySelector(".tx-note-text");
    var more = el.note.querySelector(".tx-note-more");
    t.textContent = text;
    el.note.classList.remove("is-open");
    requestAnimationFrame(function () {
      more.hidden = t.scrollWidth <= t.clientWidth + 1;
    });
    more.onclick = function () {
      var open = !el.note.classList.contains("is-open");
      el.note.classList.toggle("is-open", open);
      more.textContent = open ? "Less" : "More";
      more.setAttribute("aria-expanded", String(open));
      if (map) map.resize();
    };
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

  function fitTo(rows, animate) {
    if (!map || !rows.length) return;
    var b = new mapboxgl.LngLatBounds();
    rows.forEach(function (r) { b.extend([r.lng, r.lat]); });
    map.fitBounds(b, { padding: compact ? 24 : 56, maxZoom: 15, duration: animate ? 700 : 0 });
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

  // ------------------------------------------------------- places on the map
  // Any address / neighborhood in South Florida, even with no sale there.
  var GEO_BBOX = "-80.95,25.1,-79.95,27.0";
  function geocode(q) {
    var url = "https://api.mapbox.com/search/geocode/v6/forward?q=" + encodeURIComponent(q) +
      "&bbox=" + GEO_BBOX + "&country=us&limit=3&types=address,street,neighborhood,locality,place,postcode&access_token=" + TOKEN;
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("geocode " + r.status);
      return r.json();
    }).then(function (j) {
      return (j.features || []).map(function (f) {
        var p = f.properties || {};
        return {
          label: p.name || p.full_address,
          sub: p.place_formatted || "",
          center: f.geometry.coordinates,
          type: p.feature_type,
          bbox: p.bbox || f.bbox || null,
        };
      });
    });
  }

  var goMarker = null;
  function goTo(g) {
    if (!map) return;
    // Areas (ZIP, neighborhood, city) filter to their bounds, which also
    // covers counties whose records lack city/ZIP; addresses just fly there.
    if (g.bbox && /postcode|neighborhood|locality|place/.test(g.type)) {
      var s = getState();
      s.bbox = g.bbox.map(function (v) { return +(+v).toFixed(5); });
      s.bboxLabel = g.type === "postcode" ? g.label + (g.sub ? " " + g.sub.split(",")[0] : "") : g.label;
      s.q = "";
      box.set("");
      if (goMarker) { goMarker.remove(); goMarker = null; }
      onFilterChange(s, "geo_area");
      map.fitBounds([[s.bbox[0], s.bbox[1]], [s.bbox[2], s.bbox[3]]], { padding: 40, duration: 900 });
      track("geocode_area", g.type);
      return;
    }
    var zoom = { address: 17, street: 15, postcode: 13, neighborhood: 14, locality: 13, place: 12 }[g.type] || 15;
    map.flyTo({ center: g.center, zoom: zoom, essential: true, duration: 900 });
    if (goMarker) goMarker.remove();
    var dot = document.createElement("div");
    dot.className = "tx-go-marker";
    dot.title = g.label;
    goMarker = new mapboxgl.Marker({ element: dot }).setLngLat(g.center).addTo(map);
    track("geocode_go", g.type);
  }

  // "Search this area": appears after the reader pans or zooms.
  function showAreaButton(show) {
    if (compact) return;
    el.areaBtn.hidden = !show;
  }
  el.areaBtn.addEventListener("click", function () {
    var b = map.getBounds();
    var s = getState();
    s.bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map(function (x) { return +x.toFixed(5); });
    s.bboxLabel = null;
    showAreaButton(false);
    track("search_area", "");
    onFilterChange(s, "bbox");
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
    if (!r.located && el.empty.hidden) {
      // (When the empty-state card is up it already says this.)
      TX.notify(el.mapWrap, "This sale has no mappable address, so it isn’t on the map. Its details are shown here and in the table.");
    }
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

    var rows = [["Recorded", fmt.date(r.date)]].concat(TX.partyRows(r));
    if (r.financed && r.loan) rows.push(["Mortgage", fmt.money(r.loan) + (r.price ? ' <span class="tx-muted">(' + Math.round((r.loan / r.price) * 100) + "% of price)</span>" : "")]);
    if (TX.hasPrevSale(r)) {
      var chg = r.prevPrice > 0 ? (r.price - r.prevPrice) / r.prevPrice : null;
      rows.push(["Previous sale", fmt.money(r.prevPrice) + (r.prevDate ? " · " + fmt.date(r.prevDate) : "") +
        (chg != null && isFinite(chg) && Math.abs(chg) < 20 ? ' <span class="tx-muted">(' + (chg >= 0 ? "+" : "") + Math.round(chg * 100) + "%)</span>" : "")]);
    }
    if (r.useDetail) rows.push(["County use code", fmt.escape(fmt.title(r.useDetail))]);
    if (r.parcelId) rows.push(["Parcel ID", fmt.escape(r.parcelId)]);
    if (r.instrument) rows.push(["Deed instrument #", fmt.escape(r.instrument)]);

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
        '<span class="tx-assm">' + (asm.type === "building" ? "Building purchase" : "Assemblage") + "</span>One of " +
        asm.members.length + (asm.type === "building" ? " units bought together · " : " deeds recorded together · ") +
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
      '<div class="tx-detail-head"><h2 id="tx-detail-title"><span class="tx-assm">' + fmt.escape(a.label) + "</span><br>" +
      fmt.escape(a.lead.address || "Address unavailable") + " and " + (a.members.length - 1) + " more" +
      '<span class="tx-sub">' + fmt.escape(a.county) + " · recorded " + fmt.date(a.date) + "</span></h2>" +
      '<button type="button" class="tx-close" aria-label="Close">×</button></div>' +
      '<div class="tx-detail-body"><div class="tx-price">' + fmt.money(a.price) + ' <span class="tx-muted" style="font-size:13px;font-weight:400">combined</span></div>' +
      '<p class="tx-assm-note">' + (a.type === "building"
        ? "Units in one building recorded to the same " + (a.partiesDirected ? "buyer" : "party") + " the same day"
        : "Adjacent parcels recorded to related " + (a.partiesDirected ? "buyers" : "parties") + " the same day") +
      ", each on its own deed. The total adds up the individual deed prices." +
      (mapped.length < a.members.length ? " " + (a.members.length - mapped.length) + " without a mappable address." : "") + "</p>" +
      '<dl class="tx-dl">' + (a.partiesDirected
        ? "<dt>Buyers</dt><dd>" + a.buyers.map(function (b) { return fmt.escape(fmt.party(b)); }).join("<br>") +
          "</dd><dt>Sellers</dt><dd>" + a.sellers.map(function (s) { return fmt.escape(fmt.party(s)); }).join("<br>") + "</dd>"
        : "<dt>Parties</dt><dd>" + a.parties.map(function (b) { return fmt.escape(fmt.party(b)); }).join("<br>") +
          '<span class="tx-addr-sub">' + TX.PARTY_NOTE + "</span></dd>") + "</dl>" +
      '<ul class="tx-stack" style="margin-top:12px">' + a.members.map(function (r) {
        return '<li><button type="button" data-pick="' + fmt.escape(r.id) + '"><span class="tx-r-title">' +
          fmt.escape(r.address || "Address unavailable") + " <strong>" + fmt.moneyShort(r.price) + "</strong></span>" +
          '<span class="tx-r-sub">' + fmt.escape(TX.partyLine(r)) + (r.located ? "" : " · not on map") + "</span></button></li>";
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
    // "Near me" only where the embedding page lets this frame use location.
    var geoAllowed = document.featurePolicy ? document.featurePolicy.allowsFeature("geolocation") : !isEmbed;
    if (!compact && geoAllowed && navigator.geolocation) {
      var geo = new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: false }, fitBoundsOptions: { maxZoom: 14 } });
      geo.on("error", function (err) {
        TX.notify(el.mapWrap, err && err.code === 1
          ? "Location access is blocked. Allow it in your browser settings to use “near me.”"
          : "Couldn’t find your location. Try searching for your address instead.");
      });
      geo.on("geolocate", function (pos) {
        var c = [pos.coords.longitude, pos.coords.latitude];
        if (c[0] < -80.95 || c[0] > -79.95 || c[1] < 25.1 || c[1] > 27.0) {
          TX.notify(el.mapWrap, "You appear to be outside South Florida, so there are no nearby sales to show.");
        }
      });
      map.addControl(geo, "top-right");
    }

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
    map.on("moveend", function (e) {
      if (e.originalEvent && data) showAreaButton(true); // reader-driven moves only
    });
    return new Promise(function (resolve) {
      map.on("load", resolve);
    });
  }

  // ------------------------------------------------------------------ peer
  var peer = TX.link("map", function (msg) {
    if (!data) return;
    if (msg.type === "filters" && msg.payload) {
      var placeChanged = JSON.stringify([state.place, state.party]) !== JSON.stringify([msg.payload.place, msg.payload.party]);
      state = msg.payload;
      filters.render();
      box.cancel();
      box.set(state.q);
      refresh(placeChanged && (state.place || state.party) ? { fit: true, animate: true } : null);
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
