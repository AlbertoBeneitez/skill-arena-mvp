// Pulse — the Galactic Games kit example core (AssemblyScript). Pure integer rules, no imports, no clock, no Math.random.
// A marker sweeps across a bar; TAP when it is inside the lit window. Ten rounds, each a little faster.
const ROUNDS: i32 = 10;
const ROUND_TICKS: i32 = 300; // 5 s at 60 ticks per second to tap
const PAUSE_TICKS: i32 = 36;  // pause between rounds

let rng: u32 = 1;
let tick: i32 = 0;
let round: i32 = 0;
let pos: i32 = 0;      // marker position, 0..1000
let vel: i32 = 0;      // per tick, signed
let target: i32 = 500; // window centre
let half: i32 = 60;    // window half width
let roundTick: i32 = 0;
let pause: i32 = 0;
let score: i32 = 0;
let lastHit: i32 = -1;
let ended: i32 = 0;

function next(): u32 { rng ^= rng << 13; rng ^= rng >> 17; rng ^= rng << 5; return rng; }

function startRound(): void {
  roundTick = 0;
  pos = <i32>(next() % 1001);
  const speed = 9 + round * 3 + <i32>(next() % 5);
  vel = (next() & 1) == 0 ? speed : -speed;
  target = 150 + <i32>(next() % 701);
  half = 70 - round * 4;
}

function endRound(points: i32): void {
  score += points; lastHit = points; round++;
  if (round >= ROUNDS) { ended = 1; return; }
  pause = PAUSE_TICKS;
}

export function gg_init(seedLo: i32, seedHi: i32): void {
  rng = (<u32>seedLo ^ (<u32>seedHi * 0x9e3779b1)) | 1;
  tick = 0; round = 0; score = 0; lastHit = -1; ended = 0; pause = 0;
  startRound();
}

/** Action 0 = TAP. Accepted only while a round is live. */
export function gg_input(action: i32): i32 {
  if (ended == 1 || pause > 0 || action != 0) return 0;
  const d = abs<i32>(pos - target);
  endRound(d <= half ? 100 - (d * 60) / half : 0);
  return 1;
}

export function gg_step(): void {
  if (ended == 1) return;
  tick++;
  if (pause > 0) { pause--; if (pause == 0) startRound(); return; }
  pos += vel;
  if (pos < 0) { pos = -pos; vel = -vel; }
  if (pos > 1000) { pos = 2000 - pos; vel = -vel; }
  roundTick++;
  if (roundTick >= ROUND_TICKS) endRound(0);
}

export function gg_status(): i32 { return ended; }
export function gg_score(): i32 { return score; }
export function gg_hash(): i32 {
  let h: u32 = 2166136261;
  h = (h ^ <u32>tick) * 16777619; h = (h ^ <u32>round) * 16777619; h = (h ^ <u32>pos) * 16777619;
  h = (h ^ <u32>vel) * 16777619; h = (h ^ <u32>target) * 16777619; h = (h ^ <u32>score) * 16777619;
  h = (h ^ <u32>pause) * 16777619; h = (h ^ rng) * 16777619;
  return <i32>h;
}

// Read-outs for the interface only (not part of the ABI).
export function view_pos(): i32 { return pos; }
export function view_target(): i32 { return target; }
export function view_half(): i32 { return half; }
export function view_round(): i32 { return round; }
export function view_pause(): i32 { return pause; }
export function view_last(): i32 { return lastHit; }
