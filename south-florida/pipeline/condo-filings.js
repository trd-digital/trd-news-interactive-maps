/*!
 * condo-filings.js — PP_CONFIG for the South Florida new-condo filings map and
 * table (south-florida-condominium-development-planning-{map,table}.html).
 *
 * Data: static.therealdeal.com/interactive-maps/south-florida-condo-pipeline-map_data.geojson,
 * rewritten each weekday by TRD's Airflow job (sofla_condo_pipeline_map_data_s3_upload)
 * from Florida DBPR's condominium filings. `normalize` is the only place that
 * knows its field names. Names and addresses come in capitals.
 */
(function (global) {
  "use strict";

  // DBPR's primary status: "Acknowledged" (filing received) and "Approved".
  var STAGES = [
    { id: "submitted", label: "Submitted", long: "Submitted (DBPR: acknowledged)", color: { light: "#2a78d6", dark: "#3987e5" } },
    { id: "accepted", label: "Accepted", long: "Accepted (DBPR: approved)", color: { light: "#1baf7a", dark: "#199e70" } },
    { id: "other", label: "Other", color: { light: "#9a9993", dark: "#8a8984" } },
  ];
  var COUNTY = { Dade: "Miami-Dade", "Miami-Dade": "Miami-Dade", Broward: "Broward", "Palm Beach": "Palm Beach" };
  var COUNTY_IDS = ["Miami-Dade", "Broward", "Palm Beach"];

  function esc(s) { return PP.fmt.escape(s); }
  // "410 NE 35TH TER, MIAMI, FL 33137" -> street, city, zip
  function splitAddress(s) {
    var parts = String(s || "").split(",").map(function (x) { return x.trim(); });
    var zip = (String(s).match(/\b(\d{5})(?:-\d{4})?\s*$/) || [])[1] || null;
    return { street: parts[0] || "", city: parts.length > 2 ? parts[parts.length - 2] : parts[1] || "", zip: zip };
  }

  function normalize(f, i, h) {
    var p = f.properties || {};
    var a = splitAddress(p["Street City State Zip"]);
    var s = String(p["Primary Status"] || "").toLowerCase();
    var entity = h.nameCase(p["Developer Name"] || "");
    var group = p.TRD_Developer || null;
    var filed = h.parseDate(p["Recorded Date"]);
    // DBPR's legal names run long ("1400 Biscayne Condo, a Condominium Within a
    // Portion of a Buildin"); the map and table show the short name.
    var filedName = h.nameCase(p["Condo Name"] || "");
    var short = filedName.replace(/(,\s*|\s+a\s+)(a\s+)?(land\s+)?condo(minium)?\b.*$/i, "").replace(/[,\s]+$/, "");
    var r = {
      id: "c" + (p["Project Number"] || i),
      name: short || filedName || "Unnamed condo",
      filedName: filedName,
      street: h.nameCase(a.street),
      city: a.city ? h.nameCase(a.city) : null,
      zip: a.zip,
      county: COUNTY[p.County] || p.County || null,
      units: h.toNum(p.Units),
      filed: filed,
      year: filed ? String(filed.getFullYear()) : null,
      stage: /approv/.test(s) ? "accepted" : /acknowl/.test(s) ? "submitted" : "other",
      dbpr: [p["Primary Status"], p["Secondary Status"]].filter(Boolean).join(", "),
      developer: group || entity || null,
      entity: entity,
      isGroup: !!group,
      association: h.nameCase(p["Managing Entity Name"] || ""),
      projectNo: p["Project Number"] || null,
      fileNo: p["File Number"] || null,
      website: /^https?:\/\//.test(p["Property Website"] || "") ? p["Property Website"] : null,
    };
    r.statusText = (STAGES.filter(function (x) { return x.id === r.stage; })[0] || {}).label;
    r.sub = [r.street, r.city].filter(Boolean).join(", ");
    r.hay = [r.filedName, r.street, r.city, r.zip, r.county, r.developer, r.entity, r.association, r.projectNo].join(" ");
    return r;
  }

  function detail(r, where) {
    var F = PP.fmt;
    var out = '<div class="tx-tags">' + PP.stageTag(r) + (r.county ? '<span class="tx-tag">' + esc(r.county) + "</span>" : "") + "</div>";
    if (r.units) out += '<p class="pp-share-text"><strong>' + F.num(r.units) + "</strong> units</p>";
    var facts = [];
    if (r.developer) facts.push(["Developer", esc(r.developer) + (r.isGroup && r.entity ? '<span class="pp-entity tx-muted">Filed as ' + esc(r.entity) + "</span>" : "")]);
    if (r.filed) facts.push(["Recorded", F.date(r.filed)]);
    if (where === "row" && r.street) facts.push(["Address", esc([r.street, r.city].filter(Boolean).join(", ") + (r.zip ? " " + r.zip : ""))]);
    else if (r.zip) facts.push(["ZIP", esc(r.zip)]);
    if (r.filedName && r.filedName !== r.name) facts.push(["Filed as", esc(r.filedName)]);
    if (r.association) facts.push(["Association", esc(r.association)]);
    if (r.dbpr) facts.push(["DBPR status", esc(r.dbpr) + (r.projectNo ? ' <span class="tx-muted">· ' + esc(r.projectNo) + "</span>" : "")]);
    out += PP.factsHtml(facts, where === "row" ? "tx-facts" : "tx-dl");
    if (r.website) out += '<p class="pp-story"><a class="pp-story-link" href="' + esc(r.website) + '" target="_blank" rel="noopener">Project website <span aria-hidden="true">↗</span></a></p>';
    return out;
  }
  function tip(r) {
    return "<strong>" + esc(r.name) + "</strong>" + esc(r.developer || r.sub) +
      " <span>· " + (r.units ? PP.fmt.num(r.units) + " units · " : "") + esc(r.statusText) + (r.filed ? " · " + PP.fmt.date(r.filed, "short") : "") + "</span>";
  }
  function note(data, compact) {
    if (compact) return "New condo filings with Florida’s DBPR · Circle size: units";
    var newest = data.rows.reduce(function (m, r) { return r.filed && (!m || r.filed > m) ? r.filed : m; }, null);
    return "New condominium projects in Miami-Dade, Broward and Palm Beach filed with Florida’s Department of Business and Professional Regulation (DBPR), from its public filings; TRD updates the list each weekday" +
      (newest ? " (newest recorded " + PP.fmt.date(newest) + ")" : "") +
      ". “Submitted”: DBPR has acknowledged the filing; “accepted”: DBPR has approved it. Dates are DBPR’s recorded dates. Where TRD knows the company behind a filing it is named; otherwise the filing entity is shown, in gray.";
  }

  function sum(rows) {
    return rows.reduce(function (n, r) { return n + (r.units || 0); }, 0);
  }
  function median(list) {
    if (!list.length) return null;
    var s = list.slice().sort(function (a, b) { return a - b; }), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function kpis(rows, data, kpi) {
    var by = {};
    rows.forEach(function (r) { by[r.stage] = (by[r.stage] || 0) + 1; });
    var mix = STAGES.filter(function (s) { return by[s.id]; }).map(function (s) {
      return '<i style="width:' + (by[s.id] / rows.length * 100).toFixed(2) + "%;background:var(--pp-" + s.id + ')" title="' + esc(s.label + ": " + by[s.id]) + '"></i>';
    }).join("");
    var newest = rows.reduce(function (m, r) { return r.filed && (!m || r.filed > m) ? r.filed : m; }, null);
    var thisYear = String(new Date().getFullYear());
    var ytd = rows.filter(function (r) { return r.year === thisYear; });
    return kpi("Filings", rows.length.toLocaleString("en-US"), (by.accepted || 0).toLocaleString("en-US") + " accepted · " + (by.submitted || 0).toLocaleString("en-US") + " submitted",
        rows.length ? '<span class="cx-mix" aria-hidden="true">' + mix + "</span>" : "") +
      kpi("Units", PP.fmt.num(sum(rows)), rows.length ? "Median " + PP.fmt.num(median(rows.map(function (r) { return r.units; }).filter(Boolean))) + " per project" : "&nbsp;") +
      kpi("Recorded in " + thisYear, ytd.length.toLocaleString("en-US"), PP.fmt.num(sum(ytd)) + " units") +
      kpi("Newest recorded", newest ? newest.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—", newest ? String(newest.getFullYear()) : "&nbsp;");
  }

  global.PP_CONFIG = {
    ns: "trd-sofla-condo-filings",
    pageRe: /south-florida-condominium-development-planning-(map|table)/,
    dataFile: "https://static.therealdeal.com/interactive-maps/south-florida-condo-pipeline-map_data.geojson",
    eventCategory: "south-florida-condo-dev-planning",
    noun: { one: "condo filing", many: "condo filings", manyCap: "Filings", kind: "Condo" },
    searchLabel: "Search condo filings",
    searchShort: "Search condos",
    searchLong: "Search condo, developer, address or city",
    loadError: "The condo filings couldn’t load. Please try again later.",
    legendTitle: "DBPR filing",
    sizeLabel: "Circle size: units",
    sizeKey: [25, 100, 400],
    sizeScale: 0.6,
    stages: STAGES,
    stageGroup: "status",
    groups: [
      { key: "status", field: "stage", label: "Status", param: "status", values: STAGES.map(function (s) { return { id: s.id, label: s.label }; }), dropEmpty: true,
        hint: "“Submitted”: DBPR has acknowledged the filing. “Accepted”: DBPR has approved it." },
      { key: "county", field: "county", label: "County", param: "county", values: COUNTY_IDS.map(function (c) { return { id: c, label: c }; }), dropEmpty: true },
      { key: "year", field: "year", label: "Recorded", param: "year", chipLabel: "Recorded",
        values: function (rows) {
          var ys = {};
          rows.forEach(function (r) { if (r.year) ys[r.year] = 1; });
          return Object.keys(ys).sort().reverse().map(function (y) { return { id: y, label: y }; });
        } },
    ],
    normalize: normalize,
    detail: detail,
    tip: tip,
    note: note,
    table: {
      kpis: kpis,
      cols: [
        { key: "name", label: "Condo", cell: function (r) {
          return '<span class="tx-addr">' + esc(r.name) + '<span class="tx-addr-sub">' + esc(r.street) + "</span></span>";
        } },
        { key: "developer", label: "Developer", cls: "cx-col-type", cell: function (r) {
          return r.developer ? (r.isGroup ? esc(r.developer) : '<span class="tx-muted">' + esc(r.developer) + "</span>") : "—";
        } },
        { key: "city", label: "City", cls: "tx-nowrap", cell: function (r) { return esc(r.city || "—"); } },
        { key: "units", label: "Units", num: true, dir: -1, cell: function (r) { return PP.fmt.num(r.units); } },
        { key: "filed", label: "Recorded", cls: "tx-nowrap", dir: -1, cell: function (r) { return r.filed ? PP.fmt.date(r.filed) : "—"; } },
        { key: "stage", label: "Status", cls: "cx-col-status", cell: function (r) { return '<span class="tx-cat">' + PP.swatch(r.stage) + esc(r.statusText) + "</span>"; } },
      ],
      cardValue: function (r) { return r.units ? PP.fmt.num(r.units) + " units" : ""; },
      cardMeta: function (r) {
        return '<span class="tx-cat">' + PP.swatch(r.stage) + esc(r.statusText) + "</span>" + (r.filed ? "<span>" + PP.fmt.date(r.filed) + "</span>" : "") +
          (r.developer ? "<span>" + esc(r.developer) + "</span>" : "");
      },
      tabs: [
        { id: "recent", label: "Newest", sort: { key: "filed", dir: -1 } },
        { id: "largest", label: "Largest", sort: { key: "units", dir: -1 } },
        { id: "developer", label: "By developer", group: {
          label: "Developer",
          keyOf: function (r) { return r.developer; },
          sub: function (rows) { return rows[0].isGroup ? "" : "Filing entity"; },
          cols: [{ key: "units", label: "Units", val: sum }],
          note: "Developers named by TRD where known; otherwise the filing entity. Tap a name to see its filings.",
          pick: function (s, name) { s.q = name; return s; },
        } },
        { id: "city", label: "By city", group: {
          label: "City",
          keyOf: function (r) { return r.city; },
          sub: function (rows) { return rows[0].county || ""; },
          cols: [{ key: "units", label: "Units", val: sum }],
          note: "Cities from the filings’ addresses. Tap a name to filter to it.",
          pick: function (s, name) { s.city = name; return s; },
        } },
      ],
    },
  };
})(window);
