/*!
 * tx-search.js — search for the South Florida Live Transactions embeds.
 * Depends on: tx-core.js (TX). Shared by the map and the table.
 *
 *  • Forgiving matching: "street" = "st", "northeast" = "ne", "5th" = "5",
 *    punctuation and case ignored, parcel IDs with or without dashes.
 *  • Grouped suggestions as you type: places (city, ZIP), people & companies
 *    (with deal count + total), individual sales, and — on the map — any
 *    street address or neighborhood via Mapbox geocoding.
 *  • Active-filter chips with one-tap removal.
 */
(function (global) {
  "use strict";

  var TX = global.TX;
  var fmt = TX.fmt;

  // ------------------------------------------------------------ normalizing
  var SYN = {
    street: "st", avenue: "ave", av: "ave", boulevard: "blvd", drive: "dr", road: "rd", lane: "ln",
    court: "ct", terrace: "ter", place: "pl", highway: "hwy", parkway: "pkwy", circle: "cir",
    causeway: "cswy", trail: "trl", square: "sq", way: "way",
    north: "n", south: "s", east: "e", west: "w",
    northeast: "ne", northwest: "nw", southeast: "se", southwest: "sw",
    apt: "", unit: "", suite: "", ste: "", // ("apartment" kept: it's a property type)
    and: "", the: "", of: "", "&": "",
    incorporated: "inc", company: "co", corporation: "corp", limited: "ltd",
  };

  // Lowercase, strip punctuation, unify abbreviations and ordinals.
  function norm(s) {
    if (!s) return "";
    return String(s)
      .toLowerCase()
      .replace(/&/g, " & ")
      .replace(/[^a-z0-9&]+/g, " ")
      .split(" ")
      .map(function (t) {
        if (!t) return "";
        if (Object.prototype.hasOwnProperty.call(SYN, t)) return SYN[t];
        var ord = t.match(/^(\d+)(st|nd|rd|th)$/);
        return ord ? ord[1] : t;
      })
      .filter(Boolean)
      .join(" ");
  }

  function tokens(q) {
    var n = norm(q);
    return n ? n.split(" ") : [];
  }

  // Every query token must start a word in the haystack (" " + norm + " ").
  function matchesAll(hay, toks) {
    for (var i = 0; i < toks.length; i++) if (hay.indexOf(" " + toks[i]) < 0) return false;
    return true;
  }

  function digitsOnly(s) {
    return String(s || "").replace(/\D+/g, "");
  }
  function idKey(s) {
    return String(s || "").replace(/[^0-9A-Za-z]+/g, "").toUpperCase();
  }

  // A parcel / deed number: 6+ digits with optional dashes, dots and spaces
  // ("50-43-44-23-000-020-160"), or one 10+ character token mixing letters
  // and digits (Broward folios like 494203AD2580).
  function parcelQuery(q) {
    var t = String(q).trim();
    if (/^[\d\s\-.]+$/.test(t) && digitsOnly(t).length >= 6) return idKey(t);
    if (/^[0-9A-Za-z\-.]+$/.test(t) && idKey(t).length >= 10 && digitsOnly(t).length >= 6) return idKey(t);
    return null;
  }

  // Split a party field into individual parties ("A; B" / glued Broward lists).
  function splitParties(s) {
    return s ? String(s).split(/\s*;\s*/).filter(Boolean) : [];
  }

  function partyKey(name) {
    return norm(fmt.party(name));
  }

  // ----------------------------------------------------- natural-language query
  // "condos in boca raton over 1m" -> { type, place, price, county, rest }.
  // Words it doesn't recognize stay as ordinary text search (rest).
  var TYPE_WORDS = [
    ["condo", ["condominiums", "condominium", "condos", "condo"]],
    ["townhouse", ["town homes", "town home", "townhouses", "townhouse", "townhomes", "townhome"]],
    ["single-family", ["single family homes", "single family home", "single family", "sfh"]],
    ["multifamily", ["apartment buildings", "apartment building", "multi family", "multifamily", "apartments", "apartment", "duplexes", "duplex", "triplex"]],
    ["office", ["office buildings", "office building", "offices", "office"]],
    ["retail", ["shopping centers", "shopping center", "retail", "stores", "store"]],
    ["industrial", ["warehouses", "warehouse", "industrial", "distribution", "flex"]],
    ["hotel", ["hotels", "hotel", "motels", "motel"]],
    ["land", ["vacant land", "vacant", "land", "lots", "lot"]],
    ["@Commercial", ["commercial"]],
    ["@Residential", ["residential"]],
  ];
  var COUNTY_WORDS = [["Miami-Dade", ["miami dade county", "miami dade", "dade county", "dade"]], ["Broward", ["broward county", "broward"]], ["Palm Beach", ["palm beach county"]]];
  var CITY_ALIASES = { "ft": "fort", "wpb": "w palm beach", "pbg": "palm beach gardens", "nmb": "n miami beach", "fll": "fort lauderdale" };
  var FILLER = { "in": 1, "at": 1, "near": 1, "sales": 1, "sale": 1, "sold": 1, "properties": 1, "property": 1, "for": 1, "with": 1, "priced": 1, "price": 1, "deals": 1, "deal": 1, "all": 1, "between": 1, "to": 1 };
  var MONEY = "\\$?\\s*(\\d+(?:\\.\\d+)?)\\s*(k|mm|m|mil|million|b|bn|billion|thousand|grand)?(?![a-z])";

  function money(num, unit, otherUnit) {
    var u = unit || otherUnit || "";
    var mult = /^(k|thousand|grand)$/.test(u) ? 1e3 : /^(m|mm|mil|million)$/.test(u) ? 1e6 : /^(b|bn|billion)$/.test(u) ? 1e9 : 1;
    var n = parseFloat(num) * mult;
    if (mult === 1 && n < 10000) n *= 1000; // "750" -> $750K, as in the price boxes
    return n;
  }

  var cityList = [];
  function parseQuery(raw, opt) {
    opt = opt || {};
    var out = { price: null, priceReversed: false, type: null, county: null, place: null, rest: "", structured: false };
    var s = " " + String(raw || "").toLowerCase().replace(/,(?=\d{3})/g, "").replace(/\s+/g, " ") + " ";
    var M = MONEY;
    function take(re, fn) {
      var m = s.match(re);
      if (!m || out.price) return;
      var r = fn(m);
      if (r) { out.price = r; s = s.replace(m[0], " "); }
    }
    // Ranges: "1m-3m", "1-3 million", "between 2 and 4 million", "500k to 2m"
    take(new RegExp("(?:between\\s+)?" + M + "\\s*(?:-|–|—|to|and)\\s*" + M), function (m) {
      if (!(m[0].indexOf("$") >= 0 || m[2] || m[4])) return null; // need a $ or unit somewhere
      var a = money(m[1], m[2], m[4]), b = money(m[3], m[4], m[2]);
      if (a > b) { out.priceReversed = true; var t = a; a = b; b = t; }
      return { min: a, max: b };
    });
    take(new RegExp("(?:over|above|more than|at least|from|min(?:imum)?|>=?)\\s*" + M), function (m) { return { min: money(m[1], m[2]) }; });
    take(new RegExp("(?:under|below|less than|up to|at most|max(?:imum)?|<=?)\\s*" + M), function (m) { return { max: money(m[1], m[2]) }; });
    take(new RegExp(M + "\\s*(?:\\+|and up|or more|plus)"), function (m) { return m[0].indexOf("$") >= 0 || m[2] ? { min: money(m[1], m[2]) } : null; });
    take(new RegExp("(?:^|\\s)(\\$\\s*\\d+(?:\\.\\d+)?\\s*(?:k|mm|m|mil|million|b|bn|billion)?|\\d+(?:\\.\\d+)?\\s*(?:k|mm|m|mil|million|b|bn|billion))(?=\\s)"), function (m) {
      var mm = m[1].match(/(\d+(?:\.\d+)?)\s*([a-z]+)?/);
      return { min: money(mm[1], mm[2]) };
    });

    var n = " " + norm(s.replace(/[$]/g, " ")).split(" ").map(function (t) { return CITY_ALIASES[t] || t; }).join(" ") + " ";
    function grab(phrase) {
      if (!phrase) return false;
      var p = " " + phrase + " ";
      var i = n.indexOf(p);
      if (i < 0) return false;
      n = n.slice(0, i) + " " + n.slice(i + p.length - 1);
      return true;
    }
    COUNTY_WORDS.some(function (cw) {
      return cw[1].some(function (w) { if (grab(norm(w))) { out.county = cw[0]; return true; } return false; });
    });
    if (!opt.noType) TYPE_WORDS.some(function (tw) {
      return tw[1].some(function (w) { if (grab(norm(w))) { out.type = tw[0]; return true; } return false; });
    });
    // Longest city name first ("palm beach gardens" before "palm beach").
    cityList.some(function (c) { if (grab(c.key)) { out.place = { kind: "city", value: c.city, label: c.city }; return true; } return false; });
    if (!out.place) {
      var z = n.match(/ (3[34]\d{3}) /);
      if (z && (zipSet[z[1]] || TX.boundaries.zip[z[1]])) { out.place = { kind: "zip", value: z[1], label: "ZIP " + z[1] }; n = n.replace(z[0], " "); }
    }
    out.rest = n.split(" ").filter(function (t) { return t && !FILLER[t]; }).join(" ");
    out.structured = !!(out.price || out.type || out.county || out.place);
    return out;
  }

  // A type word inside a matching company name ("University Drive Apartments
  // LLC", "… Land Trust") is part of the name, not a property-type filter.
  function resolveQuery(q, base) {
    var p = parseQuery(q);
    if (p.type && suggest(q, base).parties.length) p = parseQuery(q, { noType: true });
    return p;
  }

  // Apply a parsed query on top of the current filters.
  function applyParsed(state, p) {
    var s = TX.serializeState(state);
    if (p.price) { s.price = "custom"; s.priceMin = p.price.min || null; s.priceMax = p.price.max || null; }
    if (p.type) {
      if (p.type.charAt(0) === "@") { s.categories = [p.type.slice(1)]; s.useType = null; }
      else { s.useType = p.type; s.categories = TX.CATEGORIES.slice(); }
    }
    if (p.county) s.counties = [p.county];
    if (p.place) s.place = p.place;
    s.q = p.rest;
    return s;
  }

  function parsedLabel(p) {
    var bits = [];
    if (p.place && p.place.kind === "zip" && !p.place.sub) p.place.sub = zipCity(p.place.value);
    var type = p.type ? (p.type.charAt(0) === "@" ? p.type.slice(1) + " sales" : TX.USE_TYPES[p.type].label) : "Sales";
    bits.push(type + (p.place ? " in " + p.place.label + (p.place.sub ? " (" + p.place.sub + ")" : "") : p.county ? " in " + p.county + " County" : ""));
    if (p.place && p.county) bits.push(p.county + " County");
    if (p.price) bits.push(TX.priceLabel({ price: "custom", priceMin: p.price.min || null, priceMax: p.price.max || null }));
    if (p.rest) bits.push("“" + p.rest + "”");
    return bits.join(" · ");
  }

  var zipSet = {};
  // Main city of a ZIP: most common city among sales located inside it.
  var allRows = [];
  function zipCity(z) {
    var f = TX.boundaries.zip[z];
    var c = {};
    allRows.forEach(function (r) {
      if (r.city && (r.zip === z || (f && r.located && TX.inFeature(f, r.lng, r.lat)))) c[r.city] = (c[r.city] || 0) + 1;
    });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a]; })[0] || (f ? f.properties.county + " County" : "");
  }

  // Precompute per-row search fields (called once after load).
  function indexRows(rows) {
    allRows = rows;
    var cities = {};
    rows.forEach(function (r) {
      if (r.city) cities[norm(r.city)] = r.city;
      if (r.zip) zipSet[r.zip] = true;
    });
    cityList = Object.keys(cities).filter(Boolean).sort(function (a, b) { return b.length - a.length; })
      .map(function (k) { return { key: k, city: cities[k] }; });
    rows.forEach(function (r) {
      var parties = splitParties(r.buyer).concat(splitParties(r.seller));
      r._parties = parties.map(function (p) {
        return { key: partyKey(p), label: fmt.party(p) };
      });
      r._partyKeys = r._parties.map(function (p) { return p.key; });
      r._addr = " " + norm([r.address, r.city, r.zip].filter(Boolean).join(" ")) + " ";
      r._norm = " " + norm([r.address, r.city, r.zip, r.county, r.parcelId, r.instrument].concat(parties.map(fmt.party)).filter(Boolean).join(" ")) + " ";
      r._idKeys = " " + [r.parcelId, r.instrument].filter(Boolean).map(idKey).join(" ") + " ";
    });
  }

  // Free-text match used by the filter model.
  function rowMatches(r, q) {
    var pq = parcelQuery(q);
    if (pq) return r._idKeys.indexOf(pq) >= 0 || matchesAll(r._norm, tokens(q));
    var toks = tokens(q);
    return !toks.length || matchesAll(r._norm, toks);
  }

  // ------------------------------------------------------------ suggestions
  // base = rows already filtered by everything except the search itself, so
  // counts in suggestions match what picking them will show.
  function suggest(q, base) {
    var toks = tokens(q);
    var pq = parcelQuery(q);
    var out = { places: [], parties: [], sales: [] };
    if (!toks.length && !pq) return out;
    var cities = {}, zips = {}, parties = {}, sales = [];
    var zipQ = /^\d{3,5}$/.test(String(q).trim()) ? String(q).trim() : null;
    base.forEach(function (r) {
      if (r.city && matchesAll(" " + norm(r.city) + " ", toks)) {
        var c = cities[r.city] || (cities[r.city] = { kind: "city", value: r.city, label: r.city, sub: r.county, count: 0, total: 0 });
        c.count++;
        c.total += r.price;
      }
      if (zipQ && r.zip && r.zip.indexOf(zipQ) === 0) {
        var z = zips[r.zip] || (zips[r.zip] = { kind: "zip", value: r.zip, label: "ZIP " + r.zip, sub: r.city || r.county, count: 0, total: 0 });
        z.count++;
        z.total += r.price;
      }
      r._parties.forEach(function (p) {
        if (!matchesAll(" " + p.key + " ", toks)) return;
        var e = parties[p.key] || (parties[p.key] = { key: p.key, label: p.label, count: 0, total: 0, ids: {} });
        if (e.ids[r.id]) return;
        e.ids[r.id] = true;
        e.count++;
        e.total += r.price;
      });
      if (pq ? r._idKeys.indexOf(pq) >= 0 : matchesAll(r._norm, toks)) {
        sales.push({ row: r, addrHit: !pq && matchesAll(r._addr, toks) });
      }
    });
    if (zipQ && TX.boundaries.loaded) {
      Object.keys(TX.boundaries.zip).filter(function (z) { return z.indexOf(zipQ) === 0; }).slice(0, 4).forEach(function (z) {
        if (zips[z]) return;
        var f = TX.boundaries.zip[z], cityCount = {};
        var e = { kind: "zip", value: z, label: "ZIP " + z, sub: f.properties.county + " County", count: 0, total: 0 };
        base.forEach(function (r) {
          if (r.zip === z || (r.located && TX.inFeature(f, r.lng, r.lat))) {
            e.count++;
            e.total += r.price;
            if (r.city) cityCount[r.city] = (cityCount[r.city] || 0) + 1;
          }
        });
        var top = Object.keys(cityCount).sort(function (a, b) { return cityCount[b] - cityCount[a]; })[0];
        if (top) e.sub = top + " · " + e.sub;
        zips[z] = e;
      });
    }
    var byCount = function (a, b) { return b.count - a.count || b.total - a.total; };
    out.places = values(cities).sort(byCount).slice(0, 3).concat(values(zips).sort(byCount).slice(0, 2));
    out.parties = values(parties).sort(byCount).slice(0, 5);
    out.sales = sales
      .sort(function (a, b) { return (b.addrHit - a.addrHit) || b.row.price - a.row.price; })
      .slice(0, 6)
      .map(function (s) { return s.row; });
    out.saleCount = sales.length;
    return out;
  }

  function values(o) {
    return Object.keys(o).map(function (k) { return o[k]; });
  }

  // Wrap the parts of `text` that match query words in <mark>.
  function highlight(text, q) {
    var safe = fmt.escape(text || "");
    var words = String(q || "").toLowerCase().split(/[^a-z0-9]+/).filter(function (w) { return w.length > 0; });
    if (!words.length) return safe;
    var re = new RegExp("\\b(" + words.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")", "gi");
    return safe.replace(/(^|>)([^<]*)/g, function (m, a, b) {
      return a + b.replace(re, "<mark>$1</mark>");
    });
  }

  // ------------------------------------------------------------- search box
  // opts: input, panel, getBase(), onQuery(q), onPick(item), geocode(q)?,
  //       placeholder {wide, narrow}
  function searchBox(opts) {
    var input = opts.input, panel = opts.panel;
    var items = [];
    var active = -1;
    var geoSeq = 0;
    var geoTimer = null;
    var qTimer = null;
    var geoCache = {};
    var geoError = false;
    var lastParsed = null;

    function setPlaceholder() {
      if (!opts.placeholder) return;
      var w = input.getBoundingClientRect().width;
      input.placeholder = w && w < 330 ? opts.placeholder.narrow : opts.placeholder.wide;
    }
    setPlaceholder();
    requestAnimationFrame(setPlaceholder); // after first layout
    global.addEventListener("resize", setPlaceholder);

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", panel.id);
    panel.setAttribute("role", "listbox");

    function close() {
      geoSeq++; // drop any geocoding response still in flight
      panel.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      active = -1;
    }

    function hint(text) {
      items = [];
      panel.innerHTML = '<li class="tx-sg-hint" role="presentation">' + text + "</li>";
      panel.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    function render(geo) {
      var q = input.value.trim();
      if (!q) {
        close();
        return;
      }
      if (q.length < 2) {
        hint("Keep typing — enter at least 2 characters. Try an address, city, ZIP, company, person or parcel ID.");
        return;
      }
      var base = opts.getBase();
      var parsed = resolveQuery(q, base);
      lastParsed = parsed;
      var s = suggest(parsed.structured ? parsed.rest : q, base);
      if (parsed.structured && !parsed.rest) {
        // Still offer companies whose names match the whole query
        // ("Boca Raton Associates X LLLP" for "boca raton").
        var named = suggest(q, base).parties;
        s = { places: [], parties: named, sales: [], saleCount: 0 };
      }
      // Matches the current filters hide (e.g. outside the date range or price).
      var outside = 0;
      if (opts.getAll) {
        var all = opts.getAll();
        var pq0 = parcelQuery(q), toks0 = tokens(q);
        var total = 0;
        for (var k = 0; k < all.length; k++) {
          if (pq0 ? all[k]._idKeys.indexOf(pq0) >= 0 : matchesAll(all[k]._norm, toks0)) total++;
        }
        outside = Math.max(0, total - s.saleCount);
      }
      items = [];
      var html = "";
      if (parsed.structured && opts.countFor) {
        var n = opts.countFor(parsed);
        if (parsed.priceReversed) {
          html += '<li class="tx-sg-hint is-warn" role="presentation">That price range was reversed (high to low), so it’s read as ' +
            fmt.escape(TX.priceLabel({ price: "custom", priceMin: parsed.price.min, priceMax: parsed.price.max })) + ".</li>";
        }
        items.push({ kind: "smart", parsed: parsed, count: n });
        html += '<li role="option" id="tx-sg-0" class="tx-sg tx-sg-smart" data-i="0" aria-selected="false">' + icon("search") +
          '<span class="tx-sg-main">' + fmt.escape(parsedLabel(parsed)) + '<span class="tx-sg-sub">' +
          (n ? "Press Enter to show these" : "No sales match — try a wider price or another place") + "</span></span>" +
          '<span class="tx-sg-meta"><strong>' + n.toLocaleString("en-US") + "</strong> " + (n === 1 ? "sale" : "sales") + "</span></li>";
      }
      function section(title, list, fn) {
        if (!list.length) return;
        html += '<li class="tx-sg-head" role="presentation">' + title + "</li>";
        list.forEach(function (x) {
          var i = items.length;
          items.push(x);
          html += '<li role="option" id="tx-sg-' + i + '" class="tx-sg" data-i="' + i + '" aria-selected="false">' + fn(x) + "</li>";
        });
      }
      section("Places", s.places, function (p) {
        return icon("pin") + '<span class="tx-sg-main">' + highlight(p.label, q) +
          '<span class="tx-sg-sub">' + fmt.escape(p.sub || "") + "</span></span>" +
          '<span class="tx-sg-meta">' + count(p.count) + "</span>";
      });
      section("People & companies", s.parties.map(function (p) { return Object.assign({ kind: "party" }, p); }), function (p) {
        return icon("person") + '<span class="tx-sg-main">' + highlight(p.label, q) +
          '<span class="tx-sg-sub">' + fmt.moneyShort(p.total) + " total</span></span>" +
          '<span class="tx-sg-meta">' + count(p.count) + "</span>";
      });
      section("Sales", s.sales.map(function (r) { return { kind: "sale", row: r }; }), function (x) {
        var r = x.row;
        return icon("deed") + '<span class="tx-sg-main">' + highlight(r.address || "Address unavailable", q) +
          '<span class="tx-sg-sub">' + fmt.escape([r.city, r.county].filter(Boolean).join(", ")) + " · " + fmt.dateShort(r.date) +
          (r.located ? "" : " · not on map") + "</span></span>" +
          '<span class="tx-sg-meta"><strong>' + fmt.moneyShort(r.price) + "</strong></span>";
      });
      if (geo && geo.length) {
        section("Go to on the map", geo.map(function (g) { return Object.assign({ kind: "geo" }, g); }), function (g) {
          return icon("go") + '<span class="tx-sg-main">' + highlight(g.label, q) +
            '<span class="tx-sg-sub">' + fmt.escape(g.sub || "") + "</span></span>";
        });
      }
      if (parsed.structured && !parsed.rest) {
        if (s.parties.length) {
          html += '<li class="tx-sg-head" role="presentation">People &amp; companies</li>';
          s.parties.forEach(function (p) {
            var i = items.length;
            items.push(Object.assign({ kind: "party" }, p));
            html += '<li role="option" id="tx-sg-' + i + '" class="tx-sg" data-i="' + i + '" aria-selected="false">' + icon("person") +
              '<span class="tx-sg-main">' + highlight(p.label, q) + '<span class="tx-sg-sub">' + fmt.moneyShort(p.total) + " total</span></span>" +
              '<span class="tx-sg-meta">' + count(p.count) + "</span></li>";
          });
        }
        panel.innerHTML = html;
        panel.hidden = false;
        input.setAttribute("aria-expanded", "true");
        active = -1;
        return;
      }
      // Always offer the plain text filter last.
      var isId = !!parcelQuery(q);
      var allItem = { kind: "text", q: q, count: s.saleCount };
      items.push(allItem);
      html += '<li role="option" id="tx-sg-' + (items.length - 1) + '" class="tx-sg tx-sg-all" data-i="' + (items.length - 1) + '" aria-selected="false">' +
        icon("search") + '<span class="tx-sg-main">' + (s.saleCount
          ? "Show all " + s.saleCount.toLocaleString("en-US") + " matching sales"
          : isId
            ? "No sale with parcel or deed number “" + fmt.escape(q) + "” in the current view"
            : "No sales match “" + fmt.escape(q) + "” with the current filters") + "</span></li>";
      if (outside) {
        items.push({ kind: "widen", q: q, count: outside });
        html += '<li role="option" id="tx-sg-' + (items.length - 1) + '" class="tx-sg tx-sg-widen" data-i="' + (items.length - 1) + '" aria-selected="false">' +
          icon("search") + '<span class="tx-sg-main">' + outside.toLocaleString("en-US") + " more " + (outside === 1 ? "match" : "matches") +
          ' outside your current filters<span class="tx-sg-sub">Include all ' + "60 days, prices, types and counties</span></span></li>";
      } else if (!s.saleCount && !geo) {
        html += '<li class="tx-sg-hint" role="presentation">' + (isId
          ? "Parcel IDs are the county folio (Miami-Dade 13 digits, Broward 12 characters, Palm Beach 17 digits) or a deed instrument number."
          : "Check the spelling, or try part of a name — “Related” finds “Related Companies”.") + "</li>";
      }
      if (geoError && opts.geocode) {
        html += '<li class="tx-sg-hint" role="presentation">Address and place search isn’t available right now; sales search still works.</li>';
      }
      panel.innerHTML = html;
      panel.hidden = false;
      input.setAttribute("aria-expanded", "true");
      active = -1;
    }

    function count(n) {
      return n.toLocaleString("en-US") + (n === 1 ? " sale" : " sales");
    }

    function icon(name) {
      var paths = {
        pin: '<path d="M10 18s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z"/><circle cx="10" cy="8" r="2"/>',
        person: '<circle cx="10" cy="6.5" r="3"/><path d="M4 17c.8-3.2 3.1-5 6-5s5.2 1.8 6 5"/>',
        deed: '<path d="M5 2.5h7l3 3v12H5z"/><path d="M8 9h4M8 12h4"/>',
        go: '<path d="M10 2l7 16-7-4-7 4z"/>',
        search: '<circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l4.5 4.5"/>',
      };
      return '<svg class="tx-sg-icon" aria-hidden="true" viewBox="0 0 20 20">' + paths[name] + "</svg>";
    }

    function move(d) {
      var opts2 = panel.querySelectorAll(".tx-sg");
      if (!opts2.length) return;
      active = (active + d + opts2.length) % opts2.length;
      opts2.forEach(function (o, i) {
        o.classList.toggle("is-active", i === active);
        o.setAttribute("aria-selected", String(i === active));
      });
      input.setAttribute("aria-activedescendant", opts2[active].id);
      opts2[active].scrollIntoView({ block: "nearest" });
    }

    function pick(i) {
      var it = items[i];
      if (!it) return;
      close();
      opts.onPick(it);
    }

    input.addEventListener("input", function () {
      if (/(^|\s)3[34]\d{0,3}(\s|$)/.test(input.value) && !TX.boundaries.loaded) {
        TX.loadBoundaries().then(function () {
          if (document.activeElement === input) render(geoCache[input.value.trim()]);
        }).catch(function () {});
      }
      clearTimeout(qTimer);
      qTimer = setTimeout(function () {
        var p = resolveQuery(input.value, opts.getBase());
        // Structured queries ("condos over 1m") apply on Enter / pick; live,
        // only their leftover words filter as text.
        opts.onQuery(p.structured ? p.rest : input.value);
        render(geoCache[input.value.trim()]);
      }, 120);
      if (opts.geocode) {
        clearTimeout(geoTimer);
        var q = input.value.trim();
        if (q.length >= 4 && !parcelQuery(q)) {
          geoTimer = setTimeout(function () {
            var seq = ++geoSeq;
            if (geoCache[q]) return;
            opts.geocode(q).then(function (res) {
              geoError = false;
              geoCache[q] = res;
              if (seq === geoSeq && input.value.trim() === q && document.activeElement === input) render(res);
            }).catch(function () {
              geoError = true;
              if (seq === geoSeq && input.value.trim() === q && document.activeElement === input) render();
            });
          }, 350);
        }
      }
    });
    input.addEventListener("focus", function () {
      if (input.value.trim()) render(geoCache[input.value.trim()]);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); if (panel.hidden) render(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") {
        // preventDefault: the same keystroke must not "click" whatever we focus next.
        e.preventDefault();
        if (active >= 0) pick(active);
        else if (items[0] && items[0].kind === "smart") pick(0);
        else {
          close();
          opts.onQuery(input.value, true);
        }
      } else if (e.key === "Escape") {
        if (!panel.hidden) { e.stopPropagation(); close(); }
        else if (input.value) { input.value = ""; opts.onQuery(""); }
      }
    });
    panel.addEventListener("mousedown", function (e) {
      e.preventDefault(); // keep focus in the input
    });
    panel.addEventListener("click", function (e) {
      var li = e.target.closest(".tx-sg");
      if (li) pick(+li.getAttribute("data-i"));
    });
    document.addEventListener("click", function (e) {
      if (!panel.hidden && !panel.contains(e.target) && e.target !== input) close();
    });
    // "/" focuses search from anywhere in the embed.
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName)) {
        e.preventDefault();
        input.focus();
        input.select();
      }
    });

    return {
      close: close,
      set: function (v) {
        input.value = v || "";
      },
      // Drop a typed-but-not-yet-applied query (the other frame just sent
      // newer filters; a late local apply would overwrite them).
      cancel: function () {
        clearTimeout(qTimer);
        clearTimeout(geoTimer);
        geoSeq++;
      },
    };
  }

  // --------------------------------------------------------- active chips
  // Removable chips for everything that narrows the view.
  function activeChips(el, state, onChange, opts) {
    opts = opts || {};
    var d = TX.defaultState();
    var chips = [];
    if (state.q) chips.push({ key: "q", label: "“" + state.q + "”" });
    if (state.place) chips.push({ key: "place", label: state.place.label, icon: "pin" });
    if (state.party) chips.push({ key: "party", label: state.party.label, icon: "person" });
    if (state.bbox) chips.push({ key: "bbox", label: state.bboxLabel ? "Area: " + state.bboxLabel : "Map area", icon: "pin" });
    if (state.dateFrom && opts.asOf) chips.push({ key: "dates", label: TX.dateRangeLabel(state, opts.asOf) });
    if (state.useType && TX.USE_TYPES[state.useType]) chips.push({ key: "useType", label: TX.USE_TYPES[state.useType].label });
    if (!opts.full && state.price !== d.price) chips.push({ key: "price", label: TX.priceLabel(state) });
    if (!opts.full && state.counties.length !== d.counties.length) chips.push({ key: "counties", label: state.counties.join(", ") });
    if (opts.full) {
      if (state.counties.length !== d.counties.length) chips.push({ key: "counties", label: state.counties.join(", ") });
      if (state.categories.length !== d.categories.length) chips.push({ key: "categories", label: state.categories.join(", ") });
      if (state.price !== d.price) chips.push({ key: "price", label: TX.priceLabel(state) });
      if (state.financed !== d.financed) chips.push({ key: "financed", label: state.financed === "financed" ? "Financed" : "No mortgage recorded" });
      if (state.days !== d.days) chips.push({ key: "days", label: "Last " + state.days + " days" });
    }
    el.hidden = !chips.length;
    if (!chips.length) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = chips.map(function (c) {
      return '<button type="button" class="tx-active-chip" data-key="' + c.key + '" aria-label="Remove filter: ' + fmt.escape(c.label) + '">' +
        '<span class="tx-active-label">' + fmt.escape(c.label) + '</span><span class="tx-x" aria-hidden="true">×</span></button>';
    }).join("") + (chips.length > 1 ? '<button type="button" class="tx-clear-all" data-key="all">Clear all</button>' : "");
    el.onclick = function (e) {
      var b = e.target.closest("[data-key]");
      if (!b) return;
      var k = b.getAttribute("data-key");
      var s = TX.serializeState(state);
      if (k === "all") s = TX.defaultState();
      else if (k === "price") { s.price = d.price; s.priceMin = null; s.priceMax = null; }
      else if (k === "bbox") { s.bbox = null; s.bboxLabel = null; }
      else if (k === "dates") { s.dateFrom = null; s.dateTo = null; }
      else s[k] = Array.isArray(d[k]) ? d[k].slice() : d[k];
      onChange(s, "chip:" + k);
    };
  }

  TX.search = {
    parseQuery: parseQuery,
    resolveQuery: resolveQuery,
    applyParsed: applyParsed,
    norm: norm,
    indexRows: indexRows,
    rowMatches: rowMatches,
    suggest: suggest,
    searchBox: searchBox,
    activeChips: activeChips,
    partyKey: partyKey,
  };
})(window);
