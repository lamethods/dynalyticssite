// Tests for the hub search (assets/app.js, "search command palette" block), run
// against the real catalog and function index.  `npm test`
//
// The block is evaluated in a VM with the few page helpers it uses, so these tests
// exercise the shipped code, not a copy of it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(join(root, "assets", "app.js"), "utf8");
const block = app.slice(
  app.indexOf("  /* ---------- search command palette"),
  app.indexOf("  /* ---------- package dossier ---------- */")
);
const catalog = JSON.parse(readFileSync(join(root, "catalog.json"), "utf8"));
const fnWindow = {};
vm.runInNewContext(readFileSync(join(root, "assets", "functions.js"), "utf8"), { window: fnWindow });

function engine(functions = fnWindow.DYNASITE_FUNCTIONS) {
  const S = { all: catalog.entries, byId: {}, packages: [] };
  S.all.forEach((e) => { S.byId[e.id] = e; });
  S.packages = S.all.filter((e) => e.type === "package");
  const ctx = {
    S, window: { DYNASITE_FUNCTIONS: functions },
    esc: (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]),
    pkgsOf: (e) => (!e.packages ? [] : Array.isArray(e.packages) ? e.packages : [e.packages]),
    subtitleOf: (p) => { const t = p.title || ""; const i = t.indexOf("—"); return i >= 0 ? t.slice(i + 1).trim() : (p.blurb || ""); }
  };
  vm.runInNewContext(block + "\nbuildSearchIndex(); this.api = { runSearch, highlight, withinEdits, queryTokens, wordsOf, fold };", ctx);
  return ctx.api;
}
const E = engine();
const top = (q, n = 1) => E.runSearch(q).items.slice(0, n);
const titles = (q, n = 5) => top(q, n).map((it) => `${it.type}:${it.title}`);

test("an exact package name ranks that package first", () => {
  for (const id of ["tna", "cograph", "Nestimate", "latents", "VaSSTra"]) {
    const [it] = top(id);
    assert.equal(it.type, "package", `${id} -> ${titles(id)}`);
    assert.equal(it.title.split(" — ")[0], id);
  }
});

test("an exact function name ranks that function first and links its reference page", () => {
  const [it] = top("splot");
  assert.equal(it.type, "function");
  assert.equal(it.title, "splot()");
  assert.match(it.target.url, /^https:\/\/pak\.dynasite\.org\/cograph\/reference\/splot\.html$/);
  assert.equal(top("build_model()")[0].title, "build_model()");
  assert.equal(top("ebic_glasso")[0].sub.split(" · ")[0], "psychnets");
});

test("aliases find their topic: tna() is documented on build_model.html", () => {
  const hit = E.runSearch("ftna").items.find((it) => it.type === "function");
  assert.ok(hit, titles("ftna"));
  assert.match(hit.target.url, /\/tna\/reference\/build_model\.html$/);
});

test("accents and case are folded", () => {
  const a = top("lopez-pernas", 3).map((it) => it.title);
  const b = top("López-Pernas", 3).map((it) => it.title);
  assert.deepEqual(a, b);
  assert.equal(top("LOPEZ")[0].type, "person");
});

test("identifier words match on their parts: 'build model' finds build_model()", () => {
  assert.ok(titles("build model", 3).includes("function:build_model()"), titles("build model", 3));
  assert.deepEqual([...E.wordsOf("splot.net_bootstrap()")], ["splot.net_bootstrap", "splot", "net", "bootstrap"]);
});

test("one typo is tolerated; a short token is never fuzzed", () => {
  assert.ok(E.runSearch("bootsrap").items.some((it) => /bootstrap/i.test(it.title)), titles("bootsrap"));
  assert.ok(E.runSearch("nestimat").items.some((it) => it.title.startsWith("Nestimate")));
  assert.equal(E.withinEdits("tna", "dna", 0), false);
  assert.equal(E.withinEdits("bootsrap", "bootstrap", 1), true);
  assert.equal(E.withinEdits("abcd", "badc", 1), false);
  assert.equal(E.withinEdits("abcd", "bacd", 1), true);  // transposition = 1 edit
});

test("prefixes match while typing", () => {
  assert.ok(E.runSearch("bootstr").items.length > 0);
  assert.equal(top("cogra")[0].title.split(" — ")[0], "cograph");
});

test("every word must match; with none matching all, the closest are shown and flagged", () => {
  const all = E.runSearch("sequence analysis");
  assert.equal(all.partial, false);
  assert.ok(all.items.length > 0);
  const some = E.runSearch("bootstrap zzqqxx");
  assert.equal(some.partial, true);
  assert.ok(some.items.length > 0);
  assert.equal(E.runSearch("zzqqxx").items.length, 0);
});

test("stopwords are dropped unless the query is only stopwords", () => {
  assert.deepEqual([...E.queryTokens("the bootstrap of a network")], ["bootstrap", "network"]);
  assert.deepEqual([...E.queryTokens("the")], ["the"]);
});

test("empty query browses packages, people and tools", () => {
  const types = new Set(E.runSearch("").items.map((it) => it.type));
  assert.deepEqual([...types].sort(), ["package", "person", "tool"]);
});

test("ranking is a pure function of the query (stable across calls)", () => {
  assert.deepEqual(titles("network", 20), titles("network", 20));
});

test("search still works without the function index", () => {
  const bare = engine(null);  // not undefined: that would select the default index
  assert.equal(bare.runSearch("splot").items.some((it) => it.type === "function"), false);
  assert.equal(bare.runSearch("tna").items[0].type, "package");
});

test("highlight marks matches and escapes HTML", () => {
  assert.equal(E.highlight("López-Pernas", ["lopez"]), "<mark>López</mark>-Pernas");
  assert.equal(E.highlight("a <b> tna", ["tna"]), "a &lt;b&gt; <mark>tna</mark>");
  assert.equal(E.highlight("x", []), "x");
});

test("every function topic resolves to a package with a reference site", () => {
  const ids = new Set(catalog.entries.filter((e) => e.type === "package" && e.links.reference).map((e) => e.id));
  const orphans = fnWindow.DYNASITE_FUNCTIONS.filter((f) => !ids.has(f.p));
  assert.equal(orphans.length, 0, JSON.stringify(orphans.slice(0, 3)));
  assert.equal(catalog.counts.functions, fnWindow.DYNASITE_FUNCTIONS.length);
});

test("a function named after the query outranks packages that only mention it", () => {
  for (const q of ["bootstrap", "bootsrap"]) {
    const [it] = top(q);
    assert.equal(it.type, "function", `${q} -> ${titles(q)}`);
    assert.match(it.title, /bootstrap/);
  }
});
