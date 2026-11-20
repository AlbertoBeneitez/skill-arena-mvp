/** Bot simulator · a small pool of worker threads that run playMatch (see play-worker.mjs). */
import { Worker } from "node:worker_threads";
import { availableParallelism } from "node:os";
import type { PlayResult, Style } from "./policies";

type Job = { key: string; seed: string; style: Style; botSeed: string; lowerWins: boolean; target: number; budgetMs: number };
const size = Math.max(2, Math.min(8, availableParallelism() - 1));
const workers: Worker[] = [];
const pending = new Map<number, (r: { result?: PlayResult; error?: string }) => void>();
let next = 0, rr = 0;
function worker() {
  if (workers.length < size) {
    const w = new Worker(new URL("../../../scripts/sim/play-worker.mjs", import.meta.url));
    w.on("message", (m: { id: number; result?: PlayResult; error?: string }) => { pending.get(m.id)?.(m); pending.delete(m.id); });
    w.unref();
    workers.push(w);
    return w;
  }
  return workers[rr++ % workers.length];
}
export function playInWorker(job: Job): Promise<PlayResult> {
  const id = next++;
  return new Promise((resolve, reject) => {
    pending.set(id, (m) => (m.result ? resolve(m.result) : reject(new Error(m.error))));
    worker().postMessage({ id, ...job });
  });
}
