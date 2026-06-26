---
name: update-dynalytics-site
description: Add or edit content on the Dynalytics / Dynasite website — News, People, Papers, Tools, About/newsletter text, packages, tutorials/blog posts, or book volumes. Use whenever asked to update, add to, correct, or publish changes to this site. Covers editing build/sources.json, recompiling the catalog, verifying links, and publishing to GitHub Pages.
---

# Update the Dynalytics site

The site is a **static page on GitHub Pages**. All content lives in
`build/sources.json`, compiled to `catalog.json` + `assets/catalog.js` (what the
page loads). Editing flow: **edit `sources.json` → recompile → commit → push**.
Full reference: `docs/UPDATING.md`.

## Step 1 — classify the change

- **Curated** (edit directly, recompiles instantly, no network):
  `about`, `news`, `people`, `papers`, `tools`, `posts` (off-site blog/article/
  news links — the Studio's **Blogs** tab).
- **Harvested-adjacent** (also in `sources.json`, but needs a full re-harvest to
  reflect): `packages`, `book_volumes`, `chapter_packages`, `extra_links`.
- **Self-hosted tutorials**: drop the HTML in `tutorials/<package>/` — auto-
  discovered, no `sources.json` edit (see `docs/TUTORIALS.md`).

## Step 2 — edit `build/sources.json`

Append to or edit the matching array/object. Schemas (see `docs/UPDATING.md` for
the full list):

- **news[]**: `{ "date": "YYYY-MM-DD", "tag": "Paper|Software|Funding|…", "title", "blurb", "url" }`
- **people[]**: `{ "id", "name", "role", "affiliation", "blurb", "url", "photo" }`
- **papers[]**: `{ "title", "authors", "year", "venue", "url", "blurb" }`
- **tools[]**: `{ "id", "kind", "title", "blurb", "url", "links": {…}, "owner", "tags": [] }`
- **about**: `{ "tagline","lead","more","closing","paper":{"label","href"},`
  `"newsletter":{"heading","blurb","cta","note","form","email"},"points":[{"h","t"}],"pipeline":[] }`
- **packages[]**: `{ "name","dir","owner","docs","cran":bool,"tags":[],"logo"? }`
  (rest harvested from `<dir>/DESCRIPTION`)
- **posts[]**: `{ "title","url","desc","packages":[],"source","kind":"tutorial|blog|news" }`

Keep entries valid JSON; match the existing style. News is auto-sorted newest-first by `date`.

## Step 3 — recompile the catalog

- **Curated-only** change (About / News / Blogs / Papers / Tools / People) — fast, offline:
  ```bash
  node --input-type=module -e 'import("./build/curated.mjs").then(m=>console.log(m.regenCurated(process.cwd())))'
  ```
- **Anything else, or to (re)verify links** — full build (needs network + sibling
  package repos under `..`):
  ```bash
  npm run all      # node build/harvest.mjs && node build/verify_links.mjs
  ```
  `verify_links.mjs` exits non-zero if any URL is BROKEN — investigate before publishing.

Always confirm the regenerated `assets/catalog.js` contains your change
(e.g. `grep` the new title) before committing — the site loads that file, not `sources.json`.

## Step 4 — verify new links (recommended)

Curated regen marks new URLs `UNVERIFIED`. To check them without a full harvest is
not supported in isolation; run `npm run verify` (network) or rely on the weekly
`linkcheck.yml` CI. For DOIs and known-good hosts this is usually fine to defer.

## Step 5 — publish

Per the repo's git rules, **summarize the changes and ask before pushing** unless
the user already authorized it. Then:
```bash
git add build/sources.json catalog.json assets/catalog.js
git commit -m "content: <what changed>"
git push origin main
```
GitHub Pages redeploys in ~1 minute. Confirm by polling the live URL.

## Alternative — the Studio GUI

For interactive editing: `npm run studio` → http://localhost:8780/studio → edit →
**Save** (compiles) → **Publish** (commits + pushes). Same result; same files.

## Gotchas

- The page reads `assets/catalog.js` — recompile after every `sources.json` edit.
- Editing `assets/style.css`? Bump the `?v=N` cache-bust in `index.html` **and**
  `studio/index.html`.
- Never stage `.studio-auth.json` (gitignored) or `HANDOFF.md` / `LEARNINGS.md` /
  `CHANGES.md`.
- `saqr.me` 403s bots — the Chrome User-Agent in the verifier is intentional.
- `harvest.mjs` needs the sibling package checkouts (`../tna`, etc.); it reads
  their `DESCRIPTION` files.
