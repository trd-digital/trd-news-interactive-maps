"""Scaffold a new TRD interactive graphic from the shared toolkit.

Stamps a self-contained, deployable project folder from a `trd_graphics`
template: vendors the toolkit files (so the folder deploys as an isolated static
site), rewrites the per-graphic namespace, and — for a map given a CSV — runs
the geocode step and writes ``data.geojson``. Replaces the manual 9-step recipe
in the reference maps' integration guides.

    from trd_common.scaffold import new_graphic
    new_graphic("MiamiOffices_08_26", kind="map",
                title="Miami's Priciest Office Deals",
                csv="deals.csv", address_col="full_address")

Or from the shell:

    python -m trd_common.scaffold MiamiOffices_08_26 --kind map \
        --title "Miami's Priciest Office Deals" --csv deals.csv --address-col full_address

The two reference maps are never touched; this only creates new folders.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TOOLKIT = REPO_ROOT / "trd_graphics"

# Per-folder version pin. Records which toolkit version the vendored files came
# from, plus their hashes, so trd_common.sync can report drift and re-sync.
LOCK_NAME = "trd-graphics.lock.json"

# Per-kind template config. `token` is the literal namespace string in the
# template that gets globally swapped for the project's prefix (it also carries
# the "<token>:theme" localStorage key, so one replace covers both).
KINDS = {
    "chart": {
        "template": "starter/index.html",
        "vendor": ["core/trd-embed.js", "core/trd-embed.css"],
        "path_subs": [
            ('href="../core/trd-embed.css"', 'href="trd-embed.css"'),
            ('src="../core/trd-embed.js"', 'src="trd-embed.js"'),
        ],
        "token": "trd-starter",
        "title_subs": [
            ("<title>Starter Graphic | The Real Deal</title>",
             "<title>{title} | The Real Deal</title>"),
            ("<h1>Starter Graphic</h1>", "<h1>{title}</h1>"),
        ],
        "data_files": [],
    },
    "map": {
        "template": "graphics/map/example/index.html",
        "vendor": [
            "core/trd-embed.js",
            "core/trd-embed.css",
            "graphics/map/trd-map.js",
            "graphics/map/trd-map.css",
        ],
        "path_subs": [
            ('href="../../../core/trd-embed.css"', 'href="trd-embed.css"'),
            ('href="../trd-map.css"', 'href="trd-map.css"'),
            ('src="../../../core/trd-embed.js"', 'src="trd-embed.js"'),
            ('src="../trd-map.js"', 'src="trd-map.js"'),
        ],
        "token": "trd-map-example",
        "title_subs": [
            ("<title>Map module example | The Real Deal</title>",
             "<title>{title} | The Real Deal</title>"),
            ("<h1>Map module example</h1>", "<h1>{title}</h1>"),
        ],
        "data_files": ["data.geojson"],
        "geocode": True,
    },
    "dossier": {
        "template": "graphics/dossier/example/index.html",
        "vendor": [
            "core/trd-embed.js",
            "core/trd-embed.css",
            "graphics/map/trd-map.js",
            "graphics/map/trd-map.css",
            "graphics/dossier/trd-dossier.js",
            "graphics/dossier/trd-dossier.css",
        ],
        "path_subs": [
            ('href="../../../core/trd-embed.css"', 'href="trd-embed.css"'),
            ('href="../../map/trd-map.css"', 'href="trd-map.css"'),
            ('href="../trd-dossier.css"', 'href="trd-dossier.css"'),
            ('src="../../../core/trd-embed.js"', 'src="trd-embed.js"'),
            ('src="../../map/trd-map.js"', 'src="trd-map.js"'),
            ('src="../trd-dossier.js"', 'src="trd-dossier.js"'),
        ],
        "token": "trd-dossier-example",
        "title_subs": [
            ("<title>Luxury Dossier — template example | The Real Deal</title>",
             "<title>{title} | The Real Deal</title>"),
        ],
        # A dossier's content lives in these files (edit them + drop in images/).
        "data_files": ["content.json", "regions.geojson", "places.geojson"],
    },
}


def toolkit_version() -> str:
    """The current toolkit version (from ``trd_graphics/VERSION``)."""
    vf = TOOLKIT / "VERSION"
    return vf.read_text().strip() if vf.exists() else "0.0.0"


def file_sha256(path) -> str:
    """``sha256:<hex>`` digest of a file's bytes."""
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return "sha256:" + h.hexdigest()


def toolkit_src(kind: str, basename: str):
    """The toolkit source Path for a vendored file basename (or None)."""
    for rel in KINDS[kind]["vendor"]:
        if Path(rel).name == basename:
            return TOOLKIT / rel
    return None


def write_lock(proj, kind: str, prefix: str) -> dict:
    """Write ``trd-graphics.lock.json`` recording the version + vendored hashes.

    Each file hash is the toolkit-source baseline this folder was pinned to, so
    later drift (local edits vs. toolkit updates) is detectable. See
    :mod:`trd_common.sync`.
    """
    proj = Path(proj)
    files = {}
    for rel in KINDS[kind]["vendor"]:
        files[Path(rel).name] = file_sha256(proj / Path(rel).name)
    lock = {
        "toolkit_version": toolkit_version(),
        "kind": kind,
        "prefix": prefix,
        "files": files,
    }
    (proj / LOCK_NAME).write_text(json.dumps(lock, indent=2) + "\n")
    return lock


def slug_to_prefix(slug: str) -> str:
    """A valid postMessage namespace from a folder slug (lowercase, hyphenated)."""
    prefix = re.sub(r"[^a-z0-9]+", "-", slug.lower()).strip("-")
    return prefix or "trd-graphic"


def _sub(text: str, old: str, new: str, label: str) -> str:
    """Replace `old`→`new`, raising if the marker is missing (template drift)."""
    if old not in text:
        raise RuntimeError(
            "Scaffold template drift: expected " + label + " marker not found:\n  "
            + repr(old)
        )
    return text.replace(old, new)


def _geocode_to_geojson(csv, address_col: str, proj: Path) -> int:
    import pandas as pd

    from .geocode import Geocoder
    from .geojson import frame_to_geojson, write_geojson

    df = pd.read_csv(csv, dtype=str)
    if address_col not in df.columns:
        raise ValueError(
            "CSV has no column %r. Columns: %s" % (address_col, list(df.columns))
        )
    gc = Geocoder(cache_file=str(proj / "geocode_cache.csv"))
    gc.geocode_frame(df, address_col)
    fc = frame_to_geojson(df)
    return write_geojson(fc, proj / "data.geojson")


def _write_embed_snippet(proj: Path, prefix: str) -> None:
    tmpl = (TOOLKIT / "embed-snippet.template.html").read_text()
    out = (
        tmpl.replace("__EMBED_URL__", "REPLACE_WITH_DEPLOYED_URL")
        .replace("__PREFIX__", prefix)
        .replace("__IFRAME_ID__", prefix + "-iframe")
    )
    (proj / "_embed-snippet.html").write_text(out)


def new_graphic(
    slug: str,
    kind: str = "map",
    title: str | None = None,
    csv=None,
    address_col: str = "address",
    dest=None,
    prefix: str | None = None,
    force: bool = False,
    verbose: bool = True,
):
    """Create a new graphic project folder from the toolkit.

    Parameters
    ----------
    slug:        folder name (also the default namespace source), e.g.
                 ``"MiamiOffices_08_26"``.
    kind:        ``"map"`` or ``"chart"``.
    title:       page ``<title>`` / ``<h1>`` (defaults to the slug).
    csv:         map only — a CSV to geocode into ``data.geojson``.
    address_col: the address column in that CSV.
    dest:        parent directory (defaults to the repo root).
    prefix:      postMessage namespace (defaults to a slugified ``slug``).
    force:       overwrite an existing folder.

    Returns the created project ``Path``.
    """
    kind = kind.lower()
    if kind not in KINDS:
        raise ValueError("kind must be one of %s" % sorted(KINDS))
    cfg = KINDS[kind]

    proj = (Path(dest) if dest else REPO_ROOT) / slug
    if proj.exists() and not force:
        raise FileExistsError("%s already exists (pass force=True to overwrite)" % proj)
    proj.mkdir(parents=True, exist_ok=True)

    prefix = prefix or slug_to_prefix(slug)
    title = title or slug

    # --- stamp index.html --------------------------------------------------
    template_path = TOOLKIT / cfg["template"]
    html = template_path.read_text()
    for old, new in cfg["path_subs"]:
        html = _sub(html, old, new, "path")
    html = _sub(html, cfg["token"], prefix, "namespace")  # guarded; replaces all
    for old, new in cfg["title_subs"]:
        html = _sub(html, old, new.format(title=title), "title")
    (proj / "index.html").write_text(html)

    # --- vendor the toolkit files (self-contained deploy) ------------------
    for rel in cfg["vendor"]:
        shutil.copy2(TOOLKIT / rel, proj / Path(rel).name)

    # --- version pin -------------------------------------------------------
    write_lock(proj, kind, prefix)

    # --- data --------------------------------------------------------------
    # For a map given a CSV, geocode it into data.geojson; otherwise copy the
    # template's data file(s) as an editable starting point.
    feature_count = None
    if csv and cfg.get("geocode"):
        feature_count = _geocode_to_geojson(csv, address_col, proj)
    else:
        for fn in cfg.get("data_files", []):
            src = template_path.parent / fn
            if src.exists():
                shutil.copy2(src, proj / fn)

    # --- parent-page embed snippet -----------------------------------------
    _write_embed_snippet(proj, prefix)

    if verbose:
        print("Created %s graphic: %s" % (kind, proj))
        print("  namespace: %s" % prefix)
        print("  toolkit version: %s (pinned in %s)" % (toolkit_version(), LOCK_NAME))
        data_files = cfg.get("data_files", [])
        if feature_count is not None:
            print("  geocoded features: %d → data.geojson" % feature_count)
        elif data_files:
            print("  data: sample %s copied (replace with your own)" % ", ".join(data_files))
        print("  next:")
        print("    1. edit index.html (copy, namespace, token)")
        if data_files and feature_count is None:
            print("    2. replace %s%s" % (
                ", ".join(data_files),
                " (map: or re-run with csv=...)" if cfg.get("geocode") else ""))
        print("    3. preview:  (cd %s && python3 -m http.server)" % proj.name)
        print("    4. deploy the folder, put its URL in _embed-snippet.html")

    return proj


def main(argv=None):
    ap = argparse.ArgumentParser(
        prog="python -m trd_common.scaffold",
        description="Scaffold a new TRD interactive graphic from the toolkit.",
    )
    ap.add_argument("slug", help="project folder name, e.g. MiamiOffices_08_26")
    ap.add_argument("--kind", default="map", choices=sorted(KINDS))
    ap.add_argument("--title", default=None)
    ap.add_argument("--csv", default=None, help="map only: CSV to geocode")
    ap.add_argument("--address-col", default="address")
    ap.add_argument("--dest", default=None, help="parent dir (default: repo root)")
    ap.add_argument("--prefix", default=None, help="postMessage namespace")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args(argv)
    new_graphic(
        args.slug,
        kind=args.kind,
        title=args.title,
        csv=args.csv,
        address_col=args.address_col,
        dest=args.dest,
        prefix=args.prefix,
        force=args.force,
    )


if __name__ == "__main__":
    main()
