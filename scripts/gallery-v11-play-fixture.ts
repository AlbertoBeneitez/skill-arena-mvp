import assert from "node:assert/strict";
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import { SHOT_GALLERY_CORE_V11 as core } from "../lib/verified/shotGalleryCore.v11";
import type { ReplayInput } from "../lib/verified/inputValidation";

export function playGalleryV11(seed: string, mode: "correct" | "wrong" | "early" | "idle" = "correct", delay = 40, target = 1e9) {
  const s = core.create(seed),
    inputs: ReplayInput[] = [];
  let lastTap = -999;
  while (s.status === "running") {
    const trial = s.trials[s.trial];
    let action: string | null = null;
    if (mode === "early" && s.phase === "waiting") action = "PICK_0";
    else if (mode !== "idle" && s.phase === "ready" && s.tick - Math.max(s.readyTick, lastTap) >= delay + (s.trial % 4) * 4) {
      const next = trial.answers.find((i) => !s.hits.includes(i));
      if (mode === "correct" && next !== undefined) action = `PICK_${next}`;
      if (mode === "wrong") action = `PICK_${trial.targets.findIndex((_, i) => !trial.answers.includes(i))}`;
    }
    if (action && core.canApply(s, action)) {
      inputs.push({ seq: inputs.length, tick: s.tick, action });
      assert.ok(applyCoreInput(core, s, action, target));
      lastTap = s.tick;
      if (s.status === "running") assert.equal(s.score, 0, "the total is published only at the end");
    }
    if (s.status === "running") stepCore(core, s, target);
  }
  return { s, inputs };
}
