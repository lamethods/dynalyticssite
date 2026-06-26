# Self-hosted tutorials

Dynalytics hosts its tutorials directly (instead of linking out), served by
GitHub Pages from the repo's `tutorials/` folder at
`https://dynasite.org/tutorials/<package>/<slug>.html`.

The design goal is **write & push**: you should never hand-edit catalog JSON or
run a custom toolchain to publish a tutorial.

```
author tutorial (Quarto/Rmd) ──render──▶ tutorials/<package>/<slug>.html ──npm run tutorials──▶ catalog ──git push──▶ live
```

---

## The folder is the source of truth

```
tutorials/
  tna/        codyna/        cograph/        <package>/ …
    *.html      *.html         *.html           *.html
```

Every `tutorials/<package>/<slug>.html` is **auto-discovered** and registered as
a tutorial. Nothing in `build/sources.json` references them — drop a file in the
right package folder and it appears on the site.

For each file the build reads, from the file's own `<head>`:

| Field | Source |
|-------|--------|
| **title** | `<title>` (a trailing " – sonsoleslp" / " \| Mohammed Saqr" site suffix is stripped) |
| **description** | `<meta name="description">`, else `<meta property="og:description">` |
| **package** | the folder name (`tutorials/<package>/`) |
| **slug / url** | the file name → `tutorials/<package>/<slug>.html` |
| **source** | always `dynasite` (renders the "Dynalytics" footer label) |

You control title and description by writing them in your qmd front-matter
(`title:` and `description:` / `subtitle:`) — they flow straight through.

---

## Add a tutorial — write & push

1. Render your tutorial to a **single self-contained HTML** (Quarto
   `embed-resources: true`, or rmarkdown `self_contained: true`).
2. Put it in the package folder: `tutorials/<package>/<slug>.html`. Create a new
   folder the first time a package gets a tutorial.
3. Build (offline — no network, no sibling repos) and push:
   ```bash
   npm run tutorials
   git add tutorials catalog.json assets/catalog.js
   git commit -m "tutorials: add <slug>"
   git push
   ```

It then appears automatically in the **Readings → Tutorials** menu and on that
package's **dossier** (the Tutorials tab), with the package badge.

---

## Keep files small

Quarto exports plots at retina DPI, so a single tutorial can balloon to
50–75 MB (90%+ of it oversized base64 PNGs). Two ways to handle it:

- **Best — fix it at the source.** One line in the qmd front-matter:
  ```yaml
  format:
    html:
      fig-dpi: 120     # vs the retina default that produced ~10,000px plots
  ```
  Files then render small (1–3 MB) and need nothing further.

- **Backstop — slim an existing file** (no re-render, no quality-visible loss):
  ```bash
  python3 build/optimize_tutorial.py tutorials/<package>/<slug>.html
  #   --quantize     ~2× smaller (256-colour palette; mild banding risk on smooth heatmaps)
  #   --max-width N  change the 1600px downscale cap
  ```
  Run it on a folder to do everything: `python3 build/optimize_tutorial.py tutorials/`.

This optimizer is **optional** — only reach for it when a file lands oversized.

---

## How it works (for maintainers)

- **`build/curated.mjs` → `tutorialEntries(root)`** scans `tutorials/<pkg>/*.html`,
  reads each file's `<head>`, and emits a `type:"post", kind:"tutorial"` entry.
- **`regenCurated()`** (run by `npm run tutorials`) drops the old auto-discovered
  tutorials and rebuilds them from the folder, while preserving every harvested
  entry (packages, vignettes, chapters, blog posts). It is fully offline.
- **`build/harvest.mjs`** (the full `npm run all`) calls the same
  `tutorialEntries()` and excludes `kind:"tutorial"` from the `sources.json`
  `posts[]` mapping, so the two build paths agree.
- Local `tutorials/…` URLs are **skipped by the link verifier**
  (`verify_links.mjs` only checks `http(s)`), so self-hosted files never block a
  build.

### Build commands

| Command | What | Network / siblings |
|---------|------|--------------------|
| `npm run tutorials` | rebuild tutorials + curated slice (About/News/Papers/Tools/People) | offline |
| `npm run all` | full harvest (packages, CRAN, vignettes, chapters) + verify + stamp | needs both |

---

## Notes & limits

- A tutorial belongs to the **one** package whose folder it's in. For a
  multi-package tutorial, put it in the primary package's folder.
- Renaming = move the file to another `tutorials/<package>/` folder and rebuild.
  Removing = delete the file and rebuild.
- The original 247 MB of un-optimized snapshots remain in git history (from the
  first self-hosting commit); the working tree is lean. Purging history would
  need a one-time `git filter-repo` + force-push.
