/*!
 * tx-charts.js — small SVG charts for the South Florida Live Transactions
 * embeds: a sparkline, and a bar chart with a drag-to-select brush (used for
 * the daily-sales timeline and the price histogram). No dependencies.
 *
 * Mark specs follow the dataviz method: thin bars with a 2px gap, rounded
 * data ends anchored to the baseline, recessive axis, sparse labels, a hover
 * tooltip on every bar. Colors come from CSS tokens (--tx-series, etc.).
 */
(function (global) {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";

  function svgEl(name, attrs) {
    var e = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  // Sparkline path for a series of numbers in a w×h box.
  function sparkline(values, w, h) {
    if (!values.length) return "";
    var max = Math.max.apply(null, values) || 1;
    var step = values.length > 1 ? w / (values.length - 1) : 0;
    var d = values.map(function (v, i) {
      return (i ? "L" : "M") + (i * step).toFixed(1) + "," + (h - 1 - (v / max) * (h - 2)).toFixed(1);
    }).join("");
    return '<svg class="tx-spark" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + '"/></svg>';
  }

  // Bar chart with brush.
  //   el: container; opts: { bins: [{ value, label, tip }], selected: [i0, i1] | null,
  //   height, ticks: [{ i, label }], onBrush(i0, i1) , ariaLabel }
  function barBrush(el, opts) {
    var bins = opts.bins || [];
    var n = bins.length;
    var W = 300, H = opts.height || 64, AX = 16; // AX: room for tick labels
    var plotH = H - AX;
    var gap = n > 40 ? 1 : 2;
    var bw = n ? W / n : W;
    var max = 0;
    bins.forEach(function (b) { if (b.value > max) max = b.value; });
    max = max || 1;

    el.innerHTML = "";
    el.classList.add("tx-brush");
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none", role: "img", "aria-label": opts.ariaLabel || "" });
    var bars = [];
    bins.forEach(function (b, i) {
      var h = b.value ? Math.max(2, (b.value / max) * (plotH - 4)) : 0;
      var x = i * bw + gap / 2;
      var r = svgEl("rect", {
        x: x.toFixed(2), y: (plotH - h).toFixed(2), width: Math.max(0.5, bw - gap).toFixed(2), height: h.toFixed(2),
        rx: Math.min(2, (bw - gap) / 2).toFixed(2), class: "tx-bar" + (b.muted ? " is-muted" : ""),
      });
      bars.push(r);
      svg.appendChild(r);
    });
    svg.appendChild(svgEl("line", { x1: 0, x2: W, y1: plotH + 0.5, y2: plotH + 0.5, class: "tx-axis" }));
    el.appendChild(svg);

    // Tick labels as HTML so they don't stretch with the SVG.
    var ticks = document.createElement("div");
    ticks.className = "tx-ticks";
    (opts.ticks || []).forEach(function (t) {
      var s = document.createElement("span");
      s.textContent = t.label;
      s.style.left = ((t.i + 0.5) / n * 100).toFixed(2) + "%";
      if (t.i === 0) s.className = "is-first";
      if (t.i === n - 1) s.className = "is-last";
      ticks.appendChild(s);
    });
    el.appendChild(ticks);

    var tip = document.createElement("div");
    tip.className = "tx-chart-tip";
    tip.hidden = true;
    el.appendChild(tip);

    var sel = opts.selected ? opts.selected.slice() : null;
    function paint(range) {
      bars.forEach(function (r, i) {
        var on = !range || (i >= range[0] && i <= range[1]);
        r.setAttribute("class", "tx-bar" + (on ? "" : " is-out") + (bins[i].muted ? " is-muted" : ""));
      });
    }
    paint(sel);

    function indexAt(clientX) {
      var rect = svg.getBoundingClientRect();
      var i = Math.floor(((clientX - rect.left) / rect.width) * n);
      return Math.max(0, Math.min(n - 1, i));
    }
    function showTip(i, clientX) {
      var b = bins[i];
      if (!b) return;
      tip.innerHTML = b.tip || "";
      tip.hidden = false;
      var rect = el.getBoundingClientRect();
      var x = clientX - rect.left;
      tip.style.left = Math.max(0, Math.min(rect.width - tip.offsetWidth, x - tip.offsetWidth / 2)) + "px";
      bars.forEach(function (r, j) { r.classList.toggle("is-hover", j === i); });
    }
    function hideTip() {
      tip.hidden = true;
      bars.forEach(function (r) { r.classList.remove("is-hover"); });
    }

    var dragFrom = null;
    if (opts.static) svg.style.cursor = "default";
    svg.addEventListener("pointerdown", function (e) {
      if (opts.static) return; // read-only chart: hover tooltips only
      if (!n) return;
      dragFrom = indexAt(e.clientX);
      svg.setPointerCapture(e.pointerId);
      paint([dragFrom, dragFrom]);
      e.preventDefault();
    });
    svg.addEventListener("pointermove", function (e) {
      var i = indexAt(e.clientX);
      if (dragFrom != null) paint([Math.min(dragFrom, i), Math.max(dragFrom, i)]);
      if (e.pointerType === "mouse" || dragFrom != null) showTip(i, e.clientX);
    });
    svg.addEventListener("pointerup", function (e) {
      if (dragFrom == null) return;
      var i = indexAt(e.clientX);
      var r = [Math.min(dragFrom, i), Math.max(dragFrom, i)];
      dragFrom = null;
      hideTip();
      // Clicking the single already-selected bar clears the selection.
      if (sel && r[0] === r[1] && sel[0] === r[0] && sel[1] === r[1]) {
        sel = null;
        paint(null);
        opts.onBrush(null);
        return;
      }
      sel = r;
      paint(sel);
      opts.onBrush(r[0], r[1]);
    });
    if (opts.static) {
      svg.addEventListener("pointerdown", function (e) { showTip(indexAt(e.clientX), e.clientX); }); // tap = tooltip on phones
    }
    svg.addEventListener("pointerleave", function () {
      if (dragFrom == null) hideTip();
    });
    svg.addEventListener("pointercancel", function () {
      dragFrom = null;
      paint(sel);
      hideTip();
    });
  }

  global.TX = global.TX || {};
  global.TX.charts = { sparkline: sparkline, barBrush: barBrush };
})(window);
