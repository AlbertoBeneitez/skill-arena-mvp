import { SKY_HOP_CORE, type SkyHopState } from "./skyHopCore.v1";
/** V1 is frozen. V2 restores destroyed supports ahead of a recovery checkpoint. */
export const SKY_HOP_CORE_V2 = {
  ...SKY_HOP_CORE,
  gameVersion: "2.0.0",
  content: {
    base: SKY_HOP_CORE.content,
    recovery:
      "restore-crumble-ahead-of-checkpoint;keep-highest-score-and-collected-pickups",
  },
  step(state: SkyHopState) {
    const lives = state.lives;
    SKY_HOP_CORE.step(state);
    if (state.status === "running" && state.lives < lives) {
      for (let i = state.checkpoint + 1; i < state.brokenAt.length; i++) {
        state.brokenAt[i] = -1;
      }
    }
  },
};
