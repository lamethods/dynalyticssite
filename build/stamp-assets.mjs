#!/usr/bin/env node
/* stamp-assets.mjs — automatic cache-busting.
   Hashes the volatile front-end assets and rewrites the ?v=<hash> query on
   their <link>/<script> tags in index.html, so a changed file always serves
   fresh on GitHub Pages without anyone hand-editing a version number.

   Only style.css and app.js are stamped (the files that actually change).
   The vendored, stable d3.min.js / chord.js are loaded unversioned by app.js
   so the double-click-offline path keeps working. */

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = join(root, "index.html");

const hash = (rel) =>
  createHash("sha256").update(readFileSync(join(root, rel))).digest("hex").slice(0, 8);

const stamps = { "assets/style.css": hash("assets/style.css"), "assets/app.js": hash("assets/app.js") };

let html = readFileSync(indexPath, "utf8");
let changed = 0;
for (const [asset, v] of Object.entries(stamps)) {
  // match  assets/style.css?v=XXXX  (or without a query) inside an href/src attribute
  const re = new RegExp(asset.replace(/[.]/g, "\\.") + "(\\?v=[a-z0-9]+)?", "g");
  html = html.replace(re, (m) => {
    const next = asset + "?v=" + v;
    if (m !== next) changed++;
    return next;
  });
}
writeFileSync(indexPath, html);
console.log(
  changed
    ? `stamped index.html → style.css?v=${stamps["assets/style.css"]}, app.js?v=${stamps["assets/app.js"]}`
    : "index.html already up to date"
);
