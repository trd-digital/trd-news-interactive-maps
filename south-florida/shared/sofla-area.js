/*!
 * sofla-area.js — the picked city's outline on a South Florida Mapbox map:
 * everything outside it dimmed, the city shaded and outlined, and the map
 * fitted to it (as the transactions map does for a searched city).
 *
 * Outlines: south-florida-boundaries.geojson (Census TIGERweb cities,
 * simplified; transactions/build_boundaries.py), loaded the first time a city
 * is picked. A name with no outline ("Unincorporated Miami-Dade") draws
 * nothing and the map fits to its points as before.
 *
 *   var area = SoflaArea.attach({ id: "pm", getMap: fn, getTheme: fn, onLoad: fn });
 *   area.addLayers();        // in style.load, before the point layers
 *   area.show(cityName);     // on every refresh; returns the outline or null
 *   area.fit(animate, pad);  // true if it fitted to the outline
 */
(function (global) {
  "use strict";

  var FILE = "south-florida-boundaries.geojson";
  // Same tokens as the transactions map's searched area (tx-map.js).
  var COLORS = {
    light: { line: "#1a5fb4", fill: "#1a5fb4", mask: "#ffffff", maskOpacity: 0.55 },
    dark: { line: "#86b6ef", fill: "#86b6ef", mask: "#000000", maskOpacity: 0.45 },
  };
  // Names the feeds use for a city that the Census spells otherwise.
  // Names the feeds use (DBPR's as filed, typos included) for a city the
  // Census spells otherwise. Neighborhoods (Coconut Grove, Singer Island)
  // are left out: they'd outline the wrong area.
  var ALIASES = {
    ftlauderdale: "fortlauderdale", ftlaudardale: "fortlauderdale", fortluaderdale: "fortlauderdale",
    lakeworth: "lakeworthbeach", hallandale: "hallandalebeach", hallandalebreach: "hallandalebeach",
    sunnyisles: "sunnyislesbeach", dania: "daniabeach", pompano: "pompanobeach", deefieldbeach: "deerfieldbeach",
    bayharborisland: "bayharborislands", bayharbourislands: "bayharborislands", lbts: "lauderdalebythesea",
    lauderdalebythese: "lauderdalebythesea", palmbeachgarden: "palmbeachgardens",
  };
  var EMPTY = { type: "FeatureCollection", features: [] };
  var WORLD = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];

  var cities = null, promise = null;
  function key(s) {
    // "Miami, Fl 33129", "Hollywood Florida", "City of Miramar" -> the city
    var k = String(s || "").toLowerCase().replace(/^(city|town|village) of /, "").replace(/,?\s+(fl|florida)\b.*$/, "").replace(/[^a-z]/g, "");
    return ALIASES[k] || k;
  }
  function load() {
    if (promise) return promise;
    promise = fetch(FILE).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (fc) {
      var out = {};
      fc.features.forEach(function (f) {
        if (f.properties.kind !== "city") return;
        f.bbox = bbox(f.geometry);
        out[key(f.properties.name)] = f;
      });
      cities = out;
      return out;
    }).catch(function (e) {
      promise = null; // allow a retry
      throw e;
    });
    return promise;
  }
  function find(name) {
    return name && cities ? cities[key(name)] || null : null;
  }
  function bbox(g) {
    var b = [180, 90, -180, -90];
    (g.type === "Polygon" ? [g.coordinates] : g.coordinates).forEach(function (poly) {
      poly[0].forEach(function (pt) {
        if (pt[0] < b[0]) b[0] = pt[0];
        if (pt[1] < b[1]) b[1] = pt[1];
        if (pt[0] > b[2]) b[2] = pt[0];
        if (pt[1] > b[3]) b[3] = pt[1];
      });
    });
    return b;
  }
  function shapes(f) {
    if (!f) return { area: EMPTY, mask: EMPTY };
    var outers = f.geometry.type === "Polygon" ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map(function (p) { return p[0]; });
    return {
      area: { type: "FeatureCollection", features: [f] },
      mask: { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [WORLD].concat(outers) } }] },
    };
  }

  function attach(o) {
    var src = o.id + "-area", maskSrc = o.id + "-area-mask";
    var current = null, wanted = null;
    function addLayers() {
      var map = o.getMap(), c = COLORS[o.getTheme()] || COLORS.light, s = shapes(current);
      if (!map.getSource(src)) map.addSource(src, { type: "geojson", data: s.area });
      if (!map.getSource(maskSrc)) map.addSource(maskSrc, { type: "geojson", data: s.mask });
      map.addLayer({ id: maskSrc + "-fill", type: "fill", source: maskSrc, paint: { "fill-color": c.mask, "fill-opacity": c.maskOpacity } });
      map.addLayer({ id: src + "-fill", type: "fill", source: src, paint: { "fill-color": c.fill, "fill-opacity": 0.07 } });
      map.addLayer({ id: src + "-line", type: "line", source: src, paint: { "line-color": c.line, "line-width": 2.5 } });
    }
    function draw() {
      var map = o.getMap();
      if (!map || !map.getSource(src)) return;
      var s = shapes(current);
      map.getSource(src).setData(s.area);
      map.getSource(maskSrc).setData(s.mask);
    }
    function show(name) {
      wanted = name || null;
      if (wanted && !cities) {
        load().then(function () {
          if (!wanted) return;
          current = find(wanted);
          draw();
          if (current && o.onLoad) o.onLoad(current);
        }, function () {});
      }
      current = find(wanted);
      draw();
      return current;
    }
    function fit(animate, padding) {
      var map = o.getMap();
      if (!map || !current) return false;
      var b = current.bbox;
      map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: padding == null ? 40 : padding, duration: animate ? 800 : 0 });
      return true;
    }
    return { addLayers: addLayers, show: show, fit: fit, current: function () { return current; } };
  }

  global.SoflaArea = { attach: attach, load: load, find: find, key: key };
})(window);
