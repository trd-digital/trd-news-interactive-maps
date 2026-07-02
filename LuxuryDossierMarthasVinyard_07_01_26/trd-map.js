/*!
 * trd-map.js — the blessed Mapbox graphic module for the TRD embed toolkit.
 *
 * Depends on: mapbox-gl (global `mapboxgl`) + core/trd-embed.js. It owns only
 * the MAP-specific invariants that both reference maps had to get right, so a
 * new map never re-discovers them:
 *
 *   • Token guard — refuses to build on a missing / non-`pk.` token.
 *   • Cooperative gestures — desktop Ctrl+wheel, mobile two-finger; plus the
 *     editorial trims (no boxZoom / dragRotate / touchPitch / touch-rotate).
 *   • style.load re-add — setStyle() (theme swap) wipes custom sources/layers,
 *     so your addLayers() hook is re-run on EVERY style.load, not just once.
 *   • Basemap declutter — hides poi/transit labels (and more on tiny embeds).
 *   • Overlay camera padding — keeps the flown-to feature clear of the wide-
 *     embed card column.
 *
 * It is DATA-AGNOSTIC: you draw your own sources/layers in the addLayers hook
 * (parcels, circles, choropleth, whatever). The module hands you a ready map,
 * the active theme, and helpers (matchColor, boundsOf, declutter).
 *
 * Lifecycle contract with the core:
 *   onMount(ctx): load data, then TRDMap.create({...}); map.on('loaded', ctx.postLoaded)
 *   onTheme(theme, ctx): map.setTheme(theme); ctx.requestResize()
 *
 * See trd_graphics/README.md and graphics/map/example/ for a working map.
 */
(function (global) {
  "use strict";

  var DEFAULT_STYLES = {
    light: "mapbox://styles/mapbox/light-v11",
    dark: "mapbox://styles/mapbox/dark-v11",
  };

  function isValidToken(token) {
    token = (token || "").trim();
    return token.indexOf("pk.") === 0 && token.indexOf("YOUR_MAPBOX") === -1;
  }

  // Build a Mapbox `match` expression from a {value: color} palette.
  function matchColor(getter, palette, fallback) {
    var stops = [];
    Object.keys(palette).forEach(function (k) {
      stops.push(k, palette[k]);
    });
    return ["match", getter].concat(stops).concat([fallback || "#7f8ba0"]);
  }

  // [[minLng,minLat],[maxLng,maxLat]] for a FeatureCollection / feature array
  // of Points. Returns null when there's nothing to bound.
  function boundsOf(data) {
    var feats = !data ? [] : Array.isArray(data) ? data : data.features || [];
    var lngs = [],
      lats = [];
    feats.forEach(function (f) {
      var c = f && f.geometry && f.geometry.coordinates;
      if (Array.isArray(c) && c.length >= 2 && isFinite(c[0]) && isFinite(c[1])) {
        lngs.push(c[0]);
        lats.push(c[1]);
      }
    });
    if (!lngs.length) return null;
    return [
      [Math.min.apply(null, lngs), Math.min.apply(null, lats)],
      [Math.max.apply(null, lngs), Math.max.apply(null, lats)],
    ];
  }

  // Hide POI / transit label layers that fight an editorial basemap. On tiny
  // embeds also strip road/water/natural labels so a short sticky map reads
  // cleanly. Safe to call on every style.load.
  function declutter(map, opts) {
    opts = opts || {};
    var style = map.getStyle && map.getStyle();
    if (!style || !Array.isArray(style.layers)) return;
    var noise = opts.narrow
      ? /^(poi|transit|road-label|natural-line-label|natural-point-label|water-point-label)(-|$)/i
      : /^(poi|transit)(-|$)/i;
    style.layers.forEach(function (layer) {
      if (!layer || !layer.id || !noise.test(layer.id)) return;
      try {
        map.setLayoutProperty(layer.id, "visibility", "none");
      } catch (e) {
        /* layer removed mid-iteration */
      }
    });
  }

  function docWidth() {
    return (
      (document.documentElement && document.documentElement.clientWidth) ||
      global.innerWidth ||
      1024
    );
  }

  function reducedMotion() {
    return (
      global.matchMedia &&
      global.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  /**
   * TRDMap.create(opts) — construct a hardened editorial Mapbox map.
   *
   * opts:
   *   container        DOM id or element (default "map")
   *   token            Mapbox pk.* token (required)
   *   theme            "light" | "dark" (default "light")
   *   embed            boolean — from controller.isEmbed
   *   styles           { light, dark } style URLs (default light-v11/dark-v11)
   *   data             pre-loaded GeoJSON object (load it before calling)
   *   center/zoom      initial camera, OR
   *   bounds           [[w,s],[e,n]] to fit (with fitBoundsOptions)
   *   pitch/bearing/minZoom/maxZoom
   *   overlayWidth     px reserved on the right for the wide-embed card column
   *   attribution      set false to omit the compact attribution control
   *   cooperativeGestures  default true; pass false for free pan/zoom (e.g.
   *                    standalone, where the map isn't competing with page scroll)
   *   addLayers(map, ctx)  idempotent; runs on EVERY style.load. ctx =
   *                        { map, theme, data, embed, matchColor }
   *   onReady(map)         once, after first "load"
   *   interactiveLayers    [layerId] to wire click + pointer cursor
   *   onFeatureClick(feature, event)
   *   onTokenError()       shown instead of building on a bad token
   *
   * Returns an api: { map, on(evt,fn), setTheme(t), setData(id,data),
   *   flyTo(center,opts), fitBounds(b,opts), overlayPadding(), theme }
   * Events: "style" (each style.load), "loaded" (first idle).
   */
  function create(opts) {
    opts = opts || {};
    var api = { map: null, data: opts.data || null };
    var theme = opts.theme === "dark" ? "dark" : "light";
    var embed = !!opts.embed;
    var styles = opts.styles || DEFAULT_STYLES;
    var listeners = {};

    function emit(evt, arg) {
      (listeners[evt] || []).forEach(function (fn) {
        try {
          fn(arg);
        } catch (e) {
          console.error("[trd-map] listener threw", e);
        }
      });
    }
    api.on = function (evt, fn) {
      (listeners[evt] = listeners[evt] || []).push(fn);
      return api;
    };

    if (!isValidToken(opts.token)) {
      if (typeof opts.onTokenError === "function") opts.onTokenError();
      else
        console.error(
          "[trd-map] Missing or invalid Mapbox token (must start with 'pk.')."
        );
      return api;
    }
    global.mapboxgl.accessToken = opts.token.trim();

    var mapOptions = {
      container: opts.container || "map",
      style: styles[theme],
      // Cooperative gestures (Ctrl+wheel on desktop, two fingers on touch) keep
      // a reader scrolling past an embedded map from getting trapped. It's the
      // wrong default for a standalone full-page map, where free pan/zoom is
      // expected — so let the caller turn it off (e.g. embed-only).
      cooperativeGestures: opts.cooperativeGestures !== false,
      antialias: true,
      attributionControl: false,
    };
    if (opts.bounds) {
      mapOptions.bounds = opts.bounds;
      mapOptions.fitBoundsOptions = opts.fitBoundsOptions || {
        top: 40,
        bottom: 40,
        left: 40,
        right: 40,
      };
    } else {
      mapOptions.center = opts.center || [-73.98, 40.75];
      mapOptions.zoom = opts.zoom != null ? opts.zoom : 11;
    }
    ["pitch", "bearing", "minZoom", "maxZoom"].forEach(function (k) {
      if (opts[k] != null) mapOptions[k] = opts[k];
    });

    var map = new global.mapboxgl.Map(mapOptions);
    api.map = map;

    // Keep the GL canvas matched to its container. Without this, a map that
    // mounts (lazily) while its container is one size and is later shown at
    // another — common in responsive/embed layouts — renders a canvas wider or
    // taller than the box and gets visibly clipped on mobile.
    if (typeof ResizeObserver === "function") {
      var ro = new ResizeObserver(function () {
        if (api.map) api.map.resize();
      });
      ro.observe(map.getContainer());
    }

    // In embed mode the right edge is covered by the overlay card column, so
    // park the zoom control at top-left where it stays tappable.
    map.addControl(
      new global.mapboxgl.NavigationControl({
        showCompass: false,
        visualizePitch: false,
      }),
      embed ? "top-left" : "top-right"
    );
    if (opts.attribution !== false) {
      map.addControl(
        new global.mapboxgl.AttributionControl({ compact: true }),
        "bottom-right"
      );
    }

    // Editorial gesture trims that don't fit even with cooperativeGestures on.
    if (map.boxZoom) map.boxZoom.disable();
    if (map.dragRotate) map.dragRotate.disable();
    if (map.touchPitch) map.touchPitch.disable();
    if (map.touchZoomRotate) map.touchZoomRotate.disableRotation();

    // style.load fires on the initial style AND after every setStyle(). Re-add
    // the data layers here so a theme swap doesn't leave the map bare.
    map.on("style.load", function () {
      declutter(map, { narrow: embed && docWidth() < 500 });
      if (typeof opts.addLayers === "function") {
        try {
          opts.addLayers(map, {
            map: map,
            theme: theme,
            data: api.data,
            embed: embed,
            matchColor: matchColor,
          });
        } catch (e) {
          console.error("[trd-map] addLayers threw", e);
        }
      }
      emit("style", map);
    });

    map.on("load", function () {
      // Belt-and-suspenders: the container height can settle after Mapbox
      // measured it (late fonts, fixed-height embed). Force a resize.
      map.resize();
      if (global.requestAnimationFrame)
        global.requestAnimationFrame(function () {
          map.resize();
        });

      if (map.once) map.once("idle", function () { emit("loaded", map); });
      else emit("loaded", map);

      if (typeof opts.onReady === "function") {
        try {
          opts.onReady(map);
        } catch (e) {
          console.error("[trd-map] onReady threw", e);
        }
      }

      (opts.interactiveLayers || []).forEach(function (layerId) {
        map.on("click", layerId, function (e) {
          if (typeof opts.onFeatureClick === "function") {
            opts.onFeatureClick(e.features && e.features[0], e);
          }
        });
        map.on("mouseenter", layerId, function () {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layerId, function () {
          map.getCanvas().style.cursor = "";
        });
      });
    });

    // --- public methods ----------------------------------------------------
    api.theme = theme;

    api.setTheme = function (t) {
      theme = t === "dark" ? "dark" : "light";
      api.theme = theme;
      if (map) map.setStyle(styles[theme]); // style.load re-adds layers
      return api;
    };

    api.setData = function (sourceId, data) {
      if (data) api.data = data;
      var src = map && map.getSource && map.getSource(sourceId);
      if (src && src.setData) src.setData(data);
      return api;
    };

    // Right-edge padding the camera should reserve for the overlay card column
    // (wide embed only). Single source of truth — matches the CSS column width.
    api.overlayPadding = function () {
      if (!embed || !opts.overlayWidth) return 0;
      if (docWidth() < 780) return 0;
      return opts.overlayWidth;
    };

    api.flyTo = function (center, o) {
      if (!map) return api;
      o = o || {};
      var cam = { center: center };
      for (var k in o) if (o.hasOwnProperty(k)) cam[k] = o[k];
      var pad = api.overlayPadding();
      if (pad > 0) cam.padding = { top: 0, bottom: 0, left: 0, right: pad };
      if (reducedMotion()) {
        map.jumpTo(cam);
        return api;
      }
      cam.duration = o.duration != null ? o.duration : embed ? 700 : 900;
      cam.essential = true;
      cam.easing =
        o.easing ||
        function (t) {
          return 1 - Math.pow(1 - t, 3);
        };
      map.easeTo(cam);
      return api;
    };

    api.fitBounds = function (bounds, o) {
      if (map && bounds) map.fitBounds(bounds, o || { padding: 40 });
      return api;
    };

    return api;
  }

  // Fetch a GeoJSON URL. Convenience so callers don't re-write the fetch guard.
  function loadGeoJSON(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("Failed to load " + url + " (" + res.status + ")");
      return res.json();
    });
  }

  global.TRDMap = {
    create: create,
    loadGeoJSON: loadGeoJSON,
    matchColor: matchColor,
    boundsOf: boundsOf,
    declutter: declutter,
    isValidToken: isValidToken,
    STYLES: DEFAULT_STYLES,
  };
})(typeof window !== "undefined" ? window : this);
