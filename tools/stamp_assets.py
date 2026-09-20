#!/usr/bin/env python3
"""Cache-bust the CSS/JS references in index.html with a hash of each file's contents.

    python3 tools/stamp_assets.py

GitHub Pages serves everything with max-age=600 and the files had no version in their URL, so
after a deploy a returning visitor could get the NEW index.html with the OLD cached script.js /
styles.css — new markup, old code, animations that silently do nothing. With ?v=<content hash>
a changed file is a new URL and must be fetched; an unchanged file keeps its URL and stays cached.
Run by the Pages workflow on the published copy; the repo keeps clean, unstamped references.
"""
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ["styles.css", "theme-toggle.css", "script.js"]


def main():
    page = ROOT / "index.html"
    html = page.read_text(encoding="utf-8")
    for name in ASSETS:
        digest = hashlib.sha1((ROOT / name).read_bytes()).hexdigest()[:10]
        pattern = re.compile(r'((?:href|src)=")' + re.escape(name) + r'(?:\?v=[0-9a-f]+)?(")')
        html, n = pattern.subn(rf"\g<1>{name}?v={digest}\g<2>", html)
        if n != 1:
            sys.exit(f"stamp_assets: expected exactly one reference to {name} in index.html, found {n}")
        print(f"{name} -> ?v={digest}")
    page.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()
