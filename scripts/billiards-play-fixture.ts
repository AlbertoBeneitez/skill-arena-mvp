import {
  forecastBilliards,
  BILLIARDS_POCKETS,
  type BilliardsState,
} from "../lib/verified/billiardsCore.v1";
/** QA searches the actual immutable forecast; never changes rules/seed/balls. */
export function chooseBilliardsShot(state: BilliardsState) {
  let best = { aim: state.aim, power: state.power, value: -Infinity };
  for (let aim = 0; aim < 180; aim++)
    for (let power = 0; power < 3; power++) {
      const next = forecastBilliards(state, aim, power).state;
      let value =
        (next.score - state.score) * 1000 +
        (next.shotPots ? 100000 : 0) -
        (next.scratch ? 500000 : 0);
      const cue = next.balls[0];
      for (const b of next.balls.slice(1).filter((b) => !b.potted)) {
        const nearest = Math.min(
          ...BILLIARDS_POCKETS.map((p) => (b.x - p.x) ** 2 + (b.y - p.y) ** 2),
        );
        value -= Math.floor(nearest / 1000000);
      }
      if (next.lastContactTick < state.tick) value -= 100000;
      if (!cue.potted)
        value += Math.min(
          5000,
          Math.floor(
            Math.min(
              cue.x - 42000,
              348000 - cue.x,
              cue.y - 94000,
              504000 - cue.y,
            ) / 10,
          ),
        );
      if (value > best.value) best = { aim, power, value };
    }
  return best;
}
