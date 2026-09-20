# nainesh.dev

Personal portfolio of Nainesh Rabadiya — static HTML, CSS and vanilla JS, no build step.

- `index.html` — all content
- `styles.css`, `theme-toggle.css` — styling (dark/light via `data-theme` on `<html>`)
- `script.js` — interactions (theme, nav, reveals, hero canvas, tooltips)
- `404.html` — custom not-found page

## Local preview

```bash
python3 -m http.server 8000
```

## Deploy

Pushing to `version-1.0.0` runs `.github/workflows/static.yml`, which publishes the repo root to GitHub Pages at https://nainesh.dev.
