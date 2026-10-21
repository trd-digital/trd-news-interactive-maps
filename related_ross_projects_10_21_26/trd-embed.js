/*!
 * trd-embed.js — the TRD article-embed constraint surface, solved once.
 *
 * GRAPHIC-AGNOSTIC. This runtime knows nothing about maps, charts, or any
 * particular visual. It owns only the things every TRD interactive graphic
 * must get right to live inside an article iframe:
 *
 *   • embed detection (framed / ?layout=embed)         → data-layout="embed"
 *   • theme: standalone toggle + persistence, OR mirror the parent site's
 *     light/dark when embedded (never persists while framed)
 *   • the postMessage bridge (ready / loaded / resize / set-theme /
 *     request-resize), namespaced per graphic
 *   • the iframe auto-sizer — body.scrollHeight only, rAF-debounced, with the
 *     |Δ|<2 guard that stops the parent-resize feedback loop
 *   • lazy mount — build the heavy graphic only when it nears the viewport
 *
 * A "graphic module" (map, chart, …) plugs in through three callbacks:
 *   onMount(ctx)  — build your graphic (fires once, lazily, in embed & standalone)
 *   onTheme(t,ctx)— react to a light/dark change ("light" | "dark")
 *   onResize(ctx) — optional; your content reflowed and needs a re-measure
 *
 * The matching pre-paint <head> snippet (core/boot-snippet.html) must run
 * inline before any stylesheet so the iframe never flashes the standalone
 * layout/theme. This external file takes over once the DOM is ready.
 *
 * See trd_graphics/README.md for the full contract. No build step, no deps.
 */
(function (global) {
  "use strict";

  var HEIGHT_MIN = 100; // parent clamps reported heights to this sane range
  var HEIGHT_MAX = 5000;

  function readEnv() {
    var params = null;
    try {
      params = new URLSearchParams(global.location.search);
    } catch (e) {
      /* malformed location.search */
    }
    var framed;
    try {
      framed = global.self !== global.top;
    } catch (e) {
      framed = true; // cross-origin parent: assume embedded
    }
    var layout = params && params.get("layout");
    var theme = params && params.get("theme");
    return {
      embed: layout === "embed" || framed,
      queryTheme: theme === "dark" || theme === "light" ? theme : null,
    };
  }

  function currentTheme() {
    var t = document.documentElement.getAttribute("data-theme");
    return t === "dark" ? "dark" : "light";
  }

  function systemTheme() {
    return global.matchMedia &&
      global.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function TRDEmbed(options) {
    var opts = options || {};
    var env = readEnv();

    var self = {
      /** True when running inside a TRD article iframe. */
      isEmbed: env.embed,
      /** "light" | "dark" — the live theme. */
      theme: currentTheme(),
      /** Anything the graphic module wants to hang off the controller. */
      graphic: null,
    };

    // --- message namespace -------------------------------------------------
    // Per-graphic prefix so multiple embeds in one article don't cross-talk
    // (listeners whitelist by message type, not origin).
    var prefix = (opts.prefix || "trd-graphic").replace(/:+$/, "");
    var MSG = {
      READY: prefix + ":ready",
      LOADED: prefix + ":loaded",
      RESIZE: prefix + ":resize",
      SET_THEME: prefix + ":set-theme",
      REQUEST_RESIZE: prefix + ":request-resize",
    };
    self.messageTypes = MSG;

    var themeKey = opts.themeKey || prefix + ":theme";
    var mounted = false;
    var loadedSent = false;

    // --- theme -------------------------------------------------------------
    function applyTheme(theme, o) {
      o = o || {};
      theme = theme === "dark" ? "dark" : "light";
      self.theme = theme;
      document.documentElement.setAttribute("data-theme", theme);
      // The host page owns the preference while embedded; never write storage.
      if (o.persist && !self.isEmbed) {
        try {
          localStorage.setItem(themeKey, theme);
        } catch (e) {
          /* private mode, etc. */
        }
      }
      if (typeof opts.onTheme === "function") {
        try {
          opts.onTheme(theme, self);
        } catch (e) {
          console.error("[trd-embed] onTheme threw", e);
        }
      }
      requestResize();
    }
    self.applyTheme = applyTheme;

    function setupThemeToggle() {
      var btn = opts.toggle
        ? typeof opts.toggle === "string"
          ? document.querySelector(opts.toggle)
          : opts.toggle
        : null;

      if (self.isEmbed) {
        // One source of truth when embedded: the TRD site's own switcher.
        if (btn) btn.remove();
        return;
      }
      if (btn) {
        btn.addEventListener("click", function () {
          applyTheme(self.theme === "dark" ? "light" : "dark", {
            persist: true,
          });
        });
      }
      // Follow the OS while the reader hasn't explicitly chosen.
      if (global.matchMedia) {
        var mq = global.matchMedia("(prefers-color-scheme: dark)");
        var handler = function (ev) {
          var stored = null;
          try {
            stored = localStorage.getItem(themeKey);
          } catch (e) {}
          if (stored === "dark" || stored === "light") return;
          applyTheme(ev.matches ? "dark" : "light", { persist: false });
        };
        if (mq.addEventListener) mq.addEventListener("change", handler);
        else if (mq.addListener) mq.addListener(handler);
      }
    }

    // --- iframe auto-sizer -------------------------------------------------
    // body.scrollHeight ONLY. documentElement.scrollHeight returns the iframe
    // viewport height when content is shorter, which pegs the reported height
    // and stops the parent from ever shrinking us back down. Never use vh/svh
    // in embed CSS either — it sizes against the iframe and loops. (README §4)
    function requestResize() {
      if (!self.isEmbed || !global.parent || global.parent === global) return;
      if (requestResize._scheduled) return;
      requestResize._scheduled = true;
      requestAnimationFrame(function () {
        requestResize._scheduled = false;
        var height = document.body ? document.body.scrollHeight : 0;
        if (!height) return;
        // Suppress no-op / sub-pixel reports to avoid a feedback loop with a
        // parent that sizes the iframe back from our reported height.
        if (Math.abs(height - (requestResize._last || 0)) < 2) return;
        requestResize._last = height;
        post(MSG.RESIZE, { height: height });
      });
    }
    self.requestResize = requestResize;

    function post(type, payload) {
      if (!self.isEmbed) return;
      try {
        var msg = { type: type };
        if (payload)
          for (var k in payload)
            if (Object.prototype.hasOwnProperty.call(payload, k))
              msg[k] = payload[k];
        global.parent.postMessage(msg, "*");
      } catch (e) {
        /* parent unreachable */
      }
    }
    self.post = post;

    function postLoaded() {
      if (loadedSent) return;
      loadedSent = true;
      post(MSG.LOADED);
    }
    self.postLoaded = postLoaded;

    function setupParentBridge() {
      if (!self.isEmbed) return;

      global.addEventListener("message", function (ev) {
        var data = ev && ev.data;
        if (!data || typeof data !== "object") return;
        if (
          data.type === MSG.SET_THEME &&
          (data.value === "light" || data.value === "dark")
        ) {
          applyTheme(data.value, { persist: false });
        } else if (data.type === MSG.REQUEST_RESIZE) {
          requestResize();
        }
      });

      // Re-report on any content reflow.
      if (typeof ResizeObserver === "function") {
        var ro = new ResizeObserver(function () {
          requestResize();
          if (typeof opts.onResize === "function") opts.onResize(self);
        });
        if (document.body) ro.observe(document.body);
      } else {
        global.addEventListener("resize", requestResize);
      }

      post(MSG.READY);
      requestResize();
    }

    // --- lazy mount --------------------------------------------------------
    // Build the heavy graphic only when its container nears the viewport, so a
    // deeply-buried embed doesn't pay the cost (WebGL, big DOM) for readers who
    // never scroll to it. Pair with loading="lazy" on the iframe.
    function doMount() {
      if (mounted) return;
      mounted = true;
      if (typeof opts.onMount === "function") {
        try {
          opts.onMount(self);
        } catch (e) {
          console.error("[trd-embed] onMount threw", e);
        }
      }
      requestResize();
    }
    self.mount = doMount;

    function mountWhenVisible() {
      var el = opts.mountTarget
        ? typeof opts.mountTarget === "string"
          ? document.querySelector(opts.mountTarget)
          : opts.mountTarget
        : null;
      if (!el || typeof IntersectionObserver !== "function") {
        doMount();
        return;
      }
      var rect = el.getBoundingClientRect();
      if (rect.top < global.innerHeight && rect.bottom > 0 && rect.width > 0) {
        doMount();
        return;
      }
      var obs = new IntersectionObserver(
        function (entries) {
          for (var i = 0; i < entries.length; i++) {
            if (entries[i].isIntersecting) {
              obs.disconnect();
              doMount();
              break;
            }
          }
        },
        { rootMargin: opts.rootMargin || "200px" }
      );
      obs.observe(el);
    }

    // --- init --------------------------------------------------------------
    // Theme attribute is already set pre-paint by the <head> boot snippet;
    // trust it (falling back to query/system) so first paint is correct.
    var initialTheme =
      env.queryTheme || currentTheme() || systemTheme();
    applyTheme(initialTheme, { persist: false });
    setupThemeToggle();
    setupParentBridge();

    if (opts.lazy === false) doMount();
    else mountWhenVisible();

    return self;
  }

  TRDEmbed.HEIGHT_MIN = HEIGHT_MIN;
  TRDEmbed.HEIGHT_MAX = HEIGHT_MAX;
  TRDEmbed.readEnv = readEnv;

  global.TRDEmbed = TRDEmbed;
})(typeof window !== "undefined" ? window : this);
