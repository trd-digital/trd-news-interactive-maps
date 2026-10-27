/*!
 * cf-tracker.js — real estate money in Florida's 2026 races
 * (south-florida-campaign-real-estate.html): who in real estate gave, how
 * much, and to whom. Tabs: top donors, top recipients.
 * Depends on: TRD theme.js, cf-core.js (CF).
 */
(function () {
  "use strict";

  var fmt = CF.fmt;
  var track = CF.tracker("sofla-campaign-real-estate");
  var app = CF.root(document.currentScript);
  var params = new URLSearchParams(location.search);
  var LOOKUP = "south-florida-campaign-donor-lookup.html";

  var state = {
    tab: params.get("tab") === "recipients" ? "recipients" : "donors",
    where: params.get("where") === "sofla" ? "sofla" : "all",
    to: ["candidates", "committees"].indexOf(params.get("to")) >= 0 ? params.get("to") : "all",
    sector: CF.SECTOR[params.get("sector")] ? params.get("sector") : null,
    q: params.get("q") || "",
  };
  var data = null;

  CF.theme(null, track);

  var el = {
    kpis: app.querySelector(".cx-kpis"),
    sectors: app.querySelector(".cf-sectors"),
    controls: app.querySelector(".cf-controls"),
    tabs: app.querySelector(".tx-tabs"),
    summary: app.querySelector(".tx-summary"),
    host: app.querySelector(".cf-host"),
    loading: app.querySelector(".tx-loading"),
    asof: app.querySelector(".tx-asof"),
  };

  el.controls.innerHTML = CF.searchHtml("Search donors and recipients", window.innerWidth < 520 ? "Search names" : "Search a donor, company or candidate", state.q) +
    '<span class="cf-ctl"><span class="cf-label">Donors</span><span class="cf-chipset" data-key="where"></span></span>' +
    '<span class="cf-ctl"><span class="cf-label">Recipients</span><span class="cf-chipset" data-key="to"></span></span>';
  var input = el.controls.querySelector(".tx-search-input");
  input.addEventListener("input", CF.debounce(function () {
    state.q = input.value.trim();
    track("search", state.q);
    refresh();
  }, 200));
  el.controls.addEventListener("click", function (e) {
    var b = e.target.closest(".tx-chip");
    if (!b) return;
    state[b.getAttribute("data-group")] = b.getAttribute("data-value");
    track("filter", b.getAttribute("data-group") + ":" + b.getAttribute("data-value"));
    refresh();
  });
  el.sectors.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-sector]");
    if (!b) return;
    var s = b.getAttribute("data-sector");
    state.sector = state.sector === s ? null : s;
    track("sector", state.sector || "all");
    refresh();
  });
  el.tabs.addEventListener("click", function (e) {
    var b = e.target.closest(".tx-tab");
    if (!b) return;
    state.tab = b.getAttribute("data-tab");
    track("tab", state.tab);
    refresh();
  });

  // ------------------------------------------------------------------ tables
  function nameCell(title, sub) {
    return '<span class="cf-name">' + fmt.escape(title) + "</span>" + (sub ? '<span class="cf-sub">' + fmt.escape(sub) + "</span>" : "");
  }
  function amountCell(v) {
    return "<strong>" + fmt.moneyShort(v) + "</strong>";
  }
  function donorSub(d) {
    return [d.c, d.j].filter(Boolean).join(" · ");
  }
  var donorsNode = document.createElement("div"), recipsNode = document.createElement("div");
  var donorsTable = CF.table({
    el: donorsNode,
    id: function (r) { return "d" + r.i; },
    sort: { key: "total", dir: -1 },
    cols: [
      { key: "name", label: "Donor", html: function (r) { return nameCell(r.d.n, donorSub(r.d)); }, sort: function (r) { return r.d.n; } },
      { key: "sector", label: "Sector", wide: true, html: function (r) { return CF.sectorTag(r.d.s); }, sort: function (r) { return CF.SECTOR[r.d.s].short; } },
      { key: "gifts", label: "Gifts", num: true, wide: true, html: function (r) { return fmt.num(r.gifts); } },
      { key: "recips", label: "Recipients", num: true, wide: true, html: function (r) { return fmt.num(r.recips.size); }, sort: function (r) { return r.recips.size; } },
      { key: "total", label: "Total", num: true, html: function (r) { return amountCell(r.total); } },
    ],
    expand: function (r) {
      var list = Array.from(r.recips.entries()).sort(function (a, b) { return b[1] - a[1]; });
      return '<div class="cf-expand"><div><p class="cf-list-title">Gave to</p>' + list10(list.map(function (x) {
        var rc = data.recipients[x[0]];
        return [CF.recipName(rc), CF.recipLine(rc), x[1]];
      })) + "</div><div>" + '<dl class="tx-dl"><dt>Sector</dt><dd>' + CF.sectorTag(r.d.s) + "</dd>" +
        "<dt>First gift</dt><dd>" + fmt.date(CF.dayToISO(data.start, r.first)) + "</dd><dt>Latest gift</dt><dd>" + fmt.date(CF.dayToISO(data.start, r.last)) + "</dd>" +
        (r.d.z ? "<dt>ZIP code</dt><dd>" + fmt.escape(r.d.z) + "</dd>" : "") + "</dl>" +
        '<div class="tx-actions"><a class="tx-btn" target="_blank" rel="noopener" href="' + LOOKUP + "?donor=" + encodeURIComponent(r.d.n) + (r.d.z ? "&zip=" + r.d.z : "") +
        '">See every gift ↗</a></div></div></div>';
    },
    empty: emptyText,
    onSort: function (k) { track("sort", k); },
    onExpand: function (id) { track("expand", id); },
  });
  var recipsTable = CF.table({
    el: recipsNode,
    id: function (r) { return "r" + r.i; },
    sort: { key: "total", dir: -1 },
    cols: [
      { key: "name", label: "Recipient", html: function (r) { return nameCell(CF.recipName(r.r), CF.recipLine(r.r)); }, sort: function (r) { return r.r.n; } },
      { key: "donors", label: "Real estate donors", num: true, wide: true, html: function (r) { return fmt.num(r.donors.size); }, sort: function (r) { return r.donors.size; } },
      { key: "gifts", label: "Gifts", num: true, wide: true, html: function (r) { return fmt.num(r.gifts); } },
      { key: "total", label: "From real estate", num: true, html: function (r) { return amountCell(r.total); } },
    ],
    expand: function (r) {
      var list = Array.from(r.donors.entries()).sort(function (a, b) { return b[1] - a[1]; });
      var parts = CF.SECTORS.map(function (s) { return { id: s.id, label: s.label, value: r.bySector[s.id] || 0 }; });
      return '<div class="cf-expand"><div><p class="cf-list-title">Top real estate donors</p>' + list10(list.map(function (x) {
        var d = data.donors[x[0]];
        return [d.n, [CF.SECTOR[d.s].short, d.c].filter(Boolean).join(" · "), x[1]];
      })) + '</div><div><p class="cf-list-title">By sector</p>' + CF.mixBar(parts, r.total) +
        '<ul class="cf-list" style="margin-top:8px">' + parts.filter(function (p) { return p.value; }).sort(function (a, b) { return b.value - a.value; }).map(function (p) {
          return '<li><span class="cf-li-main">' + CF.sectorTag(p.id) + '</span><span class="cf-li-amt">' + fmt.moneyShort(p.value) + "</span></li>";
        }).join("") + "</ul>" +
        '<div class="tx-actions"><a class="tx-btn" target="_blank" rel="noopener" href="' + LOOKUP + "?recipient=" + encodeURIComponent(r.r.n) + '">See every gift ↗</a></div></div></div>';
    },
    empty: emptyText,
    onSort: function (k) { track("sort", k); },
    onExpand: function (id) { track("expand", id); },
  });
  function list10(items) {
    var html = '<ul class="cf-list">' + items.slice(0, 10).map(function (x) {
      return '<li><span class="cf-li-main">' + fmt.escape(x[0]) + (x[1] ? ' <span class="tx-muted">' + fmt.escape(x[1]) + "</span>" : "") +
        '</span><span class="cf-li-amt">' + fmt.moneyShort(x[2]) + "</span></li>";
    }).join("") + "</ul>";
    return html + (items.length > 10 ? '<p class="cf-more">+ ' + CF.plural(items.length - 10, "more") + "</p>" : "");
  }
  function emptyText() {
    return state.q ? "No real estate donors or recipients match “" + fmt.escape(state.q) + "” with these filters." : "Nothing matches these filters.";
  }

  // ------------------------------------------------------------------ data
  function passDonor(d) {
    if (state.where === "sofla" && !d.f) return false;
    if (state.sector && d.s !== state.sector) return false;
    return true;
  }
  function passRecip(r) {
    if (state.to === "candidates") return r.k === "c";
    if (state.to === "committees") return r.k === "p";
    return true;
  }
  function aggregate() {
    var q = CF.norm(state.q);
    var byD = new Map(), byR = new Map(), total = 0, sofla = 0, bySector = {};
    var all = { total: 0, bySector: {} };
    data.gifts.forEach(function (g) {
      var d = data.donors[g[0]], r = data.recipients[g[1]];
      if (!passRecip(r)) return;
      if (state.where === "sofla" && !d.f) return;
      all.total += g[3];
      all.bySector[d.s] = (all.bySector[d.s] || 0) + g[3];
      if (state.sector && d.s !== state.sector) return;
      if (q && data.dn[g[0]].indexOf(q) < 0 && data.rn[g[1]].indexOf(q) < 0) return;
      total += g[3];
      if (d.f) sofla += g[3];
      bySector[d.s] = (bySector[d.s] || 0) + g[3];
      var a = byD.get(g[0]);
      if (!a) byD.set(g[0], a = { i: g[0], d: d, total: 0, gifts: 0, recips: new Map(), first: g[2], last: g[2] });
      a.total += g[3];
      a.gifts++;
      a.recips.set(g[1], (a.recips.get(g[1]) || 0) + g[3]);
      if (g[2] < a.first) a.first = g[2];
      if (g[2] > a.last) a.last = g[2];
      var b = byR.get(g[1]);
      if (!b) byR.set(g[1], b = { i: g[1], r: r, total: 0, gifts: 0, donors: new Map(), bySector: {} });
      b.total += g[3];
      b.gifts++;
      b.donors.set(g[0], (b.donors.get(g[0]) || 0) + g[3]);
      b.bySector[d.s] = (b.bySector[d.s] || 0) + g[3];
    });
    return { donors: Array.from(byD.values()), recips: Array.from(byR.values()), total: total, sofla: sofla, bySector: bySector, all: all };
  }

  function refresh() {
    if (!data) return;
    var a = aggregate();
    var unfiltered = !state.q && !state.sector;
    el.kpis.innerHTML =
      CF.kpi("From real estate", fmt.moneyShort(a.total), unfiltered && state.where === "all" && state.to === "all" ? fmt.pct(a.total, data.all) + " of all " + fmt.moneyShort(data.all) + " given" : "With these filters",
        a.total ? CF.mixBar(CF.SECTORS.map(function (s) { return { id: s.id, label: s.label, value: a.bySector[s.id] || 0 }; }), a.total) : "") +
      CF.kpi("From South Florida", fmt.moneyShort(a.sofla), fmt.pct(a.sofla, a.total) + " of it, by donor ZIP code") +
      CF.kpi("Donors", fmt.num(a.donors.length), a.donors.length ? "Largest: " + fmt.escape(top(a.donors).d.n) : "") +
      CF.kpi("Recipients", fmt.num(a.recips.length), a.recips.length ? "Largest: " + fmt.escape(top(a.recips).r.n) : "");

    var secTotal = state.sector ? a.all.total : a.total;
    el.sectors.innerHTML = CF.SECTORS.map(function (s) {
      var v = (state.sector ? a.all.bySector : a.bySector)[s.id] || 0;
      var on = state.sector === s.id;
      return '<li><button type="button" data-sector="' + s.id + '" class="' + (on ? "is-active" : "") + '" aria-pressed="' + on + '">' +
        '<i class="tx-swatch cf-swatch-' + s.id + '"></i><span title="' + s.label + '">' + s.short + '</span><span class="cf-s-amt">' + fmt.moneyShort(v) +
        '</span><span class="cf-s-pct">' + fmt.pct(v, secTotal) + "</span></button></li>";
    }).join("");

    el.controls.querySelector('[data-key="where"]').innerHTML = CF.chips("where", [{ id: "all", label: "Everywhere" }, { id: "sofla", label: "South Florida" }], state.where);
    el.controls.querySelector('[data-key="to"]').innerHTML = CF.chips("to", [{ id: "all", label: "All" }, { id: "candidates", label: "Candidates" }, { id: "committees", label: "PACs and parties" }], state.to);

    el.tabs.querySelectorAll(".tx-tab").forEach(function (b) {
      var on = b.getAttribute("data-tab") === state.tab;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });
    var list = state.tab === "donors" ? a.donors : a.recips;
    el.summary.innerHTML = "<strong>" + CF.plural(list.length, state.tab === "donors" ? "donor" : "recipient") + "</strong>" +
      (state.sector ? " · " + fmt.escape(CF.SECTOR[state.sector].label) : "") + (state.where === "sofla" ? " · South Florida donors" : "");
    var node = state.tab === "donors" ? donorsNode : recipsNode;
    if (el.host.firstChild !== node) {
      el.host.innerHTML = "";
      el.host.appendChild(node);
    }
    (state.tab === "donors" ? donorsTable : recipsTable).set(list);
  }
  function top(list) {
    return list.reduce(function (m, r) { return !m || r.total > m.total ? r : m; }, null);
  }

  CF.load("cf-realestate").then(function (d) {
    data = d;
    data.dn = d.donors.map(function (x) { return CF.norm(x.n); });
    data.rn = d.recipients.map(function (x) { return CF.norm(x.n); });
    el.loading.hidden = true;
    el.asof.innerHTML = fmt.escape(CF.asOfText(d, "Real estate donors are identified by occupation and company name, so some are missed and a few may be misread. " +
      "Money from PACs and industry groups was often raised from members, so some dollars appear twice: once given to the PAC, again when the PAC gives it."));
    refresh();
    CF.gtmOnLoad();
    track("loaded", d.gifts.length);
  }).catch(function () {
    el.loading.innerHTML = "<span>The campaign data couldn’t load. Please try again later.</span>";
  });
})();
