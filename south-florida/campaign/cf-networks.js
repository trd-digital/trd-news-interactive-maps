/*!
 * cf-networks.js — South Florida addresses that many donor companies share
 * (south-florida-campaign-llc-networks.html). Developers often give through
 * many LLCs registered to one office; so do law firms and tenants of one
 * tower. Each row is an address; expand it for its companies, where their
 * money went and same-day bundles.
 * Depends on: TRD theme.js, cf-core.js (CF).
 */
(function () {
  "use strict";

  var fmt = CF.fmt;
  var track = CF.tracker("sofla-campaign-llc-networks");
  var app = CF.root(document.currentScript);
  var params = new URLSearchParams(location.search);
  var LOOKUP = "south-florida-campaign-donor-lookup.html";
  var COUNTIES = ["Miami-Dade", "Broward", "Palm Beach"];

  var state = {
    q: params.get("q") || "",
    kind: params.get("q") ? "all" : params.get("kind") === "all" ? "all" : "re",
    county: COUNTIES.indexOf(params.get("county")) >= 0 ? params.get("county") : "",
  };
  var data = null;

  CF.theme(null, track);

  var el = {
    kpis: app.querySelector(".cx-kpis"),
    controls: app.querySelector(".cf-controls"),
    summary: app.querySelector(".tx-summary"),
    host: app.querySelector(".cf-host"),
    loading: app.querySelector(".tx-loading"),
    asof: app.querySelector(".tx-asof"),
  };
  el.controls.innerHTML = CF.searchHtml("Search addresses and companies", window.innerWidth < 520 ? "Address or company" : "Search an address, company or city", state.q) +
    '<span class="cf-chipset" data-key="kind"></span>' +
    '<select class="cf-select" aria-label="County"><option value="">All three counties</option>' +
    COUNTIES.map(function (c) { return '<option value="' + c + '"' + (state.county === c ? " selected" : "") + ">" + c + "</option>"; }).join("") + "</select>";
  var input = el.controls.querySelector(".tx-search-input");
  input.addEventListener("input", CF.debounce(function () {
    state.q = input.value.trim();
    track("search", state.q);
    refresh();
  }, 200));
  el.controls.addEventListener("click", function (e) {
    var b = e.target.closest(".tx-chip");
    if (!b) return;
    state.kind = b.getAttribute("data-value");
    track("filter", "kind:" + state.kind);
    refresh();
  });
  el.controls.querySelector(".cf-select").addEventListener("change", function (e) {
    state.county = e.target.value;
    track("filter", "county:" + (state.county || "all"));
    refresh();
  });

  function isRE(a) {
    return a.re * 2 >= a.n;
  }
  var table = CF.table({
    el: el.host,
    id: function (a) { return a.id; },
    sort: { key: "n", dir: -1 },
    cols: [
      { key: "a", label: "Address", html: function (a) {
        return '<span class="cf-name">' + fmt.escape(a.a) + '</span><span class="cf-sub">' + fmt.escape(a.c + ", " + a.z + (a.co ? " · " + a.co : "")) + "</span>";
      } },
      { key: "n", label: "Companies", num: true, html: function (a) { return "<strong>" + fmt.num(a.n) + "</strong>"; } },
      { key: "re", label: "Real estate", num: true, wide: true, html: function (a) { return a.re ? fmt.num(a.re) : '<span class="cx-dim">—</span>'; } },
      { key: "gc", label: "Gifts", num: true, wide: true, html: function (a) { return fmt.num(a.gc); } },
      { key: "t", label: "Total given", num: true, html: function (a) { return "<strong>" + fmt.moneyShort(a.t) + "</strong>"; } },
    ],
    expand: expand,
    empty: function () { return state.q ? "No shared addresses match “" + fmt.escape(state.q) + "”" + (state.kind === "re" ? ' with mostly real estate companies. <button type="button" class="tx-reset" data-all>Search all addresses</button>' : ".") : "No addresses match these filters."; },
    onSort: function (k) { track("sort", k); },
    onExpand: function (id) { track("expand", id); },
  });
  el.host.addEventListener("click", function (e) {
    if (!e.target.closest("[data-all]")) return;
    state.kind = "all";
    refresh();
  });

  function day(n) {
    return fmt.date(CF.dayToISO(data.start, n));
  }
  function recip(i) {
    return data.recipients[i];
  }
  function expand(a) {
    var shown = a.e.slice(0, 25);
    var ents = '<ul class="cf-list">' + shown.map(function (e) {
      var when = e.d0 === e.d1 ? day(e.d0) : day(e.d0) + " – " + day(e.d1);
      var name = e.s ? '<a href="' + LOOKUP + "?donor=" + encodeURIComponent(e.n) + '" target="_blank" rel="noopener" class="cf-link">' + fmt.escape(e.n) + "</a>"
        : '<span class="cf-name">' + fmt.escape(e.n) + "</span>";
      return '<li><span class="cf-li-main">' + name +
        (e.s ? " " + CF.sectorTag(e.s) : "") + '<span class="cf-sub">' + CF.plural(e.g, "gift") + " · " + when +
        (e.r.length ? " · to " + fmt.escape(e.r.slice(0, 2).map(function (i) { return recip(i).n; }).join(", ")) + (e.r.length > 2 ? " and others" : "") : "") +
        '</span></span><span class="cf-li-amt">' + fmt.moneyShort(e.t) + "</span></li>";
    }).join("") + "</ul>" + (a.e.length > shown.length ? '<p class="cf-more">+ ' + CF.plural(a.e.length - shown.length, "more company", "more companies") + "</p>" : "");
    var recips = '<ul class="cf-list">' + a.r.slice(0, 10).map(function (x) {
      var r = recip(x[0]);
      return '<li><span class="cf-li-main">' + fmt.escape(CF.recipName(r)) + ' <span class="tx-muted">' + fmt.escape(CF.recipLine(r)) + '</span></span><span class="cf-li-amt">' + fmt.moneyShort(x[1]) + "</span></li>";
    }).join("") + "</ul>" + (a.r.length > 10 ? '<p class="cf-more">+ ' + CF.plural(a.r.length - 10, "more recipient") + "</p>" : "");
    var bundles = a.b.length ? '<p class="cf-list-title" style="margin-top:14px">Same-day gifts</p><ul class="cf-list">' + a.b.map(function (b) {
      return '<li><span class="cf-li-main">' + CF.plural(b[2], "company", "companies") + " gave to " + fmt.escape(CF.recipName(recip(b[0]))) + " on " + day(b[1]) + "</span></li>";
    }).join("") + "</ul>" : "";
    return '<div class="cf-expand"><div><p class="cf-list-title">Companies at this address</p>' + ents + "</div>" +
      '<div><p class="cf-list-title">Where the money went</p>' + recips + bundles + "</div></div>";
  }

  function refresh() {
    if (!data) return;
    var n = CF.norm(state.q);
    var list = data.addresses.filter(function (a) {
      if (state.kind === "re" && !isRE(a)) return false;
      if (state.county && a.co !== state.county) return false;
      if (n && a.search.indexOf(n) < 0) return false;
      return true;
    });
    var companies = list.reduce(function (s, a) { return s + a.n; }, 0);
    var total = list.reduce(function (s, a) { return s + a.t; }, 0);
    var best = null;
    list.forEach(function (a) { a.b.forEach(function (b) { if (!best || b[2] > best.b[2]) best = { a: a, b: b }; }); });
    el.kpis.innerHTML =
      CF.kpi("Addresses", fmt.num(list.length), "Each shared by 5+ donor companies") +
      CF.kpi("Companies", fmt.num(companies), "Giving from those addresses") +
      CF.kpi("Given", fmt.moneyShort(total), "To candidates, PACs and parties") +
      CF.kpi("Largest same-day bundle", best ? CF.plural(best.b[2], "company", "companies") : "—",
        best ? "To " + fmt.escape(recip(best.b[0]).n) + ", " + fmt.date(CF.dayToISO(data.start, best.b[1]), { month: "short", day: "numeric" }) : "");
    el.controls.querySelector('[data-key="kind"]').innerHTML = CF.chips("kind", [{ id: "re", label: "Mostly real estate" }, { id: "all", label: "All addresses" }], state.kind);
    el.summary.innerHTML = "<strong>" + CF.plural(list.length, "address", "addresses") + "</strong>" + (state.kind === "re" ? " where most donor companies are in real estate" : "");
    table.set(list);
    if (n && list.length === 1) table.open(list[0].id);
  }

  CF.load("cf-networks").then(function (d) {
    data = d;
    d.addresses.forEach(function (a, i) {
      a.id = "a" + i;
      a.search = CF.norm([a.a, a.c, a.z].concat(a.e.map(function (e) { return e.n; })).join(" "));
    });
    el.loading.hidden = true;
    el.asof.innerHTML = fmt.escape(CF.asOfText(d, "Addresses are as donors listed them, with suite numbers removed. Sharing an address doesn’t by itself mean companies share an owner: many are tenants of one office building, clients of one law firm or registered agent, or units of one company.")) ;
    refresh();
    CF.gtmOnLoad();
    track("loaded", d.addresses.length);
  }).catch(function () {
    el.loading.innerHTML = "<span>The campaign data couldn’t load. Please try again later.</span>";
  });
})();
