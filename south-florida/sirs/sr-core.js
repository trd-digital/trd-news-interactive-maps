/*!
 * sr-core.js — shared runtime for the South Florida condo reserve study
 * (SIRS) map and table (south-florida-condo-reserve-studies-{map,table}.html).
 *
 * Data: south-florida-condo-reserve-studies.geojson, one feature per condo
 * association that has reported a Structural Integrity Reserve Study to
 * Florida's DBPR, built by south-florida/_sirs/build_sirs.py from DBPR's two
 * filing lists (before July 2025, and July 2025 on). `normalize()` is the
 * only place that knows its field names.
 *
 * Styling: transactions/tx.css (shared look) + construction/cx.css + sr.css.
 */
(function (global) {
  "use strict";

  var DATA_FILE = "south-florida-condo-reserve-studies.geojson";
  var MAPBOX_TOKEN = "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";
  var NS = "trd-sofla-sirs";
  var PAGE_RE = /south-florida-condo-reserve-studies-(map|table)/;

  // When an association reported. One color each on the map.
  var PERIODS = [
    { id: "post", label: "July 2025 or later", long: "Reported July 2025 or later" },
    { id: "both", label: "Both periods", long: "Reported before and after July 2025" },
    { id: "pre", label: "Before July 2025", long: "Reported before July 2025 only" },
  ];
  var PERIOD_IDS = PERIODS.map(function (p) { return p.id; });
  var COUNTIES = ["Miami-Dade", "Broward", "Palm Beach"];
  var TYPES = ["Condominium", "Cooperative", "Not listed"];

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
  };
  function plural(n, one, many) {
    return n.toLocaleString("en-US") + " " + (n === 1 ? one : many || one + "s");
  }
  var KEEP_UPPER = /^(LLC|II|III|IV|VI|VII|VIII|IX|XI|XII|USA|NE|NW|SE|SW|PH|CU|YMCA|LTD)$/;
  // Names are shown as filed, but most are filed in capitals.
  function nameCase(s) {
    s = String(s || "").replace(/\s+/g, " ").trim();
    if (/[a-z]/.test(s)) return s;
    return s.toLowerCase().replace(/[a-z0-9'’.]+/g, function (w, i) {
      var up = w.toUpperCase();
      if (KEEP_UPPER.test(up.replace(/\./g, ""))) return up;
      if (/^(inc|assn|assoc|corp|no|bldg|ph|sec)\.?$/.test(w)) return w.charAt(0).toUpperCase() + w.slice(1);
      if (i && /^(of|and|or|the|at|a|on|in|by|by-the-sea)$/.test(w)) return w;
      if (/^\d/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).replace(/^./, function (c) { return c.toUpperCase(); });
  }

  // ------------------------------------------------------------- normalize
  function normalize(f, i) {
    var p = f.properties || {};
    var c = f.geometry && f.geometry.coordinates;
    var rep = p.Reported || [];
    var period = rep.length > 1 ? "both" : /before/i.test(rep[0] || "") ? "pre" : "post";
    var type = p["Type Listed"] ? (/coop/i.test(p["Project Type"]) ? "Cooperative" : p["Project Type"] === "Mixed" ? "Condominium" : "Condominium") : "Not listed";
    var r = {
      id: "a" + i,
      name: nameCase(p["Association Name"]),
      projects: (p.Projects || []).map(nameCase),
      otherNames: (p["Other Names"] || []).map(nameCase),
      city: p.City || null,
      zip: p.Zip || null,
      county: p.County || null,
      period: period,
      type: type,
      filings: +p.Filings || 1,
      precise: p.Location === "Building",
      // How the point was found (build_sirs.py): only "Building" is the building itself.
      locLabel: { "ZIP area": "the ZIP code’s center", "City area": "the city’s center", Street: "the street, not the building",
        "Nearby place": "a nearby business, not the building", "Shared point": "a general area shared with other condos" }[p.Location] || null,
      ids: p["DBPR IDs"] || [],
      lng: c && isFinite(c[0]) ? +c[0] : null,
      lat: c && isFinite(c[1]) ? +c[1] : null,
    };
    // Only associations placed at the building itself go on the map; the rest are table-only.
    r.located = r.precise && r.lng != null && r.lat != null;
    r.hay = [r.name, r.projects.join(" "), r.otherNames.join(" "), r.city, r.zip, r.county].join(" ").toLowerCase();
    return r;
  }

  // ------------------------------------------------------------------ load
  function dataUrl() {
    var q = new URLSearchParams(location.search);
    if (q.get("data") && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return q.get("data");
    return DATA_FILE;
  }
  function startTags() {
    if (typeof global.__srLoadGtm !== "function") return;
    var go = function () { global.__srLoadGtm(); };
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
      var rows = (fc.features || []).map(normalize);
      rows.sort(function (a, b) { return a.name.localeCompare(b.name); });
      var byId = {}, at = {}, cities = {};
      rows.forEach(function (r, i) {
        r._n = i;
        byId[r.id] = r;
        if (r.located) {
          var k = r.lng.toFixed(5) + "," + r.lat.toFixed(5);
          (at[k] = at[k] || []).push(r);
          r.spot = k;
        }
        if (r.city) cities[r.city] = (cities[r.city] || 0) + 1;
      });
      return {
        rows: rows,
        byId: byId,
        at: at, // associations sharing one map point
        cities: Object.keys(cities).sort(function (a, b) { return a.localeCompare(b); }),
        cityCounts: cities,
        generated: fc.generated_at ? String(fc.generated_at).slice(0, 10) : null,
      };
    });
    loadPromise.then(startTags, startTags);
    return loadPromise;
  }

  // ------------------------------------------------------------------ state
  function defaultState() {
    return { periods: PERIOD_IDS.slice(), counties: COUNTIES.slice(), types: TYPES.slice(), city: null, q: "" };
  }
  function listParam(v, all) {
    if (!v) return null;
    var want = String(v).toLowerCase().split(",");
    var out = all.filter(function (x) { return want.indexOf(String(x).toLowerCase()) >= 0 || want.indexOf(slug(x)) >= 0; });
    return out.length ? out : null;
  }
  // URL presets: ?reported=post,both ?county=broward ?type=cooperative ?city=aventura ?q=text
  function stateFromUrl(search) {
    var q = new URLSearchParams(search == null ? location.search : search);
    var s = defaultState();
    var p = listParam(q.get("reported"), PERIOD_IDS);
    if (p) s.periods = p;
    var c = listParam(q.get("county"), COUNTIES);
    if (c) s.counties = c;
    var t = listParam(q.get("type"), TYPES);
    if (t) s.types = t;
    if (q.get("city")) s.city = q.get("city").slice(0, 60);
    if (q.get("q")) s.q = q.get("q").slice(0, 100);
    return s;
  }
  function resolveCity(state, data) {
    if (!state.city || !data) return state;
    var want = slug(state.city);
    state.city = data.cities.filter(function (c) { return slug(c) === want; })[0] || null;
    return state;
  }
  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  function filterCount(s) {
    var n = 0;
    if (s.periods.length !== PERIOD_IDS.length) n++;
    if (s.counties.length !== COUNTIES.length) n++;
    if (s.types.length !== TYPES.length) n++;
    if (s.city) n++;
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
      if (opts.ignore !== "periods" && state.periods.indexOf(r.period) < 0) return false;
      if (opts.ignore !== "counties" && state.counties.indexOf(r.county) < 0) return false;
      if (opts.ignore !== "types" && state.types.indexOf(r.type) < 0) return false;
      if (opts.ignore !== "city" && state.city && r.city !== state.city) return false;
      for (var i = 0; i < words.length; i++) if (r.hay.indexOf(words[i]) < 0) return false;
      return true;
    });
  }
  function periodLabel(id) {
    return (PERIODS[PERIOD_IDS.indexOf(id)] || {}).label || id;
  }

  // ------------------------------------------------------------------ analytics
  function tracker(category) {
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
            if (w.location.origin === location.origin && PAGE_RE.test(w.location.pathname)) out.push(w);
          } catch (e) { /* cross-origin frame */ }
        }
      } catch (e) {}
      return out;
    }
    global.addEventListener("message", function (ev) {
      if (ev.origin !== location.origin || !ev.data || ev.data.ns !== NS || ev.data.from === role) return;
      onMessage(ev.data);
    });
    var api = {
      send: function (type, payload) {
        siblings().forEach(function (w) { w.postMessage({ ns: NS, from: role, type: type, payload: payload }, location.origin); });
      },
      hasPeer: function (peerRole) {
        return siblings().some(function (w) { return w.location.pathname.indexOf("studies-" + peerRole) >= 0; });
      },
    };
    setTimeout(function () { api.send("hello", null); }, 0);
    return api;
  }

  // ------------------------------------------------------------- filter bar
  function filterBar(el, getState, onChange, opts) {
    opts = opts || {};
    function chip(group, value, label, active) {
      return '<button type="button" class="tx-chip' + (active ? " is-active" : "") + '" data-group="' + group + '" data-value="' +
        fmt.escape(value) + '" aria-pressed="' + active + '">' + label + "</button>";
    }
    function group(label, key, inner, hint) {
      return '<div class="tx-group" data-key="' + key + '"><span class="tx-group-label">' + label + "</span>" +
        '<div class="tx-chips">' + inner + "</div>" + (hint ? '<p class="cx-hint">' + hint + "</p>" : "") + "</div>";
    }
    function counts(data, s, key, field) {
      var c = {};
      if (data) apply(data.rows, s, { ignore: key }).forEach(function (r) { c[r[field]] = (c[r[field]] || 0) + 1; });
      return c;
    }
    function n(c, k, data) {
      return data ? ' <span class="tx-n">' + (c[k] || 0).toLocaleString("en-US") + "</span>" : "";
    }
    function render() {
      var s = getState();
      var data = opts.getData ? opts.getData() : null;
      var pc = counts(data, s, "periods", "period"), cc = counts(data, s, "counties", "county"), tc = counts(data, s, "types", "type");
      var html = '<div class="tx-filter-groups">';
      html += group("Reported", "periods", PERIODS.map(function (p) {
        return chip("periods", p.id, '<i class="tx-swatch sr-swatch-' + p.id + '"></i>' + p.label + n(pc, p.id, data),
          s.periods.length < PERIOD_IDS.length && s.periods.indexOf(p.id) >= 0);
      }).join(""), "“Both periods”: the association appears on DBPR’s list before July 2025 and on its list since.");
      html += group("County", "counties", COUNTIES.map(function (c) {
        return chip("counties", c, c + n(cc, c, data), s.counties.length < COUNTIES.length && s.counties.indexOf(c) >= 0);
      }).join(""));
      if (data) {
        var cityC = counts(data, s, "city", "city");
        html += '<div class="tx-group" data-key="city"><label class="tx-group-label" for="sr-city">City</label><div class="tx-chips">' +
          '<select id="sr-city" class="pm-select"><option value="">All cities</option>' +
          data.cities.filter(function (c) { return cityC[c] || s.city === c; }).map(function (c) {
            return '<option value="' + fmt.escape(c) + '"' + (s.city === c ? " selected" : "") + ">" + fmt.escape(c) + " (" + (cityC[c] || 0).toLocaleString("en-US") + ")</option>";
          }).join("") + "</select></div></div>";
      }
      html += group("Type", "types", TYPES.map(function (t) {
        return chip("types", t, t + n(tc, t, data), s.types.length < TYPES.length && s.types.indexOf(t) >= 0);
      }).join(""), "DBPR’s list since July 2025 doesn’t give a type.");
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
      var g = b.getAttribute("data-group"), v = b.getAttribute("data-value");
      var all = g === "periods" ? PERIOD_IDS : g === "counties" ? COUNTIES : TYPES;
      s[g] = toggleSet(s[g], v, all);
      if (g === "counties") s.city = null;
      onChange(s, g + ":" + v);
      render();
    });
    el.addEventListener("change", function (e) {
      if (e.target.id !== "sr-city") return;
      var s = getState();
      s.city = e.target.value || null;
      onChange(s, "city:" + (s.city || "all"), { fit: true });
      render();
    });
    return { render: render };
  }
  function toggleSet(current, v, all) {
    if (current.length === all.length) return [v];
    var has = current.indexOf(v) >= 0;
    var next = has ? current.filter(function (x) { return x !== v; }) : current.concat([v]);
    if (!next.length || next.length === all.length) return all.slice();
    return all.filter(function (x) { return next.indexOf(x) >= 0; });
  }

  function activeChips(container, s, onChange) {
    var chips = [];
    if (s.q) chips.push(["q", "“" + s.q + "”"]);
    if (s.city) chips.push(["city", s.city]);
    if (s.periods.length !== PERIOD_IDS.length) chips.push(["periods", "Reported: " + s.periods.map(periodLabel).join(", ")]);
    if (s.counties.length !== COUNTIES.length) chips.push(["counties", s.counties.join(", ")]);
    if (s.types.length !== TYPES.length) chips.push(["types", s.types.join(", ")]);
    container.hidden = !chips.length;
    container.innerHTML = chips.map(function (c) {
      return '<button type="button" class="tx-active-chip" data-clear="' + c[0] + '" aria-label="Remove filter: ' + fmt.escape(c[1]) + '">' +
        fmt.escape(c[1]) + ' <span class="tx-x" aria-hidden="true">×</span></button>';
    }).join("") + (chips.length > 1 ? '<button type="button" class="tx-clear-all" data-clear="all">Clear all</button>' : "");
    container.onclick = function (e) {
      var b = e.target.closest("[data-clear]");
      if (!b) return;
      var k = b.getAttribute("data-clear"), d = defaultState(), n = clone(s);
      if (k === "all") n = d;
      else n[k] = d[k] && d[k].slice ? d[k].slice() : d[k];
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
        if (c.toLowerCase().indexOf(lq) === 0 && out.length < 2) out.push({ kind: "city", value: c, title: c, sub: plural(data.cityCounts[c], "association") });
      });
      data.rows.filter(function (r) { return r.hay.indexOf(lq) >= 0 && (r.name.toLowerCase().indexOf(lq) >= 0 || r.projects.some(function (p) { return p.toLowerCase().indexOf(lq) >= 0; })); })
        .slice(0, 6).forEach(function (r) {
          out.push({ kind: "assoc", row: r, title: r.name, sub: [r.city, r.zip].filter(Boolean).join(" ") + " · " + periodLabel(r.period) });
        });
      return out;
    }
    function draw() {
      if (!items.length) { panel.hidden = true; input.setAttribute("aria-expanded", "false"); return; }
      panel.innerHTML = items.map(function (it, i) {
        return '<li role="option" id="sr-opt-' + i + '" class="' + (i === active ? "is-active" : "") + '" data-i="' + i + '"' +
          (i === active ? ' aria-selected="true"' : "") + '><span class="tx-sg-main"><span class="cx-sg-kind">' +
          (it.kind === "city" ? "City" : "Condo") + "</span>" + fmt.escape(it.title) + '</span><span class="tx-sg-sub">' + fmt.escape(it.sub) + "</span></li>";
      }).join("");
      panel.hidden = false;
      input.setAttribute("aria-expanded", "true");
      if (active >= 0) input.setAttribute("aria-activedescendant", "sr-opt-" + active);
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
    return '<label class="tx-search"><span class="tx-sr">Search condo associations</span>' +
      '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4.5 4.5" /></svg>' +
      '<input class="tx-search-input" type="search" autocomplete="off" spellcheck="false" placeholder="' + fmt.escape(placeholder) + '" value="' + fmt.escape(q || "") + '" /></label>';
  }

  // ------------------------------------------------------------------ detail
  function facts(r) {
    var out = [];
    out.push(["Reported", '<i class="tx-swatch sr-swatch-' + r.period + '"></i> ' + fmt.escape({ post: "July 2025 or later", both: "Before and after July 2025", pre: "Before July 2025 only" }[r.period])]);
    out.push(["Where", fmt.escape([r.city, r.zip].filter(Boolean).join(" ") + (r.county ? " · " + r.county + " County" : ""))]);
    if (r.type !== "Not listed") out.push(["Type", r.type]);
    if (r.filings > 1) out.push(["Filings", plural(r.filings, "filing") + ' <span class="tx-muted">on DBPR’s lists</span>']);
    if (!r.located) out.push(["Map", '<span class="tx-muted">Not mapped: its building couldn’t be pinned down from the name, city and ZIP it filed</span>']);
    return out;
  }
  function projectsHtml(r, max) {
    max = max || 8;
    var list = r.projects.filter(function (p) { return p.toLowerCase() !== r.name.toLowerCase(); });
    var names = r.otherNames;
    var html = "";
    if (list.length) {
      html += '<div class="pm-jobs"><p class="pm-jobs-title">' + (list.length === 1 ? "Condo" : plural(list.length, "condo")) + "</p><ul>" +
        list.slice(0, max).map(function (p) { return "<li>" + fmt.escape(p) + "</li>"; }).join("") + "</ul>" +
        (list.length > max ? '<p class="tx-muted pm-more">+ ' + (list.length - max) + " more</p>" : "") + "</div>";
    }
    if (names.length) html += '<p class="sr-aka tx-muted">Also filed as ' + names.slice(0, 3).map(fmt.escape).join("; ") + (names.length > 3 ? " …" : "") + "</p>";
    return html;
  }
  function periodTag(r) {
    return '<span class="tx-tag"><i class="tx-swatch sr-swatch-' + r.period + '"></i>' + periodLabel(r.period) + "</span>";
  }
  function asOfText(data) {
    return "Condo and co-op associations in Miami-Dade, Broward and Palm Beach that have reported a structural integrity reserve study (SIRS) to Florida’s DBPR, from its two public lists (before July 2025, and July 2025 on)" +
      (data.generated ? ", combined " + new Date(data.generated + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "") +
      ". An association on both lists appears once. Names are as associations filed them. The lists have no street addresses, so locations come from the association or condo name, city and ZIP; the map shows only associations whose building was found.";
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

  global.SR = {
    MAPBOX_TOKEN: MAPBOX_TOKEN,
    PERIODS: PERIODS,
    PERIOD_IDS: PERIOD_IDS,
    COUNTIES: COUNTIES,
    TYPES: TYPES,
    fmt: fmt,
    plural: plural,
    nameCase: nameCase,
    load: load,
    normalize: normalize,
    defaultState: defaultState,
    stateFromUrl: stateFromUrl,
    resolveCity: resolveCity,
    filterCount: filterCount,
    isDefault: isDefault,
    clone: clone,
    apply: apply,
    periodLabel: periodLabel,
    tracker: tracker,
    link: link,
    filterBar: filterBar,
    activeChips: activeChips,
    searchBox: searchBox,
    searchHtml: searchHtml,
    facts: facts,
    projectsHtml: projectsHtml,
    periodTag: periodTag,
    asOfText: asOfText,
    theme: theme,
  };
})(window);
