# Updating the Dynalytics site

Everything the site shows comes from **one data file**, `build/sources.json`,
which is compiled into `catalog.json` + `assets/catalog.js` (what the page
actually loads). There are two ways to edit content; both end with the same
`git push`, after which GitHub Pages redeploys in ~1 minute.

```
build/sources.json ──(compile)──▶ catalog.json + assets/catalog.js ──(git push)──▶ GitHub Pages
        ▲                                   ▲
   you edit this                    the site reads this
```

There is no server in production. The site is a static page on GitHub Pages.
The **Studio** below is a *local* editing tool you run only while making changes.

---

## Two content kinds: curated vs. harvested

| Kind | What | Where it comes from | Edit it? |
|------|------|---------------------|----------|
| **Curated** | About text, Newsletter, **News**, **People**, **Papers**, **Tools**, **Blogs** (off-site blog/article/news links) | hand-written in `build/sources.json` | ✅ yes — this is what you change, in the Studio or by hand |
| **Self-hosted tutorials** | the tutorial HTML pages under `tutorials/<package>/` | auto-discovered from the folder (title/description read from each file's `<head>`) | ✅ yes — **drop a file in the folder**, see [TUTORIALS.md](./TUTORIALS.md) |
| **Harvested** | package title/description/version, vignette/article lists, book **chapter** pages + abstracts, book volumes | auto-pulled from local `DESCRIPTION` files, CRAN, and live `pkgdown` / `lamethods` sitemaps | ⚠️ only via a full re-harvest |

The six sections the Studio edits — **About, News, Blogs, Papers, Tools,
People** — are pure curated content and recompile **instantly with no network**.
Anything touching packages or chapters needs a full **re-harvest** (hits the
network and needs the sibling package repos checked out next to this one).

**Tutorials are self-hosted**, not linked out: each `tutorials/<package>/<slug>.html`
is auto-registered (no `sources.json` entry). To add one, drop the HTML in the
package folder and run `npm run tutorials` (offline) — full guide in
**[docs/TUTORIALS.md](./TUTORIALS.md)**.

---

## Way 1 — the Studio (GUI, recommended for content)

```bash
npm run studio          # first run prints a generated password
# or set your own:
STUDIO_PASSWORD='choose-one' npm run studio
```

Open **http://localhost:8780/studio**, sign in, then:

1. Pick a tab: **About · News · Blogs · Papers · Tools · People**.
2. Edit fields; **+ Add** / **Remove** items.
3. **Save** (or ⌘S) — compiles `catalog.js` locally, instantly. Click **Preview ↗**
   to see the result at `http://localhost:8780/`.
4. **Publish** — `git add` + `commit` + `push` of `build/sources.json`,
   `catalog.json`, `assets/catalog.js`. Pages redeploys.
5. **Re-harvest** — only when packages/chapters changed. Re-pulls from the
   network and re-verifies every link.

The password is stored **hashed** in `.studio-auth.json` (gitignored). Delete
that file to reset it.

---

## Way 2 — edit `sources.json` directly (CLI / scripted / AI)

Best for bulk edits, programmatic changes, or when you're already in an editor.

1. **Edit** the relevant array/section in `build/sources.json` (schemas below).
2. **Compile** the catalog:
   - **Curated-only change** (About / News / Blogs / Papers / Tools / People) —
     instant, no network:
     ```bash
     node --input-type=module -e 'import("./build/curated.mjs").then(m=>console.log(m.regenCurated(process.cwd())))'
     ```
   - **Anything else, or to re-verify links** — full build:
     ```bash
     npm run all        # node build/harvest.mjs && node build/verify_links.mjs
     ```
     `harvest.mjs` needs the sibling package repos present under `workspace_root`
     (`..`) and network access; `verify_links.mjs` exits non-zero if any URL is
     **BROKEN**.
3. **Commit & push** the generated files:
   ```bash
   git add build/sources.json catalog.json assets/catalog.js
   git commit -m "content: <what changed>"
   git push origin main
   ```

> New URLs added by a curated-only regen are marked `UNVERIFIED` until a full
> `npm run verify` (or the weekly CI link-check) confirms them. Unchanged URLs
> keep their previous verified status.

---

## Section schemas (`build/sources.json`)

**News** — `news[]` (newest-first display is automatic, sorted by `date`):
```json
{ "date": "2026-06-21", "tag": "Paper",
  "title": "…", "blurb": "…", "url": "https://doi.org/…" }
```

**People** — `people[]`:
```json
{ "id": "saqr", "name": "…", "role": "…", "affiliation": "…",
  "blurb": "…", "url": "https://…", "photo": "https://…" }
```

**Papers** — `papers[]`:
```json
{ "title": "…", "authors": "…", "year": "2026", "venue": "…",
  "url": "https://doi.org/…", "blurb": "…" }
```

**Tools** — `tools[]`:
```json
{ "id": "tnapy", "kind": "Python", "title": "…", "blurb": "…",
  "url": "https://…", "links": { "github": "https://…" },
  "owner": "mohsaqr", "tags": ["python", "TNA"] }
```

**About** — the `about` object (homepage text + newsletter):
```json
{ "tagline": "…", "lead": "…", "more": "…", "closing": "…",
  "paper": { "label": "Read the paper", "href": "https://doi.org/…" },
  "newsletter": { "heading": "…", "blurb": "…", "cta": "Subscribe",
                  "note": "…", "form": null, "email": "hamada@saqr.me" },
  "points": [ { "h": "Heading", "t": "Body" } ],
  "pipeline": ["…"] }
```
> Newsletter: set `"form"` to a Google Form URL to make **Subscribe** open it;
> leave it `null` to fall back to a `mailto:` to `email`.

**Packages** — `packages[]` (the rest is harvested from each `DESCRIPTION`):
```json
{ "name": "tna", "dir": "tna", "owner": "sonsoleslp",
  "docs": "https://sonsoles.me/tna/", "cran": true,
  "tags": ["network","TNA"], "logo": "https://…" }
```
Escape hatches: `"no_github": true`, `"exclude_articles": ["slug"]`,
`"docs": null` (no pkgdown site).

**Blogs / posts** (off-site blog / article / news links) — `posts[]`. Edited in
the Studio's **Blogs** tab; **curated and instant** (a curated-only regen rebuilds
them, no re-harvest needed):
```json
{ "title": "…", "url": "https://…", "desc": "…",
  "packages": ["tna"], "source": "sonsoles.me", "kind": "blog" }
```
`kind` ∈ `blog | news | article`. **Tutorials are no longer listed here** —
they are self-hosted and auto-discovered from `tutorials/<package>/`
(see [TUTORIALS.md](./TUTORIALS.md)).

**Book volumes** — `book_volumes[]` (chapters auto-harvested from `sitemap`):
`id, title, blurb, cover, code_repo, springer_doi_base?, base, sitemap,
titles{ slug: "Chapter Title" }`.

---

## Things that bite

- **The site loads `assets/catalog.js`, not `sources.json`.** If your edit
  doesn't show, you forgot to recompile (step 2 above) or to commit the
  regenerated files.
- **CSS changes need a cache-bust.** After editing `assets/style.css`, bump the
  `?v=N` query in `index.html` (and `studio/index.html`) so returning visitors
  get it.
- **`saqr.me` 403s bots.** Link verification sends a Chrome User-Agent on
  purpose — don't "fix" that.
- **Never commit** `.studio-auth.json` (gitignored) or session artifacts
  (`HANDOFF.md`, `LEARNINGS.md`, `CHANGES.md`).
- **Re-harvest needs siblings.** `harvest.mjs` reads `../<pkg>/DESCRIPTION`; run
  it from a full workspace checkout, not a standalone clone of this repo.

---

## Deploy

GitHub Pages serves the repo root on `main`. A push that changes
`catalog.json` / `assets/catalog.js` triggers a redeploy (~1 min). The committed
`CNAME` points the custom domain. The weekly `.github/workflows/linkcheck.yml`
cron re-verifies links and opens an issue on breakage.
