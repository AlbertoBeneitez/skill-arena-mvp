// Pulse — the kit's example rules. A marker sweeps across a bar; TAP when it is inside the lit window.
// Ten rounds, each a little faster. Integers only, seeded randomness only, no clock: same seed + same inputs = same result.
import { createRng } from "../kit/seeded";
import type { CoreState, GameCore } from "../kit/core";

const ROUNDS = 10;
const ROUND_TICKS = 300; // 5 s at 60 ticks per second to tap
const PAUSE_TICKS = 36;  // pause between rounds

export type PulseState = CoreState & {
  rng: number;      // the seeded generator's state, so a match can be saved and resumed exactly
  round: number;
  pos: number;      // marker position, 0..1000
  vel: number;      // per tick, signed
  target: number;   // window centre
  half: number;     // window half width
  roundTick: number;
  pause: number;
  lastHit: number;  // points of the last round, -1 before the first
};

function draw(state: PulseState, max: number) {
  const rng = createRng(state.rng);
  const v = rng.nextInt(max);
  state.rng = rng.state();
  return v;
}

function startRound(s: PulseState) {
  s.roundTick = 0;
  s.pos = draw(s, 1001);
  const speed = 9 + s.round * 3 + draw(s, 5);
  s.vel = draw(s, 2) === 0 ? speed : -speed;
  s.target = 150 + draw(s, 701);
  s.half = 70 - s.round * 4;
}

function endRound(s: PulseState, points: number) {
  s.score += points; s.lastHit = points; s.round++;
  if (s.round >= ROUNDS) { s.status = "won"; return; }
  s.pause = PAUSE_TICKS;
}

export const core: GameCore<PulseState> = {
  gameId: "pulse",
  gameVersion: "1.0.0",
  width: 360,
  height: 640,
  tickRate: 60,
  maxFinalTick: 3600,
  maxInputs: 64,
  inputVersion: 1,
  actions: ["TAP"],
  content: { rounds: ROUNDS },
  create(seed) {
    const s: PulseState = {
      tick: 0, status: "running", score: 0, failure: null,
      rng: createRng(`pulse:${seed}`).state(), round: 0, pos: 0, vel: 0, target: 500, half: 60, roundTick: 0, pause: 0, lastHit: -1,
    };
    startRound(s);
    return s;
  },
  step(s) {
    s.tick++;
    if (s.status !== "running") return;
    if (s.pause > 0) { s.pause--; if (s.pause === 0) startRound(s); return; }
    s.pos += s.vel;
    if (s.pos < 0) { s.pos = -s.pos; s.vel = -s.vel; }
    if (s.pos > 1000) { s.pos = 2000 - s.pos; s.vel = -s.vel; }
    s.roundTick++;
    if (s.roundTick >= ROUND_TICKS) endRound(s, 0);
  },
  canApply(s, action) {
    return action === "TAP" && s.status === "running" && s.pause === 0;
  },
  apply(s) {
    const d = Math.abs(s.pos - s.target);
    endRound(s, d <= s.half ? 100 - Math.floor((d * 60) / s.half) : 0);
  },
};
