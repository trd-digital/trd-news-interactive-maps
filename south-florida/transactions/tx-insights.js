/*!
 * tx-insights.js — "Market overview" for the South Florida Live Transactions
 * table: a market-pulse strip (sales, volume, median price, financed share,
 * each vs the previous period of equal length), top-deal cards, and the
 * "By area" summary. Depends on: tx-core.js, tx-charts.js.
 */
(function (global) {
  "use strict";

  var TX = global.TX;
  var fmt = TX.fmt;

  function median(a) {
    if (!a.length) return null;
    a = a.slice().sort(function (x, y) { return x - y; });
    var m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  function metrics(rows) {
    var total = 0, fin = 0;
    rows.forEach(function (r) { total += r.price; if (r.financed) fin++; });
    return {
      count: rows.length,
      volume: total,
      median: median(rows.map(function (r) { return r.price; })),
      financed: rows.length ? fin / rows.length : null,
    };
  }

  function daysBetween(a, b) {
    return Math.round((TX.isoToDate(b) - TX.isoToDate(a)) / 864e5) + 1;
  }

  // ----------------------------------------------------------- market pulse
  // ctx: { rows (all), state, asOf }
  function pulse(el, ctx) {
    var range = TX.dateRange(ctx.state, ctx.asOf);
    var len = daysBetween(range[0], range[1]);
    var cur = TX.apply(ctx.rows, ctx.state, ctx.asOf);
    var priorState = TX.serializeState(ctx.state);
    priorState.dateFrom = TX.isoAdd(range[0], -len);
    priorState.dateTo = TX.isoAdd(range[0], -1);
    // A prior period is only comparable if every selected county has records
    // back to its start.
    // Only the counties actually in the current results matter (a Boca Raton
    // search shouldn't talk about Miami-Dade).
    var inView = ctx.state.counties.filter(function (c) { return cur.some(function (r) { return r.county === c; }); });
    if (!inView.length) inView = ctx.state.counties;
    var gaps = TX.coverageGaps(ctx.rows, priorState.dateFrom, inView);
    // Comparable when the selected counties' records reach back to (within two
    // days of) the start of the prior period.
    var earliest = ctx.rows.reduce(function (m, r) {
      return inView.indexOf(r.county) >= 0 && (!m || r.date < m) ? r.date : m;
    }, "");
    var comparable = !gaps.length && !!earliest && earliest <= TX.isoAdd(priorState.dateFrom, 2);
    var gapNames = gaps.map(function (g) { return g.county; });
    var covered = inView.filter(function (c) { return gapNames.indexOf(c) < 0; });
    var prev = comparable ? TX.apply(ctx.rows, priorState, ctx.asOf) : null;
    var a = metrics(cur), b = prev ? metrics(prev) : null;

    // Daily series for sparklines.
    var days = [];
    for (var d = range[0]; d <= range[1]; d = TX.isoAdd(d, 1)) days.push(d);
    var idx = {};
    days.forEach(function (x, i) { idx[x] = i; });
    var n = days.map(function () { return 0; }), v = n.slice();
    cur.forEach(function (r) { var i = idx[r.date]; if (i != null) { n[i]++; v[i] += r.price; } });

    var vs = "vs prior " + len + " days";
    function change(now, then, kind) {
      if (!b || now == null || then == null) {
        return '<span class="tx-kpi-chg is-na">' + (gapNames.length
          ? "No " + vs.replace("vs ", "") + " to compare for " + gapNames.join(" & ")
          : "No prior period to compare") + "</span>";
      }
      if (kind === "pts") {
        var pts = Math.round((now - then) * 100);
        return '<span class="tx-kpi-chg">' + arrow(pts) + Math.abs(pts) + (Math.abs(pts) === 1 ? " pt " : " pts ") + vs + "</span>";
      }
      if (!then) return '<span class="tx-kpi-chg is-na">—</span>';
      var pct = Math.round(((now - then) / then) * 100);
      return '<span class="tx-kpi-chg">' + arrow(pct) + Math.abs(pct) + "% " + vs + "</span>";
    }
    function arrow(x) {
      return x > 0 ? '<span aria-label="up">▲</span> ' : x < 0 ? '<span aria-label="down">▼</span> ' : '<span aria-label="no change">■</span> ';
    }
    var tiles = [
      { label: "Sales", value: a.count.toLocaleString("en-US"), chg: change(a.count, b && b.count), spark: n },
      { label: "Volume", value: fmt.moneyShort(a.volume), chg: change(a.volume, b && b.volume), spark: v },
      { label: "Median price", value: fmt.moneyShort(a.median), chg: change(a.median, b && b.median) },
      { label: "Financed", value: a.financed == null ? "—" : Math.round(a.financed * 100) + "%", chg: change(a.financed, b && b.financed, "pts"), sub: "deeds with a mortgage recorded" },
    ];
    var note = !b && gapNames.length && covered.length
      ? '<p class="tx-pulse-note">' + gapNames.join(" and ") + " records start " + fmt.dateShort(gaps[0].start) +
        ", so there’s no earlier period to compare. " +
        '<button type="button" class="tx-msg-btn" data-compare-counties="' + fmt.escape(covered.join("|")) + '">Compare ' + fmt.escape(covered.join(" & ")) + " only</button></p>"
      : "";
    el.innerHTML = note + tiles.map(function (t) {
      return '<div class="tx-kpi"><span class="tx-kpi-label">' + t.label + "</span>" +
        '<span class="tx-kpi-value">' + t.value + "</span>" + t.chg +
        (t.spark ? TX.charts.sparkline(t.spark, 120, 22) : t.sub ? '<span class="tx-kpi-sub">' + t.sub + "</span>" : "") + "</div>";
    }).join("");
    var btn = el.querySelector("[data-compare-counties]");
    if (btn && ctx.onCounties) btn.onclick = function () { ctx.onCounties(btn.getAttribute("data-compare-counties").split("|")); };
  }

  // -------------------------------------------------------------- top deals
  // entries: display entries (deeds + assemblages) for the current filters.
  function topDeals(el, entries, onPick) {
    var top = entries.slice().sort(function (x, y) { return y.price - x.price; }).slice(0, 10);
    if (!top.length) {
      el.innerHTML = '<p class="tx-muted">No sales match these filters.</p>';
      return;
    }
    el.innerHTML = top.map(function (e, i) {
      var r = e.kind === "assemblage" ? e.lead : e;
      var img = TX.aerialUrl(r, 240, 120);
      var where = [r.city, e.kind === "assemblage" ? e.county : r.county].filter(Boolean).join(" · ");
      var who = e.kind === "assemblage"
        ? TX.partySummary(e.partiesDirected ? e.buyers : e.parties, e.partiesDirected ? "buyer" : "party")
        : TX.partyLine(r);
      return '<button type="button" class="tx-deal" data-id="' + fmt.escape(e.id) + '">' +
        '<span class="tx-deal-rank">' + (i + 1) + "</span>" +
        (img ? '<img class="tx-deal-img" loading="lazy" alt="" src="' + fmt.escape(img) + '">' : '<span class="tx-deal-img is-empty">No aerial — address unavailable</span>') +
        '<span class="tx-deal-body">' +
        (e.kind === "assemblage" ? '<span class="tx-assm">' + fmt.escape(e.label) + "</span>" : "") +
        '<span class="tx-deal-price">' + fmt.moneyShort(e.price) + (e.kind === "assemblage" ? ' <small>combined</small>' : "") + "</span>" +
        '<span class="tx-deal-addr">' + fmt.escape(r.address || "Address unavailable") + (e.kind === "assemblage" ? " + " + (e.members.length - 1) + " more" : "") + "</span>" +
        '<span class="tx-deal-sub">' + fmt.escape(where) + " · " + fmt.dateShort(e.date) + "</span>" +
        '<span class="tx-deal-who">' + fmt.escape(who) + "</span>" +
        "</span></button>";
    }).join("");
    el.onclick = function (ev) {
      var b = ev.target.closest(".tx-deal");
      if (b) onPick(b.getAttribute("data-id"));
    };
  }

  // ---------------------------------------------------------------- by area
  // Groups deeds by city (Miami-Dade records don't carry a city yet).
  function areaRows(rows) {
    var by = {};
    rows.forEach(function (r) {
      var key = r.city ? r.city + "|" + r.county : "|" + r.county;
      var g = by[key] || (by[key] = { city: r.city, county: r.county, rows: [] });
      g.rows.push(r);
    });
    return Object.keys(by).map(function (k) {
      var g = by[k];
      var m = metrics(g.rows);
      var top = g.rows.reduce(function (t, r) { return !t || r.price > t.price ? r : t; }, null);
      return { city: g.city, county: g.county, count: m.count, volume: m.volume, median: m.median, financed: m.financed, top: top };
    });
  }

  // ---------------------------------------------------------------- history
  // Monthly aggregates (south-florida-transactions-history.json), loaded only
  // when the overview is open. Rows: month, county, city, use_type, count,
  // volume, median, financed — with "*" rollups (medians aren't additive).
  var HISTORY_FILE = "south-florida-transactions-history.json";
  // Verified Oct 12 2026 against the per-sale feed (PBC within 6%, Broward 3%,
  // medians within 2%). Set false to hide trends if the file is ever suspect.
  var HISTORY_READY = true;
  var history = null, historyPromise = null;
  function cityKey(s) { return String(s || "").toLowerCase().replace(/[^a-z]/g, ""); }
  function loadHistory() {
    if (historyPromise) return historyPromise;
    historyPromise = fetch(HISTORY_FILE).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (h) {
      var col = {};
      h.columns.forEach(function (c, i) { col[c] = i; });
      var idx = {}, months = {};
      h.rows.forEach(function (r) {
        var city = r[col.city] === "*" ? "*" : cityKey(r[col.city]);
        idx[r[col.month] + "|" + r[col.county] + "|" + city + "|" + r[col.use_type]] = {
          count: r[col.count], volume: r[col.volume], median: r[col.median], financed: r[col.financed],
        };
        months[r[col.month]] = true;
      });
      history = { idx: idx, months: Object.keys(months).sort(), partial: h.partial_months || [], coverage: h.coverage || {}, through: h.through };
      return history;
    }).catch(function (e) {
      historyPromise = null;
      throw e;
    });
    return historyPromise;
  }

  function monthLabel(m, long) {
    var d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1);
    return d.toLocaleDateString("en-US", long ? { month: "long", year: "numeric" } : { month: "short", year: "2-digit" });
  }

  // scope: { county: null|name, city: null|{name, county}, use: null|USE_TYPES key }
  function trends(el, scope) {
    var section = el.previousElementSibling && el.previousElementSibling.classList.contains("tx-subhead") ? el.previousElementSibling : null;
    el.hidden = !HISTORY_READY;
    if (section) section.hidden = !HISTORY_READY;
    if (!HISTORY_READY) return;
    if (!history) {
      el.innerHTML = '<p class="tx-muted">Loading monthly history…</p>';
      loadHistory().then(function () { trends(el, scope); }).catch(function () {
        el.innerHTML = '<p class="tx-muted">Monthly history isn’t available right now.</p>';
      });
      return;
    }
    var county = scope.city ? scope.city.county : scope.county || "*";
    var city = scope.city ? cityKey(scope.city.name) : "*";
    var use = scope.use || "*";
    var series = history.months.map(function (m) {
      return { m: m, v: history.idx[m + "|" + county + "|" + city + "|" + use] || null, partial: history.partial.indexOf(m) >= 0 };
    });
    var full = series.filter(function (s) { return s.v && !s.partial; });
    var scopeLabel = (scope.use ? TX.USE_TYPES[scope.use].label.toLowerCase() : "sales") + " in " +
      (scope.city ? scope.city.name : scope.county ? scope.county + " County" : "South Florida");
    if (full.length < 2) {
      el.innerHTML = '<p class="tx-muted">Not enough monthly history for ' + fmt.escape(scopeLabel) + " yet (months with fewer than 3 sales are left out).</p>";
      return;
    }
    var last = full[full.length - 1], prev = full[full.length - 2];
    function chg(a, b) {
      if (!b) return "";
      var p = Math.round(((a - b) / b) * 100);
      return " · " + (p > 0 ? "▲ " : p < 0 ? "▼ " : "■ ") + Math.abs(p) + "% vs " + monthLabel(prev.m).split(" ")[0];
    }
    el.innerHTML =
      '<p class="tx-trend-sum"><strong>' + monthLabel(last.m, true) + ":</strong> " + last.v.count.toLocaleString("en-US") + " " + fmt.escape(scopeLabel) +
      chg(last.v.count, prev.v.count) + " · median " + fmt.moneyShort(last.v.median) + chg(last.v.median, prev.v.median) +
      (last.v.count < 30 ? ' <span class="tx-muted">(small sample: medians swing month to month)</span>' : "") + "</p>" +
      '<div class="tx-trend-grid"><div><p class="tx-trend-h">Sales per month</p><div class="tx-chart tx-trend-count"></div></div>' +
      '<div><p class="tx-trend-h">Median price</p><div class="tx-chart tx-trend-median"></div></div></div>' +
      '<p class="tx-chart-cap">' + (series.some(function (s) { return s.partial; }) ? "Lighter bars are partial months. " : "") +
      "Deeds of $100,000+, by record date. Monthly history through " + fmt.date(history.through) + ".</p>";
    function bins(field, money) {
      return series.map(function (s) {
        var v = s.v ? s.v[field] : 0;
        return {
          value: v || 0,
          muted: s.partial,
          tip: "<strong>" + monthLabel(s.m, true) + (s.partial ? " (partial)" : "") + "</strong>" +
            (s.v ? (money ? fmt.moneyShort(v) + " median" : v.toLocaleString("en-US") + " sales · " + fmt.moneyShort(s.v.volume)) : "Fewer than 3 sales"),
        };
      });
    }
    var ticks = [0, Math.floor(series.length / 2), series.length - 1].map(function (i) { return { i: i, label: monthLabel(series[i].m) }; });
    TX.charts.barBrush(el.querySelector(".tx-trend-count"), { bins: bins("count"), ticks: ticks, static: true, ariaLabel: "Sales per month, " + scopeLabel, onBrush: function () {} });
    TX.charts.barBrush(el.querySelector(".tx-trend-median"), { bins: bins("median", true), ticks: ticks, static: true, ariaLabel: "Median price per month, " + scopeLabel, onBrush: function () {} });
  }

  TX.insights = { pulse: pulse, topDeals: topDeals, areaRows: areaRows, metrics: metrics, trends: trends, loadHistory: loadHistory };
})(window);
