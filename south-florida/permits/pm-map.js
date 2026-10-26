/*!
 * pm-map.js — South Florida building permits map (one dot per site).
 * Depends on: mapbox-gl (window.__pmMapbox), TRD theme.js, pm-core.js (PM).
 */
(function () {
  "use strict";

  var STYLES = { light: "mapbox://styles/mapbox/light-v11", dark: "mapbox://styles/mapbox/dark-v11" };
  // Opening view and limits; the HTML's instant preview uses the same numbers.
  var OPEN_BOUNDS = [[-80.56, 25.54], [-80.12, 25.98]];
  var MAX_BOUNDS = [[-81.0, 25.25], [-79.7, 27.05]];
  // Must match the --pm-* tokens in pm.css (tx.css palette slots).
  var COLORS = {
    light: { new: "#2a78d6", addition: "#1baf7a", renovation: "#9a9993", demolition: "#eb6834", ring: "#ffffff", sel: "#111111" },
    dark: { new: "#3987e5", addition: "#199e70", renovation: "#8a8984", demolition: "#d95926", ring: "#212121", sel: "#ffffff" },
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

  var fmt = PM.fmt;
  var track = PM.tracker("sofla-permits-map");
  var params = new URLSearchParams(location.search);
  var isEmbed = window.self !== window.top;
  var app = PM.root(document.currentScript);
  var compact = params.get("view") === "dashboard" || window.innerHeight < 450;
  if (compact) app.classList.add("tx-compact");

  var state = PM.stateFromUrl();
  var data = null;
  var visible = [];
  var map = null;
  // The picked city's outline (shared/sofla-area.js); the map snaps to it.
  var area = SoflaArea.attach({
    id: "pm",
    getMap: function () { return map; },
    getTheme: function () { return theme.get(); },
    onLoad: function () { if (!state.hood) area.fit(true, fitPadding()); },
  });
  var shownCity = null;
  var selectedId = null;
  var hoverPopup = null;

  var theme = PM.theme(function (t) {
    try { localStorage.setItem("trd-sofla-pm:theme-seen", JSON.stringify(t)); } catch (e) {}
    if (map) map.setStyle(STYLES[t]); // style.load re-adds our layers
  }, track);
  try { localStorage.setItem("trd-sofla-pm:theme-seen", JSON.stringify(theme.get())); } catch (e) {}

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

  el.topbar.insertAdjacentHTML("afterbegin", PM.searchHtml(state.q, window.innerWidth < 520 ? "Search permits" : "Search address, city, owner or permit #"));
  var box = PM.searchBox({
    input: el.topbar.querySelector(".tx-search-input"),
    panel: el.results,
    getData: function () { return data; },
    onQuery: function (q) {
      var s = PM.clone(state);
      s.q = q;
      onFilterChange(s, "search", { fit: !!q });
    },
    onPick: function (it) {
      var s = PM.clone(state);
      track("search_pick", it.kind);
      if (it.kind === "city") {
        s.city = it.value;
        s.hood = null;
        s.q = "";
        box.clear();
        onFilterChange(s, "city", { fit: true });
      } else if (it.kind === "hood") {
        s.hood = it.value;
        s.q = "";
        box.clear();
        onFilterChange(s, "hood", { fit: true });
      } else if (it.kind === "owner") {
        s.q = it.value;
        box.clear();
        el.topbar.querySelector(".tx-search-input").value = it.value;
        onFilterChange(s, "owner", { fit: true });
      } else if (it.kind === "project") {
        revealRow(it.row);
        select(it.row.id, { fly: true, announce: true });
      }
    },
  });
  var filters = PM.filterBar(el.filterPanel, function () { return PM.clone(state); }, onFilterChange, {
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
    if (PM.apply([r], state, data.asOf).length) return;
    var s = PM.clone(state);
    if (s.sizes.indexOf(r.size) < 0) s.sizes = PM.SIZE_IDS.filter(function (x) { return s.sizes.indexOf(x) >= 0 || x === r.size; });
    if (s.types.indexOf(r.type) < 0) s.types = PM.TYPES.slice();
    if (s.works.indexOf(r.work) < 0) s.works = PM.WORK_IDS.slice();
    if (s.city && s.city !== r.city) s.city = null;
    if (s.hood && s.hood !== r.hood) s.hood = null;
    if (!PM.apply([r], s, data.asOf).length) { s = PM.defaultState(); s.sizes = PM.SIZE_IDS.slice(); }
    state = s;
    box.set(state.q);
    filters.render();
    refresh();
    peer.send("filters", PM.clone(state));
  }

  // ------------------------------------------------------------- filtering
  function onFilterChange(next, why, opts) {
    state = next;
    if (why !== "search") track("filter", why);
    refresh(opts && opts.fit ? { fit: true, animate: true } : null);
    peer.send("filters", PM.clone(state));
  }

  function refresh(opts) {
    if (!data) return;
    visible = PM.apply(data.rows, state, data.asOf);
    var located = visible.filter(function (r) { return r.located; });
    var sum = PM.summary(visible);
    var typeWord = state.works.length === 1 ? PM.workLabel(state.works[0]).toLowerCase().replace(/ or .*/, "") + " " : "";
    el.count.innerHTML = "<strong>" + sum.count.toLocaleString("en-US") + "</strong> " + typeWord + (sum.count === 1 ? "site" : "sites") +
      (state.hood ? " in " + fmt.escape(state.hood) : state.city ? " in " + fmt.escape(state.city) : "") +
      (sum.value ? '<span class="tx-count-total"> · ' + fmt.moneyShort(sum.value) + " est. cost</span>" : "");
    var n = PM.filterCount(state);
    var badge = el.filterToggle.querySelector(".tx-badge");
    badge.hidden = !n;
    badge.textContent = n;
    PM.activeChips(el.chips, state, function (s, why) {
      box.set(s.q);
      if (!s.q) el.topbar.querySelector(".tx-search-input").value = "";
      onFilterChange(s, why);
      if (!el.filterPanel.hidden) filters.render();
    });
    if (!el.filterPanel.hidden) filters.render();
    var unmapped = visible.length - located.length;
    el.note.textContent = compact
      ? "Permits through " + fmt.date(data.asOf) + " · Source: " + PM.sourceShort(data)
      : PM.asOfText(data) + (unmapped ? " " + PM.plural(unmapped, "site") + " without a reliable map location " + (unmapped === 1 ? "is" : "are") + " listed in the table." : "");
    renderEmpty(visible.length, located.length);
    renderLegend();
    setSource(located);
    area.show(state.city);
    var cityChanged = state.city !== shownCity;
    shownCity = state.city;
    updateListBtn();
    if (selectedId && !visible.some(function (r) { return r.id === selectedId; })) clearSelection();
    if ((opts && opts.fit) || (cityChanged && state.city)) fitTo(located, opts ? opts.animate : true);
  }

  function renderEmpty(n, mapped) {
    if (!data || mapped) {
      el.empty.hidden = true;
      return;
    }
    el.empty.innerHTML = (n ? "None of these sites has a map location; they’re listed in the table." : "No permits match these filters.") +
      (PM.isDefault(state) ? "" : ' <button type="button" class="tx-reset" data-act="reset">Reset filters</button>');
    el.empty.hidden = false;
  }
  el.empty.addEventListener("click", function (e) {
    if (!e.target.closest('[data-act="reset"]')) return;
    box.clear();
    onFilterChange(PM.defaultState(), "reset", { fit: true });
  });

  function toFeatures(rows) {
    return {
      type: "FeatureCollection",
      features: rows.map(function (r) {
        return {
          type: "Feature",
          id: r._n,
          geometry: { type: "Point", coordinates: [r.lng, r.lat] },
          properties: { id: r.id, value: r.value || 0, work: r.work, minor: r.size === "minor" || r.size === "nocost" ? 1 : 0 },
        };
      }),
    };
  }
  function setSource(rows) {
    var src = map && map.getSource("pm");
    if (src) src.setData(toFeatures(rows));
  }
  function fitPadding() {
    return window.innerWidth <= 600 ? 40 : { top: 60, bottom: 40, left: 40, right: el.detail.hidden ? 60 : 380 };
  }
  function fitTo(rows, animate) {
    // A picked city fits to its outline; a neighborhood to its permits.
    if (map && !state.hood && area.fit(animate, fitPadding())) return;
    if (!map || !rows.length) return;
    var b = new mapboxgl.LngLatBounds();
    rows.forEach(function (r) { b.extend([r.lng, r.lat]); });
    map.fitBounds(b, { padding: fitPadding(), maxZoom: 15, duration: animate ? 800 : 0 });
  }

  // ------------------------------------------------------------------ legend
  function renderLegend() {
    var p = COLORS[theme.get()];
    var base = PM.apply(data.rows, state, data.asOf, { ignore: "works" });
    var counts = {};
    base.forEach(function (r) { counts[r.work] = (counts[r.work] || 0) + 1; });
    var all = state.works.length === PM.WORK_IDS.length;
    var html = '<button type="button" class="tx-legend-toggle" aria-expanded="false">Legend</button><div class="tx-legend-body">' +
      '<p class="tx-legend-title">Work</p><div class="tx-legend-cats">';
    PM.WORKS.forEach(function (w) {
      var on = all || state.works.indexOf(w.id) >= 0;
      html += '<button type="button" class="tx-legend-cat' + (on ? "" : " is-off") + '" data-work="' + w.id + '" aria-pressed="' + on +
        '" title="Show only ' + w.label.toLowerCase() + '"><i class="tx-swatch" style="background:' + p[w.id] + '"></i>' + (compact ? w.short : w.label) +
        '<span class="tx-n">' + (counts[w.id] || 0).toLocaleString("en-US") + "</span></button>";
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
    var b = e.target.closest("[data-work]");
    if (!b) return;
    var s = PM.clone(state);
    var v = b.getAttribute("data-work");
    var all = s.works.length === PM.WORK_IDS.length;
    var next = all ? [v] : s.works.indexOf(v) >= 0 ? s.works.filter(function (x) { return x !== v; }) : s.works.concat([v]);
    s.works = !next.length || next.length === PM.WORK_IDS.length ? PM.WORK_IDS.slice() : PM.WORK_IDS.filter(function (x) { return next.indexOf(x) >= 0; });
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
    if (!r.located) PM.notify(el.mapWrap, "This site has no reliable map location. Its details are shown here and in the table.");
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
    if (map && map.getLayer("pm-selected")) map.setFilter("pm-selected", ["==", ["get", "id"], selectedId || ""]);
  }

  function renderDetail(r) {
    var sub = PM.placeLine(r) + (r.city === "Unincorporated Miami-Dade" && r.hood ? " · unincorporated" : "") +
      (r.units.length === 1 ? " · Unit " + r.units[0] : "");
    var tags = PM.workTag(r) + PM.sizeTag(r) + PM.typeTag(r);
    if (!r.located) tags += '<span class="tx-tag">Not on map</span>';
    var actions = "";
    if (r.parcelUrl) actions += '<a class="tx-btn" href="' + fmt.escape(r.parcelUrl) + '" target="_blank" rel="noopener">Property record ↗</a>';
    if (peer.hasPeer("table")) actions += '<button type="button" class="tx-btn" data-act="table">Show in table</button>';
    el.detail.innerHTML =
      '<div class="tx-detail-head"><h2 id="tx-detail-title">' + fmt.escape(r.address || "Address unavailable") +
      '<span class="tx-sub">' + fmt.escape(sub) + "</span></h2>" +
      '<button type="button" class="tx-close" aria-label="Close">×</button></div>' +
      '<div class="tx-detail-body">' +
      (r.located ? '<img class="tx-detail-img" loading="lazy" alt="Satellite view of ' + fmt.escape(r.address || "the site") + '" src="' + fmt.escape(PM.aerialUrl(r, 312, 140)) + '">' : "") +
      '<div class="tx-price">' + (r.value ? fmt.money(r.value) : '<span class="tx-muted">Cost not given</span>') +
      (r.value ? '<span class="cx-price-note">estimated cost' + (r.jobs.length > 1 ? ", all jobs" : "") + "</span>" : "") + "</div>" +
      '<div class="tx-tags">' + tags + "</div>" +
      '<dl class="tx-dl">' + PM.facts(r).map(function (x) { return "<dt>" + x[0] + "</dt><dd>" + x[1] + "</dd>"; }).join("") + "</dl>" +
      PM.jobsHtml(r) +
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
      "List " + PM.plural(n, "site") + " in view";
    el.listBtn.disabled = !n;
    if (!el.sheet.hidden) renderSheet();
  }
  function renderSheet() {
    var list = inView(), top = list.slice(0, 50);
    el.sheet.innerHTML = '<div class="tx-detail-head"><h2>' + PM.plural(list.length, "site") + ' in view<span class="tx-sub">' +
      (list.length > 50 ? "Top 50 by cost · zoom in for the rest" : "Sorted by estimated cost") +
      '</span></h2><button type="button" class="tx-close" aria-label="Close list">×</button></div><div class="tx-detail-body"><ul class="tx-stack">' +
      top.map(function (r) {
        return '<li><button type="button" data-pick="' + fmt.escape(r.id) + '"><span class="tx-r-title">' + fmt.escape(r.address || "Address unavailable") +
          " <strong>" + fmt.moneyShort(r.value) + '</strong></span><span class="tx-r-sub">' + fmt.escape(PM.placeLine(r)) + " · " + fmt.dateShort(r.date) + "</span></button></li>";
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
    area.addLayers(); // under the points
    var p = COLORS[theme.get()];
    if (!map.getSource("pm")) map.addSource("pm", { type: "geojson", data: toFeatures(visible.filter(function (r) { return r.located; })) });
    var hover = ["boolean", ["feature-state", "hover"], false];
    map.addLayer({
      id: "pm-points",
      type: "circle",
      source: "pm",
      paint: {
        "circle-radius": radiusExpr(),
        "circle-color": ["match", ["get", "work"], "new", p.new, "addition", p.addition, "demolition", p.demolition, p.renovation],
        // Minor work reads lighter, so real projects stand out when both show.
        "circle-opacity": ["case", hover, 1, ["==", ["get", "minor"], 1], 0.45, 0.85],
        "circle-stroke-color": ["case", hover, p.sel, p.ring],
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 9, ["case", hover, 2, 0.5], 13, ["case", hover, 2, 1]],
      },
      layout: { "circle-sort-key": ["-", 0, ["to-number", ["get", "value"], 0]] }, // small projects on top
    });
    map.addLayer({
      id: "pm-selected",
      type: "circle",
      source: "pm",
      filter: ["==", ["get", "id"], selectedId || ""],
      paint: { "circle-radius": radiusExpr(4), "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": p.sel, "circle-stroke-width": 2.5 },
    });
  }

  function initMap() {
    mapboxgl.accessToken = PM.MAPBOX_TOKEN;
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
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.__pmMap = map; // dev/test hook
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
    map.on("mousemove", "pm-points", function (e) {
      var f = e.features[0];
      if (!f) return;
      map.getCanvas().style.cursor = "pointer";
      if (hoverId !== null && hoverId !== f.id) map.setFeatureState({ source: "pm", id: hoverId }, { hover: false });
      hoverId = f.id;
      map.setFeatureState({ source: "pm", id: hoverId }, { hover: true });
      if (!canHover || !data) return;
      var r = data.byId[f.properties.id];
      if (!r) return;
      if (!hoverPopup) hoverPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: "tx-tip", offset: 12, maxWidth: "260px" });
      var scale = [PM.workLabel(r.work), r.newSqft ? fmt.numShort(r.newSqft) + " sq ft" : "", r.jobs.length > 1 ? PM.plural(r.jobs.length, "job") : ""].filter(Boolean).join(" · ");
      hoverPopup.setLngLat(f.geometry.coordinates)
        .setHTML("<strong>" + fmt.escape(r.address || "Address unavailable") + "</strong>" + (r.value ? fmt.moneyShort(r.value) : "Cost not given") +
          " <span>· " + fmt.escape(PM.placeLine(r)) + " · " + fmt.escape(scale) + "</span>")
        .addTo(map);
    });
    map.on("mouseleave", "pm-points", function () {
      map.getCanvas().style.cursor = "";
      if (hoverId !== null) map.setFeatureState({ source: "pm", id: hoverId }, { hover: false });
      hoverId = null;
      if (hoverPopup) hoverPopup.remove();
    });
    map.on("click", function (e) {
      if (!data) return;
      var pad = canHover ? 3 : 10;
      var feats = map.queryRenderedFeatures([[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]], { layers: ["pm-points"] });
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
  var peer = PM.link("map", function (msg) {
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
        // Combined page: bring the map back into view.
        if (msg.local) window.scrollTo({ top: Math.max(0, app.getBoundingClientRect().top + window.scrollY), behavior: "smooth" });
      }
    } else if (msg.type === "hello" && !PM.isDefault(state)) {
      peer.send("filters", PM.clone(state));
    }
  });

  // ------------------------------------------------------------------ boot
  function showError(msg) {
    el.loading.innerHTML = "<span>" + fmt.escape(msg) + "</span>";
    el.loading.hidden = false;
  }
  var mapReady = (window.__pmMapbox || Promise.resolve()).then(function () {
    if (!window.mapboxgl || !mapboxgl.supported || !mapboxgl.supported()) {
      throw new Error("This map needs WebGL, which your browser doesn’t support. The table on this page lists every permit.");
    }
    try {
      return initMap();
    } catch (e) {
      throw new Error("The map couldn’t load. The table on this page lists every permit.");
    }
  });
  mapReady.catch(function (e) { showError(e.message); });
  function hidePreview() {
    var pv = app.querySelector(".tx-preview");
    if (!pv) return;
    pv.classList.add("is-gone");
    setTimeout(function () { pv.remove(); }, 400);
  }

  Promise.all([PM.load(), mapReady]).then(function (res) {
    data = res[0];
    PM.resolveCity(state, data);
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
    mapReady.then(function () { showError("Building permits couldn’t load. Please try again later."); }, function () {});
  });
})();
