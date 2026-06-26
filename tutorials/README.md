# Tutorials

Self-hosted tutorials, served by GitHub Pages at
`https://dynasite.org/tutorials/<package>/<slug>.html`.

> Full reference (architecture, build commands, limits): **[../docs/TUTORIALS.md](../docs/TUTORIALS.md)**.
> This file is the at-the-folder quick start.

**The folder is the source of truth.** Every `tutorials/<package>/<slug>.html`
is auto-registered as a tutorial — no `sources.json` editing. Its title and
description are read from the file's own `<head>` (the `title:` and
`description:`/`subtitle:` you wrote in the qmd front-matter).

## Add a tutorial — write & push

1. Render your tutorial to a **single self-contained HTML** (Quarto
   `embed-resources: true`, or rmarkdown `self_contained: true`).
2. Drop it in the package folder: `tutorials/<package>/<slug>.html`
   (make a new folder when a package gets its first tutorial).
3. Build & push:
   ```bash
   npm run tutorials      # offline rebuild — scans this folder, updates the catalog
   git add tutorials catalog.json assets/catalog.js
   git commit -m "tutorials: add <slug>" && git push
   ```

That's it. The tutorial appears in the **Readings** menu and on its **package
dossier** automatically, with its package badge.

## Keep the files small (one-time habit, not a per-tutorial chore)

Quarto exports plots at retina DPI, which can make a single file 50–75 MB. Two
ways to avoid the bloat:

- **Best — fix it at the source.** In your qmd front-matter:
  ```yaml
  format:
    html:
      fig-dpi: 120        # instead of the retina default that yields ~10,000px plots
  ```
  Then files render small (1–3 MB) and need nothing further.
- **Backstop — slim an existing file** (no re-render needed):
  ```bash
  python3 build/optimize_tutorial.py tutorials/<package>/<slug>.html
  # --quantize  : ~2× smaller (256-colour palette; slight banding risk on smooth heatmaps)
  # --max-width N: change the 1600px downscale cap
  ```

## Notes

- Title is auto-cleaned (a trailing " – sonsoleslp" / " | Mohammed Saqr" site
  suffix is stripped). To control the title/description, set them in the qmd.
- A tutorial belongs to the package whose folder it's in. For a multi-package
  tutorial, put it in the primary package's folder.
- Local `tutorials/…` URLs are skipped by the link verifier, so they never block
  a build.
