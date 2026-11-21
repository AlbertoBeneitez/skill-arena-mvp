#!/usr/bin/env node
// Integridad de versiones de juegos: hash por versión + registro encadenado de solo-añadir.
//
//   node scripts/game-integrity.mjs verify [--base <ref-git>]
//   node scripts/game-integrity.mjs register <id> [--version X.Y.Z]
//   node scripts/game-integrity.mjs scan [<id>] [--warn]
//   node scripts/game-integrity.mjs digest <id>
//
// Sin dependencias; solo módulos de Node. Ver docs/game-spec-template.md.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, appendFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GAMES_DIR = join(ROOT, "games");
const LOG_REL = "games/versions.log.jsonl";
const LOG_PATH = join(ROOT, LOG_REL);
const GENESIS = "0".repeat(64);
const DIGEST_SCHEME = "skillarena-game-digest-v1";
const SEMVER = /^\d+\.\d+\.\d+$/;
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

const REQUIRED_HEADINGS = [
  "## 1. Identificación",
  "## 2. Descripción y modo de juego",
  "## 3. Azar y fuentes de variabilidad",
  "## 4. Modelo de simulación",
  "## 5. Verificabilidad y registro de partidas",
  "## 6. Puntuación, desempate y premios",
  "## 7. Integridad del cliente",
  "## 8. Equidad económica",
  "## 9. Pruebas de conformidad",
  "## 10. Declaración y responsabilidad",
];
const STATUS_RE = /^\*\*Estado de conformidad:\*\* (CONFORME|NO CONFORME|PENDIENTE)\s*$/m;

// Fuentes de azar o de reloj que no deben aparecer en la lógica de un juego.
const FORBIDDEN = [
  [/\bMath\.random\b/, "Math.random"],
  [/\bcrypto\.getRandomValues\b/, "crypto.getRandomValues"],
  [/\bcrypto\.randomUUID\b/, "crypto.randomUUID"],
  [/\bDate\.now\b/, "Date.now"],
  [/\bperformance\.now\b/, "performance.now"],
  [/\bnew Date\b/, "new Date"],
];

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const normalize = (buf) => Buffer.from(buf.toString("utf8").replace(/\r\n/g, "\n"), "utf8");

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
}

// ---------- manifiestos ----------

function listGameIds() {
  if (!existsSync(GAMES_DIR)) return [];
  return readdirSync(GAMES_DIR)
    .filter((d) => !d.startsWith("_") && statSync(join(GAMES_DIR, d)).isDirectory())
    .sort();
}

function manifestPath(id) {
  return join(GAMES_DIR, id, "manifest.json");
}

function readManifest(id) {
  const p = manifestPath(id);
  if (!existsSync(p)) throw new Error(`${id}: falta games/${id}/manifest.json`);
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    throw new Error(`${id}: manifest.json no es JSON válido (${e.message})`);
  }
}

// Devuelve la lista de problemas del manifiesto (vacía si es válido).
function manifestProblems(id, m) {
  const out = [];
  if (m.id !== id) out.push(`id «${m.id}» distinto del nombre de carpeta «${id}»`);
  if (!ID_RE.test(String(m.id ?? ""))) out.push("id no válido (minúsculas, números y guiones)");
  if (!SEMVER.test(String(m.version ?? ""))) out.push(`version «${m.version}» no es X.Y.Z`);
  if (!m.name) out.push("falta name");
  if (!["propio", "importado"].includes(m.origin)) out.push("origin debe ser «propio» o «importado»");
  if (!m.provider || !String(m.provider).trim()) out.push("falta provider (quién entrega o firma el juego)");
  if (!Array.isArray(m.files) || m.files.length === 0) {
    out.push("files vacío");
    return out;
  }
  const seen = new Set();
  for (const f of m.files) {
    if (typeof f !== "string" || !f) { out.push("files contiene un valor no válido"); continue; }
    if (isAbsolute(f) || f.split(/[\\/]/).includes("..")) { out.push(`ruta no permitida: ${f}`); continue; }
    if (f.includes("\\")) { out.push(`usa «/» como separador: ${f}`); continue; }
    if (seen.has(f)) out.push(`fichero repetido: ${f}`);
    seen.add(f);
    const abs = resolve(ROOT, f);
    if (relative(ROOT, abs).startsWith("..")) { out.push(`fuera del repositorio: ${f}`); continue; }
    if (!existsSync(abs) || !statSync(abs).isFile()) out.push(`no existe: ${f}`);
  }
  const specRel = `games/${id}/SPEC.md`;
  if (!seen.has(specRel)) out.push(`files debe incluir ${specRel}`);
  return out;
}

function specProblems(id) {
  const p = join(GAMES_DIR, id, "SPEC.md");
  if (!existsSync(p)) return [`falta games/${id}/SPEC.md`];
  const text = readFileSync(p, "utf8").replace(/\r\n/g, "\n");
  const out = [];
  if (!STATUS_RE.test(text)) out.push("SPEC.md: falta la línea «**Estado de conformidad:** CONFORME | NO CONFORME | PENDIENTE»");
  const lines = new Set(text.split("\n").map((l) => l.trimEnd()));
  for (const h of REQUIRED_HEADINGS) if (!lines.has(h)) out.push(`SPEC.md: falta la sección «${h}»`);
  return out;
}

// ---------- digest ----------

function fileHashes(m) {
  const map = {};
  for (const f of [...m.files].sort()) map[f] = sha256(normalize(readFileSync(resolve(ROOT, f))));
  return map;
}

function computeDigest(m) {
  const hashes = fileHashes(m);
  let text = `${DIGEST_SCHEME}\nid:${m.id}\nversion:${m.version}\n`;
  for (const f of Object.keys(hashes)) text += `${f}\0${hashes[f]}\n`;
  return { digest: sha256(text), files: hashes };
}

// ---------- registro encadenado ----------

function entryHash(e) {
  const { entry_hash, ...rest } = e;
  const ordered = {
    seq: rest.seq, ts: rest.ts, id: rest.id, version: rest.version,
    digest: rest.digest, files: rest.files, prev: rest.prev,
  };
  return sha256(JSON.stringify(ordered));
}

function parseLog(text, label) {
  const entries = [];
  const problems = [];
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  lines.forEach((line, i) => {
    try { entries.push(JSON.parse(line)); }
    catch { problems.push(`${label}: línea ${i + 1} no es JSON`); }
  });
  return { entries, problems };
}

function chainProblems(entries) {
  const out = [];
  let prev = GENESIS;
  entries.forEach((e, i) => {
    const where = `registro línea ${i + 1}`;
    if (e.seq !== i + 1) out.push(`${where}: seq ${e.seq}, esperado ${i + 1}`);
    if (e.prev !== prev) out.push(`${where}: prev no coincide con la entrada anterior (registro alterado o con entradas borradas)`);
    if (e.entry_hash !== entryHash(e)) out.push(`${where}: entry_hash no coincide (entrada alterada)`);
    prev = e.entry_hash;
  });
  const pairs = new Map();
  for (const e of entries) {
    const k = `${e.id}@${e.version}`;
    if (pairs.has(k)) out.push(`versión duplicada en el registro: ${k}`);
    pairs.set(k, true);
  }
  return out;
}

function readLog() {
  if (!existsSync(LOG_PATH)) return { entries: [], problems: [] };
  return parseLog(readFileSync(LOG_PATH, "utf8"), LOG_REL);
}

// Contenido del registro en otra revisión de git. null = no se puede comparar; "" = no existía.
function logAtRef(ref) {
  const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  try { git("rev-parse", "--verify", `${ref}^{commit}`); }
  catch { return null; }
  try { git("cat-file", "-e", `${ref}:${LOG_REL}`); }
  catch { return ""; }
  return git("show", `${ref}:${LOG_REL}`);
}

// ---------- comandos ----------

function cmdVerify(args) {
  const baseIdx = args.indexOf("--base");
  const base = baseIdx >= 0 ? args[baseIdx + 1] : null;

  const { entries, problems } = readLog();
  problems.forEach(fail);
  if (!problems.length) chainProblems(entries).forEach(fail);

  if (base) {
    const before = logAtRef(base);
    if (before === null) {
      console.warn(`! No se puede comparar con «${base}» (no existe en este clon). Se omite la comprobación de historial.`);
    } else if (before !== "") {
      const prior = parseLog(before, `${LOG_REL}@${base}`);
      prior.problems.forEach(fail);
      prior.entries.forEach((e, i) => {
        if (JSON.stringify(entries[i]) !== JSON.stringify(e)) fail(`el registro reescribe o borra la entrada ${i + 1} que ya existía en ${base}`);
      });
    }
  }

  const ids = listGameIds();
  if (ids.length === 0) console.log("Sin juegos publicados en games/ (el registro conserva el historial de los retirados).");
  for (const id of ids) {
    let m;
    try { m = readManifest(id); } catch (e) { fail(e.message); continue; }
    const mp = [...manifestProblems(id, m)];
    if (!mp.length) mp.push(...specProblems(id));
    if (mp.length) { mp.forEach((p) => fail(`${id}: ${p}`)); continue; }

    const { digest } = computeDigest(m);
    const reg = entries.find((e) => e.id === id && e.version === m.version);
    if (!reg) {
      fail(`${id}@${m.version}: versión sin registrar. Ejecuta: node scripts/game-integrity.mjs register ${id}`);
    } else if (reg.digest !== digest) {
      fail(`${id}@${m.version}: el código o la especificación NO coinciden con el digest registrado (${reg.digest.slice(0, 12)}… ≠ ${digest.slice(0, 12)}…). ` +
        `Una versión registrada no se modifica: sube la versión y registra: node scripts/game-integrity.mjs register ${id} --version <nueva>`);
    } else {
      console.log(`✓ ${id}@${m.version}  ${digest.slice(0, 16)}…`);
    }
  }
  if (process.exitCode) {
    console.error("\nVerificación FALLIDA.");
  } else {
    console.log(`\nVerificación correcta: ${ids.length} juego(s), ${entries.length} entrada(s) en el registro.`);
  }
}

function cmdRegister(args) {
  const id = args[0];
  if (!id || id.startsWith("--")) { fail("uso: register <id> [--version X.Y.Z]"); return; }
  const vIdx = args.indexOf("--version");
  const newVersion = vIdx >= 0 ? args[vIdx + 1] : null;

  const m = readManifest(id);
  if (newVersion) {
    if (!SEMVER.test(newVersion)) { fail(`versión «${newVersion}» no es X.Y.Z`); return; }
    m.version = newVersion;
  }
  const problems = [...manifestProblems(id, m)];
  if (!problems.length) problems.push(...specProblems(id));
  if (problems.length) { problems.forEach((p) => fail(`${id}: ${p}`)); return; }

  const { entries, problems: lp } = readLog();
  const cp = lp.length ? lp : chainProblems(entries);
  if (cp.length) { cp.forEach(fail); fail("el registro está dañado; no se añade nada."); return; }

  const { digest, files } = computeDigest(m);
  const existing = entries.find((e) => e.id === id && e.version === m.version);
  if (existing) {
    if (existing.digest === digest) { console.log(`= ${id}@${m.version} ya está registrada con este mismo contenido.`); return; }
    fail(`${id}@${m.version} ya está registrada con otro contenido. Una versión registrada es inmutable: usa --version con una nueva.`);
    return;
  }

  const prev = entries.length ? entries.at(-1).entry_hash : GENESIS;
  const e = { seq: entries.length + 1, ts: new Date().toISOString(), id, version: m.version, digest, files, prev };
  e.entry_hash = entryHash(e);
  appendFileSync(LOG_PATH, JSON.stringify(e) + "\n");
  if (newVersion) writeFileSync(manifestPath(id), JSON.stringify(m, null, 2) + "\n");
  console.log(`+ ${id}@${m.version} registrada  digest ${digest}`);
  console.log(`  entrada #${e.seq}  entry_hash ${e.entry_hash}`);
}

function cmdDigest(args) {
  const id = args[0];
  if (!id) { fail("uso: digest <id>"); return; }
  const m = readManifest(id);
  const p = manifestProblems(id, m);
  if (p.length) { p.forEach((x) => fail(`${id}: ${x}`)); return; }
  const { digest, files } = computeDigest(m);
  console.log(`${id}@${m.version}  ${digest}`);
  for (const f of Object.keys(files)) console.log(`  ${files[f]}  ${f}`);
}

function cmdScan(args) {
  const warnOnly = args.includes("--warn");
  const ids = args.filter((a) => !a.startsWith("--"));
  const targets = ids.length ? ids : listGameIds();
  let findings = 0;
  for (const id of targets) {
    let m;
    try { m = readManifest(id); } catch (e) { fail(e.message); continue; }
    for (const f of m.files ?? []) {
      if (!/\.(m?[jt]sx?|c?js)$/.test(f) || !existsSync(resolve(ROOT, f))) continue;
      readFileSync(resolve(ROOT, f), "utf8").split("\n").forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, "");
        for (const [re, name] of FORBIDDEN) {
          if (re.test(code)) { findings++; console.log(`${id}: ${f}:${i + 1}  ${name}`); }
        }
      });
    }
  }
  console.log(findings ? `\n${findings} uso(s) de azar o reloj en la lógica de juego.` : "Sin usos de azar ni reloj en la lógica de juego.");
  if (findings && !warnOnly) process.exitCode = 1;
}

const [cmd, ...rest] = process.argv.slice(2);
const commands = { verify: cmdVerify, register: cmdRegister, digest: cmdDigest, scan: cmdScan };
if (!commands[cmd]) {
  console.error("uso: game-integrity.mjs <verify [--base ref] | register <id> [--version X.Y.Z] | digest <id> | scan [id] [--warn]>");
  process.exit(2);
}
commands[cmd](rest);
