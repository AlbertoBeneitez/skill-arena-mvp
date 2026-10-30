import assert from "node:assert/strict";
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import { SHOT_GALLERY_CORE_V12 as core, GALLERY_V12_CIVILIAN } from "../lib/verified/shotGalleryCore.v12";
import type { ReplayInput } from "../lib/verified/inputValidation";

/**
 * Scripted player. `double`: two targets per burst, on consecutive ticks (two fingers at once).
 * `civilian`: always shoots a civilian when there is one (else any decoy).
 */
export function playGalleryV12(seed: string, mode: "correct" | "double" | "wrong" | "civilian" | "early" | "idle" = "correct", delay = 40, target = 1e9) {
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
      if (mode === "civilian" && due) {
        const civ = trial.targets.findIndex((t) => t.species === GALLERY_V12_CIVILIAN);
        action = `PICK_${civ >= 0 ? civ : trial.targets.findIndex((_, i) => !trial.answers.includes(i))}`;
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
