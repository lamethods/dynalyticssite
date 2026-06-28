#!/usr/bin/env node
/* Adds the shared analytics include to every HTML page.
   Re-run this after adding new standalone HTML files. */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const analyticsPath = join(root, "assets", "analytics.js");
const version = createHash("sha256").update(readFileSync(analyticsPath)).digest("hex").slice(0, 8);
const skipDirs = new Set([".git", "node_modules"]);

function htmlFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (skipDirs.has(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...htmlFiles(path));
    } else if (entry.endsWith(".html")) {
      files.push(path);
    }
  }
  return files;
}

function includeFor(file) {
  const rel = relative(dirname(file), analyticsPath).split(sep).join("/");
  return `  <script src="${rel}?v=${version}"></script>`;
}

const legacySnippet =
  /\n?[ \t]*<!-- Google tag \(gtag\.js\) -->[ \t]*\n[ \t]*<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-M4WK9QTCB5"><\/script>[ \t]*\n[ \t]*<script>[ \t]*\n[ \t]*window\.dataLayer = window\.dataLayer \|\| \[\];[ \t]*\n[ \t]*function gtag\(\)\{dataLayer\.push\(arguments\);\}[ \t]*\n[ \t]*gtag\(['"]js['"], new Date\(\)\);[ \t]*\n[ \t]*\n?[ \t]*gtag\(['"]config['"], ['"]G-M4WK9QTCB5['"]\);[ \t]*\n[ \t]*<\/script>[ \t]*\n?/g;

const analyticsInclude =
  /\n?[ \t]*<script src="(?:\.\.\/|\.\/|\/)?(?:[^"]*\/)?assets\/analytics\.js(?:\?v=[a-f0-9]+)?"><\/script>[ \t]*\n?/g;

let changed = 0;
for (const file of htmlFiles(root)) {
  let html = readFileSync(file, "utf8");
  const nextInclude = includeFor(file);
  let next = html.replace(legacySnippet, "\n").replace(analyticsInclude, "\n");

  if (!/<head\b[^>]*>/i.test(next)) {
    console.warn(`skipped ${relative(root, file)}: missing <head>`);
    continue;
  }

  next = next.replace(/(<head\b[^>]*>)(?!\n)/i, "$1\n");
  next = next.replace(/(<head\b[^>]*>\n)(?:[ \t]*\n)+/i, "$1");
  next = next.replace(/(<head\b[^>]*>\n)/i, `$1${nextInclude}\n`);
  if (next !== html) {
    writeFileSync(file, next);
    changed++;
  }
}

console.log(
  changed
    ? `analytics include updated in ${changed} HTML file${changed === 1 ? "" : "s"}`
    : "analytics includes already up to date"
);
