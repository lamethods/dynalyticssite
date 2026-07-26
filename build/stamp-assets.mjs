#!/usr/bin/env node
/* stamp-assets.mjs — automatic cache-busting.
   Hashes the volatile front-end assets and rewrites the ?v=<hash> query on
   their <link>/<script> tags in each public shell, so a changed file always
   serves fresh on GitHub Pages without anyone hand-editing a version number.

   The shared style plus each page's app script are stamped.
   The vendored, stable d3.min.js / chord.js are loaded unversioned by app.js
   so the double-click-offline path keeps working. */

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const hash = (rel) =>
  createHash("sha256").update(readFileSync(join(root, rel))).digest("hex").slice(0, 8);

const stamps = {
  "assets/style.css": hash("assets/style.css"),
  "assets/app.js": hash("assets/app.js"),
  "assets/package-sites.js": hash("assets/package-sites.js")
};
const pages = {
  "index.html": ["assets/style.css", "assets/app.js"],
  "package-sites.html": ["assets/style.css", "assets/package-sites.js"],
  "carmnotes.html": ["assets/style.css"]
};

let changed = 0;
for (const [page, assets] of Object.entries(pages)) {
  const pagePath = join(root, page);
  let html = readFileSync(pagePath, "utf8");
  for (const asset of assets) {
    const v = stamps[asset];
    // match assets/style.css?v=XXXX (or without a query) in href/src attributes
    const re = new RegExp(asset.replace(/[.]/g, "\\.") + "(\\?v=[a-z0-9]+)?", "g");
    html = html.replace(re, (m) => {
      const next = asset + "?v=" + v;
      if (m !== next) changed++;
      return next;
    });
  }
  writeFileSync(pagePath, html);
}
console.log(
  changed
    ? `stamped ${Object.keys(pages).join(", ")} → style.css?v=${stamps["assets/style.css"]}`
    : "public page assets already up to date"
);
