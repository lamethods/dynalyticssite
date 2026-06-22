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

// reachability check (HEAD, then GET) — used to include only resolving chapter PDFs
async function urlOk(url) {
  for (const method of ["HEAD", "GET"]) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 20000);
    try {
      const r = await fetch(url, { method, headers: { "User-Agent": UA }, redirect: "follow", signal: ac.signal });
      clearTimeout(t);
      if (r.status < 400) return true;
      if (![403, 405, 501].includes(r.status)) return false;  // definitive failure; don't bother with GET
    } catch { clearTimeout(t); }
  }
  return false;
}

// per-repo top-level directory names (cached) — to map chapters to their code folder
const repoDirCache = {};
async function getRepoDirs(repo) {
  if (!repo) return new Set();
  if (repoDirCache[repo]) return repoDirCache[repo];
  const body = await fetchText(`https://api.github.com/repos/${repo}/contents`);
  const set = new Set();
  if (body) { try { for (const it of JSON.parse(body)) if (it.type === "dir") set.add(it.name); } catch {} }
  repoDirCache[repo] = set;
  return set;
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

// --- chapter description scraping ---
// boilerplate paragraphs that appear in the Quarto chapter template nav/footer
const CHAP_BOILER = /download code|check out our new book|©\s*20\d\d|^the authors$|all rights reserved|this content is licensed|table of contents/i;
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#3[49];|&rsquo;|&lsquo;|&apos;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"').replace(/&nbsp;/g, " ").replace(/&hellip;/g, "…")
    .replace(/&mdash;/g, "—").replace(/&ndash;/g, "–");
}
// trim to ~200 chars at a word boundary, keeping 1–2 sentences
function trimDescription(text) {
  // drop bracketed bibliography markers ([1], [1, 2], [1–3]) — no bibliography here
  text = text.replace(/\s*\[\d+(?:\s*[,–-]\s*\d+)*\]/g, "");
  text = text.replace(/\s+([,.;:])/g, "$1").replace(/\s+/g, " ").trim();
  if (text.length <= 220) return text;
  // prefer cutting after the first sentence if it lands in range
  const firstStop = text.search(/[.!?]\s/);
  if (firstStop >= 90 && firstStop <= 220) return text.slice(0, firstStop + 1);
  const cut = text.slice(0, 200);
  const lastSpace = cut.lastIndexOf(" ");
  return cut.slice(0, lastSpace > 120 ? lastSpace : 200).replace(/[\s,;:–—-]+$/, "") + "…";
}
// fetch a chapter page and extract a concise description (meta or first real paragraph)
async function chapterDescription(url) {
  const html = await fetchText(url);
  if (!html) return null;
  // 1) <meta name="description"> if present and meaningful
  const meta = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  if (meta) {
    const d = decodeEntities(meta[1].replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
    if (d.length >= 40) return trimDescription(d);
  }
  // 2) first substantive paragraph of the chapter body
  let body = (html.match(/<main[\s\S]*?<\/main>/i) || [html])[0];
  body = body.replace(/<(script|style|figure|figcaption|table|nav)[\s\S]*?<\/\1>/gi, "");
  const paras = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decodeEntities(m[1].replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 60 && !CHAP_BOILER.test(p));
  return paras.length ? trimDescription(paras[0]) : null;
}
// the authoritative chapter summary is the published abstract — via CrossRef JSON
// (Springer's own page redirects bots to a consent wall; CrossRef is clean & reliable).
// Uses the polite-pool mailto UA + retries so bursts don't get rate-limited to a fallback.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function chapterAbstract(doiBase, num) {
  const url = `https://api.crossref.org/works/${doiBase}_${num}`;
  const headers = { "User-Agent": "dynasite/1.0 (+https://dynalytics.lamethods.org; mailto:hamada@saqr.me)" };
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url, { headers });
      if (r.status === 429 || r.status >= 500) { await sleep(800 * (attempt + 1)); continue; }
      if (!r.ok) return null;
      const a = (await r.json())?.message?.abstract;
      if (!a) return null;
      let d = decodeEntities(a.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim().replace(/^abstract[:\s]+/i, "");
      return d.length >= 60 ? trimDescription(d) : null;
    } catch { await sleep(500); }
  }
  return null;
}

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
  const codeDirs = await getRepoDirs(vol.code_repo);
  const out = await Promise.all(rows.map(async ({ slug, loc }) => {
    const title = vol.titles[slug] || slug.replace(/-/g, " ");
    const rel = loc.replace(/.*?(chapters\/.*)$/, "$1");
    const url = vol.base + rel;
    const links = { read: url };
    if (codeDirs.has(slug)) links.code = `https://github.com/${vol.code_repo}/tree/main/${slug}`;
    const num = vol.springer_doi_base ? (slug.match(/ch0*([0-9]+)/) || [])[1] : null;
    let abstract = null;
    if (num) {
      const pdf = `https://link.springer.com/content/pdf/${vol.springer_doi_base}_${num}.pdf`;
      if (await urlOk(pdf)) links.pdf = pdf;     // only include if the open-access PDF resolves
      abstract = await chapterAbstract(vol.springer_doi_base, num);   // the real chapter abstract
    }
    // prefer the Springer abstract; fall back to the chapter page's first paragraph
    const desc = abstract || await chapterDescription(url);
    return {
      id: `${vol.id}::${slug}`, type: "chapter",
      title: `${slug.replace(/^ch0?/, "Ch ").replace(/-.*$/, "")} — ${title}`,
      blurb: desc || `${vol.title} chapter.`, url, links,
      owner: "saqr/lopez-pernas/tikka", tags: ["lamethods", vol.id, "chapter", "book"],
      packages: src.chapter_packages?.[slug] || [], volume: vol.title,
      status: "UNVERIFIED", last_checked: null
    };
  }));
  return out;
}

// --- run ---
const pkgArrays = [];
for (const p of src.packages) pkgArrays.push(await buildPackage(p));
const packageEntries = pkgArrays.flat();

const chapterEntries = (await Promise.all(src.book_volumes.map(buildVolume))).flat();

const paperEntries = (src.papers || []).map((p, i) => ({
  id: `paper::${i + 1}`, type: "paper", title: p.title, blurb: p.blurb, url: p.url, links: { paper: p.url },
  authors: p.authors, year: p.year, venue: p.venue, status: "UNVERIFIED", last_checked: null
}));

const toolEntries = (src.tools || []).map((t) => ({
  id: `tool::${t.id}`, type: "tool", kind: t.kind, title: t.title, blurb: t.blurb,
  url: t.url, links: t.links, owner: t.owner ?? null, tags: t.tags,
  status: "UNVERIFIED", last_checked: null
}));

const peopleEntries = (src.people || []).map((p) => ({
  id: `person::${p.id}`, type: "person", title: p.name, name: p.name,
  role: p.role, affiliation: p.affiliation, blurb: p.blurb,
  url: p.url, photo: p.photo, links: { site: p.url },
  status: "UNVERIFIED", last_checked: null
}));

const extraEntries = (src.extra_links || []).map((e) => ({ ...e, links: { link: e.url }, status: "UNVERIFIED", last_checked: null }));

const entries = [...packageEntries, ...postEntries, ...chapterEntries, ...paperEntries, ...toolEntries, ...peopleEntries, ...extraEntries];
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
