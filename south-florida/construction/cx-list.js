/*!
 * cx-list.js — "Construction Pipeline" card on the TRD South Florida
 * dashboard: the biggest projects with a permit issued in the last 30 days.
 * Depends on: TRD theme.js, cx-core.js (CX).
 */
(function () {
  "use strict";

  var ARTICLE = "https://therealdeal.com/data/miami/2025/south-florida-construction-pipeline/?utm_source=embed&utm_medium=widget";
  var fmt = CX.fmt;
  var track = CX.tracker("miami-construction-list");
  var params = new URLSearchParams(location.search);
  var limit = Math.min(10, Math.max(1, parseInt(params.get("limit"), 10) || 10));
  var app = document.getElementById("tx-app");
  var list = app.querySelector(".cx-list");
  var cap = app.querySelector(".cx-list-cap");

  CX.theme(null, track);

  // Placeholders while the permits load, so the card doesn't jump.
  list.innerHTML = new Array(limit + 1).join('<li class="cx-skel" aria-hidden="true"></li>');

  // Biggest first among projects with floor area (minor work left out).
  // A quiet month widens the window rather than leaving the card short.
  function pick(data) {
    var windows = [30, 60, 90, 365];
    for (var i = 0; i < windows.length; i++) {
      var from = isoDaysBefore(data.asOf, windows[i]);
      var rows = data.rows.filter(function (r) { return r.size !== "minor" && r.date >= from; });
      if (rows.length >= limit || i === windows.length - 1) {
        rows.sort(function (a, b) { return (b.value || 0) - (a.value || 0) || (b.date < a.date ? -1 : 1); });
        return { rows: rows.slice(0, limit), days: windows[i] };
      }
    }
  }
  function isoDaysBefore(iso, days) {
    var d = new Date(iso + "T12:00:00");
    d.setDate(d.getDate() - days + 1);
    return d.toISOString().slice(0, 10);
  }

  function render(data) {
    var p = pick(data);
    cap.textContent = "Biggest projects permitted in the last " + (p.days === 365 ? "year" : p.days + " days") + " · through " + fmt.dateShort(data.asOf);
    list.innerHTML = p.rows.map(function (r) {
      var kind = r.type + (r.use && r.source === "county" ? " · " + r.use : "");
      var scale = r.sqft ? fmt.numShort(r.sqft) + " sq ft" : r.units ? CX.plural(r.units, "unit") : "";
      return '<li><div class="cx-li"><span class="cx-li-kind">' + fmt.escape(kind) + "</span>" +
        '<span class="cx-li-addr">' + fmt.escape(r.address || "Address unavailable") + "</span>" +
        '<span class="cx-li-place">' + fmt.escape(CX.placeLine(r)) + "</span>" +
        '<span class="cx-li-num"><span class="cx-li-value">' + (r.value ? fmt.moneyShort(r.value) : "—") + "</span>" +
        '<span class="cx-li-sub">' + fmt.escape(scale) + "</span>" +
        '<span class="cx-li-sub">' + fmt.dateShort(r.date) + "</span></span></div></li>";
    }).join("") || '<li class="tx-empty">No new projects in the permit feed yet.</li>';
    app.insertAdjacentHTML("beforeend", '<a class="cx-more" href="' + ARTICLE + '" target="_parent">View more</a>');
    app.querySelector(".cx-more").addEventListener("click", function () { track("view_more"); });
    track("loaded", p.rows.length);
  }

  // The TRD dashboard sizes this frame from the posted height (?updateHeight).
  function postHeight() {
    if (!params.get("updateHeight") || window.parent === window) return;
    var origin = location.origin === "https://trd-digital.github.io" ? "https://therealdeal.com" : "http://localhost:3010";
    window.parent.postMessage({ updateHeight: app.offsetHeight + 10, src: location.href }, origin);
  }
  window.addEventListener("resize", postHeight);
  window.addEventListener("load", postHeight);
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "updateHeight") postHeight();
  });

  CX.load().then(render).catch(function () {
    list.innerHTML = '<li class="tx-empty">Construction permits couldn’t load. Please try again later.</li>';
  }).then(postHeight);
})();
