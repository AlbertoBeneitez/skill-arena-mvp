import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { unzipSync, zipSync, strToU8 } from "fflate";
import { checkManifest, externalReferences, imageSize, inputScript, replayCore, seedWords, unpackPackage } from "../lib/studio/package";
import { checkPackage } from "../lib/server/studioPackageCheck";

// The studio kit is itself a valid package: it must pass every automatic check.
const kitZip = new Uint8Array(readFileSync("public/studio/galactic-games-kit.zip"));
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
console.log(`Studio packages OK · kit passes (core ${pass.report.checks.find((c) => c.id === "coreSpeed")?.detail}), manifest, external refs, cover, imports, seed, reset, length, time limit, zip safety`);
