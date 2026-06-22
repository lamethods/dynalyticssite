// studio-auth.mjs — minimal, dependency-free auth for the Studio server.
// Salted SHA-256 password hash + HMAC-signed session token, persisted to a
// gitignored .studio-auth.json. No accounts/roles — a single editor password.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes, createHash, createHmac, timingSafeEqual } from "node:crypto";

const FILE = (root) => join(root, ".studio-auth.json");
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const b64u = (buf) => Buffer.from(buf).toString("base64url");
const SESSION_TTL = 1000 * 60 * 60 * 12; // 12h

function safeEqual(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// Load auth config; create it on first run. Password comes from STUDIO_PASSWORD
// (env) if set, otherwise a random one is generated and printed once.
export function ensureAuth(root) {
  const path = FILE(root);
  if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8"));
  const salt = randomBytes(16).toString("hex");
  const secret = randomBytes(32).toString("hex");
  const envPw = process.env.STUDIO_PASSWORD;
  const password = envPw || randomBytes(9).toString("base64url");
  const cfg = { salt, secret, hash: sha256(salt + password), created: new Date().toISOString() };
  writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n");
  console.log("\n──────────────────────────────────────────────");
  console.log("  Studio password " + (envPw ? "set from STUDIO_PASSWORD." : "generated:  " + password));
  console.log("  Stored (hashed) in .studio-auth.json — delete that file to reset.");
  console.log("──────────────────────────────────────────────\n");
  return cfg;
}

export function verifyPassword(cfg, password) {
  return safeEqual(cfg.hash, sha256(cfg.salt + String(password || "")));
}

export function createToken(cfg) {
  const payload = b64u(JSON.stringify({ exp: Date.now() + SESSION_TTL }));
  const sig = b64u(createHmac("sha256", cfg.secret).update(payload).digest());
  return payload + "." + sig;
}

export function verifyToken(cfg, token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  const expect = b64u(createHmac("sha256", cfg.secret).update(payload).digest());
  if (!safeEqual(sig, expect)) return false;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString()).exp > Date.now(); }
  catch { return false; }
}
