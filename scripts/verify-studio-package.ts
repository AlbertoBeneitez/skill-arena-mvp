import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { unzipSync, zipSync, strToU8 } from "fflate";
import { checkManifest, externalReferences, imageSize, inputScript, replayCore, seedWords, unpackPackage } from "../lib/studio/package";
import { checkPackage } from "../lib/server/studioPackageCheck";

// Format 1 (WebAssembly + HTML, v142–v177): still understood for stored and published packages. Its kit is a fixture.
const kitZip = new Uint8Array(readFileSync("scripts/fixtures/studio/pulse-format1.zip"));
const kit = unzipSync(kitZip);
const pass = await checkPackage(kitZip);
assert.ok(pass.report.ok, `kit passes: ${JSON.stringify(pass.report.checks.filter((c) => !c.ok))}`);
assert.equal(pass.report.checks.length, 8);
assert.equal(pass.unpacked.manifest?.id, "pulse");

const failing = async (files: Record<string, Uint8Array>) => (await checkPackage(zipSync(files))).report.checks.filter((c) => !c.ok && !c.skipped).map((c) => `${c.id}:${c.detail ?? ""}`);
const withFile = (name: string, data: Uint8Array | null) => { const f: Record<string, Uint8Array> = { ...kit }; if (data) f[name] = data; else delete f[name]; return f; };
const manifest = JSON.parse(new TextDecoder().decode(kit["galactic.json"]));
const core = (n: string) => new Uint8Array(readFileSync(`scripts/fixtures/studio/${n}.wasm`));

// Static checks
assert.deepEqual(await failing(withFile("galactic.json", null)), ["manifest:galactic.json"]);
assert.deepEqual(await failing(withFile("galactic.json", strToU8(JSON.stringify({ ...manifest, shelf: "popular" })))), ["manifest:shelf"], "Populares is earned");
assert.deepEqual(await failing(withFile("game.html", strToU8('<script src="https://cdn.example.com/x.js"></script>'))), ["game:https://cdn.example.com/x.js"]);
assert.deepEqual(await failing(withFile("cover.webp", null)), ["cover:cover.webp"]);
assert.deepEqual(await failing(withFile("core.wasm", null)), ["coreLoad:core.wasm"]);
assert.deepEqual(await failing(withFile("core.wasm", strToU8("not wasm"))), ["coreLoad:invalid"]);
// A core that imports anything is refused: (module (import "env" "now" (func)))
const importing = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 2, 11, 1, 3, 101, 110, 118, 3, 110, 111, 119, 0, 0]);
assert.deepEqual(await failing(withFile("core.wasm", importing)), ["coreLoad:import env.now"]);
// Running checks
assert.deepEqual(await failing(withFile("core.wasm", core("seedless"))), ["coreSeed:seed ignored"]);
assert.deepEqual(await failing(withFile("core.wasm", core("noreset"))), ["coreReplay:different result on replay"], "gg_init must reset everything");
assert.deepEqual(await failing(withFile("core.wasm", core("endless"))), ["coreReplay:not finished by maxTicks (3600)"]);
assert.deepEqual(await failing(withFile("core.wasm", core("hang"))), ["coreSpeed:> 6 s"], "a core that never returns is stopped");
// Zip safety
assert.deepEqual(unpackPackage(new Uint8Array([1, 2, 3])).checks, [{ id: "zip", ok: false, detail: "unreadable" }]);
assert.equal(unpackPackage(zipSync({ "../evil.txt": strToU8("x") })).checks[0].ok, false, "no path escapes");
const nested: Record<string, Uint8Array> = {};
for (const [n, b] of Object.entries(kit)) nested[`pulse/${n}`] = b;
assert.ok((await checkPackage(zipSync(nested))).report.ok, "a package zipped inside one folder is accepted");

// Pieces
assert.deepEqual(imageSize(kit["cover.webp"]), { w: 1600, h: 1100 });
assert.deepEqual(externalReferences('<img src="data:image/png;base64,AA"><a href="//x.io/y">'), ["//x.io/y"]);
assert.equal(checkManifest({ ...manifest, actions: ["TAP", "TAP"] }).ok, false, "actions are unique");
assert.equal(checkManifest({ ...manifest, maxTicks: 200_000 }).ok, false);
assert.deepEqual(inputScript("s", 1, 3600), inputScript("s", 1, 3600), "seeded scripts");
// The interface's view of a match replays to the core's: same seed and inputs, same result.
const inst = new WebAssembly.Instance(new WebAssembly.Module(kit["core.wasm"] as BufferSource), {}).exports as Record<string, unknown>;
const [lo, hi] = seedWords("match-1");
const a = replayCore(inst, lo, hi, inputScript("p", 1, 3600), 3600), b = replayCore(inst, lo, hi, inputScript("p", 1, 3600), 3600);
assert.deepEqual(a, b);
assert.ok(a.ended && a.score >= 0);
// v178 · Format 2, the app's own TypeScript format: the downloadable kit is a valid package and uploads take only it.
{
  const v2Zip = new Uint8Array(readFileSync("public/studio/galactic-games-kit.zip"));
  const v2 = unzipSync(v2Zip);
  const ok = await checkPackage(v2Zip, [2]);
  assert.ok(ok.report.ok, `kit v2 passes: ${JSON.stringify(ok.report.checks.filter((c) => !c.ok))}`);
  assert.deepEqual(ok.report.checks.map((c) => c.id), ["zip", "manifest", "core", "view", "cover"]);
  assert.equal(ok.unpacked.manifest?.format, 2);
  assert.equal(ok.unpacked.manifest?.width, 360);
  const old = await checkPackage(kitZip, [2]);
  assert.equal(old.report.ok, false, "uploads refuse format 1");
  assert.deepEqual(old.report.checks.filter((c) => !c.ok && !c.skipped).map((c) => `${c.id}:${c.detail}`), ["manifest:format 1 → 2"]);
  const f2 = async (files: Record<string, Uint8Array>) => (await checkPackage(zipSync(files), [2])).report.checks.filter((c) => !c.ok && !c.skipped).map((c) => `${c.id}:${c.detail ?? ""}`);
  const with2 = (name: string, data: string | null) => { const f: Record<string, Uint8Array> = { ...v2 }; if (data === null) delete f[name]; else f[name] = strToU8(data); return f; };
  const coreSrc = new TextDecoder().decode(v2["src/core.ts"]), gameSrc = new TextDecoder().decode(v2["src/game.ts"]);
  const m2 = JSON.parse(new TextDecoder().decode(v2["galactic.json"]));
  assert.deepEqual(await f2(with2("src/core.ts", null)), ["core:src/core.ts"]);
  assert.deepEqual(await f2(with2("src/game.ts", null)), ["view:src/game.ts"]);
  assert.deepEqual(await f2(with2("cover.webp", null)), ["cover:cover.webp"], "the presentation image is required");
  assert.deepEqual(await f2(with2("src/core.ts", coreSrc + "\nconst r = Math.random();")), ["core:src/core.ts: Math.random"]);
  assert.deepEqual(await f2(with2("src/core.ts", coreSrc + "\nconst t = Date.now();")), ["core:src/core.ts: Date"]);
  assert.deepEqual(await f2(with2("src/rules/extra.ts", "export const t = performance.now();")), ["core:src/rules/extra.ts: performance"]);
  assert.deepEqual(await f2(with2("src/core.ts", 'import _ from "lodash";\n' + coreSrc)), ["core:src/core.ts: import lodash"]);
  assert.deepEqual(await f2(with2("src/core.ts", coreSrc + "\n// never Math.random() or Date here\n/* nor performance */")), [], "comments are not code");
  assert.deepEqual(await f2(with2("src/game.ts", gameSrc + '\nfetch("/score");')), ["view:src/game.ts: network"]);
  assert.deepEqual(await f2(with2("src/game.ts", gameSrc + '\nconst img = "https://cdn.example.com/a.png";')), ["view:src/game.ts: external URL"]);
  assert.deepEqual(await f2(with2("src/game.ts", gameSrc + "\nconst x = Date.now();")), [], "the screen may read the clock (it never decides)");
  assert.deepEqual(await f2(with2("galactic.json", JSON.stringify({ ...m2, width: undefined }))), ["manifest:width/height"]);
  const nested2: Record<string, Uint8Array> = {};
  for (const [n, b] of Object.entries(v2)) nested2[`pulse/${n}`] = b;
  assert.ok((await checkPackage(zipSync(nested2), [2])).report.ok, "a format-2 package inside one folder is accepted");
}
console.log(`Studio packages OK · format 2 kit, static source rules, format 1 refused at upload · format 1: kit passes (core ${pass.report.checks.find((c) => c.id === "coreSpeed")?.detail}), manifest, external refs, cover, imports, seed, reset, length, time limit, zip safety`);
