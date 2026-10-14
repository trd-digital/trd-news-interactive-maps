/*!
 * cx-map.js — South Florida construction pipeline map.
 * Depends on: mapbox-gl (window.__cxMapbox), TRD theme.js, cx-core.js (CX).
 */
(function () {
  "use strict";

  var STYLES = { light: "mapbox://styles/mapbox/light-v11", dark: "mapbox://styles/mapbox/dark-v11" };
  // Opening view and limits; the HTML's instant preview uses the same numbers.
  var OPEN_BOUNDS = [[-80.56, 25.54], [-80.12, 25.98]];
  var MAX_BOUNDS = [[-80.9, 25.25], [-79.8, 26.25]];
  // Must match --tx-* tokens in tx.css (residential / commercial / land slot).
  var COLORS = {
    light: { Residential: "#2a78d6", Commercial: "#eb6834", "Mixed use": "#1baf7a", ring: "#ffffff", sel: "#111111" },
    dark: { Residential: "#3987e5", Commercial: "#d95926", "Mixed use": "#199e70", ring: "#212121", sel: "#ffffff" },
  };

  // Circle area tracks estimated cost (sqrt), so a $100M tower reads ~3x a
  // $10M building, not 10x. Projects with no cost draw at the smallest size.
  var VALUE_STOPS = [1e4, 1e6, 1e7, 1e8];
  var RADIUS_BY_ZOOM = {
    9: [2, 3, 6, 11],
    12: [3, 4.5, 9, 17],
    15: [4.5, 7, 13, 24],
  };
  function radiusExpr(extra) {
    extra = extra || 0;
    var v = ["max", ["to-number", ["get", "value"], 0], VALUE_STOPS[0]];
    var expr = ["interpolate", ["linear"], ["zoom"]];
    Object.keys(RADIUS_BY_ZOOM).forEach(function (z) {
      var r = RADIUS_BY_ZOOM[z];
      var inner = ["interpolate", ["linear"], ["sqrt", v]];
      VALUE_STOPS.forEach(function (p, i) { inner.push(Math.sqrt(p), r[i] + extra); });
      expr.push(+z, inner);
    });
    return expr;
  }
  function radiusAt(zoom, value) {
    var zs = Object.keys(RADIUS_BY_ZOOM).map(Number);
    function at(z) {
      var r = RADIUS_BY_ZOOM[z], s = Math.sqrt(Math.max(value, VALUE_STOPS[0]));
      for (var i = 1; i < VALUE_STOPS.length; i++) {
        var a = Math.sqrt(VALUE_STOPS[i - 1]), b = Math.sqrt(VALUE_STOPS[i]);
        if (s <= b || i === VALUE_STOPS.length - 1) {
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

  var fmt = CX.fmt;
  var track = CX.tracker("miami-construction-map");
  var params = new URLSearchParams(location.search);
  var isEmbed = window.self !== window.top;
  var app = document.getElementById("tx-app");
  var compact = params.get("view") === "dashboard" || window.innerHeight < 450;
  if (compact) app.classList.add("tx-compact");

  var state = CX.stateFromUrl();
  var data = null;
  var visible = [];
  var map = null;
  var selectedId = null;
  var hoverPopup = null;

  var theme = CX.theme(function (t) {
    try { localStorage.setItem("trd-sofla-cx:theme-seen", JSON.stringify(t)); } catch (e) {}
    if (map) map.setStyle(STYLES[t]); // style.load re-adds our layers
  }, track);
  try { localStorage.setItem("trd-sofla-cx:theme-seen", JSON.stringify(theme.get())); } catch (e) {}

  // ------------------------------------------------------------------ DOM
  var el = {
    topbar: app.querySelector(".tx-topbar"),
    count: app.querySelector(".tx-count"),
    filterToggle: app.querySelector(".tx-filter-toggle"),
    filterPanel: app.querySelector(".tx-filter-panel"),
    results: app.querySelector(".tx-results"),
    chips: app.querySelector(".tx-active"),
    legend: app.querySelector(".tx-legend"),
    note: app.querySelector(".tx-mapnote"),
    detail: app.querySelector(".tx-detail:not(.tx-sheet)"),
    empty: app.querySelector(".tx-empty-map"),
    listBtn: app.querySelector(".tx-list-btn"),
    sheet: app.querySelector(".tx-sheet"),
    mapWrap: app.querySelector(".tx-map-wrap"),
    loading: app.querySelector(".tx-loading"),
  };

  el.topbar.insertAdjacentHTML("afterbegin", CX.searchHtml(state.q, window.innerWidth < 520 ? "Search projects" : "Search address, neighborhood, builder or permit #"));
  var box = CX.searchBox({
    input: el.topbar.querySelector(".tx-search-input"),
    panel: el.results,
    getData: function () { return data; },
    onQuery: function (q) {
      var s = CX.clone(state);
      s.q = q;
      onFilterChange(s, "search", { fit: !!q });
    },
    onPick: function (it) {
      var s = CX.clone(state);
      track("search_pick", it.kind);
      if (it.kind === "hood") {
        s.hood = it.value;
        s.q = "";
        box.clear();
        onFilterChange(s, "hood", { fit: true });
      } else if (it.kind === "firm") {
        s.q = it.value;
        box.clear();
        el.topbar.querySelector(".tx-search-input").value = it.value;
        onFilterChange(s, "firm", { fit: true });
      } else if (it.kind === "project") {
        revealRow(it.row);
        select(it.row.id, { fly: true, announce: true });
      }
    },
  });
  var filters = CX.filterBar(el.filterPanel, function () { return CX.clone(state); }, onFilterChange, {
    getData: function () { return data; },
  });

  el.filterToggle.addEventListener("click", function () {
    var open = el.filterPanel.hidden;
    if (open) filters.render();
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
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!el.filterPanel.hidden) {
      el.filterPanel.hidden = true;
      el.filterToggle.setAttribute("aria-expanded", "false");
      el.filterToggle.focus();
    } else if (!el.detail.hidden) clearSelection();
    else if (!el.sheet.hidden) el.sheet.hidden = true;
  });

  // A project hidden by the current filters (picked from search, or sent by
  // the table) is still shown: widen the filters just enough to include it.
  function revealRow(r) {
    if (CX.apply([r], state, data.asOf).length) return;
    var s = CX.clone(state);
    if (s.sizes.indexOf(r.size) < 0) s.sizes = CX.SIZE_IDS.filter(function (x) { return s.sizes.indexOf(x) >= 0 || x === r.size; });
    if (s.types.indexOf(r.type) < 0) s.types = CX.TYPES.slice();
    if (s.areas.indexOf(r.area) < 0) s.areas = CX.AREAS.slice();
    if (s.hood && s.hood !== r.hood) s.hood = null;
    if (!CX.apply([r], s, data.asOf).length) { s = CX.defaultState(); s.sizes = CX.SIZE_IDS.slice(); }
    state = s;
    box.set(state.q);
    filters.render();
    refresh();
    peer.send("filters", CX.clone(state));
  }

  // ------------------------------------------------------------- filtering
  function onFilterChange(next, why, opts) {
    state = next;
    if (why !== "search") track("filter", why);
    refresh(opts && opts.fit ? { fit: true, animate: true } : null);
    peer.send("filters", CX.clone(state));
  }

  function refresh(opts) {
    if (!data) return;
    visible = CX.apply(data.rows, state, data.asOf);
    var located = visible.filter(function (r) { return r.located; });
    var sum = CX.summary(visible);
    var noun = state.sizes.length === 1 && state.sizes[0] === "minor" ? "permits" : "projects";
    var typeWord = state.types.length === 1 ? state.types[0].toLowerCase() + " " : "";
    el.count.innerHTML = "<strong>" + sum.count.toLocaleString("en-US") + "</strong> " + typeWord + (sum.count === 1 ? noun.slice(0, -1) : noun) +
      (state.hood ? " in " + fmt.escape(state.hood) : "") +
      (sum.value ? '<span class="tx-count-total"> · ' + fmt.moneyShort(sum.value) + " est. cost</span>" : "");
    var n = CX.filterCount(state);
    var badge = el.filterToggle.querySelector(".tx-badge");
    badge.hidden = !n;
    badge.textContent = n;
    CX.activeChips(el.chips, state, function (s, why) {
      box.set(s.q);
      if (!s.q) el.topbar.querySelector(".tx-search-input").value = "";
      onFilterChange(s, why);
      if (!el.filterPanel.hidden) filters.render();
    });
    if (!el.filterPanel.hidden) filters.render();
    var unmapped = visible.length - located.length;
    el.note.textContent = compact
      ? "Miami permits through " + fmt.date(data.asOf) + " · Source: City of Miami, Miami-Dade County"
      : CX.asOfText(data) + (unmapped ? " " + CX.plural(unmapped, "project") + " without a map location " + (unmapped === 1 ? "is" : "are") + " listed in the table." : "");
    renderEmpty(visible.length, located.length);
    renderLegend();
    setSource(located);
    updateListBtn();
    if (selectedId && !visible.some(function (r) { return r.id === selectedId; })) clearSelection();
    if (opts && opts.fit) fitTo(located, opts.animate);
  }

  function renderEmpty(n, mapped) {
    if (!data || mapped) {
      el.empty.hidden = true;
      return;
    }
    el.empty.innerHTML = (n ? "None of these projects has a map location; they’re listed in the table." : "No projects match these filters.") +
      (CX.isDefault(state) ? "" : ' <button type="button" class="tx-reset" data-act="reset">Reset filters</button>');
    el.empty.hidden = false;
  }
  el.empty.addEventListener("click", function (e) {
    if (!e.target.closest('[data-act="reset"]')) return;
    box.clear();
    onFilterChange(CX.defaultState(), "reset", { fit: true });
  });

  function toFeatures(rows) {
    return {
      type: "FeatureCollection",
      features: rows.map(function (r) {
        return {
          type: "Feature",
          id: r._n,
          geometry: { type: "Point", coordinates: [r.lng, r.lat] },
          properties: { id: r.id, value: r.value || 0, type: r.type, minor: r.size === "minor" ? 1 : 0 },
        };
      }),
    };
  }
  function setSource(rows) {
    var src = map && map.getSource("cx");
    if (src) src.setData(toFeatures(rows));
  }
  function fitTo(rows, animate) {
    if (!map || !rows.length) return;
    var b = new mapboxgl.LngLatBounds();
    rows.forEach(function (r) { b.extend([r.lng, r.lat]); });
    var narrow = window.innerWidth <= 600;
    map.fitBounds(b, {
      padding: narrow ? 40 : { top: 60, bottom: 40, left: 40, right: el.detail.hidden ? 60 : 380 },
      maxZoom: 15,
      duration: animate ? 800 : 0,
    });
  }

  // ------------------------------------------------------------------ legend
  function renderLegend() {
    var p = COLORS[theme.get()];
    var base = CX.apply(data.rows, state, data.asOf, { ignore: "types" });
    var counts = {};
    base.forEach(function (r) { counts[r.type] = (counts[r.type] || 0) + 1; });
    var all = state.types.length === CX.TYPES.length;
    var html = '<button type="button" class="tx-legend-toggle" aria-expanded="false">Legend</button><div class="tx-legend-body">' +
      '<p class="tx-legend-title">Project type</p><div class="tx-legend-cats">';
    CX.TYPES.forEach(function (t) {
      if (!counts[t] && t === "Mixed use") return; // the feed rarely has it
      var on = all || state.types.indexOf(t) >= 0;
      html += '<button type="button" class="tx-legend-cat' + (on ? "" : " is-off") + '" data-type="' + t + '" aria-pressed="' + on +
        '" title="Show only ' + t.toLowerCase() + '"><i class="tx-swatch" style="background:' + p[t] + '"></i>' + t +
        '<span class="tx-n">' + (counts[t] || 0).toLocaleString("en-US") + "</span></button>";
    });
    html += "</div>";
    if (!compact) {
      var z = map ? map.getZoom() : 11;
      html += '<div class="tx-legend-sizes" aria-label="Circle size shows estimated construction cost">';
      [[1e6, "$1M"], [1e7, "$10M"], [1e8, "$100M"]].forEach(function (s) {
        var d = Math.max(4, Math.round(radiusAt(z, s[0]) * 2));
        html += '<span class="tx-legend-size"><i style="width:' + d + "px;height:" + d + 'px"></i>' + s[1] + "</span>";
      });
      html += '</div><p class="tx-legend-hint">Circle size: estimated cost</p>';
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
    var b = e.target.closest("[data-type]");
    if (!b) return;
    var s = CX.clone(state);
    var v = b.getAttribute("data-type");
    var all = s.types.length === CX.TYPES.length;
    var next = all ? [v] : s.types.indexOf(v) >= 0 ? s.types.filter(function (x) { return x !== v; }) : s.types.concat([v]);
    s.types = !next.length || next.length === CX.TYPES.length ? CX.TYPES.slice() : CX.TYPES.filter(function (x) { return next.indexOf(x) >= 0; });
    onFilterChange(s, "legend:" + v);
  });

  // ------------------------------------------------------------------ select
  function select(id, opts) {
    opts = opts || {};
    var r = data && data.byId[id];
    if (!r) return;
    selectedId = id;
    renderDetail(r);
    el.sheet.hidden = true;
    if (!r.located) CX.notify(el.mapWrap, "This project has no map location. Its details are shown here and in the table.");
    highlight();
    if (opts.fly && r.located && map) {
      map.flyTo({ center: [r.lng, r.lat], zoom: Math.max(map.getZoom(), 15.5), padding: detailPadding(), duration: opts.instant ? 0 : 900, essential: true });
    }
    if (opts.announce) peer.send("select", id);
  }
  function detailPadding() {
    return window.innerWidth <= 600
      ? { top: 0, bottom: Math.round(window.innerHeight * 0.45), left: 0, right: 0 }
      : { top: 0, bottom: 0, left: 0, right: 360 };
  }
  function clearSelection() {
    selectedId = null;
    el.detail.hidden = true;
    highlight();
  }
  function highlight() {
    if (map && map.getLayer("cx-selected")) map.setFilter("cx-selected", ["==", ["get", "id"], selectedId || ""]);
  }

  function renderDetail(r) {
    var sub = CX.placeLine(r) + (r.area === "Unincorporated Miami-Dade" && r.hood ? " · unincorporated" : "");
    var tags = CX.typeTag(r) + CX.sizeTag(r);
    if (!r.located) tags += '<span class="tx-tag">Not on map</span>';
    var actions = "";
    if (r.parcelUrl) actions += '<a class="tx-btn" href="' + fmt.escape(r.parcelUrl) + '" target="_blank" rel="noopener">Property record ↗</a>';
    if (peer.hasPeer("table")) actions += '<button type="button" class="tx-btn" data-act="table">Show in table</button>';
    el.detail.innerHTML =
      '<div class="tx-detail-head"><h2 id="tx-detail-title">' + fmt.escape(r.address || "Address unavailable") +
      '<span class="tx-sub">' + fmt.escape(sub) + "</span></h2>" +
      '<button type="button" class="tx-close" aria-label="Close">×</button></div>' +
      '<div class="tx-detail-body">' +
      (r.located ? '<img class="tx-detail-img" loading="lazy" alt="Satellite view of ' + fmt.escape(r.address || "the site") + '" src="' + fmt.escape(CX.aerialUrl(r, 312, 140)) + '">' : "") +
      '<div class="tx-price">' + (r.value ? fmt.money(r.value) : '<span class="tx-muted">Cost not given</span>') +
      (r.value ? '<span class="cx-price-note">estimated cost</span>' : "") + "</div>" +
      '<div class="tx-tags">' + tags + "</div>" +
      '<dl class="tx-dl">' + CX.facts(r).map(function (x) { return "<dt>" + x[0] + "</dt><dd>" + x[1] + "</dd>"; }).join("") + "</dl>" +
      CX.workHtml(r, r.work.length <= 4) +
      (actions ? '<div class="tx-actions">' + actions + "</div>" : "") + "</div>";
    el.detail.setAttribute("aria-labelledby", "tx-detail-title");
    el.detail.hidden = false;
    el.detail.scrollTop = 0;
    el.detail.querySelector(".tx-close").focus({ preventScroll: true });
  }
  el.detail.addEventListener("click", function (e) {
    if (e.target.closest(".tx-close")) {
      clearSelection();
      return;
    }
    if (e.target.closest('[data-act="table"]') && selectedId) {
      peer.send("reveal", selectedId);
      track("show_in_table", selectedId);
    }
  });

  // ------------------------------------------------- phones: list what's in view
  function inView() {
    if (!map) return [];
    var b = map.getBounds();
    return visible.filter(function (r) { return r.located && b.contains([r.lng, r.lat]); })
      .sort(function (a, c) { return (c.value || 0) - (a.value || 0); });
  }
  function updateListBtn() {
    el.listBtn.hidden = compact || !data || window.innerWidth > 600;
    if (el.listBtn.hidden) return;
    var n = inView().length;
    el.listBtn.innerHTML = '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 5h12M4 10h12M4 15h12"/></svg> ' +
      "List " + CX.plural(n, "project") + " in view";
    el.listBtn.disabled = !n;
    if (!el.sheet.hidden) renderSheet();
  }
  function renderSheet() {
    var list = inView(), top = list.slice(0, 50);
    el.sheet.innerHTML = '<div class="tx-detail-head"><h2>' + CX.plural(list.length, "project") + ' in view<span class="tx-sub">' +
      (list.length > 50 ? "Top 50 by cost · zoom in for the rest" : "Sorted by estimated cost") +
      '</span></h2><button type="button" class="tx-close" aria-label="Close list">×</button></div><div class="tx-detail-body"><ul class="tx-stack">' +
      top.map(function (r) {
        return '<li><button type="button" data-pick="' + fmt.escape(r.id) + '"><span class="tx-r-title">' + fmt.escape(r.address || "Address unavailable") +
          " <strong>" + fmt.moneyShort(r.value) + '</strong></span><span class="tx-r-sub">' + fmt.escape(CX.placeLine(r)) + " · " + fmt.dateShort(r.date) + "</span></button></li>";
      }).join("") + "</ul></div>";
  }
  el.listBtn.addEventListener("click", function () {
    renderSheet();
    el.detail.hidden = true;
    el.sheet.hidden = false;
    track("list_in_view", inView().length);
  });
  el.sheet.addEventListener("click", function (e) {
    if (e.target.closest(".tx-close")) { el.sheet.hidden = true; return; }
    var b = e.target.closest("[data-pick]");
    if (b) select(b.getAttribute("data-pick"), { fly: true, announce: true });
  });

  // ------------------------------------------------------------------ map
  function declutter() {
    (map.getStyle().layers || []).forEach(function (l) {
      if (/poi|transit|airport/.test(l.id) && l.type === "symbol") map.setLayoutProperty(l.id, "visibility", "none");
    });
  }
  function addLayers() {
    var p = COLORS[theme.get()];
    if (!map.getSource("cx")) map.addSource("cx", { type: "geojson", data: toFeatures(visible.filter(function (r) { return r.located; })) });
    var hover = ["boolean", ["feature-state", "hover"], false];
    map.addLayer({
      id: "cx-points",
      type: "circle",
      source: "cx",
      paint: {
        "circle-radius": radiusExpr(),
        "circle-color": ["match", ["get", "type"], "Residential", p.Residential, "Commercial", p.Commercial, p["Mixed use"]],
        // Minor work reads lighter, so buildings stand out when both show.
        "circle-opacity": ["case", hover, 1, ["==", ["get", "minor"], 1], 0.45, 0.85],
        "circle-stroke-color": ["case", hover, p.sel, p.ring],
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 9, ["case", hover, 2, 0.5], 13, ["case", hover, 2, 1]],
      },
      layout: { "circle-sort-key": ["-", 0, ["to-number", ["get", "value"], 0]] }, // small projects on top
    });
    map.addLayer({
      id: "cx-selected",
      type: "circle",
      source: "cx",
      filter: ["==", ["get", "id"], selectedId || ""],
      paint: { "circle-radius": radiusExpr(4), "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": p.sel, "circle-stroke-width": 2.5 },
    });
  }

  function initMap() {
    mapboxgl.accessToken = CX.MAPBOX_TOKEN;
    map = new mapboxgl.Map({
      container: "tx-map",
      style: STYLES[theme.get()],
      bounds: OPEN_BOUNDS,
      maxBounds: MAX_BOUNDS,
      minZoom: 8,
      attributionControl: false,
      cooperativeGestures: isEmbed,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    map.touchZoomRotate.disableRotation();
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.__cxMap = map; // dev/test hook
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
    map.on("mousemove", "cx-points", function (e) {
      var f = e.features[0];
      if (!f) return;
      map.getCanvas().style.cursor = "pointer";
      if (hoverId !== null && hoverId !== f.id) map.setFeatureState({ source: "cx", id: hoverId }, { hover: false });
      hoverId = f.id;
      map.setFeatureState({ source: "cx", id: hoverId }, { hover: true });
      if (!canHover || !data) return;
      var r = data.byId[f.properties.id];
      if (!r) return;
      if (!hoverPopup) hoverPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: "tx-tip", offset: 12, maxWidth: "260px" });
      var scale = [r.sqft ? fmt.numShort(r.sqft) + " sq ft" : "", r.units > 1 ? CX.plural(r.units, "unit") : ""].filter(Boolean).join(" · ");
      hoverPopup.setLngLat(f.geometry.coordinates)
        .setHTML("<strong>" + fmt.escape(r.address || "Address unavailable") + "</strong>" + (r.value ? fmt.moneyShort(r.value) : "Cost not given") +
          " <span>· " + fmt.escape(CX.placeLine(r)) + (scale ? " · " + scale : "") + "</span>")
        .addTo(map);
    });
    map.on("mouseleave", "cx-points", function () {
      map.getCanvas().style.cursor = "";
      if (hoverId !== null) map.setFeatureState({ source: "cx", id: hoverId }, { hover: false });
      hoverId = null;
      if (hoverPopup) hoverPopup.remove();
    });
    map.on("click", function (e) {
      if (!data) return;
      var pad = canHover ? 3 : 10;
      var feats = map.queryRenderedFeatures([[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]], { layers: ["cx-points"] });
      if (!feats.length) {
        if (!el.detail.hidden) clearSelection();
        return;
      }
      // The smallest hit is drawn on top.
      feats.sort(function (a, b) { return a.properties.value - b.properties.value; });
      if (hoverPopup) hoverPopup.remove();
      track("select", feats[0].properties.id);
      select(feats[0].properties.id, { announce: true });
    });
    map.on("zoomend", function () { if (data) renderLegend(); });
    map.on("moveend", updateListBtn);
    return new Promise(function (resolve) { map.on("load", resolve); });
  }

  // ------------------------------------------------------------------ peer
  var peer = CX.link("map", function (msg) {
    if (!data) return;
    if (msg.type === "filters" && msg.payload) {
      var hoodChanged = msg.payload.hood !== state.hood;
      state = msg.payload;
      box.set(state.q);
      el.topbar.querySelector(".tx-search-input").value = state.q || "";
      if (!el.filterPanel.hidden) filters.render();
      refresh(hoodChanged && state.hood ? { fit: true, animate: true } : null);
    } else if (msg.type === "select" || msg.type === "reveal") {
      var r = data.byId[msg.payload];
      if (r) {
        revealRow(r);
        select(msg.payload, { fly: true });
      }
    } else if (msg.type === "hello" && !CX.isDefault(state)) {
      peer.send("filters", CX.clone(state));
    }
  });

  // ------------------------------------------------------------------ boot
  function showError(msg) {
    el.loading.innerHTML = "<span>" + fmt.escape(msg) + "</span>";
    el.loading.hidden = false;
  }
  var mapReady = (window.__cxMapbox || Promise.resolve()).then(function () {
    if (!window.mapboxgl || !mapboxgl.supported || !mapboxgl.supported()) {
      throw new Error("This map needs WebGL, which your browser doesn’t support. The table on this page lists every project.");
    }
    try {
      return initMap();
    } catch (e) {
      throw new Error("The map couldn’t load. The table on this page lists every project.");
    }
  });
  mapReady.catch(function (e) { showError(e.message); });
  function hidePreview() {
    var pv = app.querySelector(".tx-preview");
    if (!pv) return;
    pv.classList.add("is-gone");
    setTimeout(function () { pv.remove(); }, 400);
  }

  Promise.all([CX.load(), mapReady]).then(function (res) {
    data = res[0];
    el.loading.hidden = true;
    var deep = params.get("project");
    refresh({ fit: !(deep && data.byId[deep]) });
    map.once("idle", hidePreview);
    if (deep && data.byId[deep]) {
      revealRow(data.byId[deep]);
      select(deep, { fly: true, instant: true });
    }
    track("loaded", data.rows.length);
  }).catch(function () {
    mapReady.then(function () { showError("Construction permits couldn’t load. Please try again later."); }, function () {});
  });
})();
