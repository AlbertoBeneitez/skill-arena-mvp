import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import { STACK_RELAY_CORE, rebuildRelay, type RelayInput } from "../lib/verified/stackRelay.v1";

/**
 * Scripted relay turn (tests only): rebuilds the tower, waits `wait` ticks, then drops each block when it lines up
 * with the top one and stops as the block after the last one appears. `idleAfter`: after that many placements it
 * stops dropping and lets the run idle out.
 */
export function playRelayTurn(seed: string, committed: readonly RelayInput[], committedFinalTick: number, blocks: number, opts: { wait?: number; idleAfter?: number } = {}) {
  const rebuilt = rebuildRelay(seed, committed, committedFinalTick);
  if (!rebuilt.ok) throw new Error(rebuilt.error);
  const s = rebuilt.state, start = s.height, inputs: RelayInput[] = [];
  let waited = 0;
  while (s.status === "running") {
    const placed = s.height - start;
    if (placed >= blocks && s.phase === "moving" && s.movingAgeTicks === 0) break;
    const top = s.blocks[s.blocks.length - 1];
    const off = s.axis === "x" ? s.moving.xMilli - top.xMilli : s.moving.zMilli - top.zMilli;
    const idle = opts.idleAfter !== undefined && placed >= opts.idleAfter;
    if (!idle && waited >= (opts.wait ?? 0) && s.phase === "moving" && Math.abs(off) < 2_500 && STACK_RELAY_CORE.canApply(s, "DROP")) {
      inputs.push({ tick: s.tick, action: "DROP" });
      applyCoreInput(STACK_RELAY_CORE, s, "DROP", Number.MAX_SAFE_INTEGER);
      if (s.status !== "running") break;
    }
    stepCore(STACK_RELAY_CORE, s, Number.MAX_SAFE_INTEGER);
    waited++;
  }
  return { inputs, finalTick: s.tick, state: s };
}
