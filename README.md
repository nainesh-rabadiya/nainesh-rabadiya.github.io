# nainesh.dev

Personal portfolio of Nainesh Rabadiya — static HTML, CSS and vanilla JS, no build step.

- `index.html` — all content
- `styles.css`, `theme-toggle.css` — styling (dark/light via `data-theme` on `<html>`)
- `script.js` — interactions (theme, nav, reveals, hero canvas, tooltips)
- `404.html` — custom not-found page
- `tools/build_ai_files.py` — generates the AI-readable files (stdlib only)
- `tools/stamp_assets.py` — run by the deploy: adds `?v=<content hash>` to the CSS/JS links so browsers never mix new HTML with old cached code

## AI-readable files

`llms.txt`, `about.md` and `resume.json` are generated from `index.html`:

```bash
python3 tools/build_ai_files.py
```

The deploy workflow runs this on every push, so edit the page and the files follow. Don't edit them by hand.

## Local preview

```bash
python3 -m http.server 8000
```

## Deploy

Pushing to `version-1.0.0` runs `.github/workflows/static.yml`, which publishes the repo root to GitHub Pages at https://nainesh.dev.
