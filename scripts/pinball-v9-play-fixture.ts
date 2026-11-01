/** Test-only bot for Pinball V9: reads the visible ball and presses the flipper in front of it. */
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { PINBALL_CORE_V9 as core, copyPinballStateV9 } from "../lib/verified/pinballCore.v9";

export type BotModeV9 = "smart" | "idle" | "plunge-only";
export function playPinballV9(seed: string, mode: BotModeV9 = "smart", level = 7, target = 1e9) {
  const s = core.create(seed), inputs: ReplayInput[] = [];
  const pressed = { left: -1, right: -1 };
  const send = (action: string) => {
    if (inputs.at(-1)?.tick === s.tick || !core.canApply(s, action)) return false;
    inputs.push({ seq: inputs.length, tick: s.tick, action });
    applyCoreInput(core, s, action, target);
    return true;
  };
  while (s.status === "running") {
    if (s.phase === "lane") {
      if (mode !== "idle") {
        if (!s.chargeHeld) send("PLUNGER_HOLD");
        else if (s.charge >= level * 8) send("PLUNGER_RELEASE");
      }
    } else if (s.phase === "play" && mode === "smart") {
      // V9: every ball in play (multiball) is watched.
      const balls = [s.ball, ...s.extra];
      const wantL = balls.some((b) => b.x < 195000 && b.x > 40000 && b.y > 495000 && b.vy > 0),
        wantR = balls.some((b) => b.x >= 195000 && b.x < 340000 && b.y > 495000 && b.vy > 0);
      const b = s.ball;
      if (!s.leftHeld && wantL && send("FLIP_LEFT_PRESS")) pressed.left = s.tick;
      else if (!s.rightHeld && wantR && send("FLIP_RIGHT_PRESS")) pressed.right = s.tick;
      else if (s.leftHeld && (s.tick - pressed.left > 18 || b.y < 420000)) send("FLIP_LEFT_RELEASE");
      else if (s.rightHeld && (s.tick - pressed.right > 18 || b.y < 420000)) send("FLIP_RIGHT_RELEASE");
    }
    stepCore(core, s, target);
  }
  return { s, inputs, copy: copyPinballStateV9(s) };
}
