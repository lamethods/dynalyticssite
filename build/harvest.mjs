#!/usr/bin/env node
// harvest.mjs — build catalog.json (+ assets/catalog.js) for Dynasite.
// Node port of harvest.R. Same output. No dependencies (built-in fetch).
//
// Sources: each package's local DESCRIPTION + build/sources.json + live pkgdown
// articles index + live lamethods book sitemaps + curated posts/books/papers.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, resolve, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const BUILD = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(BUILD, "..");
const src = JSON.parse(readFileSync(join(BUILD, "sources.json"), "utf8"));
const WORKSPACE = resolve(ROOT, src.workspace_root);
const today = new Date().toISOString().slice(0, 10);

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchText(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 25000);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: ac.signal });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; } finally { clearTimeout(t); }
}

// --- DESCRIPTION (DCF) parsing ---
function parseDcf(text) {
  const out = {}; let key = null;
  for (const raw of text.split(/\r?\n/)) {
    if (/^\s/.test(raw) && key) { out[key] += " " + raw.trim(); }
    else { const m = raw.match(/^([^:]+):\s?(.*)$/); if (m) { key = m[1].trim(); out[key] = m[2]; } }
  }
  return out;
}
const splitUrls = (x) => (!x ? [] : x.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean));
function githubFromUrls(urls) {
  const hit = urls.find((u) => /github\.com\/[^/]+\/[^/ ]+/i.test(u));
  if (!hit) return null;
  const m = hit.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
  if (!m) return null;
  if (m[1].toLowerCase() === "yourusername") return null;
  return `https://github.com/${m[1]}/${m[2].replace(/\.git$/, "")}`;
}
const homepageFromUrls = (urls) =>
  urls.find((u) => !/github\.com|cran\.r-project|r-project\.org|r-universe/i.test(u)) || null;

function cleanBlurb(x) {
  if (!x) return "";
  x = x.replace(/<[^>]*>/g, "");
  x = x.replace(/\([^()]*\([0-9]{4}[a-z]?\)[^()]*\)/g, "");
  x = x.replace(/\([^()]*(et al\.|, ?[0-9]{4})[^()]*\)/g, "");
  x = x.replace(/\(\s*\)/g, "");
  x = x.replace(/See\s+for (more )?details[^.]*\./gi, "");
  x = x.replace(/\s+([,.;])/g, "$1");
  x = x.replace(/([,;])\s*\./g, ".");
  x = x.replace(/\s+/g, " ");
  return x.trim();
}

async function cranVersion(name) {
  const body = await fetchText(`https://crandb.r-pkg.org/${name}`);
  if (!body) return null;
  try { return JSON.parse(body).Version || null; } catch { return null; }
}

function vignetteTitle(path) {
  const head = readFileSync(path, "utf8").split(/\r?\n/).slice(0, 40);
  const t = head.find((l) => /^title:\s*/.test(l));
  if (t) return t.replace(/^title:\s*["']?|["']?\s*$/g, "").trim();
  const v = head.find((l) => /VignetteIndexEntry/.test(l));
  if (v) return v.replace(/.*VignetteIndexEntry\}?\{?|\}.*/g, "").trim();
  return basename(path).replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
}

async function getSiteArticles(docs) {
  const base = docs + "articles/";
  const origin = (docs.match(/^(https?:\/\/[^/]+)/) || [])[1] || "";
  let html = await fetchText(base + "index.html");
  if (!html) html = await fetchText(base);
  if (!html) return [];
  const re = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set(), out = [];
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    const text = m[2].replace(/<[^>]*>/g, "").trim();
    if (!/\.html$/.test(href) || /index\.html$/.test(href) || /^\.\.\//.test(href) || /^#/.test(href)) continue;
    if (!text || text.length >= 120) continue;
    const url = /^https?:\/\//.test(href) ? href : (/^\//.test(href) ? origin + href : base + href);
    if (!/\/articles\//.test(url) || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, title: text });
  }
  return out;
}

// --- packages + articles ---
async function buildPackage(pkg) {
  const descPath = join(WORKSPACE, pkg.dir, "DESCRIPTION");
  if (!existsSync(descPath)) { console.warn(`DESCRIPTION not found for ${pkg.name}`); return []; }
  const d = parseDcf(readFileSync(descPath, "utf8"));
  const urls = [...splitUrls(d.URL), ...splitUrls(d.BugReports)];
  const github = pkg.no_github ? null : githubFromUrls(urls);
  let docs = pkg.docs != null ? pkg.docs : homepageFromUrls(urls);

  const links = {};
  if (pkg.cran) links.cran = `https://CRAN.R-project.org/package=${pkg.name}`;
  if (github) links.github = github;
  if (docs) { docs = docs.replace(/\/?$/, "/"); links.docs = docs; links.reference = docs + "reference/"; links.articles = docs + "articles/"; }

  let cranv = pkg.cran ? await cranVersion(pkg.name) : null;
  if (pkg.cran && !cranv) cranv = d.Version;
  console.error(`  · ${pkg.name.padEnd(16)} docs=${docs ? "yes" : "no"} cran=${cranv || "-"}`);

  const primary = links.docs || links.cran || links.github || null;
  const pkgEntry = {
    id: pkg.name, type: "package",
    title: `${pkg.name} — ${d.Title || ""}`,
    blurb: cleanBlurb(d.Description),
    url: primary, links,
    ...(pkg.logo ? { logo: pkg.logo } : {}),
    ...(pkg.cran ? { cran_version: cranv } : {}),
    version: d.Version || null,
    owner: pkg.owner ?? null, tags: pkg.tags,
    ...(Object.keys(links).length === 0 ? { note: "Local / not yet published publicly" } : {}),
    status: "UNVERIFIED", last_checked: null
  };

  const excl = pkg.exclude_articles || [];
  const vig = [];
  if (links.articles) {
    let arts = await getSiteArticles(docs);
    if (arts.length) {
      arts = arts.filter((a) => !excl.includes(basename(a.url).replace(/\.html$/, "")));
      for (const a of arts) {
        const b = basename(a.url).replace(/\.html$/, "");
        vig.push({
          id: `${pkg.name}::${b}`, type: "vignette", title: a.title,
          blurb: `Article on the ${pkg.name} documentation site.`,
          url: a.url, links: { article: a.url },
          owner: pkg.owner ?? null, tags: [pkg.name, "article", pkg.tags[0]],
          packages: [pkg.name], kind: "article", status: "UNVERIFIED", last_checked: null
        });
      }
    } else {
      const vdir = join(WORKSPACE, pkg.dir, "vignettes");
      if (existsSync(vdir)) {
        for (const f of readdirSync(vdir).filter((f) => /\.(Rmd|qmd)$/i.test(f) && !/^_/.test(f))) {
          const b = f.replace(/\.[^.]+$/, "");
          if (excl.includes(b)) continue;
          vig.push({
            id: `${pkg.name}::${b}`, type: "vignette", title: vignetteTitle(join(vdir, f)),
            blurb: `Article from the ${pkg.name} package.`,
            url: links.articles + b + ".html", links: { article: links.articles + b + ".html" },
            owner: pkg.owner ?? null, tags: [pkg.name, "article", pkg.tags[0]],
            packages: [pkg.name], kind: "article", status: "UNVERIFIED", last_checked: null
          });
        }
      }
    }
  }
  return [pkgEntry, ...vig];
}

// --- posts ---
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const postEntries = src.posts.map((p, i) => ({
  id: `post::${i + 1}::${slugify(p.title.slice(0, 24))}`, type: "post", kind: p.kind,
  title: p.title, blurb: p.desc, url: p.url, links: { post: p.url },
  owner: p.source === "saqr.me" ? "mohsaqr" : "sonsoleslp", source: p.source,
  packages: p.packages, tags: [p.kind, ...p.packages], status: "UNVERIFIED", last_checked: null
}));

// --- book chapters (exact URLs from live sitemaps) ---
async function buildVolume(vol) {
  const xml = await fetchText(vol.sitemap);
  if (!xml) { console.warn(`sitemap fetch failed for ${vol.id}`); return []; }
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => u.includes("/chapters/"));
  const seen = new Set(), rows = [];
  for (const loc of locs) {
    const m = loc.match(/chapters\/(ch[0-9]+[^/]*)\//);
    if (!m || seen.has(m[1])) continue;
    seen.add(m[1]);
    rows.push({ slug: m[1], loc });
  }
  rows.sort((a, b) => a.slug.localeCompare(b.slug));
  return rows.map(({ slug, loc }) => {
    const title = vol.titles[slug] || slug.replace(/-/g, " ");
    const rel = loc.replace(/.*?(chapters\/.*)$/, "$1");
    const url = vol.base + rel;
    return {
      id: `${vol.id}::${slug}`, type: "chapter",
      title: `${slug.replace(/^ch0?/, "Ch ").replace(/-.*$/, "")} — ${title}`,
      blurb: `${vol.title} chapter.`, url, links: { chapter: url },
      owner: "saqr/lopez-pernas/tikka", tags: ["lamethods", vol.id, "chapter", "book"],
      packages: src.chapter_packages?.[slug] || [], volume: vol.title,
      status: "UNVERIFIED", last_checked: null
    };
  });
}

// --- run ---
const pkgArrays = [];
for (const p of src.packages) pkgArrays.push(await buildPackage(p));
const packageEntries = pkgArrays.flat();

const chapterEntries = (await Promise.all(src.book_volumes.map(buildVolume))).flat();

const bookEntries = src.book_volumes.map((v) => ({
  id: v.id, type: "book", title: v.title, blurb: v.blurb, url: v.base, links: { book: v.base },
  owner: "saqr/lopez-pernas/tikka", tags: ["book", "lamethods"], status: "UNVERIFIED", last_checked: null
}));

const paperEntries = (src.papers || []).map((p, i) => ({
  id: `paper::${i + 1}`, type: "paper", title: p.title, blurb: p.blurb, url: p.url, links: { paper: p.url },
  authors: p.authors, year: p.year, venue: p.venue, status: "UNVERIFIED", last_checked: null
}));

const extraEntries = (src.extra_links || []).map((e) => ({ ...e, links: { link: e.url }, status: "UNVERIFIED", last_checked: null }));

const entries = [...packageEntries, ...postEntries, ...chapterEntries, ...bookEntries, ...paperEntries, ...extraEntries];
const count = (t) => entries.filter((e) => e.type === t).length;
const catalog = {
  generated_at: today,
  about: src.about,
  counts: { total: entries.length, packages: count("package"), vignettes: count("vignette"), posts: count("post"), chapters: count("chapter") },
  entries
};

writeFileSync(join(ROOT, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
writeFileSync(join(ROOT, "assets", "catalog.js"), "window.CATALOG = " + JSON.stringify(catalog) + ";\n");
console.log(`Wrote catalog.json\n  total=${entries.length} packages=${count("package")} vignettes=${count("vignette")} posts=${count("post")} chapters=${count("chapter")}`);
