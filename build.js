#!/usr/bin/env node
/* Assembles data/words.js and data/patterns.js from data/raw/*.json
   Usage: node build.js

   Vocabulary is telc "Einfach gut" A2 + B1, grouped alphabetically per level.
   Batch files are data/raw/a2_*.json and data/raw/b1_*.json. */
const fs = require("fs");
const path = require("path");
const RAW = path.join(__dirname, "data", "raw");
const OUT = path.join(__dirname, "data");

function readJSON(f) { return JSON.parse(fs.readFileSync(f, "utf8")); }

/* ---- patterns ---- */
try {
  const p = readJSON(path.join(RAW, "patterns.json"));
  const patterns = p.patterns || p;
  fs.writeFileSync(path.join(OUT, "patterns.js"),
    "window.PATTERNS = " + JSON.stringify(patterns) + ";\n");
  console.log("patterns.js  <-", patterns.length, "patterns");
} catch (e) { console.warn("patterns skipped:", e.message); }

/* ---- words ---- */
// Load order: all A2 batches first, then all B1, so a headword that appears
// at both levels is kept once, at the lower (A2) level.
const files = fs.readdirSync(RAW)
  .filter(function (f) { return /^(a2|b1)[-_]\d+\.json$/i.test(f); })
  .sort(function (a, b) {
    var la = a[0] === "a" ? 0 : 1, lb = b[0] === "a" ? 0 : 1;   // a2 before b1
    if (la !== lb) return la - lb;
    return a.localeCompare(b, "en", { numeric: true });
  });

const batches = [];
let seen = new Set(), dupes = 0, total = 0;

function cleanKey(de) {
  return String(de || "").toLowerCase().replace(/^(der|die|das)\s+/, "").trim();
}

for (const name of files) {
  const f = path.join(RAW, name);
  let b;
  try { b = readJSON(f); } catch (e) { console.warn("BAD JSON", name, e.message); continue; }
  const level = /b1/i.test(b.level || name) ? "B1" : "A2";
  const words = [];
  for (const w of (b.words || [])) {
    const key = cleanKey(w.de);
    if (!key) continue;
    if (seen.has(key)) { dupes++; continue; }
    seen.add(key);
    words.push({
      de: w.de || "",
      en: w.en || "",
      pos: w.pos || "",
      plural: w.plural || "",
      meanings: Array.isArray(w.meanings) ? w.meanings : [],
      rule: w.rule || "",
      example: w.example || "", exampleEn: w.exampleEn || "",
      example2: w.example2 || "", example2En: w.example2En || ""
    });
  }
  batches.push({ id: b.id, title: b.title, level: level, words });
  total += words.length;
  console.log(name, "->", b.title, "(" + words.length + " words, " + level + ")");
}

fs.writeFileSync(path.join(OUT, "words.js"),
  "window.VOCAB = " + JSON.stringify({ batches }) + ";\n");
console.log("\nwords.js  <-", batches.length, "batches,", total, "unique words (", dupes, "duplicates removed )");
