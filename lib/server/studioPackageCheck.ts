/**
 * The automatic admission check (v142), run on every package at upload, before anything is stored. Static checks come
 * from lib/studio/package.ts; the core is then played inside a worker thread with a hard time limit: three seeded
 * scripts, each twice (a fresh instance, then the same instance re-initialised), and one script under a second seed.
 * The core imports nothing, so inside the worker it can only compute; the limit stops a core that never returns.
 */
import { Worker } from "node:worker_threads";
import { CHECK_SEEDS, finishReport, inputScript, inspectCore, replayCore, seedWords, unpackPackage, type Check, type Report, type ReplayResult, type Unpacked } from "@/lib/studio/package";

const TIME_LIMIT_MS = 6000;
const SLOW_RUN_MS = 1500;
const MEMORY_LIMIT = 64 * 1024 * 1024;

type Run = { seedLo: number; seedHi: number; inputs: [number, number][]; fresh: boolean };
type WorkerOut = { ok: true; results: ReplayResult[]; ms: number[]; memory: number } | { ok: false; error: string };

const WORKER = `
const { parentPort, workerData } = require("node:worker_threads");
const replayCore = (${replayCore.toString()});
try {
  const module = new WebAssembly.Module(workerData.core);
  let instance = null;
  const results = [], ms = [];
  for (const run of workerData.runs) {
    if (run.fresh || !instance) instance = new WebAssembly.Instance(module, {});
    const t0 = performance.now();
    results.push(replayCore(instance.exports, run.seedLo, run.seedHi, run.inputs, workerData.maxTicks));
    ms.push(Math.round(performance.now() - t0));
  }
  const mem = instance && instance.exports.memory ? instance.exports.memory.buffer.byteLength : 0;
  parentPort.postMessage({ ok: true, results, ms, memory: mem });
} catch (e) {
  parentPort.postMessage({ ok: false, error: String(e && e.message || e).slice(0, 120) });
}`;

function playInWorker(core: Uint8Array, runs: Run[], maxTicks: number): Promise<WorkerOut | "timeout"> {
  return new Promise((resolve) => {
    const w = new Worker(WORKER, { eval: true, workerData: { core, runs, maxTicks }, resourceLimits: { maxOldGenerationSizeMb: 96 } });
    const timer = setTimeout(() => { void w.terminate(); resolve("timeout"); }, TIME_LIMIT_MS);
    w.once("message", (m: WorkerOut) => { clearTimeout(timer); void w.terminate(); resolve(m); });
    w.once("error", (e: Error) => { clearTimeout(timer); resolve({ ok: false, error: String(e.message).slice(0, 120) }); });
  });
}

const same = (a: ReplayResult, b: ReplayResult) => a.score === b.score && a.hash === b.hash && a.ticks === b.ticks && a.ended === b.ended;

export async function checkPackage(zip: Uint8Array): Promise<{ report: Report; unpacked: Unpacked }> {
  const { checks, unpacked } = unpackPackage(zip);
  const fail = (c: Check) => { checks.push(c); return { report: finishReport(checks), unpacked }; };
  if (!unpacked.core) return { report: finishReport(checks), unpacked };
  const inspected = inspectCore(unpacked.core);
  checks.push({ id: "coreLoad", ok: inspected.ok, detail: inspected.detail });
  if (!inspected.ok || !unpacked.manifest) return { report: finishReport(checks), unpacked };

  const { actions, maxTicks } = unpacked.manifest;
  const runs: Run[] = [];
  for (const seed of CHECK_SEEDS) {
    const [seedLo, seedHi] = seedWords(seed), inputs = inputScript(seed, actions.length, maxTicks);
    runs.push({ seedLo, seedHi, inputs, fresh: true }, { seedLo, seedHi, inputs, fresh: false });
  }
  const [bLo, bHi] = seedWords(CHECK_SEEDS[1]);
  runs.push({ seedLo: bLo, seedHi: bHi, inputs: runs[0].inputs, fresh: true }); // seed B, script A
  const out = await playInWorker(unpacked.core, runs, maxTicks);
  if (out === "timeout") return fail({ id: "coreSpeed", ok: false, detail: `> ${TIME_LIMIT_MS / 1000} s` });
  if (!out.ok) return fail({ id: "coreReplay", ok: false, detail: `trap: ${out.error}` });

  const r = out.results;
  const replay = (() => {
    for (let k = 0; k < CHECK_SEEDS.length; k++) {
      const a = r[2 * k], b = r[2 * k + 1];
      if (!same(a, b)) return { ok: false, detail: "different result on replay" };
      if (!a.ended) return { ok: false, detail: `not finished by maxTicks (${maxTicks})` };
      if (!Number.isInteger(a.score) || a.score < 0) return { ok: false, detail: `score ${a.score}` };
    }
    if (out.memory > MEMORY_LIMIT) return { ok: false, detail: "memory > 64 MB" };
    return { ok: true };
  })();
  checks.push({ id: "coreReplay", ...replay });
  checks.push(same(r[0], r[6]) ? { id: "coreSeed", ok: false, detail: "seed ignored" } : { id: "coreSeed", ok: true });
  const slowest = Math.max(...out.ms);
  checks.push(slowest > SLOW_RUN_MS ? { id: "coreSpeed", ok: false, detail: `${slowest} ms` } : { id: "coreSpeed", ok: true, detail: `${slowest} ms` });
  return { report: finishReport(checks), unpacked };
}
