# South Florida Live Transactions — map + table

Two embeds on the TRD data site, both reading one data file:

| Page | Embedded on |
|---|---|
| `../south-florida-transactions-map.html` | `/data/miami/2024/priciest-south-florida-sales/` (1260×600), South Florida dashboard card (`?property-type=residential`, 487×394) |
| `../south-florida-transactions-table.html` | `/data/miami/2024/priciest-south-florida-sales/` (1260×850) |

Code: `tx-core.js` (data, filters, URL presets, map↔table sync), `tx-map.js`,
`tx-table.js`, `tx.css`. `normalize()` in `tx-core.js` is the only code that
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
| `parcel_id`, `parcel_url` | string \| null | |
| `parcel_count` | integer ≥ 1 | One deed covering several parcels |
| `assemblage_id` | string, omitted if none | Same-day group of 2+ distinct deeds; the UI groups it only if all mappable members are within 500 m |
| `location_status` | `"located"` \| `"unavailable"` | `geometry` is `null` when unavailable — never a county/city centroid |

### Publishing checklist (for the scheduled job)

1. Run after all three county feeds have refreshed.
2. Write `south-florida/south-florida-transactions.json` (~5–6 MB for 60 days).
3. Commit it to `main` of `trd-digital/trd-news-interactive-maps`; GitHub Pages deploys in ~2–3 minutes.
4. Fail loudly if any county's `latest_record_date` is more than 3 days old, or the feature count drops sharply day over day.
5. Keep every committed file under GitHub's 100 MB hard limit (`broward_output.geojson` was ~78 MB in Oct 2026 and growing).

## Local preview

```bash
python3 -m http.server 8765   # from the repo root
# http://127.0.0.1:8765/south-florida/south-florida-transactions-map.html
```

On localhost only, `?data=<path>` points the pages at a different data file.
