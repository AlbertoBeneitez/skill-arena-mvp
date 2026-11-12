// npm run preview — play your game in the browser at the logical size, with the same tick loop the app uses.
import { core } from "../src/core";
import { view } from "../src/game";

const canvas = document.querySelector("canvas")!;
const ctx = canvas.getContext("2d")!;
const scale = Math.min(innerWidth / core.width, innerHeight / core.height) * devicePixelRatio;
canvas.width = core.width * scale; canvas.height = core.height * scale;
canvas.style.width = `${canvas.width / devicePixelRatio}px`;
let state = core.create(String(Date.now())); // the preview may use the clock; the core never does
const t0 = performance.now();
const act = (a: string | null) => { if (a && core.canApply(state, a)) core.apply(state, a); };
const point = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * core.width, y: ((e.clientY - r.top) / r.height) * core.height }; };
canvas.addEventListener("pointerdown", (e) => act(view.pointAction?.(point(e), "down", state) ?? null));
canvas.addEventListener("pointermove", (e) => act(view.pointAction?.(point(e), "move", state) ?? null));
canvas.addEventListener("pointerup", (e) => act(view.pointAction?.(point(e), "up", state) ?? null));
addEventListener("keydown", (e) => { if (e.key === "r") { state = core.create(String(Date.now())); return; } act(view.keys?.[e.key] ?? null); });
const out = document.querySelector("output")!;
const frame = () => {
  const target = Math.floor(((performance.now() - t0) / 1000) * core.tickRate);
  while (state.status === "running" && state.tick < Math.min(target, core.maxFinalTick)) core.step(state);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  view.render(ctx, state, { width: core.width, height: core.height });
  out.textContent = `${(view.scoreCells?.(state) ?? [{ label: "Score", value: state.score }]).map((c) => `${c.label} ${c.value}`).join(" · ")} · ${state.status}  (R: new match)`;
  requestAnimationFrame(frame);
};
frame();
