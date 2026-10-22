/*!
 * sr-map.js — South Florida condo reserve study (SIRS) map.
 * Depends on: mapbox-gl (window.__srMapbox), TRD theme.js, sr-core.js (SR).
 */
(function () {
  "use strict";

  var STYLES = { light: "mapbox://styles/mapbox/light-v11", dark: "mapbox://styles/mapbox/dark-v11" };
  // Opening view (the three counties) and limits; the HTML's preview matches.
  var OPEN_BOUNDS = [[-80.75, 25.4], [-79.95, 26.98]];
  var MAX_BOUNDS = [[-81.6, 24.9], [-79.3, 27.4]];
  // Must match the --sr-* tokens in sr.css (tx.css palette slots).
  var COLORS = {
    light: { post: "#2a78d6", both: "#1baf7a", pre: "#eb6834", ring: "#ffffff", sel: "#111111" },
    dark: { post: "#3987e5", both: "#199e70", pre: "#d95926", ring: "#212121", sel: "#ffffff" },
  };

  var fmt = SR.fmt;
  var track = SR.tracker("sofla-sirs-map");
  var params = new URLSearchParams(location.search);
  var isEmbed = window.self !== window.top;
  var app = document.getElementById("tx-app");
  var compact = params.get("view") === "dashboard" || window.innerHeight < 450;
  if (compact) app.classList.add("tx-compact");

  var state = SR.stateFromUrl();
  var data = null;
  var visible = [];
  var map = null;
  var selectedSpot = null;
  var hoverPopup = null;

  var theme = SR.theme(function (t) {
    try { localStorage.setItem("trd-sofla-sirs:theme-seen", JSON.stringify(t)); } catch (e) {}
    if (map) map.setStyle(STYLES[t]);
  }, track);
  try { localStorage.setItem("trd-sofla-sirs:theme-seen", JSON.stringify(theme.get())); } catch (e) {}

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
    mapWrap: app.querySelector(".tx-map-wrap"),
    loading: app.querySelector(".tx-loading"),
  };

  el.topbar.insertAdjacentHTML("afterbegin", SR.searchHtml(state.q, window.innerWidth < 520 ? "Search condos" : "Search condo, association or city"));
  var input = el.topbar.querySelector(".tx-search-input");
  var box = SR.searchBox({
    input: input,
    panel: el.results,
    getData: function () { return data; },
    onQuery: function (q) {
      var s = SR.clone(state);
      s.q = q;
      onFilterChange(s, "search", { fit: !!q });
    },
    onPick: function (it) {
      track("search_pick", it.kind);
      if (it.kind === "city") {
        var s = SR.clone(state);
        s.city = it.value;
        s.q = "";
        box.clear();
        onFilterChange(s, "city", { fit: true });
      } else {
        reveal(it.row);
        selectRow(it.row, { fly: true, announce: true });
      }
    },
  });
  var filters = SR.filterBar(el.filterPanel, function () { return SR.clone(state); }, onFilterChange, { getData: function () { return data; } });

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
  });

  // An association hidden by the filters (picked in search or sent by the
  // table) is still shown: drop the filters that hide it.
  function reveal(r) {
    if (SR.apply([r], state).length) return;
    state = SR.defaultState();
    box.set("");
    input.value = "";
    filters.render();
    refresh();
    peer.send("filters", SR.clone(state));
  }

  function onFilterChange(next, why, opts) {
    state = next;
    if (why !== "search") track("filter", why);
    refresh(opts && opts.fit ? { fit: true, animate: true } : null);
    peer.send("filters", SR.clone(state));
  }

  function refresh(opts) {
    if (!data) return;
    visible = SR.apply(data.rows, state);
    var located = visible.filter(function (r) { return r.located; });
    el.count.innerHTML = "<strong>" + visible.length.toLocaleString("en-US") + "</strong> " + (visible.length === 1 ? "association" : "associations") +
      (state.city ? " in " + fmt.escape(state.city) : "");
    var n = SR.filterCount(state);
    var badge = el.filterToggle.querySelector(".tx-badge");
    badge.hidden = !n;
    badge.textContent = n;
    SR.activeChips(el.chips, state, function (s, why) {
      box.set(s.q);
      if (!s.q) input.value = "";
      onFilterChange(s, why);
      if (!el.filterPanel.hidden) filters.render();
    });
    if (!el.filterPanel.hidden) filters.render();
    var approx = located.filter(function (r) { return !r.precise; }).length;
    el.note.textContent = compact
      ? "Associations that reported a SIRS to Florida’s DBPR · Hollow dots: approximate location"
      : SR.asOfText(data) + (approx ? " Hollow dots (" + approx.toLocaleString("en-US") + ") are approximate: the ZIP code or city center, the street, or a nearby place." : "");
    el.empty.hidden = !!located.length;
    el.empty.innerHTML = located.length ? "" : "No associations match these filters." + (SR.isDefault(state) ? "" : ' <button type="button" class="tx-reset" data-act="reset">Reset filters</button>');
    renderLegend();
    setSource(located);
    if (selectedSpot && !visible.some(function (r) { return r.spot === selectedSpot; })) clearSelection();
    else if (selectedSpot) renderDetail(selectedSpot);
    if (opts && opts.fit) fitTo(located, opts.animate);
  }
  el.empty.addEventListener("click", function (e) {
    if (!e.target.closest('[data-act="reset"]')) return;
    box.clear();
    onFilterChange(SR.defaultState(), "reset", { fit: true });
  });

  // One map point per spot; several associations can share it.
  function toFeatures(rows) {
    var by = {}, out = [];
    rows.forEach(function (r) {
      var f = by[r.spot];
      if (!f) {
        f = by[r.spot] = { type: "Feature", id: out.length, geometry: { type: "Point", coordinates: [r.lng, r.lat] }, properties: { spot: r.spot, n: 0, period: r.period, precise: r.precise ? 1 : 0, rank: 0 } };
        out.push(f);
      }
      f.properties.n++;
      // Color by the most recent report at the spot.
      var rank = { post: 3, both: 2, pre: 1 }[r.period];
      if (rank > f.properties.rank) { f.properties.rank = rank; f.properties.period = r.period; }
      if (r.precise) f.properties.precise = 1;
    });
    return { type: "FeatureCollection", features: out };
  }
  function setSource(rows) {
    var src = map && map.getSource("sr");
    if (src) src.setData(toFeatures(rows));
  }
  function fitTo(rows, animate) {
    if (!map || !rows.length) return;
    var b = new mapboxgl.LngLatBounds();
    rows.forEach(function (r) { b.extend([r.lng, r.lat]); });
    map.fitBounds(b, { padding: window.innerWidth <= 600 ? 40 : { top: 60, bottom: 40, left: 40, right: el.detail.hidden ? 60 : 380 }, maxZoom: 15, duration: animate ? 800 : 0 });
  }

  // ------------------------------------------------------------------ legend
  function renderLegend() {
    var p = COLORS[theme.get()];
    var counts = {};
    SR.apply(data.rows, state, { ignore: "periods" }).forEach(function (r) { counts[r.period] = (counts[r.period] || 0) + 1; });
    var all = state.periods.length === SR.PERIOD_IDS.length;
    var html = '<button type="button" class="tx-legend-toggle" aria-expanded="false">Legend</button><div class="tx-legend-body">' +
      '<p class="tx-legend-title">Reported a SIRS</p><div class="tx-legend-cats">';
    SR.PERIODS.forEach(function (x) {
      var on = all || state.periods.indexOf(x.id) >= 0;
      html += '<button type="button" class="tx-legend-cat' + (on ? "" : " is-off") + '" data-period="' + x.id + '" aria-pressed="' + on +
        '" title="Show only ' + x.long.toLowerCase() + '"><i class="tx-swatch" style="background:' + p[x.id] + '"></i>' + x.label +
        '<span class="tx-n">' + (counts[x.id] || 0).toLocaleString("en-US") + "</span></button>";
    });
    html += '</div><p class="tx-legend-hint sr-legend-hollow"><i aria-hidden="true"></i>Approximate location</p></div>';
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
    var b = e.target.closest("[data-period]");
    if (!b) return;
    var s = SR.clone(state), v = b.getAttribute("data-period"), ids = SR.PERIOD_IDS;
    var all = s.periods.length === ids.length;
    var next = all ? [v] : s.periods.indexOf(v) >= 0 ? s.periods.filter(function (x) { return x !== v; }) : s.periods.concat([v]);
    s.periods = !next.length || next.length === ids.length ? ids.slice() : ids.filter(function (x) { return next.indexOf(x) >= 0; });
    onFilterChange(s, "legend:" + v);
  });

  // ------------------------------------------------------------------ select
  function rowsAt(spot) {
    return visible.filter(function (r) { return r.spot === spot; });
  }
  function selectRow(r, opts) {
    opts = opts || {};
    if (!r.located) return;
    selectSpot(r.spot, { fly: opts.fly, focusId: r.id });
    if (opts.announce) peer.send("select", r.id);
  }
  function selectSpot(spot, opts) {
    opts = opts || {};
    selectedSpot = spot;
    renderDetail(spot, opts.focusId);
    highlight();
    var r = data.rows.filter(function (x) { return x.spot === spot; })[0];
    if (opts.fly && r && map) {
      map.flyTo({ center: [r.lng, r.lat], zoom: Math.max(map.getZoom(), r.precise ? 15.5 : 13), padding: detailPadding(), duration: opts.instant ? 0 : 900, essential: true });
    }
  }
  function detailPadding() {
    return window.innerWidth <= 600 ? { top: 0, bottom: Math.round(window.innerHeight * 0.45), left: 0, right: 0 } : { top: 0, bottom: 0, left: 0, right: 360 };
  }
  function clearSelection() {
    selectedSpot = null;
    el.detail.hidden = true;
    highlight();
  }
  function highlight() {
    if (map && map.getLayer("sr-selected")) map.setFilter("sr-selected", ["==", ["get", "spot"], selectedSpot || ""]);
  }

  function assocHtml(r, open) {
    var actions = peer.hasPeer("table") ? '<div class="tx-actions"><button type="button" class="tx-btn" data-act="table" data-id="' + r.id + '">Show in table</button></div>' : "";
    return '<div class="tx-tags">' + SR.periodTag(r) + (r.type !== "Not listed" ? '<span class="tx-tag">' + r.type + "</span>" : "") + "</div>" +
      '<dl class="tx-dl">' + SR.facts(r).map(function (x) { return "<dt>" + x[0] + "</dt><dd>" + x[1] + "</dd>"; }).join("") + "</dl>" +
      SR.projectsHtml(r) + actions;
  }
  function renderDetail(spot, focusId) {
    var list = rowsAt(spot);
    if (!list.length) { clearSelection(); return; }
    var head, body;
    if (list.length === 1) {
      var r = list[0];
      head = fmt.escape(r.name) + '<span class="tx-sub">' + fmt.escape([r.city, r.zip].filter(Boolean).join(" ")) + "</span>";
      body = assocHtml(r);
    } else {
      var r0 = list[0];
      head = SR.plural(list.length, "association") + ' here<span class="tx-sub">' +
        fmt.escape([r0.city, r0.zip].filter(Boolean).join(" ") + (r0.precise ? "" : " · approximate location")) + "</span>";
      body = '<ul class="sr-stack">' + list.map(function (x) {
        var openIt = x.id === focusId;
        return '<li><details' + (openIt ? " open" : "") + '><summary><span class="sr-stack-name">' + fmt.escape(x.name) + '</span><span class="tx-swatch sr-swatch-' + x.period + '" title="' + fmt.escape(SR.periodLabel(x.period)) + '"></span></summary>' +
          assocHtml(x) + "</details></li>";
      }).join("") + "</ul>";
    }
    el.detail.innerHTML = '<div class="tx-detail-head"><h2 id="tx-detail-title">' + head + '</h2><button type="button" class="tx-close" aria-label="Close">×</button></div>' +
      '<div class="tx-detail-body">' + body + "</div>";
    el.detail.setAttribute("aria-labelledby", "tx-detail-title");
    el.detail.hidden = false;
    el.detail.scrollTop = 0;
    var f = focusId && el.detail.querySelector("details[open]");
    if (f) f.scrollIntoView({ block: "nearest" });
  }
  el.detail.addEventListener("click", function (e) {
    if (e.target.closest(".tx-close")) { clearSelection(); return; }
    var b = e.target.closest('[data-act="table"]');
    if (b) {
      peer.send("reveal", b.getAttribute("data-id"));
      track("show_in_table", b.getAttribute("data-id"));
    }
  });

  // ------------------------------------------------------------------ map
  function declutter() {
    (map.getStyle().layers || []).forEach(function (l) {
      if (/poi|transit|airport/.test(l.id) && l.type === "symbol") map.setLayoutProperty(l.id, "visibility", "none");
    });
  }
  function addLayers() {
    var p = COLORS[theme.get()];
    if (!map.getSource("sr")) map.addSource("sr", { type: "geojson", data: toFeatures(visible.filter(function (r) { return r.located; })) });
    var hover = ["boolean", ["feature-state", "hover"], false];
    var color = ["match", ["get", "period"], "post", p.post, "both", p.both, p.pre];
    // Bigger for points holding several associations. `extra` widens the selection ring.
    function radius(extra) {
      return ["interpolate", ["linear"], ["zoom"], 8, ["+", 2.5 + extra, ["min", ["get", "n"], 6]], 12, ["+", 4 + extra, ["min", ["*", ["get", "n"], 1.2], 9]],
        15, ["+", 6 + extra, ["min", ["*", ["get", "n"], 1.5], 12]]];
    }
    map.addLayer({
      id: "sr-points",
      type: "circle",
      source: "sr",
      paint: {
        "circle-radius": radius(0),
        // Approximate locations draw hollow.
        "circle-color": ["case", ["==", ["get", "precise"], 1], color, "rgba(0,0,0,0)"],
        "circle-opacity": ["case", hover, 1, 0.85],
        "circle-stroke-color": ["case", hover, p.sel, ["==", ["get", "precise"], 1], p.ring, color],
        "circle-stroke-width": ["case", ["==", ["get", "precise"], 1], ["case", hover, 2, 0.8], ["case", hover, 2.5, 1.6]],
      },
      layout: { "circle-sort-key": ["get", "precise"] },
    });
    map.addLayer({
      id: "sr-selected",
      type: "circle",
      source: "sr",
      filter: ["==", ["get", "spot"], selectedSpot || ""],
      paint: { "circle-radius": radius(4), "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": p.sel, "circle-stroke-width": 2.5 },
    });
  }
  function initMap() {
    mapboxgl.accessToken = SR.MAPBOX_TOKEN;
    map = new mapboxgl.Map({
      container: "tx-map",
      style: STYLES[theme.get()],
      bounds: OPEN_BOUNDS,
      maxBounds: MAX_BOUNDS,
      minZoom: 7,
      attributionControl: false,
      cooperativeGestures: isEmbed,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    map.touchZoomRotate.disableRotation();
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.__srMap = map; // dev/test hook
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
    map.on("mousemove", "sr-points", function (e) {
      var f = e.features[0];
      if (!f) return;
      map.getCanvas().style.cursor = "pointer";
      if (hoverId !== null && hoverId !== f.id) map.setFeatureState({ source: "sr", id: hoverId }, { hover: false });
      hoverId = f.id;
      map.setFeatureState({ source: "sr", id: hoverId }, { hover: true });
      if (!canHover || !data) return;
      var list = rowsAt(f.properties.spot);
      if (!list.length) return;
      if (!hoverPopup) hoverPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: "tx-tip", offset: 10, maxWidth: "260px" });
      var r = list[0];
      hoverPopup.setLngLat(f.geometry.coordinates).setHTML(list.length === 1
        ? "<strong>" + fmt.escape(r.name) + "</strong>" + fmt.escape([r.city, r.zip].filter(Boolean).join(" ")) + " <span>· " + fmt.escape(SR.periodLabel(r.period)) + (r.precise ? "" : " · approximate location") + "</span>"
        : "<strong>" + SR.plural(list.length, "association") + "</strong>" + fmt.escape([r.city, r.zip].filter(Boolean).join(" ")) + " <span>· click to list" + (r.precise ? "" : " · approximate location") + "</span>")
        .addTo(map);
    });
    map.on("mouseleave", "sr-points", function () {
      map.getCanvas().style.cursor = "";
      if (hoverId !== null) map.setFeatureState({ source: "sr", id: hoverId }, { hover: false });
      hoverId = null;
      if (hoverPopup) hoverPopup.remove();
    });
    map.on("click", function (e) {
      if (!data) return;
      var pad = canHover ? 3 : 10;
      var feats = map.queryRenderedFeatures([[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]], { layers: ["sr-points"] });
      if (!feats.length) {
        if (!el.detail.hidden) clearSelection();
        return;
      }
      if (hoverPopup) hoverPopup.remove();
      feats.sort(function (a, b) { return b.properties.precise - a.properties.precise; });
      track("select", feats[0].properties.spot);
      selectSpot(feats[0].properties.spot);
    });
    return new Promise(function (resolve) { map.on("load", resolve); });
  }

  // ------------------------------------------------------------------ peer
  var peer = SR.link("map", function (msg) {
    if (!data) return;
    if (msg.type === "filters" && msg.payload) {
      var cityChanged = msg.payload.city !== state.city;
      state = msg.payload;
      box.set(state.q);
      input.value = state.q || "";
      if (!el.filterPanel.hidden) filters.render();
      refresh(cityChanged && state.city ? { fit: true, animate: true } : null);
    } else if (msg.type === "select" || msg.type === "reveal") {
      var r = data.byId[msg.payload];
      if (r) {
        reveal(r);
        selectRow(r, { fly: true });
      }
    } else if (msg.type === "hello" && !SR.isDefault(state)) {
      peer.send("filters", SR.clone(state));
    }
  });

  // ------------------------------------------------------------------ boot
  function showError(msg) {
    el.loading.innerHTML = "<span>" + fmt.escape(msg) + "</span>";
    el.loading.hidden = false;
  }
  var mapReady = (window.__srMapbox || Promise.resolve()).then(function () {
    if (!window.mapboxgl || !mapboxgl.supported || !mapboxgl.supported()) {
      throw new Error("This map needs WebGL, which your browser doesn’t support. The table on this page lists every association.");
    }
    try {
      return initMap();
    } catch (e) {
      throw new Error("The map couldn’t load. The table on this page lists every association.");
    }
  });
  mapReady.catch(function (e) { showError(e.message); });
  function hidePreview() {
    var pv = app.querySelector(".tx-preview");
    if (!pv) return;
    pv.classList.add("is-gone");
    setTimeout(function () { pv.remove(); }, 400);
  }
  Promise.all([SR.load(), mapReady]).then(function (res) {
    data = res[0];
    SR.resolveCity(state, data);
    el.loading.hidden = true;
    refresh({ fit: !!(state.city || state.q) });
    map.once("idle", hidePreview);
    track("loaded", data.rows.length);
  }).catch(function () {
    mapReady.then(function () { showError("The reserve study filings couldn’t load. Please try again later."); }, function () {});
  });
})();
