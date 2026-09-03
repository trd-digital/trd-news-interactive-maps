/*!
 * trd-dossier.js — the "Luxury Dossier" interactive template engine.
 *
 * Depends on: mapbox-gl + trd-embed.js + trd-map.js. Renders a full editorial
 * dossier from three data files — content.json (modules), regions.geojson (town
 * polygons) and places.geojson (categorized notable places) — into a fixed set
 * of container elements in the page (see graphics/dossier/example/index.html).
 *
 *   TRDDossier({ token, prefix, themeKey,
 *                content:'content.json', regions:'regions.geojson', places:'places.geojson' })
 *
 * It owns the editorial layer; the toolkit owns everything below it:
 *   - TRDEmbed  → embed detection, theme, the postMessage bridge, auto-sizing.
 *   - TRDMap    → the hardened Mapbox map (gestures, style.load re-add, camera).
 *
 * A dossier is a TALL page: in embed mode the iframe auto-sizes to the whole
 * body; only the map band is a fixed pixel height (set in trd-dossier.css).
 */
(function (global) {
  "use strict";

  // Town fill palette (A–F ramp) and place-category palette, per theme.
  var DEFAULT_TOWNS = {
    light: { A: "#1f6f4f", B: "#2e8b62", C: "#46a179", D: "#6bbd97", E: "#93d3b5", F: "#bde3d0" },
    dark:  { A: "#2f8f68", B: "#3fa079", C: "#57b78a", D: "#78c9a3", E: "#98d8ba", F: "#b9e6d1" },
  };
  var DEFAULT_CAT = {
    light: { record: "#c0392b", development: "#7b4fbf", hospitality: "#d98324" },
    dark:  { record: "#e8695b", development: "#a985e0", hospitality: "#e8a54e" },
  };
  var CAT_LABEL = {
    record: "Record & notable sales",
    development: "Developments",
    hospitality: "Hospitality & dining",
  };
  var EMPTY = { type: "FeatureCollection", features: [] };

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fetchJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("Failed to load " + url + " (" + r.status + ")");
      return r.json();
    });
  }

  function TRDDossier(opts) {
    opts = opts || {};
    var S = {
      content: null, regions: null, places: null,
      theme: "light", mapApi: null, controller: null,
      towns: opts.townPalette || DEFAULT_TOWNS,
      cats: opts.catPalette || DEFAULT_CAT,
      activeCat: "all", activeTown: null, selected: null,
    };

    // The map is optional: only load region/place data if the page has a #map
    // container. Remove the whole .d-map-section from index.html to ship a
    // dossier with no map — everything else still renders.
    var wantMap = !!el("map");
    Promise.all([
      fetchJSON(opts.content || "content.json"),
      wantMap ? fetchJSON(opts.regions || "regions.geojson").catch(function () { return null; }) : Promise.resolve(null),
      wantMap ? fetchJSON(opts.places || "places.geojson").catch(function () { return null; }) : Promise.resolve(null),
    ]).then(function (r) {
      S.content = r[0]; S.regions = r[1]; S.places = r[2];
      S.hasMap = wantMap && !!(S.regions && S.places);
      renderModules();
      wireEmbed();
    }).catch(function (e) {
      console.error("[dossier] load failed", e);
      if (el("d-hero")) el("d-hero").innerHTML = '<p style="padding:40px 0">Dossier data failed to load.</p>';
    });

    function townColor(letter) { return (S.towns[S.theme] || S.towns.light)[letter]; }
    function catColor(cat) { return (S.cats[S.theme] || S.cats.light)[cat] || "#888"; }
    function placeByName(name) {
      var fs = S.places.features;
      for (var i = 0; i < fs.length; i++) if (fs[i].properties.name === name) return fs[i];
      return null;
    }

    // ---- editorial modules (rendered once, cheap) -----------------------
    function renderModules() {
      var c = S.content;
      // Hero
      var h = c.hero || {};
      el("d-hero").innerHTML =
        '<div class="d-hero-text">' +
          (h.kicker ? '<p class="d-hero-kicker">' + esc(h.kicker) + "</p>" : "") +
          "<h1>" + esc(h.title || "") + "</h1>" +
          (h.dek ? '<p class="d-hero-dek">' + esc(h.dek) + "</p>" : "") +
          (h.byline ? '<p class="d-hero-byline">' + esc(h.byline) + "</p>" : "") +
        "</div>" +
        (h.image ? '<figure class="d-hero-figure"><img src="' + esc(h.image) + '" alt="' + esc(h.title || "") + '" loading="lazy"></figure>' : "");

      // Intro prose
      el("d-intro-prose").innerHTML = (c.intro || []).map(function (p) {
        return "<p>" + esc(p) + "</p>";
      }).join("");

      // Stats
      el("d-stats").innerHTML = (c.stats || []).map(function (s) {
        return '<div class="d-stat"><div class="v">' + esc(s.value) + "</div>" +
          '<div class="l">' + esc(s.label) + "</div>" +
          (s.note ? '<div class="n">' + esc(s.note) + "</div>" : "") + "</div>";
      }).join("");

      // Most expensive listing (marquee feature)
      if (c.listing && el("d-listing")) {
        var L = c.listing;
        el("d-listing").innerHTML =
          (L.image ? '<figure class="d-listing-fig"><img src="' + esc(L.image) + '" alt="' + esc(L.address || "") + '" loading="lazy"></figure>' : "") +
          '<div class="d-listing-body">' +
            '<div class="d-listing-label">' + esc(L.label || "Most expensive listing") + "</div>" +
            (L.price ? '<div class="d-listing-price">' + esc(L.price) + "</div>" : "") +
            (L.address ? '<div class="d-listing-addr">' + esc(L.address) + "</div>" : "") +
            (L.body ? '<p class="d-listing-text">' + esc(L.body) + "</p>" : "") +
            '<dl class="d-listing-meta">' +
              (L.buyer ? "<dt>Buyer</dt><dd>" + esc(L.buyer) + "</dd>" : "") +
              (L.listingAgents ? "<dt>Listing agents</dt><dd>" + esc(L.listingAgents) + "</dd>" : "") +
              (L.buyerAgent ? "<dt>Buyer&rsquo;s agent</dt><dd>" + esc(L.buyerAgent) + "</dd>" : "") +
            "</dl>" +
          "</div>";
      }

      // Map section subtitle (markets key)
      if (el("d-map-sub") && c.markets) {
        el("d-map-sub").textContent = c.markets.map(function (m) {
          return m.letter + ". " + m.town;
        }).join("   ");
      }

      // Brokers
      if (c.brokers) {
        el("d-brokers").innerHTML =
          "<h2>" + esc(c.brokers.title || "Top brokers") + "</h2>" +
          (c.brokers.note ? '<p class="sub">' + esc(c.brokers.note) + "</p>" : "") +
          '<div class="d-brokers-list">' + (c.brokers.list || []).map(function (b) {
            var ph = b.image
              ? '<img class="ph" src="' + esc(b.image) + '" alt="" loading="lazy">'
              : '<span class="ph blank">' + esc((b.name || "?").charAt(0)) + "</span>";
            return '<div class="d-broker"><span class="rank">' + esc(b.rank) + "</span>" + ph +
              '<span><span class="nm">' + esc(b.name) + '</span><br><span class="fm">' + esc(b.firm) + "</span></span>" +
              '<span class="vol">' + esc(b.volume) + "</span></div>";
          }).join("") + "</div>";
      }

      // Names to know
      if (c.names) {
        el("d-names").innerHTML =
          "<h2>" + esc(c.names.title || "Names to know") + "</h2>" +
          '<div class="d-names-grid">' + (c.names.list || []).map(function (n) {
            return '<article class="d-name">' +
              (n.image ? '<img src="' + esc(n.image) + '" alt="' + esc(n.name) + '" loading="lazy">' : "") +
              '<div class="b"><h3>' + esc(n.name) + "</h3>" +
              '<p class="t">' + esc(n.title) + "</p><p>" + esc(n.blurb) + "</p></div></article>";
          }).join("") + "</div>";
      }

      // Quotes
      if (c.quotes) {
        el("d-quotes-wrap").innerHTML =
          '<div class="d-quotes">' + c.quotes.map(function (q) {
            return '<div class="d-quote"><blockquote>&ldquo;' + esc(q.text) + '&rdquo;</blockquote>' +
              '<div class="who">' + esc(q.name) + '</div><div class="role">' + esc(q.role) + "</div></div>";
          }).join("") + "</div>";
      }

      // Narrative blocks (developments + affordability)
      var blocks = [];
      if (c.developments) blocks.push(c.developments);
      if (c.affordability) blocks.push(c.affordability);
      el("d-narrative").innerHTML = blocks.map(function (b) {
        return '<div class="blk"><h2>' + esc(b.title) + "</h2>" +
          (b.note ? '<p class="sub">' + esc(b.note) + "</p>" : "") +
          "<p>" + esc(b.body) + "</p></div>";
      }).join("");

      // Footer
      if (c.credits) {
        el("d-footer").innerHTML =
          "<div>Source: " + esc(c.credits.source || "") + "</div>" +
          (c.credits.photos ? "<div>Photos: " + esc(c.credits.photos) + "</div>" : "");
      }

      renderFilters();
      renderLegend();
    }

    // ---- map controls (no-op when the dossier has no map) ----------------
    function renderFilters() {
      if (!S.hasMap || !el("d-filters")) return;
      var cats = uniqueCats();
      var html = '<button class="d-chip active" data-cat="all">All places</button>';
      cats.forEach(function (cat) {
        html += '<button class="d-chip" data-cat="' + cat + '">' +
          '<span class="dot" style="background:' + catColor(cat) + '"></span>' +
          esc(CAT_LABEL[cat] || cat) + "</button>";
      });
      var f = el("d-filters");
      f.innerHTML = html;
      f.querySelectorAll(".d-chip").forEach(function (btn) {
        btn.addEventListener("click", function () {
          f.querySelectorAll(".d-chip").forEach(function (b) { b.classList.remove("active"); });
          btn.classList.add("active");
          S.activeCat = btn.dataset.cat;
          applyFilters();
        });
      });
    }

    function renderLegend() {
      if (!S.hasMap || !el("d-legend")) return;
      var cats = uniqueCats();
      var markets = (S.content.markets || []);
      el("d-legend").innerHTML =
        "<h4>Places</h4>" + cats.map(function (cat) {
          return '<div class="row"><span class="sw" style="background:' + catColor(cat) + '"></span>' + esc(CAT_LABEL[cat] || cat) + "</div>";
        }).join("") +
        (markets.length ? '<h4 style="margin-top:9px">Towns</h4>' + markets.map(function (m) {
          return '<div class="row"><span class="sw town" style="background:' + townColor(m.letter) + '"></span>' + m.letter + ". " + esc(m.town) + "</div>";
        }).join("") : "");
    }

    function uniqueCats() {
      var seen = {}, order = ["record", "development", "hospitality"], out = [];
      S.places.features.forEach(function (f) { seen[f.properties.category] = 1; });
      order.forEach(function (c) { if (seen[c]) out.push(c); });
      Object.keys(seen).forEach(function (c) { if (out.indexOf(c) < 0) out.push(c); });
      return out;
    }

    function applyFilters() {
      var m = S.mapApi && S.mapApi.map;
      if (!m || !m.getLayer("places")) return;
      var f = ["all"];
      if (S.activeCat !== "all") f.push(["==", ["get", "category"], S.activeCat]);
      if (S.activeTown) f.push(["==", ["get", "town"], S.activeTown]);
      m.setFilter("places", f.length > 1 ? f : null);
    }

    // ---- detail card -----------------------------------------------------
    function selectPlace(name) {
      var f = placeByName(name);
      if (!f) return;
      S.selected = name;
      fillCard(f);
      el("d-card").classList.add("open");
      setActiveSource(f);
      if (S.mapApi) S.mapApi.flyTo(f.geometry.coordinates, { zoom: 13.4 });
    }
    function fillCard(f) {
      var p = f.properties;
      var img = p.image ? '<img class="d-card-img" src="' + esc(p.image) + '" alt="' + esc(p.name) + '">' : "";
      el("d-card").innerHTML =
        '<button class="d-card-close" aria-label="Close">&times;</button>' + img +
        '<div class="d-card-body">' +
        '<div class="cat" style="color:' + catColor(p.category) + '">' + esc(CAT_LABEL[p.category] || p.category) + "</div>" +
        "<h3>" + esc(p.name) + "</h3>" +
        '<div class="town">' + esc(p.town) + (p.year ? " &middot; " + esc(p.year) : "") + "</div>" +
        (p.price ? '<div class="price">' + esc(p.price) + "</div>" : "") +
        (p.blurb ? '<p class="blurb">' + esc(p.blurb) + "</p>" : "") +
        (p.agents ? '<div class="agents">' + esc(p.agents) + "</div>" : "") +
        (p.approximate ? '<div class="approx">Approximate location</div>' : "") +
        "</div>";
      el("d-card").querySelector(".d-card-close").addEventListener("click", closeCard);
    }
    function closeCard() {
      S.selected = null;
      el("d-card").classList.remove("open");
      setActiveSource(null);
    }
    function setActiveSource(f) {
      var m = S.mapApi && S.mapApi.map;
      if (!m || !m.getSource("active")) return;
      m.getSource("active").setData(f ? { type: "FeatureCollection", features: [f] } : EMPTY);
    }

    // ---- embed + map wiring ---------------------------------------------
    function wireEmbed() {
      S.controller = TRDEmbed({
        prefix: opts.prefix || "trd-dossier",
        themeKey: opts.themeKey || (opts.prefix || "trd-dossier") + ":theme",
        toggle: opts.toggle || "#d-toggle",
        // With a map, lazily mount when it nears the viewport; without one,
        // mount immediately so the embed still reports ready/loaded and sizes.
        mountTarget: S.hasMap ? "#map" : null,
        lazy: S.hasMap,
        onMount: function (ctx) {
          S.theme = ctx.theme;
          if (S.hasMap) buildMap(ctx);
          else ctx.postLoaded();
        },
        onTheme: function (theme, ctx) {
          S.theme = theme;
          if (S.mapApi) S.mapApi.setTheme(theme);
          renderLegend(); renderFilters();
          if (S.selected) fillCard(placeByName(S.selected));
          ctx.requestResize();
        },
      });
    }

    function addLayers(map, c) {
      var tp = S.towns[c.theme] || S.towns.light;
      var cp = S.cats[c.theme] || S.cats.light;
      var townFill = c.matchColor(["get", "letter"], tp, "#8aa");
      var catFill = c.matchColor(["get", "category"], cp, "#888");
      var labelColor = c.theme === "dark" ? "#eaf1ec" : "#12321f";
      var labelHalo = c.theme === "dark" ? "#10201a" : "#ffffff";

      if (!map.getSource("regions")) map.addSource("regions", { type: "geojson", data: S.regions });
      if (!map.getSource("places")) map.addSource("places", { type: "geojson", data: S.places });
      if (!map.getSource("active")) map.addSource("active", { type: "geojson", data: EMPTY });

      if (!map.getLayer("regions-fill"))
        map.addLayer({ id: "regions-fill", type: "fill", source: "regions",
          paint: { "fill-color": townFill, "fill-opacity": 0.38 } });
      if (!map.getLayer("regions-line"))
        map.addLayer({ id: "regions-line", type: "line", source: "regions",
          paint: { "line-color": townFill, "line-width": 1.2, "line-opacity": 0.9 } });
      if (!map.getLayer("regions-label"))
        map.addLayer({ id: "regions-label", type: "symbol", source: "regions",
          layout: { "text-field": ["get", "letter"], "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"], "text-size": 15 },
          paint: { "text-color": labelColor, "text-halo-color": labelHalo, "text-halo-width": 1.3 } });

      if (!map.getLayer("active-glow"))
        map.addLayer({ id: "active-glow", type: "circle", source: "active",
          paint: { "circle-radius": 22, "circle-color": catFill, "circle-opacity": 0.22 } });
      if (!map.getLayer("places"))
        map.addLayer({ id: "places", type: "circle", source: "places",
          paint: { "circle-radius": 8, "circle-color": catFill, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
      if (!map.getLayer("active-ring"))
        map.addLayer({ id: "active-ring", type: "circle", source: "active",
          paint: { "circle-radius": 9, "circle-opacity": 0, "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 } });

      applyFilters();
    }

    function buildMap(ctx) {
      S.mapApi = TRDMap.create({
        container: "map",
        token: opts.token,
        theme: ctx.theme,
        embed: ctx.isEmbed,
        bounds: TRDMap.boundsOf(collectPoints(S.regions.features)),
        fitBoundsOptions: { padding: ctx.isEmbed ? 46 : 64, maxZoom: 12.5 },
        cooperativeGestures: ctx.isEmbed,
        interactiveLayers: ["places"], // pin hover cursor (click handled below)
        addLayers: addLayers,
      });

      S.mapApi.on("style", function () {
        applyFilters();
        if (S.selected) setActiveSource(placeByName(S.selected));
      });
      S.mapApi.on("loaded", function () { ctx.postLoaded(); });

      var map = S.mapApi.map;
      map.on("load", function () {
        // One click handler with priority — pin > region > empty — so clicking
        // a pin selects the place without also toggling its town (the pin and
        // the region polygon underneath both sit under the cursor).
        map.on("click", function (e) {
          var pin = map.queryRenderedFeatures(e.point, { layers: ["places"] });
          if (pin.length) { selectPlace(pin[0].properties.name); return; }
          var reg = map.queryRenderedFeatures(e.point, { layers: ["regions-fill"] });
          if (reg.length) { toggleTown(reg[0].properties.town); return; }
          closeCard();
        });
        map.on("mouseenter", "regions-fill", function () { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "regions-fill", function () { map.getCanvas().style.cursor = ""; });
      });
    }

    function toggleTown(town) {
      S.activeTown = S.activeTown === town ? null : town;
      applyFilters();
      // frame the selected town, or reset to all places
      if (S.mapApi && S.mapApi.map) {
        var feats = S.activeTown
          ? S.regions.features.filter(function (f) { return f.properties.town === S.activeTown; })
          : S.regions.features;
        var b = TRDMap.boundsOf(collectPoints(feats));
        if (b) S.mapApi.fitBounds(b, { padding: 60, maxZoom: 13.5, duration: 700 });
      }
    }
    // boundsOf expects point features; approximate a polygon by its vertices.
    function collectPoints(feats) {
      var pts = [];
      feats.forEach(function (f) {
        var g = f.geometry;
        if (g.type === "Point") pts.push({ geometry: g });
        else eachCoord(g.coordinates, function (xy) { pts.push({ geometry: { coordinates: xy } }); });
      });
      return pts;
    }
    function eachCoord(c, fn) {
      if (typeof c[0] === "number") fn(c);
      else c.forEach(function (x) { eachCoord(x, fn); });
    }

    return S;
  }

  global.TRDDossier = TRDDossier;
})(typeof window !== "undefined" ? window : this);
