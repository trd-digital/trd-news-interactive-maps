/*!
 * live-local.js — PP_CONFIG for the South Florida Live Local Act map and table
 * (south-florida-live-local-{map,table}.html).
 *
 * Data: south-florida-live-local.geojson, written by
 * _live_local_auto_update/LiveLocalAutoUpdater.ipynb from TRD's Live Local
 * Google Sheet (tab ConfirmedSites). `normalize` is the only place that knows
 * its field names. Numbers come as strings; "--" means not disclosed.
 */
(function (global) {
  "use strict";

  // Stage colors: the tx.css palette slots (validated in both themes).
  var STAGES = [
    { id: "proposed", label: "Proposed", color: { light: "#2a78d6", dark: "#3987e5" } },
    { id: "approved", label: "Approved", color: { light: "#1baf7a", dark: "#199e70" } },
    { id: "building", label: "Financed or under construction", short: "Under way", color: { light: "#eb6834", dark: "#d95926" } },
    { id: "built", label: "Completed", color: { light: "#52514e", dark: "#c3c2b7" } },
    { id: "other", label: "Other", color: { light: "#9a9993", dark: "#8a8984" } },
  ];
  function stageOf(status) {
    var s = String(status || "").toLowerCase();
    if (/complet|built|open/.test(s)) return "built";
    if (/construction|financ|broke ground|groundbreaking/.test(s)) return "building";
    if (/approv/.test(s)) return "approved";
    if (/propos|plan|pre-?app|filed|submit/.test(s)) return "proposed";
    return "other";
  }
  var COUNTY_IDS = ["Miami-Dade", "Broward", "Palm Beach"];

  function esc(s) { return global.PP ? PP.fmt.escape(s) : String(s); }
  function storyDate(url) {
    var m = String(url || "").match(/\/(20\d\d)\/(\d\d)\/(\d\d)\//);
    return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null;
  }
  function host(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
  }

  function normalize(f, i, h) {
    var p = f.properties || {};
    var dev = p.Developers || p.Developer || "";
    var project = p["Project Name"] || "";
    var ll = h.toNum(p["Live Local Units"]);
    var total = h.toNum(p["Total Units"]);
    var pct = h.toNum(p["Percent Live Local"]);
    var county = p.County || null;
    var city = p.City === "Unincorporated" && county ? "Unincorporated " + county : p.City || null;
    var story = p["Recent Coverage"] || null;
    // Untitled projects go by their street address ("824 Alton Road").
    var street = String(p.Address || "").split(/,| in /)[0].trim();
    var r = {
      id: "ll" + i,
      name: project || street || dev || "Unnamed project",
      developer: dev,
      project: project,
      architect: p.Architect || null,
      sub: project ? p.Address || "" : dev,
      address: p.Address || "",
      status: p.Status || "",
      statusText: p.Status || "Status not reported",
      stage: stageOf(p.Status),
      ll: ll,
      total: total,
      pct: pct != null ? pct : ll != null && total ? Math.round(ll / total * 100) : null,
      units: total || ll || null,
      // Drop the "–– Reporter" sign-off; the sheet types em dashes as two en dashes.
      desc: String(p.Description || "").replace(/\s*[–—-]{2}\s*[A-Z][\w.' ]+$/, "").replace(/\s*[–-]{2}\s*/g, " — ").trim(),
      story: story,
      storyHost: host(story),
      covered: h.parseDate(p["Coverage Date"]) || storyDate(story),
      city: city,
      county: county,
    };
    r.hay = [r.name, dev, r.address, r.architect, city, county, r.status].join(" ");
    return r;
  }

  function fmtDate(d) { return PP.fmt.date(d); }
  function countyTag(r) {
    return r.county ? '<span class="tx-tag">' + esc(r.county) + "</span>" : "";
  }
  function detail(r, where) {
    var F = PP.fmt, out = '<div class="tx-tags">' + PP.stageTag(r) + countyTag(r) + "</div>";
    if (r.ll != null || r.total != null) out += PP.shareBar(r.ll, r.total, r.ll != null ? "Live Local units" : "units in all");
    else if (r.pct != null) out += '<p class="pp-share-text"><strong>' + r.pct + "%</strong> Live Local units <span class=\"tx-muted\">· unit count not disclosed</span></p>";
    if (r.desc) out += '<p class="pp-desc">' + esc(r.desc) + "</p>";
    var facts = [];
    if (r.developer) facts.push(["Developer", esc(r.developer)]);
    if (!r.project && where !== "row" && r.address !== r.name) facts.push(["Address", esc(r.address)]);
    if (r.architect) facts.push(["Architect", esc(r.architect)]);
    if (where === "row" && r.address) facts.push(["Address", esc(r.address)]);
    if (r.city) facts.push(["Where", esc(r.city) + (r.county && r.city.indexOf(r.county) < 0 ? " · " + esc(r.county) + " County" : "")]);
    if (r.status && r.stage !== "other" && PP.stage(r.stage).label.toLowerCase() !== r.status.toLowerCase()) facts.push(["Status", esc(r.status)]);
    if (r.covered) facts.push(["Last covered", fmtDate(r.covered)]);
    out += PP.factsHtml(facts, where === "row" ? "tx-facts" : "tx-dl");
    if (r.story) {
      out += '<p class="pp-story"><a class="pp-story-link" href="' + esc(r.story) + '" target="_blank" rel="noopener">' +
        (/therealdeal\.com$/.test(r.storyHost) ? "Read TRD’s latest story" : "Read the latest story <span class=\"tx-muted\">(" + esc(r.storyHost) + ")</span>") +
        ' <span aria-hidden="true">↗</span></a></p>';
    }
    return out;
  }
  function tip(r) {
    return "<strong>" + esc(r.name) + "</strong>" + esc(r.developer || r.address) +
      " <span>· " + esc(PP.stage(r.stage).short || PP.stage(r.stage).label) + (r.total ? " · " + PP.fmt.num(r.total) + " units" : "") + "</span>";
  }
  function note(data, compact) {
    if (compact) return "Live Local Act projects tracked by The Real Deal · Circle size: total units";
    return "Live Local Act projects in Miami-Dade, Broward and Palm Beach tracked by The Real Deal from its reporting" +
      (data.generated ? ", updated " + PP.fmt.date(data.generated) : "") +
      ". Florida’s 2023 Live Local Act lets developers override local limits on use, height and density when at least 40% of a building’s units are affordable to households earning up to 120% of the area median income. Unit counts are as last reported; — means not disclosed.";
  }

  function sum(rows, k) {
    return rows.reduce(function (n, r) { return n + (r[k] || 0); }, 0);
  }
  function kpis(rows, data, kpi) {
    var by = {};
    rows.forEach(function (r) { by[r.stage] = (by[r.stage] || 0) + 1; });
    var mix = STAGES.filter(function (s) { return by[s.id]; }).map(function (s) {
      return '<i style="width:' + (by[s.id] / rows.length * 100).toFixed(2) + "%;background:var(--pp-" + s.id + ')" title="' + esc(s.label + ": " + by[s.id]) + '"></i>';
    }).join("");
    var llKnown = rows.filter(function (r) { return r.ll != null; }).length;
    var totKnown = rows.filter(function (r) { return r.total != null; }).length;
    var further = (by.approved || 0) + (by.building || 0) + (by.built || 0);
    return kpi("Projects", rows.length.toLocaleString("en-US"), "Tracked by TRD", rows.length ? '<span class="cx-mix" aria-hidden="true">' + mix + "</span>" : "") +
      kpi("Live Local units", PP.fmt.num(sum(rows, "ll")), llKnown < rows.length ? "In " + PP.plural(llKnown, "project") + " with a count" : "Affordable or workforce") +
      kpi("Total units", PP.fmt.num(sum(rows, "total")), totKnown < rows.length ? "In " + PP.plural(totKnown, "project") + " with a count" : "&nbsp;") +
      kpi("Approved or further", further.toLocaleString("en-US"), (by.building || by.built ? ((by.building || 0) + (by.built || 0)).toLocaleString("en-US") + " financed, building or built" : "&nbsp;"));
  }
  function units(v) {
    return v == null ? '<span class="tx-muted">—</span>' : PP.fmt.num(v);
  }

  global.PP_CONFIG = {
    ns: "trd-sofla-live-local",
    pageRe: /south-florida-live-local-(map|table)/,
    dataFile: "south-florida-live-local.geojson",
    eventCategory: "south-florida-live-local",
    noun: { one: "project", many: "projects", manyCap: "Projects", kind: "Project" },
    searchLabel: "Search Live Local projects",
    searchShort: "Search projects",
    searchLong: "Search project, developer, address or city",
    loadError: "The Live Local projects couldn’t load. Please try again later.",
    legendTitle: "Stage",
    sizeLabel: "Circle size: total units",
    sizeKey: [100, 500, 2000],
    sizeScale: 0.32,
    stages: STAGES,
    stageGroup: "stage",
    groups: [
      { key: "stage", field: "stage", label: "Stage", param: "stage", chipLabel: "Stage", values: STAGES.map(function (s) { return { id: s.id, label: s.label }; }), dropEmpty: true },
      { key: "county", field: "county", label: "County", param: "county", values: COUNTY_IDS.map(function (c) { return { id: c, label: c }; }), dropEmpty: true },
    ],
    normalize: normalize,
    detail: detail,
    tip: tip,
    note: note,
    table: {
      kpis: kpis,
      cols: [
        { key: "name", label: "Project", cell: function (r) {
          return '<span class="tx-addr">' + esc(r.name) + (r.project ? '<span class="tx-addr-sub">' + esc(r.address) + "</span>" : "") + "</span>";
        } },
        { key: "developer", label: "Developer", cls: "cx-col-type", cell: function (r) { return esc(r.developer || "—"); } },
        { key: "city", label: "City", cls: "tx-nowrap", cell: function (r) { return esc(r.city || "—"); } },
        { key: "stage", label: "Stage", cell: function (r) { return '<span class="tx-cat">' + PP.swatch(r.stage) + esc(PP.stage(r.stage).short || PP.stage(r.stage).label) + "</span>"; },
          sort: function (r) { return STAGES.map(function (s) { return s.id; }).indexOf(r.stage); } },
        { key: "ll", label: "Live Local units", num: true, dir: -1, cell: function (r) { return units(r.ll); } },
        { key: "total", label: "Total units", num: true, dir: -1, cls: "cx-col-units", cell: function (r) { return units(r.total); } },
        { key: "covered", label: "Last covered", cls: "tx-nowrap cx-col-status", dir: -1, cell: function (r) { return r.covered ? PP.fmt.date(r.covered, "short") : "—"; },
          sort: function (r) { return r.covered; } },
      ],
      cardValue: function (r) { return r.total ? PP.fmt.num(r.total) + " units" : ""; },
      cardMeta: function (r) {
        return '<span class="tx-cat">' + PP.swatch(r.stage) + esc(PP.stage(r.stage).short || PP.stage(r.stage).label) + "</span>" +
          (r.ll != null ? "<span>" + PP.fmt.num(r.ll) + " Live Local</span>" : "") + (r.city ? "<span>" + esc(r.city) + "</span>" : "");
      },
      tabs: [
        { id: "recent", label: "Latest news", sort: { key: "covered", dir: -1 } },
        { id: "largest", label: "Largest", sort: { key: "total", dir: -1 } },
        { id: "developer", label: "By developer", group: {
          label: "Developer",
          keyOf: function (r) { return r.developer || null; },
          sub: function (rows) { return rows.map(function (r) { return r.project; }).filter(Boolean).slice(0, 3).join(", "); },
          cols: [
            { key: "ll", label: "Live Local units", val: function (rows) { return sum(rows, "ll"); } },
            { key: "total", label: "Total units", val: function (rows) { return sum(rows, "total"); } },
          ],
          note: "Developers as TRD reported them; joint ventures are listed under the names given. Tap a name to see its projects.",
          pick: function (s, name) { s.q = name; return s; },
        } },
        { id: "city", label: "By city", group: {
          label: "City",
          keyOf: function (r) { return r.city; },
          sub: function (rows) { return rows[0].county || ""; },
          cols: [
            { key: "ll", label: "Live Local units", val: function (rows) { return sum(rows, "ll"); } },
            { key: "total", label: "Total units", val: function (rows) { return sum(rows, "total"); } },
          ],
          note: "Cities from each project’s map location. Tap a name to filter to it.",
          pick: function (s, name) { s.city = name; return s; },
        } },
      ],
    },
  };
})(window);
