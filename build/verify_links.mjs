#!/usr/bin/env node
// verify_links.mjs — validate every http(s) URL in catalog.json. Node port of
// verify_links.R. Browser UA (saqr.me 403s bots). Exits non-zero on any broken.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const BUILD = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(BUILD, "..");
const catalogPath = join(ROOT, "catalog.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const norm = (u) => u.replace(/\/+$/, "").toLowerCase();

async function once(url, method) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 25000);
  try {
    const r = await fetch(url, { method, headers: { "User-Agent": UA }, redirect: "follow", signal: ac.signal });
    return { status: r.status, finalUrl: r.url || url, redirected: r.redirected };
  } catch (e) { return { error: e.message || String(e) }; } finally { clearTimeout(t); }
}
async function checkUrl(url) {
  let r = await once(url, "HEAD");
  if (r.error || [403, 405, 501].includes(r.status)) {
    const g = await once(url, "GET");
    if (!g.error) r = g;
  }
  if (r.error) return { status: "BROKEN", detail: r.error };
  if (r.status >= 400) return { status: "BROKEN", detail: r.status };
  const redirected = r.redirected || norm(r.finalUrl) !== norm(url);
  return { status: redirected ? "REDIRECT" : "VERIFIED", code: r.status };
}

function entryUrls(e) {
  const us = [e.url, e.logo, ...Object.values(e.links || {})].filter((u) => u && typeof u === "string");
  return [...new Set(us)];
}

const allUrls = [...new Set(catalog.entries.flatMap(entryUrls))].filter((u) => /^https?:\/\//.test(u));
console.log(`Checking ${allUrls.length} unique URLs across ${catalog.entries.length} entries...`);

// limited-concurrency pool
const results = {};
const CONC = 8;
let i = 0;
await Promise.all(Array.from({ length: CONC }, async () => {
  while (i < allUrls.length) {
    const idx = i++; const u = allUrls[idx];
    const r = await checkUrl(u);
    results[u] = r;
    console.log(`  [${String(idx + 1).padStart(3)}/${allUrls.length}] ${r.status.padEnd(8)} ${u}`);
  }
}));

const rank = { VERIFIED: 1, REDIRECT: 2, BROKEN: 3 };
const today = new Date().toISOString().slice(0, 10);
for (const e of catalog.entries) {
  const us = entryUrls(e).filter((u) => u in results);
  if (!us.length) { e.status = "LOCAL"; e.last_checked = today; continue; }
  e.status = us.map((u) => results[u].status).sort((a, b) => rank[b] - rank[a])[0];
  e.last_checked = today;
}

const vals = Object.values(results);
const nBroken = vals.filter((r) => r.status === "BROKEN").length;
const nRedirect = vals.filter((r) => r.status === "REDIRECT").length;
const nOk = vals.filter((r) => r.status === "VERIFIED").length;
catalog.verified_at = today;
catalog.link_summary = { verified: nOk, redirect: nRedirect, broken: nBroken };

writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n");
writeFileSync(join(ROOT, "assets", "catalog.js"), "window.CATALOG = " + JSON.stringify(catalog) + ";\n");

console.log(`\nLink check: ${nOk} VERIFIED  ${nRedirect} REDIRECT  ${nBroken} BROKEN`);
if (nBroken > 0) {
  console.log("\nBROKEN URLs:");
  for (const [u, r] of Object.entries(results)) if (r.status === "BROKEN") console.log(`  ${u}  (${r.detail})`);
  process.exit(1);
}
console.log("All links reachable.");
