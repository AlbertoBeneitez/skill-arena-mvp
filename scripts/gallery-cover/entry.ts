// Browser entry for scripts/render-gallery-cover.mjs: plays a seeded Shot Gallery V12 run up to a moment and renders
// it with the game's own renderer (poster mode: no HUD texts), cropped to the 800 × 550 catalogue cover.
import { renderGallery, pickGallery } from "@/components/games/ShotGallery";
import { SHOT_GALLERY_CORE_V12 as core } from "@/lib/verified/shotGalleryCore.v12";
import { applyCoreInput, stepCore } from "@/lib/verified/coreRuntime.v1";

type Cover = { seed: string; trial: number; at: number; picks: number[]; misses: [number, number][]; y0: number };
(window as unknown as { renderCover(c: Cover): Promise<string> }).renderCover = async ({ seed, trial, at, picks, misses, y0 }) => {
  const H = 620, s = core.create(seed);
  const c = document.createElement("canvas");
  c.width = 800; c.height = 550;
  const ctx = c.getContext("2d")!;
  renderGallery(ctx, s, { width: 390, height: H }, true);
  await new Promise((r) => setTimeout(r, 1500)); // scene images
  for (let guard = 0; guard < 40000 && !(s.trial === trial && s.phase === "ready" && s.tick - s.readyTick === at); guard++) {
    if (s.phase === "ready" && s.trial < trial && s.tick - s.readyTick === 40)
      for (const k of s.trials[s.trial].answers) {
        const a = `PICK_${k}`, t = s.trials[s.trial].targets[k];
        if (!core.canApply(s, a)) continue;
        pickGallery({ x: t.x, y: t.y - 16 }, "down", s); applyCoreInput(core, s, a, 1e9); stepCore(core, s, 1e9);
      }
    stepCore(core, s, 1e9);
  }
  for (const [x, y] of misses) pickGallery({ x, y }, "down", s);
  for (let k = 0; k < 14; k++) stepCore(core, s, 1e9);
  picks.forEach((k, n) => {
    const t = s.trials[s.trial].targets[k], a = pickGallery({ x: t.x + 3, y: t.y - (20 * t.scaleMilli) / 1000 }, "down", s);
    if (a && core.canApply(s, a)) { applyCoreInput(core, s, a, 1e9); if (n < picks.length - 1) stepCore(core, s, 1e9); }
  });
  for (let k = 0; k < 3; k++) stepCore(core, s, 1e9);
  const z = 800 / 390;
  ctx.setTransform(z, 0, 0, z, 0, -y0 * z);
  renderGallery(ctx, s, { width: 390, height: H }, true);
  return c.toDataURL("image/png");
};
