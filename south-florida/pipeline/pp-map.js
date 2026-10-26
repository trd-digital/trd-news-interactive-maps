/*!
 * pp-map.js — South Florida project-pipeline map (Live Local, condo filings).
 * Depends on: mapbox-gl (window.__ppMapbox), TRD theme.js, a PP_CONFIG file, pp-core.js (PP).
 */
(function () {
  "use strict";

  var CFG = PP.CFG;
  var STYLES = { light: "mapbox://styles/mapbox/light-v11", dark: "mapbox://styles/mapbox/dark-v11" };
  // Opening view (the three counties) and limits.
  var OPEN_BOUNDS = CFG.openBounds || [[-80.75, 25.4], [-79.95, 26.98]];
  var MAX_BOUNDS = [[-81.6, 24.9], [-79.3, 27.4]];
  var RING = { light: { ring: "#ffffff", sel: "#111111" }, dark: { ring: "#212121", sel: "#ffffff" } };
  // Units shown in the size key; circles are sized by the square root of units.
  var SIZE_KEY = CFG.sizeKey || [100, 500, 2000];

  var fmt = PP.fmt;
  var track = PP.tracker("map");
  var params = new URLSearchParams(location.search);
  var isEmbed = window.self !== window.top;
  var app = document.getElementById("tx-app");
  var compact = params.get("view") === "dashboard" || window.innerHeight < 450;
  if (compact) app.classList.add("tx-compact");

  var state = PP.stateFromUrl();
  var data = null;
  var visible = [];
  var map = null;
  // The picked city's outline (shared/sofla-area.js); the map snaps to it.
  var area = SoflaArea.attach({
    id: "pp",
    getMap: function () { return map; },
    getTheme: function () { return theme.get(); },
    onLoad: function () { area.fit(true, fitPadding()); },
  });
  var shownCity = null;
  var selectedSpot = null;
  var hoverPopup = null;

  var theme = PP.theme(function (t) {
    if (map) map.setStyle(STYLES[t]);
    if (data) renderLegend();
  }, track);

  var el = {
    topbar: app.querySelector(".tx-topbar"),
    count: app.querySelector(".tx-count"),
    filterToggle: app.querySelector(".tx-filter-toggle"),
    filterPanel: app.querySelector(".tx-filter-panel"),
    results: app.querySelector(".tx-results"),
    chips: app.querySelector(".tx-active"),
    legend: app.querySelector(".tx-legend"),
    note: app.querySelector(".tx-mapnote"),
    detail: app.querySelector(".tx-detail"),
    empty: app.querySelector(".tx-empty-map"),
    loading: app.querySelector(".tx-loading"),
  };

  el.topbar.insertAdjacentHTML("afterbegin", PP.searchHtml(state.q, window.innerWidth < 520 ? CFG.searchShort : CFG.searchLong));
  var input = el.topbar.querySelector(".tx-search-input");
  var box = PP.searchBox({
    input: input,
    panel: el.results,
    getData: function () { return data; },
    onQuery: function (q) {
      var s = PP.clone(state);
      s.q = q;
      onFilterChange(s, "search", { fit: !!q });
    },
    onPick: function (it) {
      track("search_pick", it.kind);
      if (it.kind === "city") {
        var s = PP.clone(state);
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
  var filters = PP.filterBar(el.filterPanel, function () { return PP.clone(state); }, onFilterChange, { getData: function () { return data; } });

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

  // A project hidden by the filters (picked in search or sent by the table)
  // is still shown: drop the filters that hide it.
  function reveal(r) {
    if (PP.apply([r], state).length) return;
    state = PP.defaultState();
    box.set("");
    input.value = "";
    filters.render();
    refresh();
    peer.send("filters", PP.clone(state));
  }

  function onFilterChange(next, why, opts) {
    state = next;
    if (why !== "search") track("filter", why);
    refresh(opts && opts.fit ? { fit: true, animate: true } : null);
    peer.send("filters", PP.clone(state));
  }

  function refresh(opts) {
    if (!data) return;
    visible = PP.apply(data.rows, state);
    var located = visible.filter(function (r) { return r.located; });
    el.count.innerHTML = "<strong>" + visible.length.toLocaleString("en-US") + "</strong> " + (visible.length === 1 ? CFG.noun.one : CFG.noun.many) +
      (state.city ? " in " + fmt.escape(state.city) : "");
    var n = PP.filterCount(state);
    var badge = el.filterToggle.querySelector(".tx-badge");
    badge.hidden = !n;
    badge.textContent = n;
    PP.activeChips(el.chips, state, function (s, why) {
      box.set(s.q);
      if (!s.q) input.value = "";
      onFilterChange(s, why);
      if (!el.filterPanel.hidden) filters.render();
    }, data);
    if (!el.filterPanel.hidden) filters.render();
    var offMap = visible.length - located.length;
    el.note.innerHTML = CFG.note(data, compact) + (offMap && !compact ? " " + fmt.escape(offMap === 1 ? "One " + CFG.noun.one + " isn’t on the map: its address places it outside the three counties. It’s in the table." : offMap + " " + CFG.noun.many + " aren’t on the map: their addresses place them outside the three counties. They’re in the table.") : "");
    el.empty.hidden = !!located.length;
    el.empty.innerHTML = located.length ? "" : "No " + CFG.noun.many + " match these filters." + (PP.isDefault(state) ? "" : ' <button type="button" class="tx-reset" data-act="reset">Reset filters</button>');
    renderLegend();
    setSource(located);
    area.show(state.city);
    var cityChanged = state.city !== shownCity;
    shownCity = state.city;
    if (selectedSpot && !visible.some(function (r) { return r.spot === selectedSpot; })) clearSelection();
    else if (selectedSpot) renderDetail(selectedSpot);
    if ((opts && opts.fit) || (cityChanged && state.city)) fitTo(located, opts ? opts.animate : true);
  }
  el.empty.addEventListener("click", function (e) {
    if (!e.target.closest('[data-act="reset"]')) return;
    box.clear();
    onFilterChange(PP.defaultState(), "reset", { fit: true });
  });

  // One map point per spot; projects at the same point share it.
  function toFeatures(rows) {
    var by = {}, out = [];
    rows.forEach(function (r) {
      var f = by[r.spot];
      if (!f) {
        f = by[r.spot] = { type: "Feature", id: out.length, geometry: { type: "Point", coordinates: [r.lng, r.lat] }, properties: { spot: r.spot, n: 0, stage: r.stage, u: 0, known: 0 } };
        out.push(f);
      }
      var p = f.properties;
      p.n++;
      if (r.units) { p.u += r.units; p.known = 1; }
      if (CFG.stages.map(function (s) { return s.id; }).indexOf(r.stage) < CFG.stages.map(function (s) { return s.id; }).indexOf(p.stage)) p.stage = r.stage;
    });
    return { type: "FeatureCollection", features: out };
  }
  function setSource(rows) {
    var src = map && map.getSource("pp");
    if (src) src.setData(toFeatures(rows));
  }
  function fitPadding() {
    return window.innerWidth <= 600 ? 40 : { top: 60, bottom: 40, left: 40, right: el.detail.hidden ? 60 : 380 };
  }
  function fitTo(rows, animate) {
    if (map && area.fit(animate, fitPadding())) return; // a picked city fits to its outline
    if (!map || !rows.length) return;
    var b = new mapboxgl.LngLatBounds();
    rows.forEach(function (r) { b.extend([r.lng, r.lat]); });
    map.fitBounds(b, { padding: fitPadding(), maxZoom: 15, duration: animate ? 800 : 0 });
  }

  // Circle radius in px for a unit count at a zoom; the layer and the size key share it.
  var ZOOM_SCALE = [[8, 0.55], [10, 0.8], [13, 1.15], [16, 1.6]];
  function zoomScale(z) {
    var s = ZOOM_SCALE;
    if (z <= s[0][0]) return s[0][1];
    for (var i = 1; i < s.length; i++) {
      if (z <= s[i][0]) return s[i - 1][1] + (s[i][1] - s[i - 1][1]) * (z - s[i - 1][0]) / (s[i][0] - s[i - 1][0]);
    }
    return s[s.length - 1][1];
  }
  function px(units, z) {
    return (3 + Math.sqrt(units || 0) * (CFG.sizeScale || 0.32)) * zoomScale(z);
  }

  // ------------------------------------------------------------------ legend
  function renderLegend() {
    var counts = {};
    PP.apply(data.rows, state, { ignore: CFG.stageGroup }).forEach(function (r) { counts[r.stage] = (counts[r.stage] || 0) + 1; });
    var pick = state.sel[CFG.stageGroup];
    var html = '<button type="button" class="tx-legend-toggle" aria-expanded="false">Legend</button><div class="tx-legend-body">' +
      '<p class="tx-legend-title">' + fmt.escape(CFG.legendTitle) + '</p><div class="tx-legend-cats">';
    CFG.stages.forEach(function (x) {
      if (!counts[x.id] && !(pick && pick.indexOf(x.id) >= 0) && !data.rows.some(function (r) { return r.stage === x.id; })) return;
      var on = !pick || pick.indexOf(x.id) >= 0;
      html += '<button type="button" class="tx-legend-cat' + (on ? "" : " is-off") + '" data-stage="' + x.id + '" aria-pressed="' + on +
        '" title="Show only: ' + fmt.escape(x.label) + '">' + PP.swatch(x.id) + fmt.escape(x.label) +
        '<span class="tx-n">' + (counts[x.id] || 0).toLocaleString("en-US") + "</span></button>";
    });
    html += "</div>";
    if (!compact) {
      var keys = SIZE_KEY.filter(function (u) { return u <= data.maxUnits * 1.2; });
      html += '<div class="pp-size-key" aria-hidden="true">' + keys.map(function (u) {
        var d = Math.round(px(u, map ? map.getZoom() : 9) * 2);
        return '<span><i style="width:' + d + "px;height:" + d + 'px"></i>' + u.toLocaleString("en-US") + "</span>";
      }).join("") + '</div><p class="tx-legend-hint">' + fmt.escape(CFG.sizeLabel) + "</p>";
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
    var b = e.target.closest("[data-stage]");
    if (!b) return;
    var s = PP.clone(state), v = b.getAttribute("data-stage");
    var all = PP.groupValues(PP.group(CFG.stageGroup), data).map(function (x) { return x.id; });
    s.sel[CFG.stageGroup] = PP.toggle(s.sel[CFG.stageGroup], v, all);
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
      map.flyTo({ center: [r.lng, r.lat], zoom: Math.max(map.getZoom(), 14), padding: detailPadding(), duration: 900, essential: true });
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
    if (map && map.getLayer("pp-selected")) map.setFilter("pp-selected", ["==", ["get", "spot"], selectedSpot || ""]);
  }

  function bodyHtml(r) {
    var actions = peer.hasPeer("table") ? '<div class="tx-actions"><button type="button" class="tx-btn" data-act="table" data-id="' + r.id + '">Show in table</button></div>' : "";
    return CFG.detail(r, "panel") + actions;
  }
  function renderDetail(spot, focusId) {
    var list = rowsAt(spot);
    if (!list.length) { clearSelection(); return; }
    var head, body;
    if (list.length === 1) {
      var r = list[0];
      head = fmt.escape(r.name) + '<span class="tx-sub">' + fmt.escape(r.sub || "") + "</span>";
      body = bodyHtml(r);
    } else {
      head = PP.plural(list.length, CFG.noun.one, CFG.noun.many) + ' here<span class="tx-sub">' + fmt.escape(list[0].sub || "") + "</span>";
      body = '<ul class="pp-stack">' + list.map(function (x) {
        return '<li><details' + (x.id === focusId || (!focusId && x === list[0]) ? " open" : "") + '><summary><span class="pp-stack-name">' + fmt.escape(x.name) + "</span>" + PP.swatch(x.stage) + "</summary>" +
          bodyHtml(x) + "</details></li>";
      }).join("") + "</ul>";
    }
    el.detail.innerHTML = '<div class="tx-detail-head"><h2 id="tx-detail-title">' + head + '</h2><button type="button" class="tx-close" aria-label="Close">×</button></div>' +
      '<div class="tx-detail-body">' + body + "</div>";
    el.detail.setAttribute("aria-labelledby", "tx-detail-title");
    el.detail.hidden = false;
    el.detail.scrollTop = 0;
  }
  el.detail.addEventListener("click", function (e) {
    if (e.target.closest(".tx-close")) { clearSelection(); return; }
    var b = e.target.closest('[data-act="table"]');
    if (b) {
      peer.send("reveal", b.getAttribute("data-id"));
      track("show_in_table", b.getAttribute("data-id"));
    }
    var a = e.target.closest("a[href]");
    if (a) track("link", a.href);
  });

  // ------------------------------------------------------------------ map
  function declutter() {
    (map.getStyle().layers || []).forEach(function (l) {
      if (/poi|transit|airport/.test(l.id) && l.type === "symbol") map.setLayoutProperty(l.id, "visibility", "none");
    });
  }
  function addLayers() {
    area.addLayers(); // under the points
    var t = theme.get(), ring = RING[t];
    if (!map.getSource("pp")) map.addSource("pp", { type: "geojson", data: toFeatures(visible.filter(function (r) { return r.located; })) });
    var hover = ["boolean", ["feature-state", "hover"], false];
    var color = ["match", ["get", "stage"]];
    CFG.stages.forEach(function (s) { color.push(s.id, s.color[t]); });
    color.push(CFG.stages[CFG.stages.length - 1].color[t]);
    // Area tracks units: radius grows with the square root. Unknown size: a small dot.
    var k = CFG.sizeScale || 0.32;
    function radius(extra) {
      var stops = ["interpolate", ["linear"], ["zoom"]];
      ZOOM_SCALE.forEach(function (z) {
        stops.push(z[0], ["+", extra, ["*", z[1], ["+", 3, ["*", k, ["sqrt", ["get", "u"]]]]]]);
      });
      return stops;
    }
    map.addLayer({
      id: "pp-points",
      type: "circle",
      source: "pp",
      paint: {
        "circle-radius": radius(0),
        "circle-color": color,
        "circle-opacity": ["case", hover, 0.95, 0.78],
        "circle-stroke-color": ["case", hover, ring.sel, ring.ring],
        "circle-stroke-width": ["case", hover, 2, 1],
      },
      // Big projects underneath, so small ones stay clickable.
      layout: { "circle-sort-key": ["-", 0, ["get", "u"]] },
    });
    map.addLayer({
      id: "pp-selected",
      type: "circle",
      source: "pp",
      filter: ["==", ["get", "spot"], selectedSpot || ""],
      paint: { "circle-radius": radius(4), "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": ring.sel, "circle-stroke-width": 2.5 },
    });
  }
  function initMap() {
    mapboxgl.accessToken = PP.MAPBOX_TOKEN;
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
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.__ppMap = map; // dev/test hook
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    if (!compact) map.addControl(new mapboxgl.FullscreenControl(), "top-right");
    map.on("zoomend", function () { if (data && !compact) renderLegend(); });
    map.on("style.load", function () {
      declutter();
      addLayers();
      highlight();
    });
    var hoverId = null;
    var canHover = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
    map.on("mousemove", "pp-points", function (e) {
      var f = e.features[0];
      if (!f) return;
      map.getCanvas().style.cursor = "pointer";
      if (hoverId !== null && hoverId !== f.id) map.setFeatureState({ source: "pp", id: hoverId }, { hover: false });
      hoverId = f.id;
      map.setFeatureState({ source: "pp", id: hoverId }, { hover: true });
      if (!canHover || !data) return;
      var list = rowsAt(f.properties.spot);
      if (!list.length) return;
      if (!hoverPopup) hoverPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: "tx-tip", offset: 10, maxWidth: "260px" });
      hoverPopup.setLngLat(f.geometry.coordinates).setHTML(list.length === 1 ? CFG.tip(list[0])
        : "<strong>" + PP.plural(list.length, CFG.noun.one, CFG.noun.many) + "</strong>" + fmt.escape(list[0].sub || "") + " <span>· click to list</span>")
        .addTo(map);
    });
    map.on("mouseleave", "pp-points", function () {
      map.getCanvas().style.cursor = "";
      if (hoverId !== null) map.setFeatureState({ source: "pp", id: hoverId }, { hover: false });
      hoverId = null;
      if (hoverPopup) hoverPopup.remove();
    });
    map.on("click", function (e) {
      if (!data) return;
      var pad = canHover ? 3 : 10;
      var feats = map.queryRenderedFeatures([[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]], { layers: ["pp-points"] });
      if (!feats.length) {
        if (!el.detail.hidden) clearSelection();
        return;
      }
      if (hoverPopup) hoverPopup.remove();
      // The smallest circle under the pointer is the one the reader aimed at.
      feats.sort(function (a, b) { return a.properties.u - b.properties.u; });
      track("select", feats[0].properties.spot);
      selectSpot(feats[0].properties.spot);
    });
    return new Promise(function (resolve) { map.on("load", resolve); });
  }

  // ------------------------------------------------------------------ peer
  var peer = PP.link("map", function (msg) {
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
    } else if (msg.type === "hello" && !PP.isDefault(state)) {
      peer.send("filters", PP.clone(state));
    }
  });

  // ------------------------------------------------------------------ boot
  function showError(msg) {
    el.loading.innerHTML = "<span>" + fmt.escape(msg) + "</span>";
    el.loading.hidden = false;
  }
  var mapReady = (window.__ppMapbox || Promise.resolve()).then(function () {
    if (!window.mapboxgl || !mapboxgl.supported || !mapboxgl.supported()) {
      throw new Error("This map needs WebGL, which your browser doesn’t support. The table on this page lists every " + CFG.noun.one + ".");
    }
    try {
      return initMap();
    } catch (e) {
      throw new Error("The map couldn’t load. The table on this page lists every " + CFG.noun.one + ".");
    }
  });
  mapReady.catch(function (e) { showError(e.message); });
  Promise.all([PP.load(), mapReady]).then(function (res) {
    data = res[0];
    PP.resolve(state, data);
    el.loading.hidden = true;
    refresh({ fit: true });
    track("loaded", data.rows.length);
  }).catch(function () {
    mapReady.then(function () { showError(CFG.loadError); }, function () {});
  });
})();
