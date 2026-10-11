import {
  BIRDS_CORE as core,
  birdsVelocity,
  type BirdsState,
} from "../lib/verified/galacticBirdsCore.v1";
import {
  birdsAimAction,
  birdsPowerAction,
} from "../lib/verified/galacticBirdsProtocol.v1";
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
export function birdsTrial(s: BirdsState, aim: number, power: number) {
  const trial: BirdsState = JSON.parse(JSON.stringify(s));
  for (const a of [birdsAimAction(aim), birdsPowerAction(power), "SHOOT"]) {
    if (!applyCoreInput(core, trial, a, 1e9))
      throw new Error(`pilot input ${a}`);
    stepCore(core, trial, 1e9);
  }
  while (trial.status === "running" && trial.phase !== "aim")
    stepCore(core, trial, 1e9);
  return trial;
}
export function chooseBirdsShot(s: BirdsState) {
  const enemy = s.enemies.find((e) => e.alive);
  if (!enemy) return { aim: 30, power: 6 };
  const candidates: { aim: number; power: number; cost: number }[] = [];
  for (let aim = 0; aim <= 60; aim += 2)
    for (let power = 0; power <= 12; power++) {
      const v = birdsVelocity(aim, power);
      let x = s.launcherX,
        y = 520000,
        vy = v.vy,
        best = Infinity;
      for (let t = 0; t < 600; t++) {
        vy += 16;
        x += v.vx;
        y += vy;
        if (y > 570000 || x > enemy.x + 100000) break;
        const d = (x - enemy.x) ** 2 + (y - enemy.y) ** 2;
        best = Math.min(best, d);
      }
      candidates.push({ aim, power, cost: best });
    }
  candidates.sort(
    (a, b) => a.cost - b.cost || b.power - a.power || a.aim - b.aim,
  );
  let choice = candidates[0],
    best = -Infinity;
  const before = s.bodies.reduce((v, b) => v + (b.alive ? b.hp : 0), 0);
  for (const c of candidates.slice(0, 16)) {
    const trial = birdsTrial(s, c.aim, c.power),
      damage =
        before - trial.bodies.reduce((v, b) => v + (b.alive ? b.hp : 0), 0),
      value =
        (trial.kills - s.kills) * 100000 +
        (trial.destroyed - s.destroyed) * 1000 +
        damage * 10 -
        (trial.tick - s.tick) * 0.1;
    if (value > best) {
      best = value;
      choice = c;
    }
  }
  return { aim: choice.aim, power: choice.power };
}
export function playBirds(seed: string) {
  const s = core.create(seed),
    inputs: ReplayInput[] = [];
  while (s.status === "running") {
    if (s.phase !== "aim") {
      stepCore(core, s, 1e9);
      continue;
    }
    const shot = chooseBirdsShot(s);
    for (const action of [
      birdsAimAction(shot.aim),
      birdsPowerAction(shot.power),
      "SHOOT",
    ]) {
      if (s.status !== "running") break;
      inputs.push({ seq: inputs.length, tick: s.tick, action });
      if (!applyCoreInput(core, s, action, 1e9))
        throw new Error(`invalid ${action}`);
      stepCore(core, s, 1e9);
    }
  }
  return { s, inputs };
}
