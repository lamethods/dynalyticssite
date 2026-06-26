// curated.mjs — single source of truth for the hand-edited ("curated") catalog
// entry types: papers, tools, news, people, and the About block.
//
// Both harvest.mjs (full network harvest) and the Studio server import these so
// there is exactly one mapping from sources.json -> catalog entries. The Studio
// uses regenCurated() to rebuild ONLY these types instantly, with no network —
// auto-harvested types (packages, chapters, vignettes, posts, books) are left
// untouched from the last full harvest.

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

// the entry types the Studio owns and can rebuild offline
export const CURATED_TYPES = ["paper", "tool", "news", "person"];

// the sources.json sections the Studio edits
export const EDITABLE_SECTIONS = ["about", "papers", "tools", "news", "people"];

export const paperEntries = (papers = []) => papers.map((p, i) => ({
  id: `paper::${i + 1}`, type: "paper", title: p.title, blurb: p.blurb, url: p.url, links: { paper: p.url },
  authors: p.authors, year: p.year, venue: p.venue, status: "UNVERIFIED", last_checked: null
}));

export const toolEntries = (tools = []) => tools.map((t) => ({
  id: `tool::${t.id}`, type: "tool", kind: t.kind, title: t.title, blurb: t.blurb,
  url: t.url, links: t.links, owner: t.owner ?? null, tags: t.tags || [],
  status: "UNVERIFIED", last_checked: null
}));

export const newsEntries = (news = []) => news.map((n, i) => ({
  id: `news::${i + 1}`, type: "news", date: n.date, tag: n.tag || null,
  title: n.title, blurb: n.blurb, url: n.url, links: { read: n.url },
  tags: ["news", ...(n.tag ? [n.tag.toLowerCase()] : [])],
  status: "UNVERIFIED", last_checked: null
}));

export const peopleEntries = (people = []) => people.map((p) => ({
  id: `person::${p.id}`, type: "person", title: p.name, name: p.name,
  role: p.role, affiliation: p.affiliation, blurb: p.blurb,
  url: p.url, photo: p.photo, links: { site: p.url },
  status: "UNVERIFIED", last_checked: null
}));

// --- self-hosted tutorials: the tutorials/ folder IS the source of truth ---
// Every tutorials/<package>/<slug>.html becomes a tutorial post automatically.
// Title + description are read from the file's own <head> (the author writes
// them in the qmd front-matter), so adding a tutorial is: drop the HTML in the
// right package folder and rebuild — no sources.json editing.
const SITE_SUFFIX = /\s*[–—|-]\s*(sonsoleslp|sonsoles(?:\.me)?|Mohammed Saqr|saqr\.me)\s*$/i;
function metaFromHtml(html) {
  const pick = (re) => { const m = html.match(re); return m ? m[1] : ""; };
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i).replace(/\s+/g, " ").replace(SITE_SUFFIX, "").trim();
  const desc = (pick(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)
            || pick(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i)).replace(/\s+/g, " ").trim();
  return { title, desc };
}
export function tutorialEntries(root) {
  const base = join(root, "tutorials");
  if (!existsSync(base)) return [];
  const out = [];
  for (const pkg of readdirSync(base)) {
    const dir = join(base, pkg);
    if (!statSync(dir).isDirectory()) continue;                 // skip README.md etc.
    for (const f of readdirSync(dir).filter((f) => /\.html$/i.test(f))) {
      const slug = f.replace(/\.html$/i, "");
      const { title, desc } = metaFromHtml(readFileSync(join(dir, f), "utf8"));
      const url = `tutorials/${pkg}/${f}`;
      out.push({
        id: `tutorial::${pkg}::${slug}`, type: "post", kind: "tutorial",
        title: title || slug, blurb: desc, url, links: { post: url },
        owner: null, source: "dynasite", packages: [pkg],
        tags: ["tutorial", pkg], status: "UNVERIFIED", last_checked: null
      });
    }
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

// build all curated entries for a sources object, in the canonical catalog order
export function buildCuratedEntries(src) {
  return [
    ...paperEntries(src.papers),
    ...toolEntries(src.tools),
    ...newsEntries(src.news),
    ...peopleEntries(src.people)
  ];
}

// Carry forward verification status for URLs that did not change, so an instant
// curated save doesn't reset a known-good link back to "UNVERIFIED".
function statusIndex(entries) {
  const idx = {};
  for (const e of entries || []) {
    for (const u of [e.url, ...Object.values(e.links || {})]) {
      if (u && typeof u === "string" && !(u in idx)) idx[u] = { status: e.status, last_checked: e.last_checked };
    }
  }
  return idx;
}
function applyKnownStatus(entries, idx) {
  for (const e of entries) {
    const hit = idx[e.url] || Object.values(e.links || {}).map((u) => idx[u]).find(Boolean);
    if (hit && hit.status && hit.status !== "UNVERIFIED") { e.status = hit.status; e.last_checked = hit.last_checked; }
  }
  return entries;
}

// Instant, network-free regeneration of the curated slice of the catalog.
// Reads sources.json + catalog.json from `root`, swaps About + curated entries,
// preserves every auto-harvested entry, rewrites catalog.json + assets/catalog.js.
export function regenCurated(root) {
  const srcPath = join(root, "build", "sources.json");
  const catPath = join(root, "catalog.json");
  const src = JSON.parse(readFileSync(srcPath, "utf8"));
  const catalog = JSON.parse(readFileSync(catPath, "utf8"));

  const known = statusIndex(catalog.entries);
  // drop curated types AND old auto-discovered tutorials — both are rebuilt below.
  const kept = catalog.entries.filter((e) =>
    !CURATED_TYPES.includes(e.type) && !(e.type === "post" && e.kind === "tutorial"));
  const fresh = applyKnownStatus(buildCuratedEntries(src), known);
  const tuts = applyKnownStatus(tutorialEntries(root), known);

  // re-insert curated entries just before People-adjacent extras so order is stable:
  // keep packages/posts/chapters/books first, then curated, then person/extra tail.
  const tailTypes = new Set(["person", "site", "docsite", "book"]);
  const head = kept.filter((e) => !tailTypes.has(e.type));
  const tail = kept.filter((e) => tailTypes.has(e.type));
  const curatedNonPerson = fresh.filter((e) => e.type !== "person");
  const curatedPerson = fresh.filter((e) => e.type === "person");

  catalog.about = src.about;
  catalog.entries = [...head, ...tuts, ...curatedNonPerson, ...curatedPerson, ...tail];
  catalog.counts = {
    ...(catalog.counts || {}),
    total: catalog.entries.length,
    news: catalog.entries.filter((e) => e.type === "news").length
  };

  writeFileSync(catPath, JSON.stringify(catalog, null, 2) + "\n");
  writeFileSync(join(root, "assets", "catalog.js"), "window.CATALOG = " + JSON.stringify(catalog) + ";\n");
  return {
    papers: src.papers?.length || 0, tools: src.tools?.length || 0,
    news: src.news?.length || 0, people: src.people?.length || 0,
    total: catalog.entries.length
  };
}
