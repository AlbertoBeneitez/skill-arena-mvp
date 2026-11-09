// Browser entry for scripts/render-slot-cover.mjs (v156): the Slot V4 machine at the moment three sevens land on the
// payline, drawn by the game's own renderer (the same 7s the player sees), cropped to the 1600 × 1100 cover.
import { renderSlot } from "@/components/games/GalacticSlot";
import { SLOT_CORE_V4 as core, SLOT_RULES_V4 } from "@/lib/verified/galacticSlotCore.v4";

type Cover = { seed: string; H: number; since: number; cropW: number; dy: number };
(window as unknown as { renderCover(c: Cover): Promise<string> }).renderCover = async ({ seed, H, since, cropW, dy }) => {
  const s = core.create(seed);
  // Three sevens on the line (symbol 7), the machine settled and paying the jackpot.
  s.positions = s.strips.map((strip) => strip.indexOf(7));
  s.from = [...s.positions]; s.destinations = [...s.positions]; s.settlingAt = -1;
  s.tick = 2400; s.spins = 7; s.steps = [2, 1, 3];
  s.lastSettledTick = s.tick - since; s.lastPayout = SLOT_RULES_V4.triple[7] * SLOT_RULES_V4.costMinor;
  const c = document.createElement("canvas");
  c.width = 1600; c.height = 1100;
  const ctx = c.getContext("2d")!;
  renderSlot(ctx, s, { width: 390, height: H });
  await new Promise((r) => setTimeout(r, 1200)); // backdrop image
  // The payline sits at the cabinet's centre; frame the crop on it.
  const tableH = 10 + s.strips[0].length * 22, payTop = 56 + tableH + 6, top = payTop + 74 + 18;
  const height = Math.max(150, H - top - 12 - 42), center = top + height / 2;
  const z = 1600 / cropW, cropH = 1100 / z;
  ctx.setTransform(z, 0, 0, z, -(195 - cropW / 2) * z, -(center - cropH / 2 + dy) * z);
  renderSlot(ctx, s, { width: 390, height: H }, true);
  return c.toDataURL("image/png");
};
