/*!
 * cf-lookup.js — real estate donor lookup
 * (south-florida-campaign-donor-lookup.html): search a company, person or
 * candidate and see each gift. With no search, the largest and latest
 * real estate gifts.
 * Depends on: TRD theme.js, cf-core.js (CF).
 */
(function () {
  "use strict";

  var fmt = CF.fmt;
  var track = CF.tracker("sofla-campaign-donor-lookup");
  var app = CF.root(document.currentScript);
  var params = new URLSearchParams(location.search);
  var NETWORKS = "south-florida-campaign-llc-networks.html";

  var data = null, networks = null;
  // view: {kind: "home"|"results"|"donor"|"recipient", ...}
  var view = { kind: "home", tab: "largest" };
  var q = params.get("q") || "";

  CF.theme(null, track);

  var el = {
    controls: app.querySelector(".cf-controls"),
    head: app.querySelector(".cf-head"),
    toolbar: app.querySelector(".tx-toolbar"),
    tabs: app.querySelector(".tx-tabs"),
    summary: app.querySelector(".tx-summary"),
    host: app.querySelector(".cf-host"),
    loading: app.querySelector(".tx-loading"),
    asof: app.querySelector(".tx-asof"),
  };
  el.controls.innerHTML = CF.searchHtml("Search real estate donors", window.innerWidth < 520 ? "Company, person or candidate" : "Search a company, person or candidate (e.g., 13th Floor, Lennar)", q);
  var input = el.controls.querySelector(".tx-search-input");
  input.addEventListener("input", CF.debounce(function () {
    q = input.value.trim();
    view = q.length >= 2 ? { kind: "results" } : { kind: "home", tab: "largest" };
    if (q.length >= 2) track("search", q);
    render();
  }, 220));
  el.tabs.addEventListener("click", function (e) {
    var b = e.target.closest(".tx-tab");
    if (!b) return;
    view = { kind: "home", tab: b.getAttribute("data-tab") };
    track("tab", view.tab);
    render();
  });

  // ------------------------------------------------------------------ tables
  function nameCell(title, sub) {
    return '<span class="cf-name">' + fmt.escape(title) + "</span>" + (sub ? '<span class="cf-sub">' + fmt.escape(sub) + "</span>" : "");
  }
  function donorBtn(i) {
    var d = data.donors[i];
    return '<button type="button" class="cf-link" data-donor="' + i + '">' + fmt.escape(d.n) + "</button>" +
      '<span class="cf-sub">' + fmt.escape([CF.SECTOR[d.s].short, d.c].filter(Boolean).join(" · ")) + "</span>";
  }
  function recipBtn(i) {
    var r = data.recipients[i];
    return '<button type="button" class="cf-link" data-recip="' + i + '">' + fmt.escape(CF.recipName(r)) + "</button>" +
      '<span class="cf-sub">' + fmt.escape(CF.recipLine(r)) + "</span>";
  }
  function dateOf(g) {
    return CF.dayToISO(data.start, g[2]);
  }
  var giftCols = {
    date: { key: "date", label: "Date", num: false, html: function (g) { return '<span class="tx-nowrap">' + fmt.date(dateOf(g)) + "</span>"; }, sort: function (g) { return g[2]; } },
    donor: { key: "donor", label: "Donor", html: function (g) { return donorBtn(g[0]); }, sort: function (g) { return data.donors[g[0]].n; } },
    recip: { key: "recip", label: "Recipient", html: function (g) { return recipBtn(g[1]); }, sort: function (g) { return data.recipients[g[1]].n; } },
    amount: { key: "amount", label: "Amount", num: true, html: function (g) { return "<strong>" + fmt.money(g[3]) + "</strong>"; }, sort: function (g) { return g[3]; } },
  };
  function giftId(g) {
    return g[0] + "-" + g[1] + "-" + g[2];
  }
  var nodes = {}, tables = {};
  function makeTable(name, cols, sort, extra) {
    nodes[name] = document.createElement("div");
    tables[name] = CF.table(Object.assign({ el: nodes[name], cols: cols, sort: sort, id: giftId, onSort: function (k) { track("sort", k); } }, extra || {}));
  }
  // Date sorts newest first on the first click.
  var dateCol = Object.assign({}, giftCols.date, { desc: true });
  makeTable("home", [dateCol, giftCols.donor, Object.assign({}, giftCols.recip, { wide: true }), giftCols.amount], { key: "amount", dir: -1 });
  makeTable("donor", [dateCol, giftCols.recip, giftCols.amount], { key: "date", dir: -1 });
  makeTable("recipient", [dateCol, giftCols.donor, giftCols.amount], { key: "date", dir: -1 });
  nodes.results = document.createElement("div");
  tables.results = CF.table({
    el: nodes.results,
    id: function (r) { return r.kind + r.i; },
    sort: { key: "total", dir: -1 },
    cols: [
      { key: "name", label: "Name", html: function (r) { return r.kind === "d" ? donorBtn(r.i) : recipBtn(r.i); }, sort: function (r) { return r.name; } },
      { key: "kind", label: "Type", wide: true, html: function (r) { return r.kind === "d" ? CF.sectorTag(data.donors[r.i].s) : '<span class="cf-sector">Recipient</span>'; }, sort: function (r) { return r.kind; } },
      { key: "gifts", label: "Gifts", num: true, wide: true, html: function (r) { return fmt.num(r.gifts); } },
      { key: "total", label: "Real estate money", num: true, html: function (r) { return "<strong>" + fmt.moneyShort(r.total) + "</strong>"; } },
    ],
    empty: function () { return "No real estate donors or recipients match “" + fmt.escape(q) + "”. Only donors identified as real estate are in this lookup."; },
    onSort: function (k) { track("sort", k); },
  });

  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-donor], [data-recip], [data-back]");
    if (!b) return;
    if (b.hasAttribute("data-back")) {
      view = q.length >= 2 ? { kind: "results" } : { kind: "home", tab: "largest" };
    } else if (b.hasAttribute("data-donor")) {
      view = { kind: "donor", i: +b.getAttribute("data-donor") };
      track("donor", data.donors[view.i].n);
    } else {
      view = { kind: "recipient", i: +b.getAttribute("data-recip") };
      track("recipient", data.recipients[view.i].n);
    }
    render();
    var top = app.getBoundingClientRect().top;
    if (top < 0) window.scrollTo({ top: window.scrollY + top, behavior: "smooth" });
  });

  // ------------------------------------------------------------------ views
  function render() {
    if (!data) return;
    var t = view.kind;
    el.toolbar.hidden = t !== "home";
    el.head.hidden = t === "home" || t === "results";
    el.head.innerHTML = "";
    var list;
    if (t === "home") {
      el.tabs.querySelectorAll(".tx-tab").forEach(function (b) {
        var on = b.getAttribute("data-tab") === view.tab;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", String(on));
      });
      list = view.tab === "latest" ? data.gifts.slice(0, 500) : data.biggest;
      tables.home.sortBy(view.tab === "latest" ? "date" : "amount", -1);
      el.summary.innerHTML = view.tab === "latest" ? "<strong>The 500 latest</strong> real estate gifts" : "<strong>The 500 largest</strong> real estate gifts";
    } else if (t === "results") {
      list = search(q);
    } else if (t === "donor") {
      list = data.byDonor[view.i] || [];
      donorHead(view.i, list);
    } else {
      list = data.byRecip[view.i] || [];
      recipHead(view.i, list);
    }
    swap(t);
    tables[t].set(list);
  }
  function swap(name) {
    if (el.host.firstChild === nodes[name]) return;
    el.host.innerHTML = "";
    el.host.appendChild(nodes[name]);
  }
  function search(text) {
    var n = CF.norm(text), out = [];
    if (!n) return out;
    data.dn.forEach(function (s, i) {
      if (s.indexOf(n) >= 0) out.push({ kind: "d", i: i, name: data.donors[i].n, total: data.dTotal[i], gifts: data.byDonor[i].length });
    });
    data.rn.forEach(function (s, i) {
      if (s.indexOf(n) >= 0 && data.byRecip[i]) out.push({ kind: "r", i: i, name: data.recipients[i].n, total: data.rTotal[i], gifts: data.byRecip[i].length });
    });
    return out;
  }
  function sum(list) {
    return list.reduce(function (s, g) { return s + g[3]; }, 0);
  }
  function backBtn() {
    return '<button type="button" class="tx-btn" data-back>‹ ' + (q.length >= 2 ? "Back to results" : "Back to all gifts") + "</button>";
  }
  function donorHead(i, list) {
    var d = data.donors[i];
    var recips = new Set(list.map(function (g) { return g[1]; }));
    var sub = [d.o ? "Company" : d.j, d.c, d.z].filter(Boolean).join(" · ");
    var html = '<h2>' + fmt.escape(d.n) + '<span class="cf-sub">' + fmt.escape(sub) + "</span>" +
      '<span class="cf-sub" style="margin-top:6px">' + CF.sectorTag(d.s) + "</span></h2>" +
      '<div><span class="cf-big">' + fmt.money(sum(list)) + '</span><span class="cf-sub">' + CF.plural(list.length, "gift") + " to " + CF.plural(recips.size, "recipient") + "</span></div>" +
      '<div class="tx-actions">' + backBtn() + '<span class="cf-net"></span></div>';
    el.head.innerHTML = html;
    el.summary.innerHTML = "";
    if (d.o) networkLink(d);
  }
  function recipHead(i, list) {
    var r = data.recipients[i];
    var donors = new Set(list.map(function (g) { return g[0]; }));
    el.head.innerHTML = '<h2>' + fmt.escape(CF.recipName(r)) + '<span class="cf-sub">' + fmt.escape(CF.recipLine(r)) + "</span></h2>" +
      '<div><span class="cf-big">' + fmt.money(sum(list)) + '</span><span class="cf-sub">from ' + CF.plural(donors.size, "real estate donor") + "</span></div>" +
      '<div class="tx-actions">' + backBtn() + "</div>";
  }
  // Companies that gave from an address many donor companies share.
  function networkLink(d) {
    (networks || (networks = CF.load("cf-networks"))).then(function (nw) {
      if (view.kind !== "donor" || data.donors[view.i] !== d) return;
      var hit = nw.addresses.find(function (a) { return a.e.some(function (e) { return e.n === d.n; }); });
      if (!hit) return;
      var box = el.head.querySelector(".cf-net");
      if (box) box.innerHTML = '<a class="tx-btn" target="_blank" rel="noopener" href="' + NETWORKS + "?q=" + encodeURIComponent(hit.a) + '">' +
        "Gave from " + fmt.escape(hit.a) + " with " + CF.plural(hit.n - 1, "other company", "other companies") + " ↗</a>";
    }, function () {});
  }

  // ------------------------------------------------------------------ boot
  CF.load("cf-realestate").then(function (d) {
    data = d;
    data.dn = d.donors.map(function (x) { return CF.norm(x.n); });
    data.rn = d.recipients.map(function (x) { return CF.norm(x.n); });
    data.byDonor = d.donors.map(function () { return []; });
    data.byRecip = [];
    data.dTotal = d.donors.map(function () { return 0; });
    data.rTotal = [];
    d.gifts.forEach(function (g) {
      data.byDonor[g[0]].push(g);
      (data.byRecip[g[1]] || (data.byRecip[g[1]] = [])).push(g);
      data.dTotal[g[0]] += g[3];
      data.rTotal[g[1]] = (data.rTotal[g[1]] || 0) + g[3];
    });
    data.biggest = d.gifts.slice().sort(function (a, b) { return b[3] - a[3]; }).slice(0, 500);
    el.loading.hidden = true;
    el.asof.innerHTML = fmt.escape(CF.asOfText(d, "Only donors identified as real estate, by occupation or company name, are included."));
    // Deep links: ?donor=Name[&zip=33131], ?recipient=Name, ?q=text
    var dn = params.get("donor"), rn = params.get("recipient"), zip = params.get("zip");
    if (dn) {
      var i = d.donors.findIndex(function (x) { return x.n === dn && (!zip || x.z === zip); });
      if (i >= 0) view = { kind: "donor", i: i };
      else {
        q = dn;
        input.value = dn;
        view = { kind: "results" };
      }
    } else if (rn) {
      var j = d.recipients.findIndex(function (x) { return x.n === rn; });
      if (j >= 0) view = { kind: "recipient", i: j };
    } else if (q.length >= 2) view = { kind: "results" };
    render();
    CF.gtmOnLoad();
    track("loaded", d.gifts.length);
  }).catch(function () {
    el.loading.innerHTML = "<span>The campaign data couldn’t load. Please try again later.</span>";
  });
})();
