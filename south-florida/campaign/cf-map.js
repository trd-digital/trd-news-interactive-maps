/*!
 * cf-map.js — South Florida campaign giving by ZIP code
 * (south-florida-campaign-donor-map.html). Shades each ZIP by total giving,
 * real estate giving, or the party split of gifts to candidates; click a ZIP
 * for its top donors and recipients.
 * Depends on: mapbox-gl (window.__cfMapbox), TRD theme.js, cf-core.js (CF).
 */
(function () {
  "use strict";

  var fmt = CF.fmt;
  var track = CF.tracker("sofla-campaign-donor-map");
  var app = CF.root(document.currentScript);
  var params = new URLSearchParams(location.search);
  var STYLES = { light: "mapbox://styles/mapbox/light-v11", dark: "mapbox://styles/mapbox/dark-v11" };
  var OPEN_BOUNDS = [[-80.75, 25.4], [-80.0, 26.98]];
  var MAX_BOUNDS = [[-81.6, 24.9], [-79.4, 27.3]];
  var BOUNDARIES = "south-florida-boundaries.geojson";
  // Sequential: one hue, light -> dark (reference ramp steps 100–700).
  // On the dark map the ramp runs dark -> light, so low values recede there too.
  var SEQ = {
    light: ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"],
    dark: ["#104281", "#1c5cab", "#2a78d6", "#5598e7", "#86b6ef", "#b7d3f6", "#e6f0fd"],
  };
  // Diverging: red (Republican) <-> gray <-> blue (Democrat).
  var DIV = { light: ["#b3261e", "#e34948", "#f0a3a2", "#e4e3df", "#9ec5f4", "#3987e5", "#184f95"], dark: ["#e66767", "#c23b3a", "#7a3534", "#4a4a47", "#2c4f7c", "#3987e5", "#86b6ef"] };
  var DIV_BREAKS = [0.2, 0.35, 0.45, 0.55, 0.65, 0.8];
  var LINE = { light: "rgba(255,255,255,.9)", dark: "rgba(20,20,20,.8)" };
  var SEL = { light: "#111111", dark: "#ffffff" };
  var METRICS = [
    { id: "t", label: "All giving" },
    { id: "re", label: "Real estate" },
    { id: "party", label: "Party split" },
  ];

  var metric = METRICS.some(function (m) { return m.id === params.get("metric"); }) ? params.get("metric") : "t";
  var map = null, data = null, shapes = null, breaks = {}, selected = null, hoverId = null, popup = null;
  var isEmbed = window.parent !== window;

  var theme = CF.theme(function () {
    if (map) map.setStyle(STYLES[theme.get()]); // style.load re-adds the layers with this theme's colors
    renderLegend();
  }, track);

  var el = {
    topbar: app.querySelector(".tx-topbar"),
    count: app.querySelector(".tx-count"),
    legend: app.querySelector(".tx-legend"),
    detail: app.querySelector(".tx-detail"),
    loading: app.querySelector(".tx-loading"),
    note: app.querySelector(".tx-mapnote"),
    chips: app.querySelector(".cf-metric"),
  };
  el.chips.addEventListener("click", function (e) {
    var b = e.target.closest(".tx-chip");
    if (!b) return;
    metric = b.getAttribute("data-value");
    track("metric", metric);
    paint();
  });

  // ------------------------------------------------------------------ color
  function nice(v) {
    if (v <= 0) return 0;
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var m = v / p;
    return (m < 1.5 ? 1 : m < 2.25 ? 2 : m < 3.5 ? 2.5 : m < 7.5 ? 5 : 10) * p;
  }
  // Six breaks at quantiles, rounded to round dollar figures.
  function quantileBreaks(values) {
    var v = values.filter(function (x) { return x > 0; }).sort(function (a, b) { return a - b; });
    var out = [];
    for (var k = 1; k < 7; k++) {
      var b = nice(v[Math.min(v.length - 1, Math.floor((k / 7) * v.length))]);
      if (!out.length || b > out[out.length - 1]) out.push(b);
    }
    return out;
  }
  function value(z, m) {
    if (m === "party") {
      var two = z.R + z.D;
      return two >= 5000 ? z.D / two : null;
    }
    return z[m];
  }
  function colorOf(z, m) {
    var v = z ? value(z, m) : null;
    if (v == null || (m !== "party" && v <= 0)) return null;
    var b = m === "party" ? DIV_BREAKS : breaks[m];
    var i = 0;
    while (i < b.length && v >= b[i]) i++;
    var seq = SEQ[theme.get()];
    return m === "party" ? DIV[theme.get()][i] : seq[Math.min(i, seq.length - 1)];
  }

  function features() {
    return {
      type: "FeatureCollection",
      features: shapes.map(function (f, i) {
        var z = data.zips[f.properties.name];
        return { type: "Feature", id: i, geometry: f.geometry, properties: { zip: f.properties.name, col: colorOf(z, metric) || "rgba(0,0,0,0)", has: z ? 1 : 0 } };
      }),
    };
  }
  function paint() {
    if (!data) return;
    var src = map && map.getSource("cf-zips");
    if (src) src.setData(features());
    el.chips.innerHTML = CF.chips("metric", METRICS, metric).replace(/^<div class="tx-chips" role="group">|<\/div>$/g, "");
    renderLegend();
    renderCount();
    if (selected) showDetail(selected);
  }
  function renderCount() {
    var tot = metric === "re" ? data.re : data.total;
    el.count.innerHTML = metric === "party" ? "<strong>Gifts to candidates</strong>" :
      "<strong>" + fmt.moneyShort(tot) + "</strong><span class=\"tx-count-total\"> from " + Object.keys(data.zips).length + " ZIP codes</span>";
  }
  function renderLegend() {
    if (!data) return;
    var html;
    if (metric === "party") {
      var c = DIV[theme.get()];
      html = '<p class="tx-legend-title">Share of candidate money</p><div class="cf-ramp">' + c.map(function (x) { return '<i style="background:' + x + '"></i>'; }).join("") +
        '</div><div class="cf-ramp-labels"><span>Republicans</span><span>Democrats</span></div>';
    } else {
      var b = breaks[metric];
      html = '<p class="tx-legend-title">' + (metric === "re" ? "Real estate giving" : "All giving") + '</p><div class="cf-ramp">' +
        SEQ[theme.get()].slice(0, b.length + 1).map(function (x) { return '<i style="background:' + x + '"></i>'; }).join("") +
        '</div><div class="cf-ramp-labels"><span>Under ' + fmt.moneyShort(b[0]) + "</span><span>" + fmt.moneyShort(b[b.length - 1]) + "+</span></div>";
    }
    el.legend.innerHTML = '<button type="button" class="tx-legend-toggle" aria-expanded="false">Legend</button><div class="tx-legend-body">' + html + "</div>";
  }
  el.legend.addEventListener("click", function (e) {
    var b = e.target.closest(".tx-legend-toggle");
    if (!b) return;
    var open = !el.legend.classList.contains("is-open");
    el.legend.classList.toggle("is-open", open);
    b.setAttribute("aria-expanded", String(open));
  });

  // ------------------------------------------------------------------ detail
  function showDetail(zip) {
    var z = data.zips[zip];
    if (!z) return;
    selected = zip;
    if (map && map.getLayer("cf-zips-sel")) map.setFilter("cf-zips-sel", ["==", ["get", "zip"], zip]);
    var two = z.R + z.D;
    var party = two ? '<p class="cf-list-title" style="margin-top:14px">Gifts to candidates by party</p><div class="cf-split">' +
      '<i style="width:' + (z.R / two * 100).toFixed(1) + "%;background:" + DIV[theme.get()][1] + '"></i><i style="width:' + (z.D / two * 100).toFixed(1) + "%;background:" + DIV[theme.get()][5] + '"></i></div>' +
      '<div class="cf-split-legend"><span>Republicans ' + fmt.moneyShort(z.R) + " (" + fmt.pct(z.R, two) + ")</span><span>Democrats " + fmt.moneyShort(z.D) + " (" + fmt.pct(z.D, two) + ")</span></div>" : "";
    var donors = '<p class="cf-list-title" style="margin-top:14px">Top donors</p><ul class="cf-list">' + z.top.map(function (x) {
      return '<li><span class="cf-li-main">' + fmt.escape(x[0]) + (x[2] ? " " + CF.sectorTag(x[2]) : "") + '</span><span class="cf-li-amt">' + fmt.moneyShort(x[1]) + "</span></li>";
    }).join("") + "</ul>";
    var recips = '<p class="cf-list-title" style="margin-top:14px">Top recipients</p><ul class="cf-list">' + z.rec.map(function (x) {
      var r = data.recipients[x[0]];
      return '<li><span class="cf-li-main">' + fmt.escape(CF.recipName(r)) + ' <span class="tx-muted">' + fmt.escape(CF.recipLine(r)) + '</span></span><span class="cf-li-amt">' + fmt.moneyShort(x[1]) + "</span></li>";
    }).join("") + "</ul>";
    el.detail.innerHTML = '<div class="tx-detail-head"><h2>' + fmt.escape(zip) + '<span class="tx-sub">' + fmt.escape(z.c + " · " + z.co) + "</span></h2>" +
      '<button type="button" class="tx-close" aria-label="Close">×</button></div><div class="tx-detail-body">' +
      '<div class="tx-price">' + fmt.money(z.t) + '</div><div class="tx-tags"><span class="tx-tag">' + CF.plural(z.dn, "donor") + '</span><span class="tx-tag">' + CF.plural(z.g, "gift") + "</span></div>" +
      '<dl class="tx-dl"><dt>Real estate</dt><dd>' + fmt.money(z.re) + ' <span class="tx-muted">(' + fmt.pct(z.re, z.t) + ", " + CF.plural(z.rn, "donor") + ")</span></dd>" +
      "<dt>To candidates</dt><dd>" + fmt.money(z.cand) + ' <span class="tx-muted">(' + fmt.pct(z.cand, z.t) + ")</span></dd></dl>" +
      party + donors + recips + "</div>";
    el.detail.hidden = false;
    el.detail.querySelector(".tx-close").onclick = clearDetail;
  }
  function clearDetail() {
    selected = null;
    el.detail.hidden = true;
    if (map && map.getLayer("cf-zips-sel")) map.setFilter("cf-zips-sel", ["==", ["get", "zip"], ""]);
  }

  // ------------------------------------------------------------------ map
  function addLayers() {
    (map.getStyle().layers || []).forEach(function (l) {
      if (/poi|transit|airport/.test(l.id) && l.type === "symbol") map.setLayoutProperty(l.id, "visibility", "none");
    });
    var before = (map.getStyle().layers || []).find(function (l) { return l.type === "symbol"; });
    var t = theme.get();
    map.addSource("cf-zips", { type: "geojson", data: features() });
    map.addLayer({ id: "cf-zips-fill", type: "fill", source: "cf-zips", paint: {
      "fill-color": ["get", "col"],
      "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.95, 0.8],
    } }, before && before.id);
    map.addLayer({ id: "cf-zips-line", type: "line", source: "cf-zips", paint: { "line-color": LINE[t], "line-width": 0.8 } }, before && before.id);
    map.addLayer({ id: "cf-zips-sel", type: "line", source: "cf-zips", filter: ["==", ["get", "zip"], selected || ""], paint: { "line-color": SEL[t], "line-width": 2.5 } });
  }
  function initMap() {
    mapboxgl.accessToken = CF.MAPBOX_TOKEN;
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
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.__cfMap = map; // dev/test hook
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.on("style.load", addLayers);
    map.once("idle", function () { el.loading.hidden = true; });
    var canHover = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
    map.on("mousemove", "cf-zips-fill", function (e) {
      var f = e.features[0];
      if (!f) return;
      map.getCanvas().style.cursor = f.properties.has ? "pointer" : "";
      if (hoverId !== null && hoverId !== f.id) map.setFeatureState({ source: "cf-zips", id: hoverId }, { hover: false });
      hoverId = f.id;
      map.setFeatureState({ source: "cf-zips", id: hoverId }, { hover: true });
      if (!canHover) return;
      var z = data.zips[f.properties.zip];
      if (!popup) popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: "tx-tip", offset: 10, maxWidth: "260px" });
      var v = !z ? "No gifts" : metric === "party" ? (z.R + z.D >= 5000 ? "Democrats " + fmt.pct(z.D, z.R + z.D) + " · Republicans " + fmt.pct(z.R, z.R + z.D) : "Little candidate money") :
        fmt.moneyShort(metric === "re" ? z.re : z.t) + (metric === "re" ? " from real estate" : " given");
      popup.setLngLat(e.lngLat).setHTML("<strong>" + fmt.escape(f.properties.zip + (z ? " · " + z.c : "")) + "</strong>" + fmt.escape(v)).addTo(map);
    });
    map.on("mouseleave", "cf-zips-fill", function () {
      map.getCanvas().style.cursor = "";
      if (hoverId !== null) map.setFeatureState({ source: "cf-zips", id: hoverId }, { hover: false });
      hoverId = null;
      if (popup) popup.remove();
    });
    map.on("click", function (e) {
      var f = map.queryRenderedFeatures(e.point, { layers: ["cf-zips-fill"] })[0];
      if (!f || !f.properties.has) return clearDetail();
      track("zip", f.properties.zip);
      showDetail(f.properties.zip);
    });
  }

  Promise.all([CF.load("cf-zips"), fetch(BOUNDARIES).then(function (r) {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  })]).then(function (res) {
    data = res[0];
    shapes = res[1].features.filter(function (f) { return f.properties.kind === "zip"; });
    var zs = Object.keys(data.zips).map(function (k) { return data.zips[k]; });
    breaks.t = quantileBreaks(zs.map(function (z) { return z.t; }));
    breaks.re = quantileBreaks(zs.map(function (z) { return z.re; }));
    el.note.textContent = CF.asOfText(data, "ZIP codes are the donors’ own. Party split counts only gifts to candidates who list a party; ZIPs with under $5,000 of it are left blank.");
    paint();
    return window.__cfMapbox;
  }).then(function () {
    if (!window.mapboxgl) throw new Error("mapbox");
    initMap();
    CF.gtmOnLoad();
    track("loaded", Object.keys(data.zips).length);
  }).catch(function () {
    el.loading.innerHTML = "<span>The map couldn’t load. Please try again later.</span>";
  });
})();
