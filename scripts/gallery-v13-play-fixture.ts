import assert from "node:assert/strict";
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import { SHOT_GALLERY_CORE_V13 as core } from "../lib/verified/shotGalleryCore.v13";
import type { ReplayInput } from "../lib/verified/inputValidation";

/**
 * Scripted player. `double`: two targets per burst, on consecutive ticks (two fingers at once).
 */
export function playGalleryV13(seed: string, mode: "correct" | "double" | "wrong" | "lookalike" | "early" | "idle" = "correct", delay = 40, target = 1e9) {
  const s = core.create(seed),
    inputs: ReplayInput[] = [];
  let lastTap = -999, burst = 0;
  while (s.status === "running") {
    const trial = s.trials[s.trial];
    let action: string | null = null;
    if (mode === "early" && s.phase === "waiting") action = "PICK_0";
    else if (mode !== "idle" && s.phase === "ready") {
      const due = s.tick - Math.max(s.readyTick, lastTap) >= delay + (s.trial % 4) * 4;
      const next = trial.answers.find((i) => !s.hits.includes(i));
      if ((mode === "correct" && due) || (mode === "double" && (due || (burst === 1 && s.tick === lastTap + 1)))) {
        if (next !== undefined) action = `PICK_${next}`;
      }
      if (mode === "wrong" && due) action = `PICK_${trial.targets.findIndex((_, i) => !trial.answers.includes(i))}`;
      if (mode === "lookalike" && due) {
        const look = trial.targets.findIndex((t) => t.lookalike);
        action = `PICK_${look >= 0 ? look : trial.targets.findIndex((_, i) => !trial.answers.includes(i))}`;
      }
    }
    if (action && core.canApply(s, action)) {
      inputs.push({ seq: inputs.length, tick: s.tick, action });
      assert.ok(applyCoreInput(core, s, action, target));
      burst = mode === "double" && s.tick !== lastTap + 1 ? 1 : 0;
      lastTap = s.tick;
      if (s.status === "running") assert.equal(s.score, 0, "the total is published only at the end");
    }
    if (s.status === "running") stepCore(core, s, target);
  }
  return { s, inputs };
}
