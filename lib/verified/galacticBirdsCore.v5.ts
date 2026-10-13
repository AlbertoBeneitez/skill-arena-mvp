/** One fixed-screen assembly per level, explicitly requested by the owner. */
import {BIRDS_CORE as base, type BirdsState} from "./galacticBirdsCore.v4";
import type {GameCore} from "./coreRuntime.v1";
export type BirdsV5State = BirdsState & {seed:string; level:number; completedKills:number; completedDestroyed:number; levelStartTick:number};
function levelField(seed:string, level:number) {
  const source = base.create(seed), centre = 300000 + level * 210000;
  const bodies = source.bodies.filter(b => Math.abs(b.x - centre) < 105000);
  const enemies = source.enemies.slice(level * 2, level * 2 + 2);
  const shift = 295000 - source.enemies[level * 2 + 1].x;
  for (const body of bodies) body.x += shift;
  for (const enemy of enemies) enemy.x += shift;
  // Align each complete assembly, not the roof target, inside the fixed field.
  const right = Math.max(...bodies.map(b => b.x + b.w / 2));
  if (right > 383000) {
    for (const body of bodies) body.x -= right - 383000;
    for (const enemy of enemies) enemy.x -= right - 383000;
  }
  return {bodies,enemies};
}
export const BIRDS_CORE_V5: GameCore<BirdsV5State> = {
  ...base,
  gameVersion:"5.0.0",
  content:{base:base.content, levels:6, camera:"FIXED_390PX_ONE_ASSEMBLY", budget:"30_SHARED_SHOTS", transitionTicks:90},
  create(seed) {return {...base.create(seed), ...levelField(seed,0),seed,level:0,completedKills:0,completedDestroyed:0,levelStartTick:0,launcherX:110000};},
  step(s) {
    base.step(s);
    s.launcherX = 110000;
    if (s.phase === "flight" && s.bird && (s.bird.x > 405000 || s.bird.x < 0)) {
      s.bird = null;
      s.phase = s.ammo ? "aim" : "settling";
      if (!s.ammo) s.finishAt = s.tick + 240;
    }
    s.height = s.completedKills + s.kills;
    if (s.status === "won" && s.kills === 2 && s.level < 5) {
      s.completedKills += s.kills;
      s.completedDestroyed += s.destroyed;
      s.level++;
      Object.assign(s,levelField(s.seed,s.level));
      s.levelStartTick = s.tick;
      s.kills = 0; s.destroyed = 0; s.bird = null; s.events = [];
      s.phase = "aim"; s.status = "running"; s.failure = null; s.finishAt = -1;
      if (!s.ammo) {s.status = "failed"; s.failure = "OUT_OF_SHOTS";}
    }
    s.score = s.status === "running" ? 0 : (s.completedKills + s.kills) * 500 + (s.completedDestroyed + s.destroyed) * 30 + (s.status === "won" ? s.ammo * 20 : 0);
  },
};
