# Dynasite — Modernization Plan

A consolidated audit of the current site and a phased plan to make it **cleaner,
sharper, more modern**, and to **add functionality** — without abandoning the
"static, vanilla, offline-capable, Studio-editable" architecture that makes it
cheap to host and easy to maintain.

_Audit date: 2026-06-23 · 151 catalog entries, 0 broken links._

> **Status (2026-06-23): Phases 0 → 1 → 2 shipped.** Pure-monochrome refresh,
> dark mode (auto + toggle), and the ⌘K search palette are live in the working
> tree. Phases 3–4 (BibTeX/per-person hubs, SEO/RSS) remain available as
> follow-ups. Decisions used: monochrome accent, dark mode auto + manual toggle.

---

## Session log — 2026-06-26 (content + Readings + self-hosted tutorials)

Work shipped after the Phase 0–2 spine. All live on `main`; catalog rebuilt and
links verified (0 broken) each step.

**Reading-room overhaul (the old "Writing" view).**
- Renamed nav: **Papers → "Selected articles"**, **Writing → "Readings"** (routes
  unchanged so links don't break).
- Every reading — tutorial, vignette/article, blog post — now renders as a
  **book-chapter-style card** across all packages (generalized `resourceCard()`),
  not just tutorials. Replaces the old flat link lists.
- **Secondary menu** under the main nav on the **Readings** page
  (Tutorials · Articles · Blogs) and on each **package dossier**
  (Tutorials · Articles · Blogs · In the Book): one category per view, so no
  63-card scroll. Styled as faint green-blue bold tabs above a divider line.
  Hash sub-routes: `#/writing/<cat>`, `#/pkg/<id>/<cat>`.
- Dropped the "R Package · maintained by …" kicker from dossier headers.

**Content.**
- News: release items for **bibnets, cooccure, transitiontrees** + the two
  **Heterogeneous TNA** papers (JCAL + arXiv "vibe coding", blog-style); later
  release news for **psychnet, lagdynamics, htna, Nestimate, snakeplot, Saqrlab,
  Saqrmisc** (psychnet/Saqrlab pulled — repos not public, broken links).
- Selected articles: added the JCAL + arXiv HTNA papers; de-duplicated Koli.
- **transitiontrees on CRAN:** taught `harvest.mjs` to surface a CRAN package's
  vignettes from CRAN's own hosted vignette HTML when it has no pkgdown site
  (`vignettesFromDir`); fixed its release news to the CRAN date/link. Also
  surfaced codyna's article via the same path.

**Self-hosted tutorials (the big one).** Tutorials moved from linked-out to
hosted under `tutorials/<package>/`. Images optimized **247 MB → 61 MB**
(`build/optimize_tutorial.py`; the bloat was retina-DPI base64 PNGs).
**Auto-discovered** from the folder — no `sources.json` entries — with title +
description read from each file's `<head>` (`tutorialEntries()` in `curated.mjs`;
`npm run tutorials` rebuilds offline). Full guide: **[TUTORIALS.md](./TUTORIALS.md)**.
Caveat: the original un-optimized snapshots remain in git history (would need a
`filter-repo` + force-push to purge).

---

## 1. What the site is today (snapshot)

- **Stack:** single-page static app. `index.html` + `assets/app.js` (539 lines,
  one IIFE) + `assets/style.css` (353 lines) + `assets/catalog.js`
  (`window.CATALOG`, inlined for offline) + `chord.js` + `d3.min.js`. Hash router,
  no framework. Hosted on GitHub Pages.
- **Content pipeline:** `build/sources.json` (curated seed) →
  `build/harvest.mjs` + `build/curated.mjs` → `catalog.json` + `assets/catalog.js`;
  `build/verify_links.mjs` checks every URL with a browser UA.
- **Editing:** `server.mjs` + `studio/` — a local-only CMS that compiles the
  catalog and git-pushes. The public site stays a dumb CDN.
- **Catalog:** 14 packages · 42 vignettes · 19 posts · 44 chapters · 12 papers ·
  4 tools · 6 news · 4 people · 3 books · 3 site links.
- **Views:** Overview (about + chord map + browse cards + newsletter), People,
  Packages, Tools, Chapters, Papers, News, and a per-package dossier.

The information architecture is **solid**. The gaps are in **polish, typographic
identity, discoverability, and a few high-value features that are half-scaffolded
but never finished.**

---

## 2. Audit findings (verified, not assumed)

### A. Dead weight & inconsistency — "consolidate"
1. **Three web-font families are downloaded but never used.** `index.html`
   `<link>`s Fraunces, Hanken Grotesk, and Space Mono; `style.css` renders
   everything in `-apple-system` / `ui-monospace`. Pure waste *and* a missed
   identity — the fonts are already paid for.
2. **~11 dead CSS selector groups** never appear in `app.js`'s output:
   `.searchwrap`, `.statline`, `.runhead`, `.motif`, `.eyebrow`, `.cols2`,
   `.about .pipe`, `.about .atag`, `.sdot*`, `.title-row`, `.deck`. The
   `sources.json` `pipeline[]` array is likewise never rendered. ~40 lines of CSS
   and a JSON block to delete.
3. **`d3.min.js` = 276 KB = 87% of the JS payload**, loaded on every page, for a
   single chord diagram that only shows on the overview.
4. **Manual cache-busting** (`?v=9`) hand-edited on every CSS change — error-prone.

### B. Functionality gaps — "add functionality"
5. **No search.** A 151-item catalog with no way to search it. The original plan
   specified Fuse.js; `.searchwrap` CSS exists but is `display:none` and never
   rendered. This is the biggest functional hole.
6. **Link-verification status is computed but never surfaced** (101 VERIFIED /
   47 REDIRECT). The freshness guarantee the build earns is invisible.
7. **42 vignettes and 19 posts are only reachable inside package dossiers** — no
   top-level way to browse the writing/tutorials.
8. **Papers have no "copy citation / BibTeX"** — the academic audience's #1 want.
9. **People link straight out;** no per-person page aggregating their
   packages/papers/chapters (the data to build it already exists).
10. **No tag/focus filtering** on the Packages list.
11. **No SEO/social layer:** no `sitemap.xml`, no Open Graph image, no JSON-LD,
    no RSS for News. Shared links render as bare text.

### C. Visual modernity — "sharper, cleaner"
12. **No dark mode** / no `prefers-color-scheme`.
13. **Generic system-sans** gives a competent-but-anonymous feel; the unused
    Fraunces is exactly the distinctive editorial display face the site wants.
14. **Pure-black single accent** — fine, but interaction states are flat; no
    motion language, no focus polish beyond underlines.

---

## 3. Design direction

Keep the restraint. The site's austerity is an asset — the goal is **"sharper
editorial," not "busier."** Concretely:

- **Type:** Fraunces (optical-size display serif) for headlines and the wordmark;
  Hanken Grotesk for body; keep a mono for metadata/labels. This alone moves the
  site from "clean template" to "designed object" — and the fonts are already
  loaded.
- **Color:** stay monochrome by default; introduce **one** restrained ink accent
  (a deep indigo or the existing CRAN-green, used only for active/interactive
  states) so the page isn't 100% greyscale.
- **Dark mode:** token-driven (the CSS already uses `--bg/--fg/--line` variables),
  so it's a `prefers-color-scheme` block + a toggle, not a rewrite.
- **Motion:** subtle, taste-first — short fades on route change, the existing
  lightbox transition language extended consistently.

---

## 4. Phased plan

Each phase is independently shippable and independently reversible.

### Phase 0 — Consolidate (low risk, do first)
- Delete the unused font `<link>`s **or** wire the fonts in (Phase 1 decides which).
- Strip the ~11 dead CSS selector groups and the unused `pipeline[]` JSON.
- Lazy-load `d3.min.js` + `chord.js` **only** on the overview route (dynamic
  `<script>` injection), or replace the chord with a dependency-free SVG. Cuts
  first-paint JS by ~87%.
- Add a tiny build step that stamps `?v=<hash>` automatically so cache-busting
  stops being manual.
- **Outcome:** smaller, tidier, faster — zero visible change.

### Phase 1 — Typographic & visual refresh ("sharper")
- Wire Fraunces + Hanken Grotesk into `--display` / `--sans` tokens; retune the
  type scale, masthead, and section heads around them.
- Add the single accent token and apply it to nav-active, links, buttons, focus.
- Add **dark mode** (media query + a masthead toggle persisted to `localStorage`).
- Tighten spacing rhythm and add restrained route-change motion.
- **Outcome:** the "modern, sharp" identity. Highest aesthetic impact.

### Phase 2 — Search & discoverability ("add functionality")
- **Global search** over all 151 entries (title + blurb + tags + type). Vanilla
  substring/scored match — no need to re-add a dependency for a 151-item set.
  Wire it as a ⌘K / `/`-to-focus command-palette overlay so it feels modern and
  keyboard-first. Reuses the already-styled (currently hidden) `.searchwrap`.
- **Tag/focus filter** on the Packages list (reuse the chord's `FOCUS` taxonomy).
- A top-level **Writing** view (or filter) that finally surfaces the 42 vignettes
  + 19 posts outside the dossiers.
- **Outcome:** the catalog becomes navigable, not just browsable.

### Phase 3 — Academic-audience features
- **Copy-citation / BibTeX** button on each paper (and package "How to cite").
- **Per-person pages** (`#/people/<id>`) that aggregate that person's papers,
  packages, and chapters from the existing catalog — turning the People tab from
  a link-out into a real hub. (Router already has the `people/<id>` branch.)
- Surface **link-status freshness** subtly (a "verified <date>" line in the
  footer or a quiet dot on outbound links).

### Phase 4 — Reach & sharing (SEO/social)
- Generate `sitemap.xml`, an Open Graph image, and JSON-LD (`SoftwareApplication`
  / `ScholarlyArticle`) at build time.
- **RSS/Atom feed** for News so releases are subscribable without the mailto.
- Per-route `<title>`/meta updates on hash change.
- **Outcome:** shared links look designed; the site is indexable and followable.

---

## 5. Sequencing recommendation

**0 → 1 → 2** is the high-value spine: consolidate, then the type/dark-mode
refresh (the "modern/sharp" the request centers on), then search (the biggest
functional gap). Phases 3–4 are additive and can follow once the spine ships.

Every phase stays inside the current architecture: vanilla JS, static output,
Studio-editable, offline-capable. No framework, no backend, no new hosting.

---

## 6. Open decisions (need user input before Phase 1)

- **Accent color:** stay pure monochrome, adopt deep indigo, or reuse CRAN-green?
- **Dark mode:** auto-only (follow OS) or auto + manual toggle?
- **Scope to execute now:** Phase 0 only (safe cleanup), 0+1 (cleanup + visual),
  or the full 0→1→2 spine?
