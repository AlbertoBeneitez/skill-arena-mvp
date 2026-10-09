import assert from "node:assert/strict";
import { SubmissionGate } from "../lib/verified/submissionGate";

const gate = new SubmissionGate<number>();
let requests = 0;
let resolve!: (value: number) => void;
const execute = async () => { requests += 1; return new Promise<number>(done => { resolve = done; }); };
const first = gate.run("a", execute);
assert.equal(gate.run("a", execute), first);
await Promise.resolve();
assert.equal(requests, 1);
await assert.rejects(gate.run("other", execute), /ATTEMPT_SUBMISSION_CONFLICT/);
resolve(17);
assert.equal(await first, 17);
assert.equal(gate.run("a", execute), first, "Completed attempts cannot double-submit");
assert.equal(requests, 1);
gate.reset();

let cancelledSignal!: AbortSignal;
let lateResolve!: (value: number) => void;
const late = gate.run("old", async signal => {
  cancelledSignal = signal;
  return new Promise<number>(done => { lateResolve = done; });
});
await Promise.resolve();
const rejection = assert.rejects(late, { name: "AbortError" });
gate.reset();
assert.equal(cancelledSignal.aborted, true);
const next = gate.run("new", async () => 29);
lateResolve(99); // Even a transport ignoring AbortSignal cannot publish success.
await rejection;
assert.equal(await next, 29);

const neverStarted = new SubmissionGate<number>();
let called = false;
const cancelledBeforeStart = neverStarted.run("a", async () => { called = true; return 1; });
neverStarted.reset();
await assert.rejects(cancelledBeforeStart, { name: "AbortError" });
assert.equal(called, false);

// A committed terminal record outlives its view, including a detach before the
// transport microtask begins. A later lifecycle can start its own submission.
const detachedGate = new SubmissionGate<number>();
let detachedCalls = 0;
let detachedSignal!: AbortSignal;
let detachedResolve!: (value: number) => void;
const committed = detachedGate.run("terminal", async signal => {
  detachedCalls++;
  detachedSignal = signal;
  return new Promise<number>(done => { detachedResolve = done; });
});
detachedGate.detach();
assert.equal(detachedGate.run("terminal", async () => 999), committed,
  "Detaching must preserve deduplication until the next lifecycle");
detachedGate.reset();
const replacement = detachedGate.run("replacement", async () => 37);
await Promise.resolve();
assert.equal(detachedCalls, 1, "A terminal record must start even after immediate view cleanup");
assert.equal(detachedSignal.aborted, false);
detachedResolve(31);
assert.equal(await committed, 31);
assert.equal(await replacement, 37);

const inFlightGate = new SubmissionGate<number>();
let inFlightSignal!: AbortSignal;
let inFlightResolve!: (value: number) => void;
const inFlight = inFlightGate.run("finished", async signal => {
  inFlightSignal = signal;
  return new Promise<number>(done => { inFlightResolve = done; });
});
await Promise.resolve();
inFlightGate.detach();
inFlightGate.detach();
inFlightGate.reset();
assert.equal(inFlightSignal.aborted, false);
inFlightResolve(41);
assert.equal(await inFlight, 41, "Leaving a view must not abort a submitted terminal record");
console.log("Submission lifecycle OK · single flight · terminal cache · cancellation · late transport · generation reset · committed detach before/after transport");
