"""Report and re-sync vendored toolkit files against ``trd_graphics``.

Scaffolded folders vendor a copy of the toolkit (so they deploy standalone) and
record what they took in ``trd-graphics.lock.json`` (see
:func:`trd_common.scaffold.write_lock`). Over time the toolkit moves on and the
copies drift. This module tells you which folders are behind and updates them on
request — without silently clobbering files you hand-edited in a project.

Per vendored file, comparing three hashes — the recorded baseline (`locked`),
the file on disk (`vendored`), and the current toolkit source (`source`):

    up-to-date        vendored == locked == source
    update-available  source != locked, vendored == locked   (toolkit moved on)
    modified          vendored != locked, source == locked    (local edit only)
    conflict          vendored != locked AND source != locked (both changed)
    missing           the vendored file was deleted

`update-available` / `missing` are applied automatically; `modified` /
`conflict` are left alone unless you pass force.

    python -m trd_common.sync --all                 # repo-wide status table
    python -m trd_common.sync MyMap_08_26           # one folder, per-file detail
    python -m trd_common.sync MyMap_08_26 --apply    # pull toolkit updates
    python -m trd_common.sync MyMap_08_26 --apply --force  # incl. modified/conflict
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from . import scaffold

LOCK_NAME = scaffold.LOCK_NAME


def read_lock(folder):
    p = Path(folder) / LOCK_NAME
    return json.loads(p.read_text()) if p.exists() else None


def status_of(folder) -> dict | None:
    """Drift status for one scaffolded folder, or None if it has no lockfile."""
    folder = Path(folder)
    lock = read_lock(folder)
    if not lock:
        return None
    kind = lock.get("kind")
    files = []
    for name, locked in lock.get("files", {}).items():
        vend_path = folder / name
        src_path = scaffold.toolkit_src(kind, name)
        vendored = scaffold.file_sha256(vend_path) if vend_path.exists() else None
        source = (
            scaffold.file_sha256(src_path) if src_path and src_path.exists() else None
        )
        if vendored is None:
            state = "missing"
        else:
            local_edit = vendored != locked
            toolkit_moved = source is not None and source != locked
            if local_edit and toolkit_moved:
                state = "conflict"
            elif toolkit_moved:
                state = "update-available"
            elif local_edit:
                state = "modified"
            else:
                state = "up-to-date"
        files.append({"name": name, "state": state})

    states = {f["state"] for f in files}
    if "conflict" in states:
        overall = "conflict"
    elif states & {"update-available", "missing"}:
        overall = "outdated"
    elif "modified" in states:
        overall = "modified"
    else:
        overall = "up-to-date"

    return {
        "folder": str(folder),
        "prefix": lock.get("prefix"),
        "kind": kind,
        "pinned": lock.get("toolkit_version"),
        "current": scaffold.toolkit_version(),
        "overall": overall,
        "files": files,
    }


def sync_graphic(folder, apply: bool = False, force: bool = False, verbose: bool = True):
    """Report drift and, when ``apply``, pull toolkit updates into ``folder``.

    Only ``update-available`` / ``missing`` files are copied by default; pass
    ``force=True`` to also overwrite ``modified`` / ``conflict`` files. The
    lockfile's per-file baselines advance to whatever was synced, and the
    top-level ``toolkit_version`` advances only once every file matches the
    current toolkit source (so an unresolved conflict keeps the folder pinned).
    """
    folder = Path(folder)
    st = status_of(folder)
    if st is None:
        if verbose:
            print("No %s in %s — not a scaffolded folder." % (LOCK_NAME, folder))
        return None

    lock = read_lock(folder)
    kind = lock["kind"]
    changed, skipped = [], []

    for f in st["files"]:
        name, state = f["name"], f["state"]
        if state == "up-to-date":
            continue
        src = scaffold.toolkit_src(kind, name)
        forced = state in ("modified", "conflict")
        do = state in ("update-available", "missing") or (forced and force)
        if not do:
            skipped.append((name, state))
            continue
        if apply and src and src.exists():
            shutil.copy2(src, folder / name)
            lock["files"][name] = scaffold.file_sha256(src)
        changed.append((name, state))

    if apply:
        # Advance the version pin only if every file now matches the toolkit.
        fully = all(
            (lambda s: s and lock["files"].get(n) == scaffold.file_sha256(s))(
                scaffold.toolkit_src(kind, n)
            )
            for n in lock["files"]
        )
        if fully:
            lock["toolkit_version"] = scaffold.toolkit_version()
        (folder / LOCK_NAME).write_text(json.dumps(lock, indent=2) + "\n")

    if verbose:
        verb = "Updated" if apply else "Would update"
        print(
            "%s  (pinned %s → toolkit %s)  [%s]"
            % (folder.name, st["pinned"], st["current"], st["overall"])
        )
        for name, state in changed:
            print("  %s %s (%s)" % (verb.lower(), name, state))
        for name, state in skipped:
            print("  skip %s (%s — pass --force)" % (name, state))
        if not changed and not skipped:
            print("  up to date")

    return {"status": st, "changed": changed, "skipped": skipped, "applied": apply}


def find_scaffolded(root=None):
    """All folders under ``root`` (default repo root) that carry a lockfile."""
    root = Path(root) if root else scaffold.REPO_ROOT
    return sorted(p.parent for p in root.glob("*/" + LOCK_NAME))


def status_all(root=None):
    return [status_of(f) for f in find_scaffolded(root)]


def _print_table(rows):
    if not rows:
        print("No scaffolded graphics found (no %s files)." % LOCK_NAME)
        return
    print("%-34s %-22s %-8s %-8s %s" % ("FOLDER", "NAMESPACE", "PINNED", "TOOLKIT", "STATUS"))
    for r in rows:
        print(
            "%-34s %-22s %-8s %-8s %s"
            % (Path(r["folder"]).name, r["prefix"] or "-", r["pinned"], r["current"], r["overall"])
        )


def main(argv=None):
    ap = argparse.ArgumentParser(
        prog="python -m trd_common.sync",
        description="Report / re-sync vendored trd_graphics files by version.",
    )
    ap.add_argument("folder", nargs="?", help="a scaffolded project folder")
    ap.add_argument("--all", action="store_true", help="repo-wide status table")
    ap.add_argument("--apply", action="store_true", help="write updates")
    ap.add_argument("--force", action="store_true", help="also overwrite modified/conflict files")
    args = ap.parse_args(argv)

    if args.all or not args.folder:
        _print_table(status_all())
        return
    sync_graphic(args.folder, apply=args.apply, force=args.force)


if __name__ == "__main__":
    main()
