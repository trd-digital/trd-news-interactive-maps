/*!
 * cf-core.js — shared runtime for the South Florida campaign-money
 * interactives (south-florida-campaign-*.html).
 *
 * Owns: loading the data files that _campaign/build_campaign.py writes from
 * the Florida Division of Elections exports, formatting, sector and party
 * labels, the sortable table + pager, KPIs, theme and analytics.
 *
 * Styling: transactions/tx.css (shared look) + construction/cx.css + cf.css.
 */
(function (global) {
  "use strict";

  var BASE = (function () {
    var s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/[^/]*$/, "") : "campaign/";
  })();

  // ------------------------------------------------------------------ format
  function trim(x, digits) {
    return (+x.toFixed(digits)).toString();
  }
  var fmt = {
    escape: function (s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    },
    money: function (n) {
      if (n == null || !isFinite(n)) return "—";
      return "$" + Math.round(n).toLocaleString("en-US");
    },
    moneyShort: function (n) {
      if (n == null || !isFinite(n)) return "—";
      var a = Math.abs(n);
      if (a >= 1e9) return "$" + trim(n / 1e9, 1) + "B";
      if (a >= 1e6) return "$" + trim(n / 1e6, a >= 1e8 ? 0 : 1) + "M";
      if (a >= 1e4) return "$" + Math.round(n / 1e3) + "K";
      if (a >= 1e3) return "$" + trim(n / 1e3, 1) + "K";
      return "$" + Math.round(n);
    },
    num: function (n) {
      return n == null || !isFinite(n) ? "—" : Math.round(n).toLocaleString("en-US");
    },
    pct: function (part, whole) {
      if (!whole) return "—";
      var p = (part / whole) * 100;
      return (p > 0 && p < 1 ? "<1" : Math.round(p)) + "%";
    },
    date: function (iso, opts) {
      var d = parseISO(iso);
      return d ? d.toLocaleDateString("en-US", opts || { month: "short", day: "numeric", year: "numeric" }) : "—";
    },
  };
  function parseISO(iso) {
    if (!iso) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  // Gifts carry days since the data's start date (Jan 1, 2025).
  function dayToISO(start, n) {
    var d = parseISO(start);
    d.setDate(d.getDate() + n);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function plural(n, one, many) {
    return n.toLocaleString("en-US") + " " + (n === 1 ? one : many || one + "s");
  }

  // ------------------------------------------------------------------ labels
  // Fixed categorical order (the tx.css palette, both themes validated);
  // cf.css defines --cf-<id>.
  var SECTORS = [
    { id: "groups", label: "Industry groups and PACs", short: "Industry groups" },
    { id: "developers", label: "Developers and investors", short: "Developers" },
    { id: "other", label: "Other real estate", short: "Other real estate" },
    { id: "realtors", label: "Realtors and brokers", short: "Realtors" },
    { id: "property", label: "Landlords and property managers", short: "Landlords, managers" },
    { id: "builders", label: "Homebuilders", short: "Homebuilders" },
  ];
  var SECTOR = {};
  SECTORS.forEach(function (s) { SECTOR[s.id] = s; });
  function sectorTag(id) {
    var s = SECTOR[id];
    return s ? '<span class="tx-cat cf-sector"><i class="tx-swatch cf-swatch-' + id + '"></i>' + s.short + "</span>" : "";
  }
  var PARTY = { R: "Republican", D: "Democrat", NPA: "No party", L: "Libertarian", I: "Independent", Nonpartisan: "Nonpartisan" };
  // "Byron Donalds (R) · Governor" / "Friends of Byron Donalds PAC · Political committee"
  function recipLine(r) {
    if (!r) return "";
    if (r.k === "c") return (r.p && r.p !== "Nonpartisan" ? r.p + " · " : "") + r.o;
    return r.t;
  }
  function recipName(r) {
    return r ? r.n + (r.k === "c" && r.p && r.p !== "Nonpartisan" ? " (" + r.p + ")" : "") : "";
  }

  // ---------------------------------------------------------------- loading
  var cache = {};
  function load(name) {
    if (!cache[name]) {
      var url = BASE + name + ".json";
      var dev = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).get("data");
      cache[name] = fetch(dev ? dev.replace("{name}", name) : url).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      });
    }
    return cache[name];
  }
  function asOfText(d, extra) {
    var c = d.asOf.candidate, p = d.asOf.committee;
    var through = c === p ? fmt.date(c) : "candidates " + fmt.date(c) + ", committees " + fmt.date(p);
    return "Source: Florida Division of Elections campaign finance reports, contributions dated Jan. 1, 2025, through " + through +
      ". Refunds, loans and interest aren’t counted. Donors are grouped by name as filed (and by ZIP code for people)." + (extra ? " " + extra : "");
  }

  // ---------------------------------------------------------------- analytics
  function tracker(category) {
    return function (action, label) {
      if (!global.dataLayer) return;
      global.dataLayer.push({ event: "event_tracking", trd: { category: category, action: action, label: label == null ? "" : String(label) } });
    };
  }
  function gtmOnLoad() {
    if (global.__cfLoadGtm) global.__cfLoadGtm();
  }

  // ------------------------------------------------------------------ theme
  // TRD's theme.js init() asks the parent page and sets <body data-bs-theme>;
  // mirror it onto <html> (tokens live on :root).
  var themeApi = null, listeners = [];
  function theme(onChange, track) {
    if (onChange) listeners.push(onChange);
    if (themeApi) return themeApi;
    var current = null;
    function set(t) {
      if (t !== "dark" && t !== "light") return;
      var changed = t !== current;
      current = t;
      document.documentElement.setAttribute("data-bs-theme", t);
      document.body.setAttribute("data-bs-theme", t);
      if (changed) listeners.forEach(function (f) { f(t); });
    }
    // theme.js declares `const TrdTheme` (a global binding, not a window property).
    var trd = typeof TrdTheme === "function"
      ? TrdTheme({ updateCallback: function (t) { set(t); if (track) track("theme", t); } }) // eslint-disable-line no-undef
      : null;
    if (trd) trd.init();
    current = (trd && trd.get()) || (global.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-bs-theme", current);
    document.body.setAttribute("data-bs-theme", current);
    themeApi = { get: function () { return current; } };
    return themeApi;
  }

  // -------------------------------------------------------------------- KPIs
  function kpi(label, value, sub, extra) {
    return '<div class="cx-kpi"><span class="cx-kpi-label">' + label + '</span><span class="cx-kpi-value">' + value + "</span>" +
      '<span class="cx-kpi-sub">' + (sub || "&nbsp;") + "</span>" + (extra || "") + "</div>";
  }
  // Stacked bar of parts [{id, value, label}] (2px gaps come from cf.css).
  function mixBar(parts, total) {
    return '<span class="cx-mix cf-mix" aria-hidden="true">' + parts.filter(function (p) { return p.value > 0; }).map(function (p) {
      return '<i style="width:' + (p.value / total * 100).toFixed(2) + "%;background:var(--cf-" + p.id + ')" title="' +
        fmt.escape(p.label + ": " + fmt.moneyShort(p.value)) + '"></i>';
    }).join("") + "</span>";
  }

  // ------------------------------------------------------------------ table
  // A sortable, paged table with expandable rows. Phones keep the table and
  // drop the columns marked `wide`.
  //   cols: [{key, label, num, desc (sorts high-first), wide, html(row), sort(row)}]
  //   o: {el, cols, pageSize, expand(row) -> html, id(row), sort: {key, dir}, empty, onSort, onExpand}
  function table(o) {
    var rows = [], page = 0, openId = null, sort = o.sort || { key: o.cols[0].key, dir: -1 };
    var pageSize = o.pageSize || 25;
    o.el.innerHTML = '<div class="cf-table-wrap"><table class="tx-table cf-table"><thead></thead><tbody></tbody></table></div><div class="tx-pager cf-pager"></div>';
    var thead = o.el.querySelector("thead"), tbody = o.el.querySelector("tbody"), pager = o.el.querySelector(".cf-pager");
    function val(r, c) {
      return c.sort ? c.sort(r) : r[c.key];
    }
    function sorted() {
      var c = o.cols.find(function (x) { return x.key === sort.key; }) || o.cols[0];
      return rows.slice().sort(function (a, b) {
        var va = val(a, c), vb = val(b, c);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        var r = typeof va === "string" ? va.localeCompare(vb) : va < vb ? -1 : va > vb ? 1 : 0;
        return r * sort.dir;
      });
    }
    function cls(c) {
      var k = [c.num ? "num" : "", c.wide ? "cf-wide" : "", c.cls || ""].join(" ").trim();
      return k ? ' class="' + k + '"' : "";
    }
    function render() {
      var list = sorted();
      var pages = Math.max(1, Math.ceil(list.length / pageSize));
      if (page >= pages) page = pages - 1;
      thead.innerHTML = "<tr>" + o.cols.map(function (c) {
        var on = sort.key === c.key;
        return "<th scope=\"col\"" + cls(c) + (on ? ' aria-sort="' + (sort.dir < 0 ? "descending" : "ascending") + '"' : "") +
          (c.nosort ? ">" + c.label : '><button type="button" data-sort="' + c.key + '">' + c.label + '<span class="tx-sort-ind" aria-hidden="true">' + (on ? (sort.dir < 0 ? "▼" : "▲") : "") + "</span></button>") + "</th>";
      }).join("") + "</tr>";
      var slice = list.slice(page * pageSize, (page + 1) * pageSize);
      if (!slice.length) {
        tbody.innerHTML = '<tr><td class="tx-empty" colspan="' + o.cols.length + '">' + (o.empty ? o.empty() : "Nothing matches.") + "</td></tr>";
      } else {
        tbody.innerHTML = slice.map(function (r) {
          var id = o.id(r), open = id === openId;
          var tr = '<tr class="tx-row' + (o.expand ? "" : " cf-static") + (open ? " is-open" : "") + '" data-id="' + fmt.escape(id) + '"' +
            (o.expand ? ' tabindex="0" aria-expanded="' + open + '"' : "") + ">" +
            o.cols.map(function (c) { return "<td" + cls(c) + ">" + c.html(r) + "</td>"; }).join("") + "</tr>";
          if (open) tr += '<tr class="tx-expand"><td colspan="' + o.cols.length + '">' + o.expand(r) + "</td></tr>";
          return tr;
        }).join("");
      }
      var from = list.length ? page * pageSize + 1 : 0, to = Math.min(list.length, (page + 1) * pageSize);
      pager.hidden = list.length <= pageSize;
      pager.innerHTML = "<span>" + from.toLocaleString("en-US") + "–" + to.toLocaleString("en-US") + " of " + list.length.toLocaleString("en-US") + "</span>" +
        '<nav class="tx-pages" aria-label="Pages"><button type="button" class="tx-chip" data-page="' + (page - 1) + '"' + (page === 0 ? " disabled" : "") +
        ' aria-label="Previous page">‹</button>' + pageNumbers(page, pages).map(function (n) {
          return n === "…" ? '<span class="tx-muted" aria-hidden="true">…</span>'
            : '<button type="button" class="tx-chip' + (n === page ? " is-active" : "") + '" data-page="' + n + '"' + (n === page ? ' aria-current="page"' : "") + ">" + (n + 1) + "</button>";
        }).join("") + '<button type="button" class="tx-chip" data-page="' + (page + 1) + '"' + (page >= pages - 1 ? " disabled" : "") + ' aria-label="Next page">›</button></nav>';
    }
    thead.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-sort]");
      if (!b) return;
      var k = b.getAttribute("data-sort");
      var c = o.cols.find(function (x) { return x.key === k; });
      sort = sort.key === k ? { key: k, dir: -sort.dir } : { key: k, dir: c.num || c.desc ? -1 : 1 };
      page = 0;
      if (o.onSort) o.onSort(k);
      render();
    });
    function toggle(id) {
      openId = openId === id ? null : id;
      if (openId && o.onExpand) o.onExpand(id);
      render();
    }
    tbody.addEventListener("click", function (e) {
      if (!o.expand || e.target.closest("a, button, .tx-expand")) return;
      var tr = e.target.closest("tr.tx-row");
      if (tr) toggle(tr.getAttribute("data-id"));
    });
    tbody.addEventListener("keydown", function (e) {
      var tr = e.target.closest("tr.tx-row");
      if (!o.expand || !tr || e.target !== tr || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      var id = tr.getAttribute("data-id");
      toggle(id);
      var again = tbody.querySelector('tr.tx-row[data-id="' + cssEscape(id) + '"]');
      if (again) again.focus();
    });
    pager.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-page]");
      if (!b || b.disabled) return;
      page = +b.getAttribute("data-page");
      openId = null;
      render();
      var y = o.el.getBoundingClientRect().top + window.scrollY - 70;
      if (o.el.getBoundingClientRect().top < 0) window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    });
    return {
      set: function (list, keepPage) {
        rows = list;
        if (!keepPage) { page = 0; openId = null; }
        render();
      },
      sortBy: function (k, dir) { sort = { key: k, dir: dir }; },
      open: function (id) {
        var list = sorted(), i = list.findIndex(function (r) { return o.id(r) === id; });
        if (i < 0) return;
        page = Math.floor(i / pageSize);
        openId = id;
        render();
      },
      render: render,
    };
  }
  function pageNumbers(p, n) {
    if (n <= 7) return Array.from({ length: n }, function (_, i) { return i; });
    var out = [0], a = Math.max(1, p - 1), b = Math.min(n - 2, p + 1);
    if (a > 1) out.push("…");
    for (var i = a; i <= b; i++) out.push(i);
    if (b < n - 2) out.push("…");
    out.push(n - 1);
    return out;
  }
  function cssEscape(s) {
    return global.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"');
  }

  // Chip group: [{id, label}] -> html; one active value.
  function chips(group, items, active) {
    return '<div class="tx-chips" role="group">' + items.map(function (it) {
      var on = it.id === active;
      return '<button type="button" class="tx-chip' + (on ? " is-active" : "") + '" data-group="' + group + '" data-value="' + fmt.escape(it.id) +
        '" aria-pressed="' + on + '">' + it.label + "</button>";
    }).join("") + "</div>";
  }
  function searchHtml(label, placeholder, q) {
    return '<label class="tx-search"><span class="tx-sr">' + fmt.escape(label) + "</span>" +
      '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4.5 4.5" /></svg>' +
      '<input class="tx-search-input" type="search" autocomplete="off" spellcheck="false" placeholder="' + fmt.escape(placeholder) + '" value="' + fmt.escape(q || "") + '" /></label>';
  }
  // Case- and punctuation-insensitive match.
  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }
  function debounce(f, ms) {
    var t = null;
    return function () {
      var a = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { f.apply(self, a); }, ms);
    };
  }
  function root(script) {
    var id = (script && script.getAttribute("data-root")) || "tx-app";
    return document.getElementById(id);
  }

  global.CF = {
    BASE: BASE,
    MAPBOX_TOKEN: "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ",
    fmt: fmt,
    plural: plural,
    dayToISO: dayToISO,
    SECTORS: SECTORS,
    SECTOR: SECTOR,
    PARTY: PARTY,
    sectorTag: sectorTag,
    recipLine: recipLine,
    recipName: recipName,
    load: load,
    asOfText: asOfText,
    tracker: tracker,
    gtmOnLoad: gtmOnLoad,
    theme: theme,
    kpi: kpi,
    mixBar: mixBar,
    table: table,
    chips: chips,
    searchHtml: searchHtml,
    norm: norm,
    debounce: debounce,
    root: root,
  };
})(window);
