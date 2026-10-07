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
console.log("Submission lifecycle OK · single flight · terminal cache · cancellation · late transport · generation reset");
