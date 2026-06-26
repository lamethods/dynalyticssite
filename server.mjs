#!/usr/bin/env node
// server.mjs — Dynasite Studio. Serves the static public site AND a login-gated
// editor at /studio. No dependencies (Node built-ins only).
//
//   npm run studio            # starts on http://localhost:8780
//   STUDIO_PASSWORD=… npm run studio
//
// Save  -> writes build/sources.json + regenerates the catalog instantly (no network).
// Publish -> git add/commit/push the regenerated files so GitHub Pages redeploys.
// Re-harvest -> full network harvest + link verify (for package/chapter changes).

import { createServer } from "node:http";
import { readFile, writeFile, readFileSync } from "node:fs";
import { readFile as readFileP } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { ensureAuth, verifyPassword, createToken, verifyToken } from "./build/studio-auth.mjs";
import { regenCurated, EDITABLE_SECTIONS } from "./build/curated.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const STUDIO = join(ROOT, "studio");
const PORT = Number(process.env.PORT || 8780);
const AUTH = ensureAuth(ROOT);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".map": "application/json"
};

const send = (res, code, body, headers = {}) => {
  res.writeHead(code, { "Cache-Control": "no-store", ...headers });
  res.end(body);
};
const json = (res, code, obj, headers = {}) =>
  send(res, code, JSON.stringify(obj), { "Content-Type": "application/json; charset=utf-8", ...headers });

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").map((c) => {
    const i = c.indexOf("="); return i < 0 ? [c.trim(), ""] : [c.slice(0, i).trim(), c.slice(i + 1).trim()];
  }).filter((p) => p[0]));
}
const authed = (req) => AUTH.open === true || verifyToken(AUTH, cookies(req).dyn_session);

function readBody(req, limit = 2_000_000) {
  return new Promise((res, rej) => {
    let data = "", size = 0;
    req.on("data", (c) => { size += c.length; if (size > limit) { rej(new Error("body too large")); req.destroy(); } else data += c; });
    req.on("end", () => res(data));
    req.on("error", rej);
  });
}

const run = (cmd, args, opts = {}) => new Promise((res) =>
  execFile(cmd, args, { cwd: ROOT, maxBuffer: 1 << 24, ...opts }, (err, stdout, stderr) =>
    res({ ok: !err, code: err?.code ?? 0, stdout: String(stdout || ""), stderr: String(stderr || "") })));

// ---- static file serving (safe path resolution) ----
function serveStatic(res, baseDir, relPath, fallbackIndex = false) {
  let rel = decodeURIComponent(relPath).replace(/\?.*$/, "");
  if (rel === "/" || rel === "") rel = "/index.html";
  const full = normalize(join(baseDir, rel));
  if (!full.startsWith(resolve(baseDir))) return send(res, 403, "Forbidden");
  const target = existsSync(full) && !full.endsWith("/") ? full : (fallbackIndex ? join(baseDir, "index.html") : full);
  readFile(target, (err, buf) => {
    if (err) return send(res, 404, "Not found");
    send(res, 200, buf, { "Content-Type": MIME[extname(target)] || "application/octet-stream",
      "Cache-Control": baseDir === ROOT && !target.includes("/studio") ? "no-cache" : "no-store" });
  });
}

// ---- API ----
async function handleApi(req, res, path) {
  // public: login + session probe
  if (path === "/api/me" && req.method === "GET") return json(res, 200, { authed: authed(req) });
  if (path === "/api/login" && req.method === "POST") {
    if (AUTH.open === true) return json(res, 200, { ok: true });   // open mode: no password
    const body = JSON.parse((await readBody(req)) || "{}");
    if (!verifyPassword(AUTH, body.password)) return json(res, 401, { error: "Wrong password" });
    return json(res, 200, { ok: true }, {
      "Set-Cookie": `dyn_session=${createToken(AUTH)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${12 * 3600}`
    });
  }
  if (path === "/api/logout" && req.method === "POST")
    return json(res, 200, { ok: true }, { "Set-Cookie": "dyn_session=; HttpOnly; Path=/; Max-Age=0" });

  // everything below requires a valid session
  if (!authed(req)) return json(res, 401, { error: "Not authenticated" });

  if (path === "/api/content" && req.method === "GET") {
    const src = JSON.parse(await readFileP(join(ROOT, "build", "sources.json"), "utf8"));
    const out = {};
    for (const k of EDITABLE_SECTIONS) out[k] = src[k] ?? (k === "about" ? {} : []);
    const cat = JSON.parse(await readFileP(join(ROOT, "catalog.json"), "utf8"));
    out._meta = { verified_at: cat.verified_at || cat.generated_at || null, counts: cat.counts || {} };
    return json(res, 200, out);
  }

  if (path === "/api/save" && req.method === "POST") {
    const incoming = JSON.parse((await readBody(req)) || "{}");
    const srcPath = join(ROOT, "build", "sources.json");
    const src = JSON.parse(await readFileP(srcPath, "utf8"));
    for (const k of EDITABLE_SECTIONS) if (k in incoming) src[k] = incoming[k];
    await new Promise((ok, no) => writeFile(srcPath, JSON.stringify(src, null, 2) + "\n", (e) => e ? no(e) : ok()));
    try {
      const counts = regenCurated(ROOT);
      return json(res, 200, { ok: true, counts });
    } catch (e) { return json(res, 500, { error: "Regen failed: " + e.message }); }
  }

  if (path === "/api/publish" && req.method === "POST") {
    const files = ["build/sources.json", "catalog.json", "assets/catalog.js"];
    const add = await run("git", ["add", ...files]);
    if (!add.ok) return json(res, 500, { step: "add", log: add.stderr || add.stdout });
    const diff = await run("git", ["diff", "--cached", "--quiet"]);
    if (diff.ok) return json(res, 200, { ok: true, nochange: true, message: "Nothing to publish — already up to date." });
    const commit = await run("git", ["commit", "-m", "studio: content update"]);
    if (!commit.ok) return json(res, 500, { step: "commit", log: commit.stderr || commit.stdout });
    const push = await run("git", ["push", "origin", "HEAD"]);
    if (!push.ok) return json(res, 500, { step: "push", log: push.stderr || push.stdout });
    return json(res, 200, { ok: true, message: "Published — GitHub Pages will redeploy shortly.", log: (commit.stdout + push.stderr).trim() });
  }

  if (path === "/api/reharvest" && req.method === "POST") {
    const h = await run("node", ["build/harvest.mjs"]);
    if (!h.ok) return json(res, 500, { step: "harvest", log: (h.stderr || h.stdout).slice(-4000) });
    const v = await run("node", ["build/verify_links.mjs"]);
    // verify exits non-zero if any link is broken; surface that but don't treat as fatal
    return json(res, 200, { ok: true, broken: !v.ok, log: (h.stdout + "\n" + v.stdout).slice(-4000) });
  }

  return json(res, 404, { error: "Unknown endpoint" });
}

createServer(async (req, res) => {
  try {
    const path = req.url.split("?")[0];
    if (path.startsWith("/api/")) return await handleApi(req, res, path);
    if (path === "/studio" || path === "/studio/" || path.startsWith("/studio/"))
      return serveStatic(res, STUDIO, path.replace(/^\/studio/, "") || "/", true);
    return serveStatic(res, ROOT, path);
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}).listen(PORT, process.env.STUDIO_HOST || "127.0.0.1", () => {
  console.log(`\n  Dynasite Studio running${AUTH.open ? " (open — no password)" : ""}`);
  console.log(`  Public site : http://localhost:${PORT}/`);
  console.log(`  Studio      : http://localhost:${PORT}/studio\n`);
});
