/**
 * Galactic Games package, format 1 (v142): how an external studio hands in a game, and the automatic checks every
 * package passes before anyone looks at it. Pure: the same code runs on the server (authoritative, at upload) and in
 * the owner's browser (the review preview). Specification for studios: docs/STUDIO_KIT.md.
 *
 * One .zip, at most 4 MB, with
 *   galactic.json  the manifest (name, version, category, description, actions, tick rate, length, credits)
 *   game.html      the interface: one self-contained file; it runs in an isolated frame with no network
 *   core.wasm      the rules: a WebAssembly module with no imports (so it can do nothing but compute), exporting the
 *                  ABI below; it is what replays and verifies every match
 *   cover.webp|png|jpg  the catalogue image, 16:11, at least 800 × 550
 *
 * Core ABI 1, all i32: gg_init(seedLo, seedHi) · gg_input(action) → 1 accepted / 0 ignored · gg_step() ·
 * gg_status() → 0 running / 1 finished · gg_score() → ≥ 0 · gg_hash() → digest of the whole state.
 * A match replays as: init; for each tick, the inputs recorded at that tick in order, then one step; until finished.
 *
 * Format 2 (v178, the only one the kit teaches and uploads accept): the game is written the way Galactic Games writes
 * its own, so it can be brought into the app as a new version (the owner hands the package to the developer who
 * integrates it; see docs/STUDIO_KIT.md). One .zip with
 *   galactic.json  the manifest (format 2: also the logical canvas width and height)
 *   cover.webp|png|jpg  the presentation image, 16:11, at least 800 × 550 (1600 × 1100 recommended) — required
 *   src/core.ts    the rules: a GameCore (create(seed) · step · canApply · apply), pure TypeScript — no clock, no
 *                  Math.random, no network, no DOM; only relative imports (the kit's seeded RNG and types)
 *   src/game.ts    the screen: render(ctx, state, viewport) on a canvas, and how touches/keys become actions
 * Code cannot be run safely at upload, so format 2 is checked statically here; determinism is proved by the kit's
 * own check (npm run check) and again when the game is integrated, with the app's golden replay tests.
 */
import { unzipSync, type UnzipFileInfo } from "fflate";
import { createRng, hashSeed } from "@/lib/deterministic/seeded";
import { PROPOSAL_SHELVES } from "@/lib/studioProposal";

export const PACKAGE_FORMAT = 1;
export const PACKAGE_LIMITS = {
  zipBytes: 4 * 1024 * 1024, files: 32, unpackedBytes: 24 * 1024 * 1024, gameBytes: 6 * 1024 * 1024,
  coreBytes: 2 * 1024 * 1024, coverBytes: 1536 * 1024, maxTicks: 108_000, actions: 64,
} as const;
export const CORE_EXPORTS = ["gg_init", "gg_input", "gg_step", "gg_status", "gg_score", "gg_hash"] as const;

export type Manifest = {
  format: 1 | 2; id: string; name: string; version: string; shelf: (typeof PROPOSAL_SHELVES)[number]; description: string;
  developer: string; actions: string[]; tickRate: number; maxTicks: number; thirdParty: { name: string; license: string }[];
  /** Format 2: the logical canvas the core and the screen use. */
  width?: number; height?: number;
};
export type CheckId = "zip" | "manifest" | "game" | "cover" | "coreLoad" | "coreReplay" | "coreSeed" | "coreSpeed" | "core" | "view";
/** skipped: not run because an earlier check failed (it counts as not passed). */
export type Check = { id: CheckId; ok: boolean; detail?: string; skipped?: true };
export type Report = { ok: boolean; checks: Check[] };
export type Unpacked = {
  manifest: Manifest | null; gameHtml: string | null; core: Uint8Array | null; cover: { name: string; bytes: Uint8Array } | null;
  /** Format 2: the TypeScript sources (path → text). */
  sources?: Record<string, string>;
  /** Which format the package is (from its manifest, or its files when the manifest is unreadable). */
  format?: 1 | 2;
};

const CHECK_ORDER: CheckId[] = ["zip", "manifest", "game", "cover", "coreLoad", "coreReplay", "coreSeed", "coreSpeed"];
const CHECK_ORDER_V2: CheckId[] = ["zip", "manifest", "core", "view", "cover"];
export const finishReport = (checks: Check[], format: 1 | 2 = 1): Report => {
  const all = (format === 2 ? CHECK_ORDER_V2 : CHECK_ORDER).map((id) => checks.find((c) => c.id === id) ?? { id, ok: false, skipped: true as const });
  return { ok: all.every((c) => c.ok), checks: all };
};

const text = (v: unknown, min: number, max: number) => typeof v === "string" && v.trim().length >= min && v.trim().length <= max;
/** Validates galactic.json; returns the first wrong field so the studio knows what to fix. */
export function checkManifest(raw: unknown): { ok: true; value: Manifest } | { ok: false; field: string } {
  const m = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (m.format !== PACKAGE_FORMAT && m.format !== 2) return { ok: false, field: "format" };
  const v2 = m.format === 2;
  if (v2 && (!Number.isInteger(m.width) || !Number.isInteger(m.height) || (m.width as number) < 120 || (m.width as number) > 2000
    || (m.height as number) < 120 || (m.height as number) > 2000)) return { ok: false, field: "width/height" };
  if (typeof m.id !== "string" || !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(m.id)) return { ok: false, field: "id" };
  if (!text(m.name, 2, 60)) return { ok: false, field: "name" };
  if (typeof m.version !== "string" || !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(m.version)) return { ok: false, field: "version" };
  if (!PROPOSAL_SHELVES.includes(m.shelf as Manifest["shelf"])) return { ok: false, field: "shelf" };
  if (!text(m.description, 10, 280)) return { ok: false, field: "description" };
  if (!text(m.developer, 2, 80)) return { ok: false, field: "developer" };
  const actions = m.actions;
  if (!Array.isArray(actions) || actions.length < 1 || actions.length > PACKAGE_LIMITS.actions
    || !actions.every((a) => typeof a === "string" && /^[A-Z][A-Z0-9_]{0,23}$/.test(a)) || new Set(actions).size !== actions.length)
    return { ok: false, field: "actions" };
  if (m.tickRate !== 30 && m.tickRate !== 60 && m.tickRate !== 120) return { ok: false, field: "tickRate" };
  if (!Number.isInteger(m.maxTicks) || (m.maxTicks as number) < 60 || (m.maxTicks as number) > PACKAGE_LIMITS.maxTicks) return { ok: false, field: "maxTicks" };
  const tp = m.thirdParty ?? [];
  if (!Array.isArray(tp) || tp.length > 40 || !tp.every((x) => x && typeof x === "object" && text((x as Record<string, unknown>).name, 1, 120) && text((x as Record<string, unknown>).license, 2, 60)))
    return { ok: false, field: "thirdParty" };
  const clean = (s: unknown) => String(s).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return {
    ok: true,
    value: {
      format: v2 ? 2 : 1, id: m.id, name: clean(m.name), version: m.version, shelf: m.shelf as Manifest["shelf"], description: clean(m.description),
      developer: clean(m.developer), actions: actions as string[], tickRate: m.tickRate as number, maxTicks: m.maxTicks as number,
      thirdParty: (tp as { name: string; license: string }[]).map((x) => ({ name: clean(x.name), license: clean(x.license) })),
      ...(v2 ? { width: m.width as number, height: m.height as number } : {}),
    },
  };
}

/** Anything game.html would try to load from outside the package (it would be blocked in the frame anyway). */
export function externalReferences(html: string): string[] {
  const found = new Set<string>();
  const re = /(?:\b(?:src|href|action|poster|data)\s*=\s*["']?|url\(\s*["']?|@import\s+["']|\bimport\s*\(?\s*["'])((?:https?:)?\/\/[^"'\s)>]+)/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) found.add(m[1].slice(0, 120));
  return [...found].slice(0, 5);
}

/** Format 2 · what the rules may not touch (they must give the same result anywhere, every time) and what neither file
 * may do (reach the network or run generated code). Returns the first offence found, or null. */
const CORE_FORBIDDEN: [RegExp, string][] = [
  [/\bMath\.random\b/, "Math.random"], [/\bDate\b/, "Date"], [/\bperformance\b/, "performance"],
  [/\b(?:setTimeout|setInterval|requestAnimationFrame)\b/, "timers"], [/\b(?:window|document|globalThis|self|navigator|localStorage)\b/, "browser APIs"],
];
const ANY_FORBIDDEN: [RegExp, string][] = [
  [/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/, "network"], [/\beval\s*\(|\bnew\s+Function\b/, "eval"],
  [/\bimport\s*\(/, "dynamic import"], [/\brequire\s*\(/, "require"], [/\bdocument\.cookie\b/, "cookies"],
  [/(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}/i, "external URL"],
];
/** Imports must stay inside the package: relative paths only. */
const IMPORT_RE = /\b(?:import|export)\b[^'"`;]*?\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']/g;
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
export function sourceOffence(src: string, rules: "core" | "view"): string | null {
  const code = stripComments(src);
  for (const [re, name] of [...(rules === "core" ? CORE_FORBIDDEN : []), ...ANY_FORBIDDEN]) if (re.test(code)) return name;
  for (let m = IMPORT_RE.exec(code); m; m = IMPORT_RE.exec(code)) {
    const target = m[1] ?? m[2];
    if (!target.startsWith("./") && !target.startsWith("../")) { IMPORT_RE.lastIndex = 0; return `import ${target.slice(0, 60)}`; }
  }
  IMPORT_RE.lastIndex = 0;
  return null;
}

/** Width and height of a PNG, JPEG or WebP, read from its header; null if it is none of them. */
export function imageSize(b: Uint8Array): { w: number; h: number } | null {
  const u16 = (i: number) => (b[i] << 8) | b[i + 1], u16le = (i: number) => b[i] | (b[i + 1] << 8);
  const u32 = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { w: u32(16), h: u32(20) };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1], len = u16(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { w: u16(i + 7), h: u16(i + 5) };
      i += 2 + len;
    }
    return null;
  }
  if (b.length > 30 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") {
    const kind = String.fromCharCode(...b.slice(12, 16));
    if (kind === "VP8X") return { w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
    if (kind === "VP8 ") return { w: u16le(26) & 0x3fff, h: u16le(28) & 0x3fff };
    if (kind === "VP8L") { const v = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24); return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
  }
  return null;
}

/** Unpacks and checks everything that does not need to run code: zip, manifest, interface, cover. */
export function unpackPackage(zip: Uint8Array): { checks: Check[]; unpacked: Unpacked } {
  const checks: Check[] = [];
  const unpacked: Unpacked = { manifest: null, gameHtml: null, core: null, cover: null };
  if (zip.length > PACKAGE_LIMITS.zipBytes) return { checks: [{ id: "zip", ok: false, detail: "> 4 MB" }], unpacked };
  let files: Record<string, Uint8Array>;
  let count = 0, total = 0, bad = "";
  try {
    files = unzipSync(zip, {
      filter: (f: UnzipFileInfo) => {
        count++; total += f.originalSize;
        if (/(^|\/)\.\.(\/|$)|^\/|\\/.test(f.name)) bad = bad || f.name;
        return !bad && count <= PACKAGE_LIMITS.files && total <= PACKAGE_LIMITS.unpackedBytes && !f.name.endsWith("/");
      },
    });
  } catch {
    return { checks: [{ id: "zip", ok: false, detail: "unreadable" }], unpacked };
  }
  if (bad) return { checks: [{ id: "zip", ok: false, detail: bad.slice(0, 80) }], unpacked };
  if (count > PACKAGE_LIMITS.files) return { checks: [{ id: "zip", ok: false, detail: `> ${PACKAGE_LIMITS.files} files` }], unpacked };
  if (total > PACKAGE_LIMITS.unpackedBytes) return { checks: [{ id: "zip", ok: false, detail: "> 24 MB unpacked" }], unpacked };
  // A package may sit inside one top-level folder (how most tools zip a folder).
  const names = Object.keys(files);
  const prefix = names.length && names.every((n) => n.includes("/") && n.split("/")[0] === names[0].split("/")[0]) ? names[0].split("/")[0] + "/" : "";
  const get = (n: string) => files[prefix + n] ?? null;
  checks.push({ id: "zip", ok: true });

  const mf = get("galactic.json");
  if (!mf) checks.push({ id: "manifest", ok: false, detail: "galactic.json" });
  else {
    let parsed: unknown = null;
    try { parsed = JSON.parse(new TextDecoder().decode(mf)); } catch { parsed = null; }
    const m = parsed === null ? { ok: false as const, field: "JSON" } : checkManifest(parsed);
    checks.push(m.ok ? { id: "manifest", ok: true } : { id: "manifest", ok: false, detail: m.field });
    if (m.ok) unpacked.manifest = m.value;
  }

  // Format 2 when its manifest says so — or, if the manifest is unreadable, when it carries src/core.ts.
  const v2 = unpacked.manifest ? unpacked.manifest.format === 2 : !!get("src/core.ts");
  unpacked.format = v2 ? 2 : 1;
  if (v2) {
    // Format 2: TypeScript sources, checked statically. src/core.ts (and src/rules/…) are the rules; every other
    // .ts under src/ is the screen.
    const decode = (b: Uint8Array) => new TextDecoder().decode(b);
    const sources: Record<string, string> = {};
    let tooBig = "";
    for (const n of names) {
      const rel = n.slice(prefix.length);
      if (!/^(?:src|kit)\/[A-Za-z0-9_\/.-]+\.ts$/.test(rel)) continue;
      if (files[n].length > 512 * 1024) tooBig = tooBig || rel;
      sources[rel] = decode(files[n]);
    }
    unpacked.sources = sources;
    const isCore = (rel: string) => rel === "src/core.ts" || rel.startsWith("src/rules/") || rel.startsWith("kit/");
    const scan = (rule: "core" | "view") => {
      for (const [rel, src] of Object.entries(sources)) {
        if (rel.startsWith("kit/") ? rule !== "core" : isCore(rel) !== (rule === "core")) continue;
        const bad = sourceOffence(src, rule);
        if (bad) return `${rel}: ${bad}`;
      }
      return null;
    };
    if (!sources["src/core.ts"]) checks.push({ id: "core", ok: false, detail: "src/core.ts" });
    else if (tooBig) checks.push({ id: "core", ok: false, detail: `${tooBig} > 512 KB` });
    else { const bad = scan("core"); checks.push(bad ? { id: "core", ok: false, detail: bad } : { id: "core", ok: true }); }
    if (!sources["src/game.ts"]) checks.push({ id: "view", ok: false, detail: "src/game.ts" });
    else { const bad = scan("view"); checks.push(bad ? { id: "view", ok: false, detail: bad } : { id: "view", ok: true }); }
  }

  const html = v2 ? null : get("game.html");
  if (v2) { /* no game.html in format 2 */ }
  else if (!html) checks.push({ id: "game", ok: false, detail: "game.html" });
  else if (html.length > PACKAGE_LIMITS.gameBytes) checks.push({ id: "game", ok: false, detail: "> 6 MB" });
  else {
    const s = new TextDecoder().decode(html);
    const ext = externalReferences(s);
    checks.push(ext.length ? { id: "game", ok: false, detail: ext[0] } : { id: "game", ok: true });
    unpacked.gameHtml = s;
  }

  const coverName = ["cover.webp", "cover.png", "cover.jpg", "cover.jpeg"].find((n) => get(n));
  if (!coverName) checks.push({ id: "cover", ok: false, detail: "cover.webp" });
  else {
    const bytes = get(coverName)!, size = imageSize(bytes);
    if (bytes.length > PACKAGE_LIMITS.coverBytes) checks.push({ id: "cover", ok: false, detail: "> 1.5 MB" });
    else if (!size) checks.push({ id: "cover", ok: false, detail: "format" });
    else if (size.w < 800 || size.h < 550 || Math.abs(size.w / size.h - 16 / 11) > .03) checks.push({ id: "cover", ok: false, detail: `${size.w}×${size.h}` });
    else { checks.push({ id: "cover", ok: true }); unpacked.cover = { name: coverName, bytes }; }
  }

  if (v2) return { checks, unpacked };
  const core = get("core.wasm");
  if (!core) checks.push({ id: "coreLoad", ok: false, detail: "core.wasm" });
  else if (core.length > PACKAGE_LIMITS.coreBytes) checks.push({ id: "coreLoad", ok: false, detail: "> 2 MB" });
  else unpacked.core = core;
  return { checks, unpacked };
}

/** The two 32-bit words a match seed gives the core. */
export const seedWords = (seed: string): [number, number] => [hashSeed(seed) | 0, hashSeed(`${seed}:hi`) | 0];

/** A seeded script of inputs to exercise a core: [tick, action] pairs, a few per second, over the whole length. */
export function inputScript(seed: string, actions: number, maxTicks: number): [number, number][] {
  const rng = createRng(`${seed}:script`);
  const out: [number, number][] = [];
  for (let t = rng.nextInt(20); t < maxTicks && out.length < 20_000; t += 1 + rng.nextInt(40)) out.push([t, rng.nextInt(actions)]);
  return out;
}

export type ReplayResult = { score: number; hash: number; ticks: number; ended: boolean; accepted: number };
/**
 * Replays a match on a core's exports. Self-contained on purpose: the server runs this very function's source inside
 * a worker with a time limit (lib/server/studioPackageCheck.ts), so it must not refer to anything outside itself.
 */
export function replayCore(ex: Record<string, unknown>, seedLo: number, seedHi: number, inputs: readonly (readonly [number, number])[], maxTicks: number): ReplayResult {
  const call = (name: string, ...args: number[]) => (ex[name] as (...a: number[]) => number)(...args);
  call("gg_init", seedLo, seedHi);
  let i = 0, t = 0, accepted = 0;
  while (t < maxTicks && call("gg_status") === 0) {
    while (i < inputs.length && inputs[i][0] === t) { accepted += call("gg_input", inputs[i][1]) === 1 ? 1 : 0; i++; }
    while (i < inputs.length && inputs[i][0] < t) i++;
    call("gg_step");
    t++;
  }
  return { score: call("gg_score"), hash: call("gg_hash") | 0, ticks: t, ended: call("gg_status") === 1, accepted };
}

/** Static check of core.wasm: it compiles, imports nothing and exports the ABI. */
export function inspectCore(core: Uint8Array): Check & { module?: WebAssembly.Module } {
  let module: WebAssembly.Module;
  try { module = new WebAssembly.Module(core as BufferSource); } catch { return { id: "coreLoad", ok: false, detail: "invalid" }; }
  const imports = WebAssembly.Module.imports(module);
  if (imports.length) return { id: "coreLoad", ok: false, detail: `import ${imports[0].module}.${imports[0].name}` };
  const exports = new Map(WebAssembly.Module.exports(module).map((e) => [e.name, e.kind]));
  const missing = CORE_EXPORTS.find((n) => exports.get(n) !== "function");
  if (missing) return { id: "coreLoad", ok: false, detail: missing };
  return { id: "coreLoad", ok: true, module };
}

/** The seeds the automatic check plays (fixed, so a report can be reproduced). */
export const CHECK_SEEDS = ["gg-check-a", "gg-check-b", "gg-check-c"] as const;
