#!/usr/bin/env node
/* Adds the shared Analytics include to every HTML page.

   Default (the Dynasite repository):
     node build/inject-analytics.mjs

   A deployed static tree (for example a pkgdown site):
     node build/inject-analytics.mjs \
       --root /srv/www/pak.dynasite.org/tna \
       --src https://pak.dynasite.org/assets/analytics.js

   Audit without writing:
     node build/inject-analytics.mjs --root <dir> --check
*/

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const analyticsPath = join(repoRoot, "assets", "analytics.js");
const version = createHash("sha256").update(readFileSync(analyticsPath)).digest("hex").slice(0, 8);
const measurementId = "G-M4WK9QTCB5";
const skipDirs = new Set([".git", "node_modules"]);

let root = repoRoot;
let publicSrc = null;
let checkOnly = false;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--root") {
    if (!args[i + 1]) throw new Error("--root requires a directory");
    root = isAbsolute(args[++i]) ? args[i] : resolve(process.cwd(), args[i]);
  } else if (args[i] === "--src") {
    if (!args[i + 1]) throw new Error("--src requires a URL or path");
    publicSrc = args[++i];
  } else if (args[i] === "--check") {
    checkOnly = true;
  } else {
    throw new Error(`unknown argument: ${args[i]}`);
  }
}
if (!existsSync(root) || !statSync(root).isDirectory()) {
  throw new Error(`HTML root is not a directory: ${root}`);
}

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
  const src = publicSrc || relative(dirname(file), analyticsPath).split(sep).join("/");
  const joiner = src.includes("?") ? "&" : "?";
  return `  <script src="${src}${joiner}v=${version}" data-dynasite-analytics="${measurementId}"></script>`;
}

const legacySnippet =
  /\n?[ \t]*<!-- Google tag \(gtag\.js\) -->[ \t]*\n[ \t]*<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-M4WK9QTCB5"><\/script>[ \t]*\n[ \t]*<script>[ \t]*\n[ \t]*window\.dataLayer = window\.dataLayer \|\| \[\];[ \t]*\n[ \t]*function gtag\(\)\{dataLayer\.push\(arguments\);\}[ \t]*\n[ \t]*gtag\(['"]js['"], new Date\(\)\);[ \t]*\n[ \t]*\n?[ \t]*gtag\(['"]config['"], ['"]G-M4WK9QTCB5['"]\);[ \t]*\n[ \t]*<\/script>[ \t]*\n?/g;

const analyticsInclude =
  /\n?[ \t]*<script\b(?=[^>]*\bsrc=["'][^"']*assets\/analytics\.js(?:\?[^"']*)?["'])[^>]*><\/script>[ \t]*\n?/gi;
const hasAnalyticsInclude =
  /<script\b(?=[^>]*(?:\bdata-dynasite-analytics=["']G-M4WK9QTCB5["']|\bsrc=["'][^"']*assets\/analytics\.js(?:\?[^"']*)?["']))[^>]*><\/script>/i;

const files = htmlFiles(root);
let changed = 0, missing = 0;
for (const file of files) {
  let html = readFileSync(file, "utf8");
  if (checkOnly) {
    if (!hasAnalyticsInclude.test(html)) {
      console.error(`missing ${relative(root, file)}`);
      missing++;
    }
    continue;
  }

  const nextInclude = includeFor(file);
  let next = html.replace(legacySnippet, "\n").replace(analyticsInclude, "\n");

  if (/<head\b[^>]*>/i.test(next)) {
    next = next.replace(/(<head\b[^>]*>)(?!\n)/i, "$1\n");
    next = next.replace(/(<head\b[^>]*>\n)(?:[ \t]*\n)+/i, "$1");
    next = next.replace(/(<head\b[^>]*>\n)/i, `$1${nextInclude}\n`);
  } else if (/<body\b[^>]*>/i.test(next)) {
    next = next.replace(/(<body\b[^>]*>)/i, `$1\n${nextInclude}`);
  } else {
    next = `${nextInclude}\n${next}`;
  }

  if (next !== html) {
    writeFileSync(file, next);
    changed++;
  }
}

if (checkOnly) {
  console.log(`analytics coverage: ${files.length - missing}/${files.length} HTML files in ${root}`);
  if (missing) process.exitCode = 1;
} else {
  console.log(
    changed
      ? `analytics include updated in ${changed}/${files.length} HTML files under ${root}`
      : `analytics includes already up to date in ${files.length} HTML files under ${root}`
  );
}
