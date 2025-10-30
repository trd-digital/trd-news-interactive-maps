# Live Local Act Projects Table

This directory contains an interactive Bootstrap Table listing South Florida Live Local Act projects sourced from `live_local.geojson`.

## Files
- `LiveLocalTable.html` – HTML scaffold including Bootstrap Table assets and loads `live-local-table.js`.
- `live-local-table.js` – JavaScript that fetches the local GeoJSON, maps properties to table columns, and renders the interactive table with search, sort, pagination, column toggles, sticky header and expandable detail rows.
- `live_local.geojson` – GeoJSON FeatureCollection of Live Local Act project points and metadata.

## Features
- Client-side search with highlight.
- Sortable columns (numeric and percent-aware sorting supported).
- Pagination for improved performance.
- Column visibility toggling.
- Expandable detail rows showing all project attributes in two balanced columns.
- Basic field formatting (numbers, percents, links) and graceful display of missing values.
- Theme integration via `TrdTheme` if available.
- Event tracking hook (`dataLayer`) with category `live-local-table` for detail opens and theme detection.

## Running Locally
Because the page fetches a local GeoJSON file via `fetch`, you need a static server (browsers block `file://` fetches).

### Quick Start (Python)
```bash
cd /Users/afarence/Documents/coding_projects/trd-news-interactive-maps/SoFlaLiveLocalAutoUpdateMap
python3 -m http.server 8080
```
Open: http://localhost:8080/LiveLocalTable.html

### Using Node (if desired)
```bash
npx serve . -p 8080
```

## Customization
- To add or change visible columns, edit `displayColumns` in `live-local-table.js`.
- To change which fields show in detail view, edit `displayFields`.
- Add additional formatting rules inside `formatValue`.

## Tracking
`trackEvent(action, label)` pushes events to `dataLayer` if present. Adjust the `category` string if integrating with a different analytics namespace.

## Future Enhancements
- Add filtering dropdowns (Status, Developer).
- Integrate map/table linking if a map component is added.
- Add CSV export using Bootstrap Table extension if needed.

---
Maintained by TRD Digital.
