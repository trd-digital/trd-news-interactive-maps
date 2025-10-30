# South Florida SIRS Interactive Map

This interactive converts `data.csv` into a GeoJSON point map rendered via the shared `trdDataCommonMap` library.

## What it does
- Parses the raw CSV in-browser (no build step) using a lightweight custom parser.
- Creates a GeoJSON FeatureCollection using `__lon` / `__lat` columns.
- Displays points styled similarly to existing TRD interactives.
- Provides live search & autocomplete across: Project Name, Association Name, Address, City, County.
- Modal shows core metadata fields.

## Files
- `index.html` – Container markup and includes dependencies.
- `app.js` – CSV fetch, parsing, GeoJSON conversion, map init, search/autocomplete.
- `data.csv` – Source dataset.

## Customize modal fields
Edit `modalDisplayFields` inside `app.js` to add/remove rows.

## Adding more search fields
Update `suggestionFields` array in `app.js`.

## Testing locally
Open `index.html` directly in a browser with file access OR run a simple server to avoid CORS issues:
```bash
python3 -m http.server 8080
# then visit http://localhost:8080/SouthFloridaSIRS/index.html
```
(Any static server works.)

## Notes
- Rows lacking valid numeric `__lat` and `__lon` are skipped.
- CSV parser handles quoted commas and escaped quotes ("").
- For very large CSVs consider pre-generating GeoJSON to reduce client parse time.

## Next Improvements (optional)
- Cluster points at low zoom.
- Add filter dropdown for County / Project Type.
- Persist last search in `localStorage`.

## License / Data
Confirm rights/attribution for dataset before publishing. No license file included.
