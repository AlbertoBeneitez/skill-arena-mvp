import {
  ALIEN_DASH_CORE as core,
  type AlienState,
} from "../lib/verified/alienDashCore.v2";
/** Reads the current deterministic state, with no alternative collision engine. */
export function chooseAlienAction(s: AlienState): string | null {
  const speed = s.speed / 120,
    standingTop = s.feet - 46000 + 4000;
  const bolt = s.bolts.find(
    (b) =>
      !b.spent &&
      (b.x - s.scroll - 108000) / (speed + 2600) <= 21 &&
      (b.x - s.scroll - 108000) / (speed + 2600) >= -2,
  );
  if (bolt && core.canApply(s, "JUMP")) return "JUMP";
  const solid = s.actors.find(
    (a) =>
      !a.passed &&
      !a.collided &&
      (a.kind === "rock" || a.kind === "platform") &&
      (a.x - s.scroll - 108000) / speed <= 30 &&
      (a.x - s.scroll - 108000) / speed >= -2 &&
      s.feet > a.bottom - a.height,
  );
  if (solid && core.canApply(s, "JUMP")) return "JUMP";
  const drone = s.actors.find(
    (a) =>
      a.kind === "drone" &&
      !a.passed &&
      a.bottom > standingTop &&
      a.x - s.scroll + a.width > 78000 &&
      a.x - s.scroll - 108000 < speed * 22,
  );
  if (drone && !s.ducking) return "DUCK_DOWN";
  if (!drone && s.ducking) return "DUCK_UP";
  return null;
}
