/*!
 * tx-compare.js — compare up to four sales side by side.
 * Shared by the map and table embeds; the list syncs between them (sibling
 * iframes) and survives a reload within the tab (sessionStorage).
 * Depends on: tx-core.js.
 */
(function (global) {
  "use strict";

  var TX = global.TX;
  var fmt = TX.fmt;
  var MAX = 4;
  var KEY = "trd-sofla-tx:compare";

  function median(a) {
    if (!a.length) return null;
    a = a.slice().sort(function (x, y) { return x - y; });
    var m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  // opts: { root (element to mount tray/panel in), peer, track, ctx() -> { data, state },
  //         showTray() -> bool, onShow(id) (focus a sale in the views) }
  function init(opts) {
    var ids = [];
    try { ids = JSON.parse(global.sessionStorage.getItem(KEY) || "[]"); } catch (e) {}
    var listeners = [];

    var tray = document.createElement("div");
    tray.className = "tx-cmp-tray";
    tray.setAttribute("role", "region");
    tray.setAttribute("aria-label", "Sales to compare");
    tray.hidden = true;
    var panel = document.createElement("div");
    panel.className = "tx-cmp-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "tx-cmp-title");
    panel.hidden = true;
    opts.root.appendChild(tray);
    opts.root.appendChild(panel);

    function rows() {
      var c = opts.ctx();
      if (!c || !c.data) return [];
      return ids.map(function (id) { return c.data.byId[id]; }).filter(Boolean);
    }

    function save(broadcast) {
      try { global.sessionStorage.setItem(KEY, JSON.stringify(ids)); } catch (e) {}
      if (broadcast) opts.peer.send("compare", ids.slice());
      renderTray();
      if (!panel.hidden) ids.length ? renderPanel() : close();
      listeners.forEach(function (fn) { fn(); });
    }

    function has(id) { return ids.indexOf(id) >= 0; }
    function toggle(id, notifyEl) {
      if (has(id)) {
        ids = ids.filter(function (x) { return x !== id; });
        opts.track("compare_remove", id);
      } else {
        if (ids.length >= MAX) {
          TX.notify(notifyEl || opts.root, "You can compare up to " + MAX + " sales. Remove one first.");
          return false;
        }
        ids.push(id);
        opts.track("compare_add", id);
      }
      save(true);
      return true;
    }

    function shortAddr(r) {
      return r.address ? r.address.replace(/\s+(#|unit|apt)?\s*[A-Z]?-?\d+[A-Z]?$/i, "") : "Address unavailable";
    }

    function renderTray() {
      var list = rows();
      tray.hidden = !list.length || !opts.showTray();
      if (tray.hidden) return;
      tray.innerHTML = '<span class="tx-cmp-label">Compare</span><div class="tx-cmp-chips">' + list.map(function (r) {
        return '<span class="tx-cmp-chip"><span>' + fmt.escape(shortAddr(r)) + " · " + fmt.moneyShort(r.price) + '</span><button type="button" data-remove="' +
          fmt.escape(r.id) + '" aria-label="Remove ' + fmt.escape(r.address || "sale") + ' from compare">×</button></span>';
      }).join("") + "</div>" +
        (list.length < 2 ? '<span class="tx-cmp-hint">Add another sale to compare</span>' : "") +
        '<button type="button" class="tx-btn tx-cmp-go"' + (list.length < 2 ? " disabled" : "") + ">Compare " + list.length + "</button>" +
        '<button type="button" class="tx-cmp-clear">Clear</button>';
    }

    // ---------------------------------------------------------- comparison
    function areaMedian(r, c) {
      var range = TX.dateRange(c.state, c.data.asOf);
      var same = c.data.rows.filter(function (x) {
        return x.category === r.category && x.date >= range[0] && x.date <= range[1] &&
          (r.city ? x.city === r.city : x.county === r.county);
      });
      return { median: median(same.map(function (x) { return x.price; })), n: same.length, area: r.city || r.county + " County" };
    }

    function renderPanel() {
      var c = opts.ctx();
      var list = rows();
      var top = Math.max.apply(null, list.map(function (r) { return r.price; }));
      var rowsDef = [
        ["Price", function (r) { return "<strong>" + fmt.money(r.price) + "</strong>" + (list.length > 1 && r.price === top ? ' <span class="tx-tag">Highest</span>' : ""); }],
        ["Vs. area median", function (r) {
          if (r.category === "Other") return '<span class="tx-muted">Property type not recorded, so no fair comparison</span>';
          var m = areaMedian(r, c);
          if (!m.median || m.n < 5) return '<span class="tx-muted">Too few comparable sales</span>';
          var ratio = r.price / m.median;
          var pct = Math.round((ratio - 1) * 100);
          // Big multiples read better as "35× the median" than "+3,400%".
          var head = ratio >= 3 ? "≈ " + (ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)) + "× the median"
            : (pct >= 0 ? "+" : "−") + Math.abs(pct) + "% vs. median";
          return head +
            '<span class="tx-addr-sub">' + fmt.escape(m.area) + " " + r.category.toLowerCase() + " median " + fmt.moneyShort(m.median) + " (" + m.n + " sales)</span>";
        }],
        ["Recorded", function (r) { return fmt.date(r.date); }],
        ["Location", function (r) { return fmt.escape([r.city, r.zip].filter(Boolean).join(" ") || "—") + '<span class="tx-addr-sub">' + fmt.escape(r.county) + " County</span>"; }],
        ["Type", function (r) { return '<span class="tx-cat"><i class="tx-swatch" data-cat="' + r.category + '"></i>' + r.category + "</span>" + (r.useDetail ? '<span class="tx-addr-sub">' + fmt.escape(fmt.title(r.useDetail)) + "</span>" : ""); }],
        ["Parties", function (r) {
          return TX.partyRows(r).map(function (p) { return '<span class="tx-addr-sub">' + p[0] + "</span>" + p[1]; }).join("");
        }],
        ["Mortgage", function (r) {
          if (!r.financed) return '<span class="tx-muted">None recorded</span>';
          return r.loan ? fmt.money(r.loan) + '<span class="tx-addr-sub">' + Math.round((r.loan / r.price) * 100) + "% of price</span>" : "Recorded";
        }],
        ["Previous sale", function (r) {
          if (!TX.hasPrevSale(r)) return '<span class="tx-muted">—</span>';
          var chg = (r.price - r.prevPrice) / r.prevPrice;
          return fmt.money(r.prevPrice) + '<span class="tx-addr-sub">' + fmt.date(r.prevDate) +
            (isFinite(chg) && Math.abs(chg) < 20 ? " · " + (chg >= 0 ? "+" : "−") + Math.abs(Math.round(chg * 100)) + "%" : "") + "</span>";
        }],
        ["Parcel", function (r) {
          return (r.parcelCount > 1 ? r.parcelCount + " parcels" : "1 parcel") + (r.parcelId ? '<span class="tx-addr-sub">' + fmt.escape(r.parcelId) + "</span>" : "");
        }],
      ];
      panel.innerHTML =
        '<div class="tx-cmp-box"><div class="tx-cmp-head"><h2 id="tx-cmp-title">Compare ' + list.length + " sales</h2>" +
        '<button type="button" class="tx-close" aria-label="Close comparison">×</button></div>' +
        '<div class="tx-cmp-scroll"><table class="tx-cmp-table"><thead><tr><th scope="col"><span class="tx-sr">Field</span></th>' +
        list.map(function (r) {
          var img = TX.aerialUrl(r, 220, 110);
          return '<th scope="col">' + (img ? '<img loading="lazy" alt="" src="' + fmt.escape(img) + '">' : '<span class="tx-cmp-noimg">No aerial</span>') +
            '<span class="tx-cmp-addr">' + fmt.escape(r.address || "Address unavailable") + "</span>" +
            '<span class="tx-cmp-acts">' + (r.located || opts.showAlways ? '<button type="button" class="tx-msg-btn" data-show="' + fmt.escape(r.id) + '">Show</button>' : "") +
            (r.parcelUrl ? '<a class="tx-msg-btn" href="' + fmt.escape(r.parcelUrl) + '" target="_blank" rel="noopener">Record ↗</a>' : "") +
            '<button type="button" class="tx-msg-btn" data-remove="' + fmt.escape(r.id) + '">Remove</button></span></th>';
        }).join("") + "</tr></thead><tbody>" +
        rowsDef.map(function (d) {
          return '<tr><th scope="row">' + d[0] + "</th>" + list.map(function (r) { return "<td>" + d[1](r) + "</td>"; }).join("") + "</tr>";
        }).join("") + "</tbody></table></div>" +
        '<p class="tx-cmp-foot">Area medians use sales of the same property type in the same city (or county) over ' + TX.dateRangeLabel(c.state, c.data.asOf) + ".</p></div>";
    }

    var lastFocus = null;
    function open() {
      if (rows().length < 2) return;
      lastFocus = document.activeElement;
      renderPanel();
      panel.hidden = false;
      panel.querySelector(".tx-close").focus();
      opts.track("compare_open", ids.length);
    }
    function close() {
      panel.hidden = true;
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    function onClick(e) {
      var rm = e.target.closest("[data-remove]");
      if (rm) { toggle(rm.getAttribute("data-remove")); return; }
      var sh = e.target.closest("[data-show]");
      if (sh) { close(); opts.onShow(sh.getAttribute("data-show")); return; }
      if (e.target.closest(".tx-cmp-go")) { open(); return; }
      if (e.target.closest(".tx-cmp-clear")) { ids = []; opts.track("compare_clear", ""); save(true); return; }
      if (e.target.closest(".tx-close") || e.target === panel) close();
    }
    tray.addEventListener("click", onClick);
    panel.addEventListener("click", onClick);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) { e.stopPropagation(); close(); }
    }, true);

    return {
      has: has,
      toggle: toggle,
      open: open,
      // From the sibling frame.
      receive: function (list) {
        ids = (list || []).slice(0, MAX);
        save(false);
      },
      refresh: function () {
        ids = ids.filter(function (id) { var c = opts.ctx(); return !c || !c.data || c.data.byId[id]; });
        renderTray();
      },
      onChange: function (fn) { listeners.push(fn); },
      list: function () { return ids.slice(); },
    };
  }

  TX.compare = { init: init, MAX: MAX };
})(window);
