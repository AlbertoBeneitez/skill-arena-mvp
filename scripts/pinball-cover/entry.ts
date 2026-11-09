// Browser entry for scripts/render-pinball-cover.mjs (v160): the V12 table drawn by the game's own renderer at a lively
// moment (ball leaving a bumper, a ramp lit, the scoop open), cropped to the 1600 × 1100 catalogue cover.
import { renderPinball } from "@/components/games/PinballVerified";
import { PINBALL_CORE_V12 as core, pinballBumpersV12 } from "@/lib/verified/pinballCore.v12";
import { stepCore } from "@/lib/verified/coreRuntime.v1";

type Cover = { cropX: number; cropY: number; cropW: number; bumper: number; age: number };
(window as unknown as { renderCover(c: Cover): Promise<string> }).renderCover = async ({ cropX, cropY, cropW, bumper, age }) => {
  const s = core.create("cover");
  s.phase = "play"; s.saveUntil = -1; s.launches = 2; s.launchTick = 0;
  s.ball = { x: 200000, y: 420000, vx: 0, vy: 0, xr: 0, yr: 0 };
  for (let i = 0; i < 40; i++) stepCore(core, s, 1e9);
  // A ball just kicked off a bumper, a ramp shot a moment ago, one drop down, multiplier ×3.
  const b = pinballBumpersV12(0)[bumper];
  s.ball = { x: b.x + 26000, y: b.y + 22000, vx: 300000, vy: 260000, xr: 0, yr: 0 };
  s.bumperFlash[bumper] = s.tick - age;
  s.rampTicks[1] = s.tick - 20; s.drops = [0, 1, 0]; s.multiplier = 3; s.rampValue = 3000; s.lanes = [1, 0, 1];
  const c = document.createElement("canvas");
  c.width = 1600; c.height = 1100;
  const ctx = c.getContext("2d")!;
  const z = 1600 / cropW;
  ctx.setTransform(z, 0, 0, z, -cropX * z, -cropY * z);
  renderPinball(ctx, s);
  await new Promise((r) => setTimeout(r, 1200)); // backdrop image
  ctx.setTransform(z, 0, 0, z, -cropX * z, -cropY * z);
  renderPinball(ctx, s);
  return c.toDataURL("image/png");
};
