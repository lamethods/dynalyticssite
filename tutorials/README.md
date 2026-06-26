# Tutorials

Self-hosted tutorial pages, served by GitHub Pages at
`https://dynasite.org/tutorials/<package>/<slug>.html`.

## Layout — one folder per package

```
tutorials/
  tna/       …tutorials about the tna package
  codyna/    …codyna
  cograph/   …cograph
  <package>/ …add a new folder when a package gets its first tutorial
```

Put each tutorial as a **single self-contained HTML file** (Quarto `embed-resources: true`,
or rmarkdown `self_contained: true`) at `tutorials/<package>/<slug>.html`.

## Adding a tutorial

1. Drop the rendered HTML at `tutorials/<package>/<slug>.html`.
2. **Slim the images** (Quarto exports plots as oversized retina PNGs — often
   90%+ of the file):
   ```bash
   python3 build/optimize_tutorial.py tutorials/<package>/<slug>.html
   # add --quantize for ~2× more (256-colour palette; slight banding risk on
   # smooth heatmap gradients), or --max-width N to change the 1600px cap.
   ```
3. Register it in `build/sources.json` under `posts[]`:
   ```json
   { "title": "…", "url": "tutorials/<package>/<slug>.html",
     "desc": "…", "packages": ["<package>"], "source": "dynasite", "kind": "tutorial" }
   ```
4. Rebuild + verify + commit:
   ```bash
   npm run all
   git add tutorials build/sources.json catalog.json assets/catalog.js
   git commit -m "tutorials: add <slug>" && git push
   ```

The card's package badge and the Readings/dossier menus pick it up automatically.
Local `tutorials/…` URLs are skipped by the link verifier (it only checks http(s)),
so they never block a build.
