# South Florida Live Transactions — map + table

Two embeds on the TRD data site, both reading one data file:

| Page | Embedded on |
|---|---|
| `../south-florida-transactions-map.html` | `/data/miami/2024/priciest-south-florida-sales/` (1260×600), South Florida dashboard card (`?property-type=residential`, 487×394) |
| `../south-florida-transactions-table.html` | `/data/miami/2024/priciest-south-florida-sales/` (1260×850) |

Code:

| File | Role |
|---|---|
| `tx-core.js` | Data load/normalize, filter model, URL presets, filter panel, map↔table sync, notices |
| `tx-search.js` | Search: grouped suggestions, forgiving matching, active-filter chips |
| `tx-charts.js` | SVG sparkline + bar chart with drag brush (timeline, price histogram) |
| `tx-insights.js` | Table "Market overview": pulse strip, top deals, By area |
| `tx-compare.js` | Compare up to four sales (tray + side-by-side panel), synced between frames |
| `tx-map.js` / `tx-table.js` | The two embeds |
| `tx.css` | All styles; light/dark tokens follow TRD theme.js |

Map extras: a Layers control (Dots/Density, color by type/price, Streets/Satellite —
remembered per reader in localStorage), approximate assemblage footprints, aerial
thumbnails (Mapbox Static Images), and a phone "List sales in view" sheet. `normalize()` in `tx-core.js` is the only code that
knows the data file's field names.

## Data file: `../south-florida-transactions.json`

**The pages show whatever this file contains — if it stops being rebuilt, the
live map and table freeze.** It must be regenerated and committed to `main`
daily, after the three county feeds update.

Producer reference implementation: CatchUpScrapers
`src/trd_scrapers/geocode/transactions_file.py` (runs in `trd run` /
`trd map build`). Production refresh is the Airflow pipeline.

### Contract

GeoJSON `FeatureCollection`, compact JSON, null properties may be omitted.

Top level:

| Field | Type | Notes |
|---|---|---|
| `generated_at` | ISO-8601 datetime | |
| `window_days` | number | 60 — the UI offers 7/14/30-day views |
| `min_price` | number | 100000 — rows below are dropped |
| `counties` | `{ "<county>": { "latest_record_date": "YYYY-MM-DD", "count": N } }` | Drives the "Recorded through …" line and per-county lag notes |
| `top_deals` | array (≤100) | `{id,address,price,date,buyer,seller,county,parcel_url}` — not yet used by these pages |

Per feature:

| Property | Type | Notes |
|---|---|---|
| `id` | string | **Stable across runs** (used for `?sale=<id>` links) |
| `address`, `city`, `zip` | string \| null | Rows without `address` are never drawn on the map |
| `county` | `"Miami-Dade"` \| `"Broward"` \| `"Palm Beach"` | |
| `price` | number | Deeds only; mortgages are folded in via `financed`/`loan` |
| `date` | `"YYYY-MM-DD"` | Record date |
| `buyer`, `seller` | string \| null | Multiple parties should be joined with `"; "` (Palm Beach names were still run together as of Oct 2026 — a county scraper fix) |
| `party_direction` | `"verified"` \| `"unknown"` | `unknown` → UI shows "Parties" without buyer/seller roles (Miami-Dade until its scraper records grantor/grantee) |
| `use_category` | `Residential` \| `Commercial` \| `Multifamily` \| `Land` \| `Other` | Map color |
| `use_detail` | string \| null | Raw county use code |
| `financed` | bool | |
| `loan` | number \| null | |
| `prev_price`, `prev_date` | number/ISO \| null | Null when the "previous sale" is this sale |
| `parcel_id`, `parcel_url` | string \| null | Real parcel folio (Miami-Dade 13 digits with leading zeros, Broward 12 characters, may include letters, Palm Beach 17 digits) and its county Property Appraiser page. Links show only when the URL matches the browser-verified pattern for its county (`PROPERTY_LINKS` in `tx-core.js`); the editorial rule is all three counties or none. |
| `instrument_number` | string \| null | Deed recording number (Broward, Palm Beach); shown in details and searchable |
| `parcel_count` | integer ≥ 1 | One deed covering several parcels |
| `assemblage_id` | string, omitted if none | Same-day group of 2+ distinct deeds; the UI groups it only if all mappable members are within 500 m |
| `location_status` | `"located"` \| `"unavailable"` | `geometry` is `null` when unavailable — never a county/city centroid |

### Publishing checklist (for the scheduled job)

1. Run after all three county feeds have refreshed.
2. Write `south-florida/south-florida-transactions.json` (~5–6 MB for 60 days).
3. Commit it to `main` of `trd-digital/trd-news-interactive-maps`; GitHub Pages deploys in ~2–3 minutes.
4. Fail loudly if any county's `latest_record_date` is more than 3 days old, or the feature count drops sharply day over day.
5. Keep every committed file under GitHub's 100 MB hard limit (`broward_output.geojson` was ~78 MB in Oct 2026 and growing).

## Search and URL presets

Search understands plain-language queries — cities ("coral gables",
"ft lauderdale", "wpb"), ZIPs, counties, property types ("condos", "townhomes",
"office", "warehouse", "hotel", "land", "apartments") and prices ("over 5m",
"under $500k", "1-3m", "$10m+"; a reversed "10m-2m" is flagged and read as
$2M–$10M) — alone or combined ("condos in boca raton over 1m"), previewing the
count before it applies. Type words inside a matching company name stay part
of the name. Miami-Dade cities come from the folio's two-digit municipality
code (`MD_MUNICIPALITY` in tx-core.js); property types are `USE_TYPES`.

Search (`tx-search.js`) also suggests places (city, ZIP), people & companies,
individual sales and parcel IDs, and on the map any address, neighborhood,
city or ZIP via Mapbox geocoding (areas filter to their bounds, which covers
counties whose records lack city/ZIP). Matching ignores case and punctuation
and unifies abbreviations ("northwest 5th avenue" = "NW 5 Ave").

Embeds can open a preset view with query parameters:
`property-type`, `use` (a `USE_TYPES` key, e.g. `condo`), `county`, `days` (7/14/30/60), `min-price` (`1m`/`5m`/`10m` or
dollars), `max-price`, `financed` (`financed`/`cash`), `q`, `city`, `zip`,
`sale=<id>`, `from`/`to` (ISO dates, custom range), and on the map
`view=dashboard` (compact card); on the table `tab=biggest|area` and `csv=1`.

Restore point before the Oct 2026 enhancements batch: git tag
`transactions-pre-enhancements`.

## Local preview

```bash
python3 -m http.server 8765   # from the repo root
# http://127.0.0.1:8765/south-florida/south-florida-transactions-map.html
```

On localhost only, `?data=<path>` points the pages at a different data file.
