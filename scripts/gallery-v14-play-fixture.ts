import assert from "node:assert/strict";
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import { SHOT_GALLERY_CORE_V14 as core, galleryAtSpotV14 } from "../lib/verified/shotGalleryCore.v14";
import type { ReplayInput } from "../lib/verified/inputValidation";

/**
 * Scripted player for V14 (tests only). `correct`: takes down the targets; `double`: two targets on consecutive ticks;
 * `wrong`: shoots a decoy first on every screen (when there is one), then the targets; `spray`: shoots every decoy it
 * can before the targets; `early`: one tap before each screen opens; `idle`: never shoots.
 */
export function playGalleryV14(seed: string, mode: "correct" | "double" | "wrong" | "spray" | "early" | "idle" = "correct", delay = 40, target = 1e9) {
  const s = core.create(seed),
    inputs: ReplayInput[] = [];
  let lastTap = -999, burst = 0, earlyDone = -1, wrongDone = -1;
  while (s.status === "running") {
    let action: string | null = null;
    const out = (pred: (i: number) => boolean) => s.live.findIndex((b, i) => b.gone < 0 && !s.hits.includes(i) && pred(i));
    if (mode === "early" && s.phase === "waiting" && earlyDone !== s.trial) { action = "PICK_0"; earlyDone = s.trial; }
    else if (mode !== "idle" && s.phase === "ready") {
      const due = s.tick - Math.max(s.readyTick, lastTap) >= delay + (s.trial % 4) * 4;
      const decoy = out((i) => !s.live[i].target), next = out((i) => s.live[i].target && (s.live[i].born < 0 || s.tick - s.live[i].born >= 12));
      if (due && ((mode === "wrong" && wrongDone !== s.trial) || mode === "spray") && decoy >= 0) { action = `PICK_${s.live[decoy].spot}`; wrongDone = s.trial; }
      else if (next >= 0 && (due || (mode === "double" && burst === 1 && s.tick === lastTap + 1))) action = `PICK_${s.live[next].spot}`;
    }
    if (action && core.canApply(s, action)) {
      if (s.phase === "ready") assert.ok(galleryAtSpotV14(s, Number(action.slice(5))) >= 0);
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
