// authors.mjs — extract human-readable author names from a parsed DESCRIPTION.
// Prefers the structured `Authors@R` (person(...) calls); falls back to the
// plain `Author:` field. Keeps only authors/creators (role aut/cre), in order.

const decodeU = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));

// split a person(...) argument list on top-level commas (ignoring quotes / nested parens)
function splitTop(s) {
  const out = []; let depth = 0, q = false, cur = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' && s[i - 1] !== "\\") q = !q;
    if (!q) { if (c === "(") depth++; else if (c === ")") depth--; }
    if (c === "," && depth === 0 && !q) { out.push(cur); cur = ""; } else cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

// pull out the inside of each balanced person( ... ) call
function personBlocks(s) {
  const blocks = []; let i = 0;
  while ((i = s.indexOf("person", i)) >= 0) {
    let k = i + 6; while (k < s.length && /\s/.test(s[k])) k++;
    if (s[k] !== "(") { i += 6; continue; }
    let depth = 0, j = k;
    for (; j < s.length; j++) { const c = s[j]; if (c === "(") depth++; else if (c === ")") { depth--; if (depth === 0) { j++; break; } } }
    blocks.push(s.slice(k + 1, j - 1)); i = j;
  }
  return blocks;
}

function rolesOf(block) {
  const m = block.match(/role\s*=\s*(c\([^)]*\)|"[^"]*")/);
  return m ? (m[1].match(/"([^"]*)"/g) || []).map((x) => x.replace(/"/g, "")) : null;
}

function nameOf(block) {
  const g = (block.match(/given\s*=\s*"((?:[^"\\]|\\.)*)"/) || [])[1];
  const f = (block.match(/family\s*=\s*"((?:[^"\\]|\\.)*)"/) || [])[1];
  if (g || f) return decodeU([g, f].filter(Boolean).join(" ").replace(/\s+/g, " ").trim());
  const pos = [];
  for (const p of splitTop(block)) {
    if (/^\s*[A-Za-z.]+\s*=/.test(p)) break;            // first named arg ends the positional run
    const m = p.match(/"((?:[^"\\]|\\.)*)"/);
    if (!m) continue;
    if (/@|https?:|\.(org|com|net|edu|fi|me|io)$/i.test(m[1])) continue;  // skip a positional email/URL
    pos.push(m[1]);
    if (pos.length >= 2) break;                         // given + family is enough
  }
  return decodeU(pos.join(" ").replace(/\s+/g, " ").trim());
}

export function parseAuthors(d) {
  let names = [];
  if (d && d["Authors@R"]) {
    for (const b of personBlocks(d["Authors@R"])) {
      const roles = rolesOf(b);
      if (roles && !roles.some((r) => r === "aut" || r === "cre")) continue;  // drop ctb/cph-only
      const n = nameOf(b);
      if (n) names.push(n);
    }
  }
  if (!names.length && d && d.Author) {
    names = d.Author
      .replace(/\([^)]*\)/g, "")                          // strip ORCID / comments
      .split(/,(?![^\[]*\])/)                             // split on commas outside [role] brackets
      .map((s) => s.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }
  const seen = new Set();
  return names.filter((n) => { const k = n.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}
