/*!
 * pp-core.js — shared runtime for South Florida's project-pipeline maps and
 * tables: Live Local Act projects (south-florida-live-local-{map,table}.html)
 * and new condo filings (south-florida-condominium-development-planning-{map,table}.html).
 *
 * Each page loads one config (pipeline/live-local.js or pipeline/condo-filings.js)
 * that sets window.PP_CONFIG: the data file, how to read a feature
 * (`normalize`), the filter groups, the map colors and the table columns.
 * Everything here is dataset-agnostic.
 *
 * Styling: transactions/tx.css (shared look) + construction/cx.css +
 * permits/pm.css + pipeline/pp.css.
 */
(function (global) {
  "use strict";

  var CFG = global.PP_CONFIG;
  var MAPBOX_TOKEN = "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";
  var COUNTIES = ["Miami-Dade", "Broward", "Palm Beach"];

  // ------------------------------------------------------------------ format
  var fmt = {
    escape: function (s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    },
    num: function (n) {
      return n == null || !isFinite(n) ? "—" : Math.round(n).toLocaleString("en-US");
    },
    date: function (d, style) {
      if (!d) return "—";
      return d.toLocaleDateString("en-US", style === "short" ? { month: "short", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
    },
  };
  function plural(n, one, many) {
    return n.toLocaleString("en-US") + " " + (n === 1 ? one : many || one + "s");
  }
  // "8/28/26", "08/12/2025", "2025-08-12" -> Date at local noon
  function parseDate(s) {
    s = String(s || "").trim();
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (m) {
      var y = +m[3];
      if (y < 100) y += 2000;
      return new Date(y, +m[1] - 1, +m[2], 12);
    }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12);
    return null;
  }
  // Numbers as the sheet/feed writes them ("1,030", "--", "") -> number or null
  function toNum(v) {
    if (v == null) return null;
    var n = parseFloat(String(v).replace(/[,%\s]/g, ""));
    return isFinite(n) ? n : null;
  }
  var KEEP_UPPER = /^(LLC|LLP|LP|LLLP|II|III|IV|VI|VII|VIII|IX|XI|XII|USA|NE|NW|SE|SW|PH|LTD|FL|JV)$/;
  // Names filed in capitals ("410 EDGEWATER CONDO") -> "410 Edgewater Condo"
  function nameCase(s) {
    s = String(s || "").replace(/\s+/g, " ").trim();
    if (/[a-z]/.test(s)) return s;
    return s.toLowerCase().replace(/[a-z0-9'’.&-]+/g, function (w, i) {
      var up = w.toUpperCase();
      if (KEEP_UPPER.test(up.replace(/[.,]/g, ""))) return up;
      if (i && /^(of|and|or|the|at|a|on|in|by|de|del|la)$/.test(w)) return w;
      if (/^\d+(st|nd|rd|th)$/.test(w)) return w;
      if (/^\d/.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).replace(/^./, function (c) { return c.toUpperCase(); });
  }
  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  // ------------------------------------------------------------------ load
  function dataUrl() {
    var q = new URLSearchParams(location.search);
    if (q.get("data") && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return q.get("data");
    return CFG.dataFile;
  }
  function startTags() {
    if (typeof global.__ppLoadGtm !== "function") return;
    var go = function () { global.__ppLoadGtm(); };
    setTimeout(function () {
      if (global.requestIdleCallback) global.requestIdleCallback(go, { timeout: 2000 });
      else go();
    }, 0);
  }
  var loadPromise = null;
  function load() {
    if (loadPromise) return loadPromise;
    loadPromise = fetch(dataUrl(), { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (fc) {
      var rows = [];
      (fc.features || []).forEach(function (f, i) {
        var r = CFG.normalize(f, i, { nameCase: nameCase, parseDate: parseDate, toNum: toNum });
        if (!r) return;
        var c = f.geometry && f.geometry.coordinates;
        r.id = r.id || "p" + i;
        r.lng = c && isFinite(c[0]) ? +c[0] : null;
        r.lat = c && isFinite(c[1]) ? +c[1] : null;
        r.located = r.lng != null && r.lat != null && !(r.lng === 0 && r.lat === 0);
        r.hay = (r.hay || [r.name, r.sub, r.city, r.county].join(" ")).toLowerCase();
        rows.push(r);
      });
      var byId = {}, cities = {};
      rows.forEach(function (r) {
        byId[r.id] = r;
        if (r.located) r.spot = r.lng.toFixed(5) + "," + r.lat.toFixed(5);
        if (r.city) cities[r.city] = (cities[r.city] || 0) + 1;
      });
      var groups = {};
      CFG.groups.forEach(function (g) {
        var vals = typeof g.values === "function" ? g.values(rows) : g.values;
        groups[g.key] = vals.filter(function (v) { return !g.dropEmpty || rows.some(function (r) { return r[g.field] === v.id; }); });
      });
      return {
        rows: rows,
        byId: byId,
        groups: groups,
        cities: Object.keys(cities).sort(function (a, b) { return a.localeCompare(b); }),
        cityCounts: cities,
        generated: fc.generated_at ? parseDate(String(fc.generated_at).slice(0, 10)) : null,
        maxUnits: rows.reduce(function (m, r) { return Math.max(m, r.units || 0); }, 0),
      };
    });
    loadPromise.then(startTags, startTags);
    return loadPromise;
  }

  // ------------------------------------------------------------------ state
  // sel[groupKey] is null (everything) or the list of picked value ids.
  function defaultState() {
    var sel = {};
    CFG.groups.forEach(function (g) { sel[g.key] = null; });
    return { sel: sel, city: null, q: "" };
  }
  function groupValues(g, data) {
    if (data) return data.groups[g.key];
    return typeof g.values === "function" ? [] : g.values;
  }
  // URL presets: each group's `param` (?stage=approved ?county=broward), plus ?city= and ?q=
  function stateFromUrl(search) {
    var q = new URLSearchParams(search == null ? location.search : search);
    var s = defaultState();
    CFG.groups.forEach(function (g) {
      var v = q.get(g.param || g.key);
      if (v) s.sel[g.key] = String(v).toLowerCase().split(",").map(slug);
    });
    if (q.get("city")) s.city = q.get("city").slice(0, 60);
    if (q.get("q")) s.q = q.get("q").slice(0, 100);
    return s;
  }
  // URL values are slugs until the data is in; match them to real ids then.
  function resolve(state, data) {
    CFG.groups.forEach(function (g) {
      var want = state.sel[g.key];
      if (!want) return;
      var vals = groupValues(g, data);
      var got = vals.filter(function (v) { return want.indexOf(v.id) >= 0 || want.indexOf(slug(v.id)) >= 0 || want.indexOf(slug(v.label)) >= 0; })
        .map(function (v) { return v.id; });
      state.sel[g.key] = got.length && got.length < vals.length ? got : null;
    });
    if (state.city) {
      var w = slug(state.city);
      state.city = data.cities.filter(function (c) { return slug(c) === w; })[0] || null;
    }
    return state;
  }
  function filterCount(s) {
    var n = s.city ? 1 : 0;
    CFG.groups.forEach(function (g) { if (s.sel[g.key]) n++; });
    return n;
  }
  function isDefault(s) {
    return !filterCount(s) && !s.q;
  }
  function clone(s) {
    return JSON.parse(JSON.stringify(s));
  }
  function apply(rows, state, opts) {
    opts = opts || {};
    var q = String(state.q || "").trim().toLowerCase();
    var words = q ? q.split(/\s+/) : [];
    return rows.filter(function (r) {
      for (var i = 0; i < CFG.groups.length; i++) {
        var g = CFG.groups[i], pick = state.sel[g.key];
        if (pick && opts.ignore !== g.key && pick.indexOf(r[g.field]) < 0) return false;
      }
      if (opts.ignore !== "city" && state.city && r.city !== state.city) return false;
      for (var j = 0; j < words.length; j++) if (r.hay.indexOf(words[j]) < 0) return false;
      return true;
    });
  }
  function toggle(current, v, all) {
    if (!current) return [v];
    var next = current.indexOf(v) >= 0 ? current.filter(function (x) { return x !== v; }) : current.concat([v]);
    if (!next.length || next.length >= all.length) return null;
    return all.filter(function (x) { return next.indexOf(x) >= 0; });
  }
  function group(key) {
    return CFG.groups.filter(function (g) { return g.key === key; })[0];
  }
  function valueLabel(key, id, data) {
    var g = group(key);
    var v = groupValues(g, data).filter(function (x) { return x.id === id; })[0];
    return v ? v.label : id;
  }

  // Stage colors (the config's `stages`): css var for swatches, hex for the map.
  function stage(id) {
    return CFG.stages.filter(function (s) { return s.id === id; })[0] || CFG.stages[CFG.stages.length - 1];
  }
  function swatch(id) {
    return '<i class="tx-swatch" style="background:var(--pp-' + id + ')"></i>';
  }
  function stageTag(r) {
    return '<span class="tx-tag">' + swatch(r.stage) + fmt.escape(r.statusText || stage(r.stage).label) + "</span>";
  }

  // ------------------------------------------------------------------ analytics
  function tracker(role) {
    var category = CFG.eventCategory + "-" + role;
    return function (action, label) {
      if (!global.dataLayer) return;
      global.dataLayer.push({ event: "event_tracking", trd: { category: category, action: action, label: label == null ? "" : String(label) } });
    };
  }

  // -------------------------------------------------------------- sibling sync
  // Same-origin sibling iframes on one TRD page reach each other through
  // window.parent.frames (as the transactions and permits embeds do).
  function link(role, onMessage) {
    function siblings() {
      var out = [];
      try {
        var frames = global.parent && global.parent !== global ? global.parent.frames : [];
        for (var i = 0; i < frames.length; i++) {
          var w = frames[i];
          if (w === global) continue;
          try {
            if (w.location.origin === location.origin && CFG.pageRe.test(w.location.pathname)) out.push(w);
          } catch (e) { /* cross-origin frame */ }
        }
      } catch (e) {}
      return out;
    }
    global.addEventListener("message", function (ev) {
      if (ev.origin !== location.origin || !ev.data || ev.data.ns !== CFG.ns || ev.data.from === role) return;
      onMessage(ev.data);
    });
    var api = {
      send: function (type, payload) {
        siblings().forEach(function (w) { w.postMessage({ ns: CFG.ns, from: role, type: type, payload: payload }, location.origin); });
      },
      hasPeer: function (peerRole) {
        return siblings().some(function (w) { return w.location.pathname.indexOf("-" + peerRole) >= 0; });
      },
    };
    setTimeout(function () { api.send("hello", null); }, 0);
    return api;
  }

  // ------------------------------------------------------------- filter bar
  function filterBar(el, getState, onChange, opts) {
    opts = opts || {};
    function chip(key, value, label, active) {
      return '<button type="button" class="tx-chip' + (active ? " is-active" : "") + '" data-group="' + key + '" data-value="' +
        fmt.escape(value) + '" aria-pressed="' + active + '">' + label + "</button>";
    }
    function render() {
      var s = getState();
      var data = opts.getData ? opts.getData() : null;
      var html = '<div class="tx-filter-groups">';
      CFG.groups.forEach(function (g) {
        var c = {};
        if (data) apply(data.rows, s, { ignore: g.key }).forEach(function (r) { c[r[g.field]] = (c[r[g.field]] || 0) + 1; });
        var pick = s.sel[g.key];
        html += '<div class="tx-group" data-key="' + g.key + '"><span class="tx-group-label">' + g.label + '</span><div class="tx-chips">' +
          groupValues(g, data).map(function (v) {
            return chip(g.key, v.id, (g.key === CFG.stageGroup ? swatch(v.id) : "") + fmt.escape(v.label) +
              (data ? ' <span class="tx-n">' + (c[v.id] || 0).toLocaleString("en-US") + "</span>" : ""), !!pick && pick.indexOf(v.id) >= 0);
          }).join("") + "</div>" + (g.hint ? '<p class="cx-hint">' + g.hint + "</p>" : "") + "</div>";
      });
      if (data && data.cities.length > 1) {
        var cityC = {};
        apply(data.rows, s, { ignore: "city" }).forEach(function (r) { if (r.city) cityC[r.city] = (cityC[r.city] || 0) + 1; });
        html += '<div class="tx-group" data-key="city"><label class="tx-group-label" for="pp-city">City</label><div class="tx-chips">' +
          '<select id="pp-city" class="pm-select"><option value="">All cities</option>' +
          data.cities.filter(function (c) { return cityC[c] || s.city === c; }).map(function (c) {
            return '<option value="' + fmt.escape(c) + '"' + (s.city === c ? " selected" : "") + ">" + fmt.escape(c) + " (" + (cityC[c] || 0).toLocaleString("en-US") + ")</option>";
          }).join("") + "</select></div></div>";
      }
      html += '<button type="button" class="tx-reset"' + (isDefault(s) ? " hidden" : "") + ">Reset</button></div>";
      el.innerHTML = html;
    }
    el.addEventListener("click", function (e) {
      var s = getState();
      if (e.target.closest(".tx-reset")) {
        var d = defaultState();
        d.q = s.q;
        onChange(d, "reset");
        render();
        return;
      }
      var b = e.target.closest(".tx-chip");
      if (!b) return;
      var key = b.getAttribute("data-group"), v = b.getAttribute("data-value");
      var all = groupValues(group(key), opts.getData && opts.getData()).map(function (x) { return x.id; });
      s.sel[key] = toggle(s.sel[key], v, all);
      if (key === "county") s.city = null;
      onChange(s, key + ":" + v);
      render();
    });
    el.addEventListener("change", function (e) {
      if (e.target.id !== "pp-city") return;
      var s = getState();
      s.city = e.target.value || null;
      onChange(s, "city:" + (s.city || "all"), { fit: true });
      render();
    });
    return { render: render };
  }

  function activeChips(container, s, onChange, data) {
    var chips = [];
    if (s.q) chips.push(["q", "“" + s.q + "”"]);
    if (s.city) chips.push(["city", s.city]);
    CFG.groups.forEach(function (g) {
      if (s.sel[g.key]) chips.push([g.key, (g.chipLabel ? g.chipLabel + ": " : "") + s.sel[g.key].map(function (id) { return valueLabel(g.key, id, data); }).join(", ")]);
    });
    container.hidden = !chips.length;
    container.innerHTML = chips.map(function (c) {
      return '<button type="button" class="tx-active-chip" data-clear="' + c[0] + '" aria-label="Remove filter: ' + fmt.escape(c[1]) + '">' +
        fmt.escape(c[1]) + ' <span class="tx-x" aria-hidden="true">×</span></button>';
    }).join("") + (chips.length > 1 ? '<button type="button" class="tx-clear-all" data-clear="all">Clear all</button>' : "");
    container.onclick = function (e) {
      var b = e.target.closest("[data-clear]");
      if (!b) return;
      var k = b.getAttribute("data-clear"), n = clone(s);
      if (k === "all") n = defaultState();
      else if (k === "q") n.q = "";
      else if (k === "city") n.city = null;
      else n.sel[k] = null;
      onChange(n, "clear:" + k);
    };
  }

  // ------------------------------------------------------------- search box
  function searchBox(o) {
    var input = o.input, panel = o.panel, items = [], active = -1, timer = null;
    function suggestions(q) {
      var data = o.getData();
      if (!data || q.length < 2) return [];
      var lq = q.toLowerCase(), out = [];
      data.cities.forEach(function (c) {
        if (c.toLowerCase().indexOf(lq) === 0 && out.length < 2) out.push({ kind: "city", value: c, title: c, sub: plural(data.cityCounts[c], CFG.noun.one, CFG.noun.many) });
      });
      data.rows.filter(function (r) { return r.hay.indexOf(lq) >= 0; }).slice(0, 6).forEach(function (r) {
        out.push({ kind: "row", row: r, title: r.name, sub: [r.sub, r.city].filter(Boolean).join(" · ") });
      });
      return out;
    }
    function draw() {
      if (!items.length) { panel.hidden = true; input.setAttribute("aria-expanded", "false"); return; }
      panel.innerHTML = items.map(function (it, i) {
        return '<li role="option" id="pp-opt-' + i + '" class="' + (i === active ? "is-active" : "") + '" data-i="' + i + '"' +
          (i === active ? ' aria-selected="true"' : "") + '><span class="tx-sg-main"><span class="cx-sg-kind">' +
          (it.kind === "city" ? "City" : CFG.noun.kind) + "</span>" + fmt.escape(it.title) + '</span><span class="tx-sg-sub">' + fmt.escape(it.sub) + "</span></li>";
      }).join("");
      panel.hidden = false;
      input.setAttribute("aria-expanded", "true");
      if (active >= 0) input.setAttribute("aria-activedescendant", "pp-opt-" + active);
      else input.removeAttribute("aria-activedescendant");
    }
    function pick(i) {
      var it = items[i];
      if (!it) return;
      items = [];
      draw();
      o.onPick(it);
    }
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", panel.id);
    input.setAttribute("aria-expanded", "false");
    panel.setAttribute("role", "listbox");
    input.addEventListener("input", function () {
      var q = input.value.trim();
      items = suggestions(q);
      active = -1;
      draw();
      clearTimeout(timer);
      timer = setTimeout(function () { o.onQuery(q); }, 200);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" && items.length) { active = (active + 1) % items.length; draw(); e.preventDefault(); }
      else if (e.key === "ArrowUp" && items.length) { active = (active - 1 + items.length) % items.length; draw(); e.preventDefault(); }
      else if (e.key === "Enter") {
        if (active >= 0) { e.preventDefault(); pick(active); }
        else { items = []; draw(); clearTimeout(timer); o.onQuery(input.value.trim()); }
      } else if (e.key === "Escape") {
        if (items.length) { items = []; draw(); } else if (input.value) { input.value = ""; o.onQuery(""); }
      }
    });
    input.addEventListener("blur", function () { setTimeout(function () { items = []; draw(); }, 150); });
    panel.addEventListener("mousedown", function (e) {
      var li = e.target.closest("li[data-i]");
      if (li) { e.preventDefault(); pick(+li.getAttribute("data-i")); }
    });
    return {
      set: function (q) { if (document.activeElement !== input) input.value = q || ""; },
      clear: function () { input.value = ""; },
    };
  }
  function searchHtml(q, placeholder) {
    return '<label class="tx-search"><span class="tx-sr">' + fmt.escape(CFG.searchLabel) + "</span>" +
      '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4.5 4.5" /></svg>' +
      '<input class="tx-search-input" type="search" autocomplete="off" spellcheck="false" placeholder="' + fmt.escape(placeholder) + '" value="' + fmt.escape(q || "") + '" /></label>';
  }

  // ------------------------------------------------------------------ detail
  // Workforce/affordable share as a bar: "412 of 1,030 units (40%)".
  function shareBar(part, total, label) {
    if (part == null && total == null) return "";
    var pct = part != null && total ? Math.min(100, part / total * 100) : null;
    return '<div class="pp-share">' +
      '<p class="pp-share-text"><strong>' + fmt.num(part) + "</strong> " + fmt.escape(label) +
      (total != null ? ' <span class="tx-muted">of ' + fmt.num(total) + " units" + (pct != null ? " · " + Math.round(pct) + "%" : "") + "</span>" : "") + "</p>" +
      (pct != null ? '<span class="pp-share-bar" aria-hidden="true"><i style="width:' + pct.toFixed(1) + '%"></i></span>' : "") + "</div>";
  }
  function factsHtml(list, cls) {
    return '<dl class="' + (cls || "tx-dl") + '">' + list.map(function (x) {
      return cls === "tx-facts" ? "<div><dt>" + x[0] + "</dt><dd>" + x[1] + "</dd></div>" : "<dt>" + x[0] + "</dt><dd>" + x[1] + "</dd>";
    }).join("") + "</dl>";
  }

  // Theme: TRD's theme.js init() asks the parent page and sets <body data-bs-theme>.
  function theme(onChange, track) {
    var current = null;
    function set(t) {
      if (t !== "dark" && t !== "light") return;
      var changed = t !== current;
      current = t;
      document.documentElement.setAttribute("data-bs-theme", t);
      document.body.setAttribute("data-bs-theme", t);
      if (changed && onChange) onChange(t);
    }
    var trd = typeof TrdTheme === "function" // eslint-disable-line no-undef
      ? TrdTheme({ updateCallback: function (t) { set(t); if (track) track("theme", t); } }) // eslint-disable-line no-undef
      : null;
    if (trd) trd.init();
    current = (trd && trd.get()) || (global.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-bs-theme", current);
    document.body.setAttribute("data-bs-theme", current);
    return { get: function () { return current; } };
  }

  // Stage colors as css vars (--pp-<id>) so swatches follow the theme.
  (function stageVars() {
    var css = ":root{" + CFG.stages.map(function (s) { return "--pp-" + s.id + ":" + s.color.light; }).join(";") + "}" +
      '[data-bs-theme="dark"]{' + CFG.stages.map(function (s) { return "--pp-" + s.id + ":" + s.color.dark; }).join(";") + "}";
    var st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
  })();

  global.PP = {
    CFG: CFG,
    MAPBOX_TOKEN: MAPBOX_TOKEN,
    COUNTIES: COUNTIES,
    fmt: fmt,
    plural: plural,
    nameCase: nameCase,
    parseDate: parseDate,
    toNum: toNum,
    slug: slug,
    load: load,
    defaultState: defaultState,
    stateFromUrl: stateFromUrl,
    resolve: resolve,
    filterCount: filterCount,
    isDefault: isDefault,
    clone: clone,
    apply: apply,
    toggle: toggle,
    group: group,
    groupValues: groupValues,
    stage: stage,
    swatch: swatch,
    stageTag: stageTag,
    tracker: tracker,
    link: link,
    filterBar: filterBar,
    activeChips: activeChips,
    searchBox: searchBox,
    searchHtml: searchHtml,
    shareBar: shareBar,
    factsHtml: factsHtml,
    theme: theme,
  };
})(window);
