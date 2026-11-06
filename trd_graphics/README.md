# trd_graphics — shared toolkit for TRD interactive graphics

Reusable resources for building **new** interactive graphics that embed into
The Real Deal article pages. The two existing reference maps
(`Extell_Assemblage_05_31_26/`, `SoFlaRestaurantMap_07_08_26/`) are the proof
of the pattern and are **left untouched** — this toolkit extracts their shared
integration surface so future graphics don't re-discover the same pitfalls.

## How graphics actually run on therealdeal.com (read first)

Checked live on Oct. 26, 2026 with Claude in Chrome, on the Publix, branded
condos, Wynwood and Florida governor's race articles. Every embed was the same:

```html
<div class="container"><div class="iframe-wrap">
  <iframe loading="lazy" src="https://trd-digital.github.io/trd-news-interactive-maps/<folder>/"
          width="100%" height="560" frameborder="0" scrolling="yes"></iframe>
</div></div>
```

- **Producers paste a plain iframe.** The `_embed-snippet.html` parent script is
  not used, so there is **no auto-resize and no theme handshake**. The core's
  postMessage bridge is harmless but nobody is listening.
- **The frame is 560px tall at every width.** The article column is **910px
  wide on desktop** and the viewport minus the gutters on phones (~358px on a
  390px phone). Anything below 560px is cut off or turns into a nested
  scroll box (`scrolling="yes"`). The governor's-race page, built as a tall
  auto-sizing page, shipped as a 560px box the reader scrolls inside. Avoid that.
- **The theme follows the reader's OS**, via the boot snippet's
  `prefers-color-scheme` fallback. The TRD page has its own light/dark setting
  (the `theme` key in localStorage on therealdeal.com), and the graphic can't read it across origins. A light graphic on the
  dark page, or the reverse, is normal. Both themes must look intentional as a
  bordered panel against a `#222` page and a white page.
- **The article supplies the context lines.** Producers put a lead-in sentence
  above the frame and an italic credit below it ("Mapbox map created by Adam
  Farence"). The graphic carries its own headline and subhead; don't add a
  credit inside the graphic.
- **The frame starts late.** TRD swaps `src` for `data-src` and starts the frame
  near the viewport (only in a visible tab). It stays at opacity 0 until the
  frame's own `load` event, so keep load-blocking resources light (see the
  `trd-embed-loader` memory).
- **Claude in Chrome screenshots of these cross-origin frames are unreliable**
  (often blank or stale). Inspect the article DOM with JS (iframe attributes and
  size), and judge rendering with `_article-embed-test.html` in Playwright.

### Rules for every new graphic

1. **Design for a fixed 910×560 and ~358×560 viewport.** Set
   `--trd-embed-h`, `--trd-embed-h-wide` and `--trd-embed-h-phone` to `560px`.
   The headline, controls, graphic, legend and source line must all fit with
   **no inner scrollbar** (`document.body.scrollHeight <= 560` in the embed).
2. **No tall multi-section pages.** If there's more to show, use tabs, a pager, a
   select, or a detail panel that swaps in place, not more height. Paginate long
   lists to the rows that fit rather than scrolling them.
3. **Keep the headline inside the graphic, compact.** Use a one-line headline,
   a one-line subhead (it may wrap on phones), and a short source/notes line
   at the bottom.
4. **Both themes are first-class.** Test light and dark (the OS setting) against
   both a dark and a light page.
5. **Format numbers ≥ 1 million as words.** Write "$21.7 million" and "3.2
   million sq. ft.", with one decimal and ".0" dropped; billions likewise.
   Below a million, use commas ("$445,120").
6. **Test in the real embed shape before handing off.** Serve the repo root over
   http, open
   `trd_graphics/_article-embed-test.html?src=../<folder>/&page=dark&w=910`
   (and `&w=358`, `&page=light`), and assert in Playwright that the iframe
   document has no vertical overflow and no console errors.
7. **Hand-off gives the producer the plain iframe line** (above) with the
   deployed URL. `_embed-snippet.html` is kept only for the optional
   auto-sizing variant.

## The idea: one constraint surface, many graphic types

The hard part of a TRD interactive isn't the map or the chart — it's living
correctly inside a TRD article iframe. That surface is identical for every
graphic, so it's solved **once** here and reused. What changes per project is
the *type of graphic* drawn inside it.

```
Layer 1  core/          ── the TRD embed constraint surface (graphic-agnostic)
Layer 2  graphic module ── a map, a bar chart, a pie chart, … mounts into it
Layer 3  per-project    ── data + config + copy (the only thing you edit)
```

The core (`core/trd-embed.js` + `core/trd-embed.css`) owns:

- **Embed detection** — framed or `?layout=embed` → `data-layout="embed"`.
- **Theme** — standalone toggle + persistence; when embedded, mirror the parent
  site's light/dark and never persist. Pre-paint so there's no flash.
- **The postMessage bridge** — `<prefix>:{ready,loaded,resize,set-theme,request-resize}`.
- **The iframe auto-sizer** — the single highest-bug-density area, solved once.
- **Lazy mount** — build the heavy graphic only when it nears the viewport.
- **Editorial tokens + shell chrome** — brand palette, fonts, fixed-height
  embed scaffolding driven by CSS variables.

It knows nothing about Mapbox, D3, SVG, etc. Those belong to the graphic module.

## Files

| File | Role |
|---|---|
| `core/trd-embed.js` | The graphic-agnostic runtime. `TRDEmbed({...})` → controller. |
| `core/trd-embed.css` | Theme tokens + the sizing-trap-safe embed shell. |
| `core/boot-snippet.html` | The inline `<head>` pre-paint snippet to paste per project. |
| `embed-snippet.template.html` | Parent-page side: paste into the TRD article slot. |
| `_article-embed-test.html` | **Use this one.** Reproduces the live article embed: plain 560px iframe, 910px (or `&w=358`) column, dark or light page. `?src=../<folder>/`. |
| `_embed-test.html` | Older harness for the auto-sizing snippet (not what the live site does). |
| `starter/` | Minimal **non-map** example (SVG bar chart) proving a graphic mounts. |
| `graphics/map/trd-map.js` | Blessed **Mapbox** module: token guard, cooperative gestures, `style.load` re-add, declutter, overlay camera padding. Data-agnostic. |
| `graphics/map/trd-map.css` | Themes Mapbox chrome (popups, controls) with the core tokens. |
| `graphics/map/example/` | A working map built on the toolkit (fetches `data.geojson`). |
| `graphics/dossier/trd-dossier.js` | **Luxury Dossier** template engine: renders an editorial package (hero, stats, region+places map, brokers, names, quotes, narrative) from a content model, on top of the core + map module. |
| `graphics/dossier/trd-dossier.css` | Green editorial palette + dossier layout/chrome. |
| `graphics/dossier/example/` | A working dossier (`content.json` + `regions.geojson` + `places.geojson`). |

## The graphic contract

A graphic module is just data + three callbacks. It never touches embed, theme,
or resize plumbing:

```js
var controller = TRDEmbed({
  prefix: "extell-assemblage",         // postMessage namespace (unique per graphic)
  themeKey: "extell-assemblage:theme", // localStorage key (standalone only)
  toggle: "#themeToggle",              // in-iframe toggle; auto-removed when embedded
  mountTarget: "#map",                 // element watched for lazy mount
  onMount: function (ctx) { /* build the graphic once, in-viewport */ ctx.postLoaded(); },
  onTheme: function (theme, ctx) { /* "light" | "dark": recolor */ ctx.requestResize(); },
  onResize: function (ctx) { /* optional: content reflowed */ },
});
// controller: { isEmbed, theme, requestResize(), post(), postLoaded(), applyTheme(), messageTypes }
```

`controller.requestResize()` is the one call a graphic must make after it
changes its own height (new content, expanded panel, etc.).

## Scaffolding a new graphic (the fast path)

`trd_common.scaffold` stamps a self-contained, deployable project folder — it
vendors the toolkit files, rewrites the per-graphic namespace/paths, generates
the parent-page embed snippet, and (for a map given a CSV) geocodes the CSV into
`data.geojson`. This replaces the manual recipe below.

```bash
# a map, geocoding a CSV of addresses into data.geojson
python -m trd_common.scaffold MiamiOffices_08_26 --kind map \
    --title "Miami's Priciest Office Deals" --csv deals.csv --address-col full_address

# a chart (no geocoding)
python -m trd_common.scaffold RankingsChart_08_26 --kind chart --title "Brokerage Rankings"

# a Luxury Dossier (copies sample content.json / regions.geojson / places.geojson)
python -m trd_common.scaffold AspenDossier_09_26 --kind dossier --title "Aspen"
```

```python
from trd_common.scaffold import new_graphic
new_graphic("MiamiOffices_08_26", kind="map", title="Miami's Priciest Office Deals",
            csv="deals.csv", address_col="full_address")
```

Then: edit `index.html` (copy, colors, camera, fields), preview with
`python3 -m http.server`, deploy the folder, and paste its URL into the
generated `_embed-snippet.html`. (Run scaffolding under the Anaconda Python that
has `googlemaps` + `pandas`.)

### Doing it by hand instead

1. Copy `starter/` (chart) or `graphics/map/example/` (map) to `<Topic>_<MMYY>/`.
2. Keep `core/boot-snippet.html` inline in `<head>` with your `themeKey`, first.
3. Set embed heights via the `--trd-embed-h*` CSS variables.
4. Vendor the core (copy the toolkit files alongside; maps deploy as isolated
   static folders) and rewrite the `<link>`/`<script src>` paths to local.
5. Fill in `embed-snippet.template.html` and test with `_embed-test.html`.

## The sizing trap (read twice)

The auto-sizer is where embeds break. The rules, enforced by the core:

- **`document.body.scrollHeight` only** — never `documentElement.scrollHeight`
  (returns the iframe viewport height when content is shorter → height pegs and
  can't shrink back).
- **No `vh` / `svh` in embed CSS** — sizes against the iframe → infinite grow
  loop. Use the fixed-pixel `--trd-embed-h*` variables instead.
- The core drops sub-pixel reports (`|Δ| < 2`); the parent snippet clamps to
  `100 < h < 5000`. Keep both guards.

## Pitfalls cheat sheet

- **Height pegged/oscillates** → `vh`/`svh` in embed CSS, or `documentElement`
  instead of `body`. The core avoids both; don't reintroduce them in module CSS.
- **Flash of standalone layout in the iframe** → the boot snippet isn't inline
  in `<head>`, or runs after a stylesheet. It must be first and synchronous.
- **Two embeds on one article cross-talk** → give each a unique `prefix`.
- **Map layers vanish after a theme swap** → re-add sources/layers on Mapbox
  `style.load` (not `load`); `setStyle()` wipes custom layers. (Module concern.)
- **Reader trapped scrolling past a sticky map on mobile** → use Mapbox
  `cooperativeGestures: true` (module concern).

## Version pinning & re-syncing

The toolkit version lives in `trd_graphics/VERSION` (single source of truth).
When the scaffolder vendors files into a project it writes a
`trd-graphics.lock.json` recording that version and each vendored file's hash.
`trd_common.sync` uses it to report drift and pull updates on request —
respecting files you hand-edited in a project:

```bash
python -m trd_common.sync --all              # repo-wide table: pinned vs current
python -m trd_common.sync MyMap_08_26        # per-file status for one folder
python -m trd_common.sync MyMap_08_26 --apply         # pull toolkit updates
python -m trd_common.sync MyMap_08_26 --apply --force # incl. locally-modified files
```

Per file, comparing recorded baseline / on-disk / toolkit source: `up-to-date`,
`update-available` (toolkit moved on), `modified` (local edit only), `conflict`
(both changed), `missing`. Updates and missing files apply automatically;
`modified` / `conflict` are left alone unless `--force`. **Bump `VERSION`
whenever you change anything in `core/` or `graphics/`** so folders can tell
they're behind.

## The Luxury Dossier template (`graphics/dossier/`)

A map-centered editorial package for TRD's recurring "Luxury Dossier" series
(Martha's Vineyard, Aspen, the Hamptons…). `TRDDossier({...})` renders the whole
thing from three data files — no per-instance JS:

- **`content.json`** — the modules: `hero`, `intro[]`, `stats[]`, `markets[]`
  (A–F town key), `brokers`, `names`, `quotes[]`, `developments`, `affordability`,
  `credits`.
- **`regions.geojson`** — town polygons, each with a `town` name and A–F `letter`
  (colored A–F; clicking a town filters + frames it).
- **`places.geojson`** — categorized point places (`category` ∈
  `record` / `development` / `hospitality`, plus `town`, `price`, `agents`,
  `blurb`, `image`, `approximate`). Clicking a pin opens a detail card.

A dossier is a **tall, content-driven page**: the embed iframe auto-sizes to the
full body, and only the map band is a fixed pixel height. Build one with
`--kind dossier` (see above), then edit the three data files and drop images in
`images/`. Reference build: `LuxuryDossierMarthasVinyard_07_01_26/` (with a
reproducible `build_data.py` that geocodes places and pulls town boundaries).

**The map is optional.** Delete the whole `.d-map-section` from `index.html`
(and drop the `mapbox-gl` + `trd-map.*` includes) to ship a text-only dossier —
the engine skips region/place loading when there's no `#map` element, and every
other module still renders. The Vineyard reference build is map-less.

## Not yet built (roadmap)

- Optional richer map presets (scrollytelling story-cards, directory + filters)
  layered on `graphics/map/`, matching the two reference maps.
