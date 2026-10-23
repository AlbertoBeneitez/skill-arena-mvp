/** Test-only bot: reads the visible ball and presses the flipper in front of it. */
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { PINBALL_CORE_V1 as core, copyPinballState } from "../lib/verified/pinballCore.v1";

export type BotMode = "smart" | "idle" | "late";
export function playPinball(seed: string, mode: BotMode = "smart", level = 7, target = 1e9) {
  const s = core.create(seed), inputs: ReplayInput[] = [];
  const pressed = { left: -1, right: -1 };
  const centerDrains: number[] = [];
  let lastLost = 0;
  const send = (action: string) => {
    if (inputs.at(-1)?.tick === s.tick || !core.canApply(s, action)) return false;
    inputs.push({ seq: inputs.length, tick: s.tick, action });
    applyCoreInput(core, s, action, target);
    return true;
  };
  while (s.status === "running") {
    if (s.phase === "lane") {
      if (!s.chargeHeld) send("PLUNGER_HOLD");
      else if (s.charge >= level * 8) send("PLUNGER_RELEASE");
    } else if (s.phase === "play" && mode !== "idle") {
      const b = s.ball, delay = mode === "late" ? 0 : 0;
      const wantL = b.x < 200000 && b.x > 40000 && b.y > 495000 && b.vy > 0,
        wantR = b.x >= 190000 && b.x < 340000 && b.y > 495000 && b.vy > 0;
      void delay;
      if (!s.leftHeld && wantL && send("FLIP_LEFT_PRESS")) pressed.left = s.tick;
      else if (!s.rightHeld && wantR && send("FLIP_RIGHT_PRESS")) pressed.right = s.tick;
      else if (s.leftHeld && (s.tick - pressed.left > 18 || b.y < 420000)) send("FLIP_LEFT_RELEASE");
      else if (s.rightHeld && (s.tick - pressed.right > 18 || b.y < 420000)) send("FLIP_RIGHT_RELEASE");
    }
    stepCore(core, s, target);
    if (s.ballsLost > lastLost) {
      lastLost = s.ballsLost;
      centerDrains.push(s.lastDrainX);
    }
  }
  return { s, inputs, drains: centerDrains, copy: copyPinballState(s) };
}
