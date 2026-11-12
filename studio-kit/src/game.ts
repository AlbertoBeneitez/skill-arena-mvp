// Pulse — the kit's example screen. It only reads the state and turns touches into actions.
import type { GameView } from "../kit/view";
import type { PulseState } from "./core";

const BAR = { x: 30, y: 300, w: 300, h: 40 };

export const view: GameView<PulseState> = {
  render(ctx, s, vp) {
    ctx.fillStyle = "#07090f";
    ctx.fillRect(0, 0, vp.width, vp.height);
    // The bar and its lit window.
    ctx.fillStyle = "#151a26";
    ctx.fillRect(BAR.x, BAR.y, BAR.w, BAR.h);
    const wx = BAR.x + ((s.target - s.half) / 1000) * BAR.w, ww = ((2 * s.half) / 1000) * BAR.w;
    ctx.fillStyle = s.pause > 0 ? "#2a3040" : "#d2df3a";
    ctx.fillRect(wx, BAR.y, ww, BAR.h);
    // The marker.
    const mx = BAR.x + (s.pos / 1000) * BAR.w;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(mx - 2, BAR.y - 12, 4, BAR.h + 24);
    // Last round's points.
    if (s.lastHit >= 0 && s.pause > 0) {
      ctx.fillStyle = s.lastHit > 0 ? "#d2df3a" : "#ff8a80";
      ctx.font = "700 32px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(s.lastHit > 0 ? `+${s.lastHit}` : "0", vp.width / 2, BAR.y - 40);
    }
  },
  pointAction(_point, phase) {
    return phase === "down" ? "TAP" : null;
  },
  keys: { " ": "TAP", Enter: "TAP" },
  scoreCells: (s) => [{ label: "Points", value: s.score }, { label: "Round", value: `${Math.min(s.round + 1, 10)}/10` }],
};
