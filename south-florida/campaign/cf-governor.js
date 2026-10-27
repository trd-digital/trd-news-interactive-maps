/*!
 * cf-governor.js — the 2026 governor's race money
 * (south-florida-campaign-governor-race.html): cumulative fundraising by
 * month for the leading candidates, with or without their PACs, and a table
 * of where each one's money came from.
 * Depends on: TRD theme.js, cf-core.js (CF).
 */
(function () {
  "use strict";

  var fmt = CF.fmt;
  var track = CF.tracker("sofla-campaign-governor-race");
  var app = CF.root(document.currentScript);
  var params = new URLSearchParams(location.search);
  var NS = "http://www.w3.org/2000/svg";

  var mode = params.get("pac") === "1" ? "pac" : "campaign";
  var data = null;

  CF.theme(null, track);

  var el = {
    chips: app.querySelector(".cf-mode"),
    legend: app.querySelector(".cf-legend"),
    chart: app.querySelector(".cf-chart"),
    kpis: app.querySelector(".cx-kpis"),
    host: app.querySelector(".cf-host"),
    loading: app.querySelector(".tx-loading"),
    asof: app.querySelector(".tx-asof"),
  };
  el.chips.addEventListener("click", function (e) {
    var b = e.target.closest(".tx-chip");
    if (!b) return;
    mode = b.getAttribute("data-value");
    track("mode", mode);
    render();
  });

  function monthLabel(m, short) {
    var p = m.split("-");
    var d = new Date(+p[0], +p[1] - 1, 1);
    return d.toLocaleDateString("en-US", short ? { month: "short" } : { month: "long", year: "numeric" });
  }
  function seriesOf(c) {
    var a = c.s.campaign || [], b = mode === "pac" ? c.s.pac || [] : [];
    var run = 0;
    return data.months.map(function (_, i) {
      run += (a[i] || 0) + (b[i] || 0);
      return run;
    });
  }
  function niceMax(v) {
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var m = v / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  }

  // ------------------------------------------------------------------ chart
  function renderChart() {
    var cands = data.candidates;
    var series = cands.map(seriesOf);
    var W = Math.max(320, el.chart.clientWidth || 640), narrow = W < 560;
    var H = narrow ? 260 : 320, padL = 48, padR = narrow ? 12 : 150, padT = 10, padB = 26;
    var max = niceMax(Math.max.apply(null, series.map(function (s) { return s[s.length - 1]; })) || 1);
    var n = data.months.length;
    function x(i) { return padL + (i / (n - 1)) * (W - padL - padR); }
    function y(v) { return padT + (1 - v / max) * (H - padT - padB); }
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Cumulative money raised by governor candidates, by month">';
    svg += '<g class="cf-grid">';
    var ticks = [0, 0.25, 0.5, 0.75, 1];
    ticks.forEach(function (t) { svg += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(max * t) + '" y2="' + y(max * t) + '"/>'; });
    svg += '</g><g class="cf-axis">';
    ticks.forEach(function (t) { svg += '<text x="' + (padL - 8) + '" y="' + (y(max * t) + 4) + '" text-anchor="end">' + fmt.moneyShort(max * t) + "</text>"; });
    data.months.forEach(function (m, i) {
      var mo = +m.split("-")[1];
      if (mo === 1 || (!narrow && mo === 7) || i === 0) {
        svg += '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? "start" : "middle") + '">' + (mo === 1 ? m.split("-")[0] : monthLabel(m, true)) + "</text>";
      }
    });
    svg += "</g>";
    series.forEach(function (s, k) {
      svg += '<path class="cf-line" stroke="var(--cf-s' + (k + 1) + ')" d="' + s.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + "," + y(v).toFixed(1); }).join("") + '"/>';
    });
    // Direct labels at the line ends, nudged apart (wide screens only; the
    // legend names every line).
    if (!narrow) {
      var ends = series.map(function (s, k) { return { k: k, y: y(s[s.length - 1]), v: s[s.length - 1] }; }).sort(function (a, b) { return a.y - b.y; });
      for (var i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
      // Pushed past the baseline: stack upward from it instead.
      var floor = H - padB;
      for (var j = ends.length - 1; j >= 0; j--) {
        var lim = j === ends.length - 1 ? floor : ends[j + 1].y - 15;
        if (ends[j].y > lim) ends[j].y = lim;
      }
      ends.forEach(function (e) {
        var c = cands[e.k];
        svg += '<text class="cf-label-text" x="' + (W - padR + 8) + '" y="' + (e.y + 4) + '">' + fmt.escape(c.n.split(" ").slice(-1)[0]) +
          ' <tspan font-weight="400" fill="var(--tx-text-2)">' + fmt.moneyShort(e.v) + "</tspan></text>";
      });
    }
    svg += '<line class="cf-cross" y1="' + padT + '" y2="' + (H - padB) + '" visibility="hidden"/>';
    svg += '<g class="cf-dots"></g><rect class="cf-hit" x="' + padL + '" y="0" width="' + (W - padL - padR) + '" height="' + H + '" fill="transparent"/></svg><div class="cf-tip" hidden></div>';
    el.chart.innerHTML = svg;

    var root = el.chart.querySelector("svg"), cross = root.querySelector(".cf-cross"), dots = root.querySelector(".cf-dots"), tip = el.chart.querySelector(".cf-tip");
    function show(ev) {
      var box = root.getBoundingClientRect();
      var px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - box.left) * (W / box.width);
      var i = Math.max(0, Math.min(n - 1, Math.round(((px - padL) / (W - padL - padR)) * (n - 1))));
      cross.setAttribute("x1", x(i));
      cross.setAttribute("x2", x(i));
      cross.setAttribute("visibility", "visible");
      dots.innerHTML = series.map(function (s, k) {
        return '<circle class="cf-dot" r="4.5" cx="' + x(i) + '" cy="' + y(s[i]) + '" fill="var(--cf-s' + (k + 1) + ')"/>';
      }).join("");
      var order = series.map(function (s, k) { return k; }).sort(function (a, b) { return series[b][i] - series[a][i]; });
      tip.innerHTML = "<strong>Through " + monthLabel(data.months[i]) + "</strong>" + order.map(function (k) {
        return '<div><i class="tx-swatch" style="background:var(--cf-s' + (k + 1) + ')"></i><span>' + fmt.escape(cands[k].n) + "</span><span>" + fmt.moneyShort(series[k][i]) + "</span></div>";
      }).join("");
      tip.hidden = false;
      var left = (x(i) / W) * box.width;
      tip.style.left = Math.min(box.width - tip.offsetWidth - 4, Math.max(0, left > box.width / 2 ? left - tip.offsetWidth - 12 : left + 12)) + "px";
      tip.style.top = "8px";
    }
    function hide() {
      cross.setAttribute("visibility", "hidden");
      dots.innerHTML = "";
      tip.hidden = true;
    }
    var hit = root.querySelector(".cf-hit");
    hit.addEventListener("mousemove", show);
    hit.addEventListener("touchstart", show, { passive: true });
    hit.addEventListener("touchmove", show, { passive: true });
    hit.addEventListener("mouseleave", hide);
    hit.addEventListener("touchend", function () { setTimeout(hide, 1800); });
  }

  // ------------------------------------------------------------------ table
  var table = CF.table({
    el: el.host,
    id: function (c) { return c.n; },
    sort: { key: "t", dir: -1 },
    cols: [
      { key: "n", label: "Candidate", html: function (c) {
        return '<span class="tx-cat"><i class="tx-swatch" style="background:var(--cf-s' + (c.k + 1) + ')"></i><span class="cf-name">' + fmt.escape(c.n) + "</span></span>" +
          '<span class="cf-sub">' + fmt.escape(CF.PARTY[c.p] || c.p || "") + "</span>";
      } },
      { key: "t", label: "Campaign", num: true, html: function (c) { return "<strong>" + fmt.moneyShort(c.t) + "</strong>"; } },
      { key: "pt", label: "PAC", num: true, html: function (c) { return c.pt ? fmt.moneyShort(c.pt) : '<span class="cx-dim">—</span>'; } },
      { key: "dn", label: "Donors", num: true, wide: true, html: function (c) { return fmt.num(c.dn); } },
      { key: "med", label: "Median gift", num: true, wide: true, html: function (c) { return fmt.money(c.med); } },
      { key: "sfp", label: "South Florida", num: true, html: function (c) { return fmt.pct(c.sf, c.t); }, sort: function (c) { return c.sf / c.t; } },
      { key: "rep", label: "Real estate", num: true, html: function (c) { return fmt.pct(c.re, c.t); }, sort: function (c) { return c.re / c.t; } },
      { key: "smp", label: "$200 or less", num: true, wide: true, html: function (c) { return fmt.pct(c.small, c.t); }, sort: function (c) { return c.small / c.t; } },
      { key: "oos", label: "Out of state", num: true, wide: true, html: function (c) { return fmt.pct(c.t - c.fl, c.t); }, sort: function (c) { return (c.t - c.fl) / c.t; } },
    ],
    expand: function (c) {
      var rows = [
        ["Gifts", fmt.num(c.g)],
        ["From South Florida", fmt.money(c.sf)],
        ["From real estate", fmt.money(c.re)],
        ["From companies and groups", fmt.money(c.cos)],
        ["Gifts of $1,000+", CF.plural(c.big, "donor") + " gave $1,000 or more"],
      ];
      if (c.self >= 1000) rows.push(["Candidate’s own money", fmt.money(c.self)]);
      if (c.pub) rows.push(["State matching funds", fmt.money(c.pub)]);
      var pac = c.pac.length ? '<div><p class="cf-list-title">' + fmt.escape(c.pac.join(", ")) + '</p><dl class="tx-dl"><dt>Raised</dt><dd>' + fmt.money(c.pt) + "</dd>" +
        "<dt>From real estate</dt><dd>" + fmt.money(c.pre) + ' <span class="tx-muted">(' + fmt.pct(c.pre, c.pt) + ")</span></dd><dt>From South Florida</dt><dd>" + fmt.money(c.psf) +
        ' <span class="tx-muted">(' + fmt.pct(c.psf, c.pt) + ")</span></dd></dl></div>" : '<div><p class="cf-list-title">PAC</p><p class="tx-muted">No “Friends of” committee in these reports.</p></div>';
      return '<div class="cf-expand"><div><p class="cf-list-title">Campaign account</p><dl class="tx-dl">' + rows.map(function (r) {
        return "<dt>" + r[0] + "</dt><dd>" + r[1] + "</dd>";
      }).join("") + "</dl></div>" + pac + "</div>";
    },
    onSort: function (k) { track("sort", k); },
    onExpand: function (id) { track("expand", id); },
  });

  function render() {
    el.chips.innerHTML = CF.chips("mode", [{ id: "campaign", label: "Campaign accounts" }, { id: "pac", label: "Including PACs" }], mode);
    el.legend.innerHTML = data.candidates.map(function (c, k) {
      return '<li><i style="background:var(--cf-s' + (k + 1) + ')"></i>' + fmt.escape(c.n) + (c.p ? " (" + fmt.escape(c.p) + ")" : "") + "</li>";
    }).join("");
    renderChart();
  }

  CF.load("cf-governor").then(function (d) {
    data = d;
    d.candidates.forEach(function (c, k) { c.k = k; });
    var lead = d.candidates[0];
    var all = d.candidates.reduce(function (s, c) { return s + c.t; }, 0) + d.others.t;
    var pacs = d.candidates.reduce(function (s, c) { return s + c.pt; }, 0);
    el.kpis.innerHTML =
      CF.kpi("Raised by candidates", fmt.moneyShort(all), CF.plural(d.candidates.length + d.others.n, "candidate") + " for governor") +
      CF.kpi("Raised by their PACs", fmt.moneyShort(pacs), d.candidates.filter(function (c) { return c.pt; }).map(function (c) { return c.n.split(" ").slice(-1)[0]; }).join(" and ")) +
      CF.kpi("Top fundraiser", fmt.escape(lead.n.split(" ").slice(-1)[0]), fmt.moneyShort(lead.t + lead.pt) + " with PAC") +
      CF.kpi("From South Florida", fmt.pct(d.candidates.reduce(function (s, c) { return s + c.sf; }, 0), d.candidates.reduce(function (s, c) { return s + c.t; }, 0)), "Of the leading campaigns’ money");
    el.loading.hidden = true;
    el.asof.innerHTML = fmt.escape(CF.asOfText(d, "Candidates shown raised $250,000 or more; " + CF.plural(d.others.n, "other candidate") + " raised " + fmt.moneyShort(d.others.t) +
      ". PACs are each candidate’s “Friends of” political committee; their totals include money moved from other committees."));
    render();
    table.set(d.candidates);
    CF.gtmOnLoad();
    track("loaded", d.candidates.length);
    var w = el.chart.clientWidth;
    window.addEventListener("resize", CF.debounce(function () {
      if (el.chart.clientWidth !== w) { w = el.chart.clientWidth; renderChart(); }
    }, 150));
  }).catch(function () {
    el.loading.innerHTML = "<span>The campaign data couldn’t load. Please try again later.</span>";
  });
})();
