# build_logos_manifest.py
import os, json

LOGO_DIR = 'Logos for Research Directory'   # adjust path as needed
OUT_FILE = 'logos.json'

manifest = {}
for fname in os.listdir(LOGO_DIR):
    if not os.path.isfile(os.path.join(LOGO_DIR, fname)):
        continue
    name, ext = os.path.splitext(fname)
    ext = ext.lstrip('.').lower()
    manifest.setdefault(name, []).append(ext)

with open(OUT_FILE, 'w') as f:
    json.dump(manifest, f, indent=2)
print(f"Wrote manifest with {len(manifest)} entries to {OUT_FILE}")
