#!/usr/bin/env node
/* Verifies every locale dictionary has exactly the keys of es.ts and the same {placeholders}. */
const fs = require("node:fs");
const path = require("node:path");

const dir = path.join(__dirname, "..", "lib", "i18n", "messages");
const LOCALES = ["es", "en", "zh", "hi", "ar", "fr", "bn", "pt", "ru", "ur"];

function load(code) {
  const src = fs.readFileSync(path.join(dir, `${code}.ts`), "utf8");
  const start = src.indexOf("{", src.indexOf(code === "es" ? "const es" : "const messages"));
  let depth = 0;
  let end = -1;
  let inStr = null;
  for (let i = start; i < src.length; i += 1) {
    const ch = src[i];
    if (inStr) {
      if (ch === "\\") { i += 1; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { inStr = ch; continue; }
    if (ch === "{") depth += 1;
    if (ch === "}") { depth -= 1; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) throw new Error(`${code}: could not parse dictionary`);
  // eslint-disable-next-line no-new-func
  return new Function(`return (${src.slice(start, end + 1)});`)();
}

const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
const base = load("es");
const baseKeys = Object.keys(base);
let failures = 0;
for (const code of LOCALES.slice(1)) {
  const dict = load(code);
  const keys = Object.keys(dict);
  for (const key of baseKeys) {
    if (!(key in dict)) { failures += 1; console.error(`${code}: missing ${key}`); continue; }
    if (typeof dict[key] !== "string" || dict[key].trim() === "") { failures += 1; console.error(`${code}: empty ${key}`); }
    if (vars(dict[key]) !== vars(base[key])) { failures += 1; console.error(`${code}: placeholders differ in ${key}: "${dict[key]}"`); }
  }
  for (const key of keys) if (!(key in base)) { failures += 1; console.error(`${code}: extra ${key}`); }
  const same = baseKeys.filter((k) => dict[k] === base[k] && /[a-záéíóúñ]{4,}/i.test(base[k]) && !k.endsWith(".name")).length;
  console.log(`${code}: ${keys.length} keys, ${same} identical to es`);
}
if (failures) { console.error(`i18n verification failed: ${failures} issue(s)`); process.exit(1); }
console.log(`i18n ok: ${LOCALES.length} locales × ${baseKeys.length} keys`);
