# Guess the Sale Price (sample game)

A tiny, static web game: you see a property photo + basic facts, then guess the sold price.

## Run locally

Because the game loads `data/properties.json` with `fetch`, you should run a local web server.

### Option A: Python (built-in)

```bash
cd Sample_RE_game
python3 -m http.server 8000
```

Open:

- http://localhost:8000

### Option B: Node (if you already have it)

```bash
npx serve .
```

## Edit the dataset

Update:

- `data/properties.json`

Each entry needs:

- `title`, `location`, `facts` (key/value pairs to display)
- `image` (path to an image file in this folder)
- `soldPrice` (number, USD)

Replace the placeholder SVGs in `assets/` with real photos (JPG/PNG/WebP), then point `image` to them.
