# South Florida campaign money

Five TRD Data interactives built from the Florida Division of Elections
contribution exports:

| Page | What it shows | Data |
|---|---|---|
| `south-florida-campaign-real-estate.html` | Real estate money tracker: sectors, top donors, top recipients | `campaign/cf-realestate.json` |
| `south-florida-campaign-donor-lookup.html` | Search a real estate company, person or candidate; every gift | `campaign/cf-realestate.json` |
| `south-florida-campaign-llc-networks.html` | South Florida addresses that 5+ donor companies share, and same-day bundles | `campaign/cf-networks.json` |
| `south-florida-campaign-donor-map.html` | Giving by South Florida ZIP code (all, real estate, party split) | `campaign/cf-zips.json` + `south-florida-boundaries.geojson` |
| `south-florida-campaign-governor-race.html` | Governor's race fundraising by month, with and without PACs | `campaign/cf-governor.json` |

Runtime: `campaign/cf-core.js` plus one script per page, styled by
`transactions/tx.css` + `construction/cx.css` + `campaign/cf.css`.
`?data=` overrides a data URL on localhost only (`{name}` is replaced by the
file name).

## Updating

1. Export contributions from the Division of Elections campaign finance
   database: one file for candidates, one for committees. Save them as
   `south-florida/con_contributions_export.csv` and
   `south-florida/contributions_export.csv` (git-ignored).
2. Run from the repo root:

       /Users/afarence/opt/anaconda3/bin/python south-florida/_campaign/build_campaign.py

3. Commit the four `campaign/cf-*.json` files.

## Rules the build applies

- Contributions dated Jan. 1, 2025, on; checks, cash, money orders, in-kind
  and pooled member dues. Refunds, loans, interest and transfers between a
  candidate's own accounts are dropped, as are dates after the export.
- No donor IDs exist: a donor is a cleaned name; people are also split by
  ZIP code.
- Real estate donors come from occupation, company name and a short list of
  known developers and homebuilders (`KNOWN`). Political committees count
  only when they're the industry's own (Realtors, home builders, apartment
  associations). Review the top of each sector after a rebuild; add
  false positives to `NAME_NOT` / `OCC_NOT`.
- Committee names are cut at 40 characters in the export; the full name is
  taken from the same committee's own giving where possible.
- South Florida means the 189 ZIP codes in `south-florida-boundaries.geojson`.
