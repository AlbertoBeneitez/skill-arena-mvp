/** V4: no inert bumpers and a seed-driven opening layout. V1–V3 physics and replays stay frozen. */
import { createRng } from "../deterministic/seeded";
import { BILLIARDS_POCKETS, BILLIARDS_RULES, createBilliardsState, type PoolBall } from "./billiardsCore.v1";
import { BILLIARDS_V2_RULES, type BilliardsV2State } from "./billiardsCore.v2";
import { BILLIARDS_ACTIONS_V3, BILLIARDS_CORE_V3 } from "./billiardsCore.v3";
import { BILLIARDS_AIM_COUNT } from "./billiardsProtocol.v1";
import type { GameCore } from "./coreRuntime.v1";

export const BILLIARDS_V4_RULES = { ...BILLIARDS_V2_RULES, generator: "billiards4-seeded-opening-no-bumpers-v1", minGap: 44000, field: { x0: 74000, x1: 316000, y0: 126000, y1: 472000 } } as const;
const CORNER_POCKETS = [0, 1, 4, 5].map((i) => BILLIARDS_POCKETS[i]);
const ball = (id: number, x: number, y: number): PoolBall => ({ id, x, y, vx: 0, vy: 0, potted: false });

export function buildBilliardsArenaV4(seed: string) {
  const rng = createRng(`${seed}:billiards4:arena`),
    f = BILLIARDS_V4_RULES.field,
    placed: { x: number; y: number }[] = [],
    inside = (x: number, y: number) => x >= f.x0 && x <= f.x1 && y >= f.y0 && y <= f.y1,
    pocketOk = (x: number, y: number) => BILLIARDS_POCKETS.every((p) => (p.x - x) ** 2 + (p.y - y) ** 2 >= 50000 ** 2),
    free = (x: number, y: number) => placed.every((p) => (p.x - x) ** 2 + (p.y - y) ** 2 >= BILLIARDS_V4_RULES.minGap ** 2);
  // One clean near-pocket target at a seed-chosen corner, then the rest anywhere on the cloth.
  const corner = CORNER_POCKETS[rng.nextInt(4)],
    sx = corner.x < 195000 ? 1 : -1,
    sy = corner.y < 299000 ? 1 : -1,
    jx = (rng.nextInt(21) - 10) * 1000,
    jy = (rng.nextInt(21) - 10) * 1000;
  const first = { x: corner.x + sx * (60000 + jx), y: corner.y + sy * (62000 + jy) };
  placed.push(first);
  // Cue ball: far enough from the first target, never beside it.
  let cue = { x: 195000, y: 299000 };
  for (let n = 0; n < 200; n++) {
    const x = f.x0 + rng.nextInt(f.x1 - f.x0 + 1), y = f.y0 + rng.nextInt(f.y1 - f.y0 + 1);
    if (!pocketOk(x, y) || (x - first.x) ** 2 + (y - first.y) ** 2 < 150000 ** 2) continue;
    cue = { x, y };
    break;
  }
  placed.push(cue);
  const targets = [first];
  for (let attempts = 0; targets.length < BILLIARDS_V4_RULES.targets && attempts < 5000; attempts++) {
    const x = f.x0 + rng.nextInt(f.x1 - f.x0 + 1), y = f.y0 + rng.nextInt(f.y1 - f.y0 + 1);
    if (!inside(x, y) || !pocketOk(x, y) || !free(x, y)) continue;
    placed.push({ x, y });
    targets.push({ x, y });
  }
  // Deterministic grid fallback (never reached with the field above, but keeps the core total).
  for (let k = 0; targets.length < BILLIARDS_V4_RULES.targets; k++) {
    const p = { x: f.x0 + 60000 * (k % 5), y: f.y0 + 60000 * Math.floor(k / 5) + 20000 };
    if (pocketOk(p.x, p.y) && free(p.x, p.y)) { placed.push(p); targets.push(p); }
    if (k > 200) break;
  }
  // Order the targets so that the easy one is first, the rest are shuffled by the seed.
  const rest = targets.slice(1);
  for (let i = rest.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  const order = [first, ...rest];
  const angle = (Math.atan2(first.y - cue.y, first.x - cue.x) + Math.PI * 2) % (Math.PI * 2);
  return {
    balls: [ball(0, cue.x, cue.y), ...order.map((p, i) => ball(i + 1, p.x, p.y))],
    aim: Math.round((angle * BILLIARDS_AIM_COUNT) / (Math.PI * 2)) % BILLIARDS_AIM_COUNT,
  };
}

function createBilliardsStateV4(seed: string): BilliardsV2State {
  const arena = buildBilliardsArenaV4(seed);
  return {
    ...createBilliardsState(seed),
    stage: BILLIARDS_RULES.levels - 1,
    balls: arena.balls,
    bumpers: [],
    aim: arena.aim,
    power: 6,
    shotsLeft: BILLIARDS_V4_RULES.shots,
    height: 0,
    lastAdvanceTick: -1,
  };
}

export const BILLIARDS_CORE_V4: GameCore<BilliardsV2State> = {
  ...BILLIARDS_CORE_V3,
  gameVersion: "4.0.0",
  actions: BILLIARDS_ACTIONS_V3,
  inputVersion: 2,
  content: {
    inheritedPhysics: BILLIARDS_CORE_V3.content,
    rules: BILLIARDS_V4_RULES,
    arena: "no-bumpers;seeded-corner-target-plus-scattered-targets;min-gap-44;pocket-clearance-50",
  },
  create: createBilliardsStateV4,
};
export { BILLIARDS_ACTIONS_V3 as BILLIARDS_ACTIONS_V4 };
