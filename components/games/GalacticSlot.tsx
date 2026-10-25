"use client";
import type { GameRuntimeProps } from "@/lib/games";
import {
  SLOT_RULES,
  type SlotState,
} from "@/lib/verified/galacticSlotCore.v1";
import { SLOT_CORE_V3 } from "@/lib/verified/galacticSlotCore.v3";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import { slotVisibleSteps, slotReelPosition } from "@/lib/slotPresentation.v2";
import CoreCanvasGame from "./CoreCanvasGame";
import { t, formatNumber, useI18n } from "@/lib/i18n";
/*
 * Presentation only: a lit arcade cabinet. Reads the authoritative state (strips, positions, steps, payouts) and
 * never writes it; every animation is a pure function of the tick.
 */
const colors = ["#f7d75f", "#ff934d", "#fa526e", "#f4cb87", "#ffd84a", "#a4a6fa", "#5ff0ff", "#ff4a5f"];
const marks = ["", "", "", "", "★", "BAR", "◆", "7"];
const GOLD = "#ffd36a";
const hash01 = (n: number) => { const q = Math.sin(n * 12.9898) * 43758.5453; return q - Math.floor(q); };

function symbol(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, size: number, glow = false) {
  ctx.save();
  ctx.translate(x, y);
  if (glow) { ctx.shadowColor = colors[id]; ctx.shadowBlur = size * 0.45; }
  if (id < 3) {
    // Fruits: lemon, orange, cherries — shaded with a highlight and a leaf.
    const g = ctx.createRadialGradient(-size * 0.12, -size * 0.12, size * 0.04, 0, 0, size * 0.42);
    g.addColorStop(0, "#fffbe8"); g.addColorStop(0.35, colors[id]); g.addColorStop(1, id === 2 ? "#8c1028" : id === 1 ? "#b5480f" : "#b38a12");
    ctx.fillStyle = g;
    ctx.beginPath();
    if (id === 2) {
      ctx.arc(-size * 0.2, size * 0.08, size * 0.21, 0, Math.PI * 2);
      ctx.moveTo(size * 0.42, size * 0.12);
      ctx.arc(size * 0.21, size * 0.12, size * 0.21, 0, Math.PI * 2);
    } else ctx.ellipse(0, 0, size * 0.34, size * (id === 0 ? 0.25 : 0.34), id === 0 ? -0.4 : 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#3f8a4a"; ctx.lineWidth = Math.max(1, size * 0.05);
    ctx.beginPath();
    if (id === 2) { ctx.moveTo(-size * 0.2, -size * 0.1); ctx.quadraticCurveTo(-size * 0.05, -size * 0.5, size * 0.08, -size * 0.42); ctx.moveTo(size * 0.21, -size * 0.06); ctx.quadraticCurveTo(size * 0.15, -size * 0.36, size * 0.08, -size * 0.42); }
    else { ctx.moveTo(0, -size * 0.3); ctx.lineTo(size * 0.02, -size * 0.42); }
    ctx.stroke();
    ctx.fillStyle = "#6fd27f";
    ctx.beginPath(); ctx.ellipse(size * 0.14, -size * 0.42, size * 0.13, size * 0.06, -0.5, 0, Math.PI * 2); ctx.fill();
  } else if (id === 3) {
    // Bell.
    const g = ctx.createLinearGradient(-size * 0.3, 0, size * 0.3, 0);
    g.addColorStop(0, "#b98a3a"); g.addColorStop(0.45, "#ffe9b0"); g.addColorStop(1, "#a0702a");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-size * 0.34, size * 0.22);
    ctx.quadraticCurveTo(-size * 0.24, size * 0.1, -size * 0.22, -size * 0.14);
    ctx.quadraticCurveTo(0, -size * 0.52, size * 0.22, -size * 0.14);
    ctx.quadraticCurveTo(size * 0.24, size * 0.1, size * 0.34, size * 0.22);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#8a5a1a"; ctx.beginPath(); ctx.arc(0, size * 0.29, size * 0.08, 0, Math.PI * 2); ctx.fill();
  } else if (id === 5) {
    // BAR plate.
    ctx.fillStyle = "#1a1440"; ctx.strokeStyle = colors[5]; ctx.lineWidth = Math.max(1, size * 0.05);
    ctx.beginPath(); ctx.roundRect(-size * 0.42, -size * 0.2, size * 0.84, size * 0.4, size * 0.08); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#e8e9ff"; ctx.font = `900 ${size * 0.3}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("BAR", 0, size * 0.02);
  } else if (id === 6) {
    // Faceted gem.
    const r = size * 0.36;
    ctx.fillStyle = "#1fb6d6";
    ctx.beginPath(); ctx.moveTo(-r, -r * 0.3); ctx.lineTo(-r * 0.5, -r * 0.75); ctx.lineTo(r * 0.5, -r * 0.75); ctx.lineTo(r, -r * 0.3); ctx.lineTo(0, r); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#a8f7ff"; ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.75); ctx.lineTo(0, -r * 0.3); ctx.lineTo(r * 0.5, -r * 0.75); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#5fe3f7"; ctx.beginPath(); ctx.moveTo(-r, -r * 0.3); ctx.lineTo(0, -r * 0.3); ctx.lineTo(0, r); ctx.closePath(); ctx.fill();
  } else {
    // Star and 7: big glyphs with a gradient and a dark outline.
    ctx.font = `900 ${id === 7 ? size * 0.8 : size * 0.74}px system-ui`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const g = ctx.createLinearGradient(0, -size * 0.35, 0, size * 0.35);
    if (id === 7) { g.addColorStop(0, "#ffd0d6"); g.addColorStop(0.45, "#ff3b52"); g.addColorStop(1, "#8c0a1e"); }
    else { g.addColorStop(0, "#fff6c2"); g.addColorStop(0.5, "#ffd23f"); g.addColorStop(1, "#d48a0a"); }
    ctx.lineWidth = Math.max(1.5, size * 0.07); ctx.strokeStyle = "#2a0a12"; ctx.strokeText(marks[id], 0, size * 0.03);
    ctx.fillStyle = g; ctx.fillText(marks[id], 0, size * 0.03);
  }
  ctx.restore();
}

/** Ring of marquee bulbs around a rectangle; chase pattern, or all flashing on a win. */
function bulbs(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, gap: number, tick: number, win: boolean) {
  const pts: [number, number][] = [];
  for (let k = 0; k <= w; k += gap) { pts.push([x + k, y]); }
  for (let k = gap; k <= h; k += gap) { pts.push([x + w, y + k]); }
  for (let k = w - gap; k >= 0; k -= gap) { pts.push([x + k, y + h]); }
  for (let k = h - gap; k > 0; k -= gap) { pts.push([x, y + k]); }
  const chase = Math.floor(tick / 6);
  pts.forEach(([px, py], i) => {
    const on = win ? Math.floor(tick / 8) % 2 === i % 2 : (i + chase) % 4 === 0;
    ctx.fillStyle = on ? (win ? "#fff3b0" : GOLD) : "rgba(255,211,106,.22)";
    if (on) { ctx.shadowColor = GOLD; ctx.shadowBlur = 8; }
    ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  });
}

function render(ctx: CanvasRenderingContext2D, s: SlotState) {
  drawSpaceBackdrop(ctx, 390, 620, 2, s.tick);
  const since = s.tick - s.lastSettledTick, win = since < 150 && s.lastPayout > 0, spinning = s.settlingAt !== -1;
  const big = win && s.lastPayout >= 8 * SLOT_RULES.costMinor;
  // Marquee title.
  ctx.save();
  const mq = ctx.createLinearGradient(0, 6, 0, 52);
  mq.addColorStop(0, "#3a0d4f"); mq.addColorStop(1, "#14062a");
  ctx.fillStyle = mq; ctx.beginPath(); ctx.roundRect(30, 6, 330, 44, 22); ctx.fill();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.stroke();
  bulbs(ctx, 48, 6, 294, 44, 21, s.tick, win);
  ctx.font = "900 22px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const tg = ctx.createLinearGradient(0, 18, 0, 40);
  tg.addColorStop(0, "#fff6c2"); tg.addColorStop(0.5, "#ffd23f"); tg.addColorStop(1, "#ff7a3d");
  ctx.shadowColor = "#ff3d9a"; ctx.shadowBlur = win ? 18 : 10;
  ctx.fillStyle = tg; ctx.fillText("GALACTIC SLOT", 195, 29);
  ctx.restore();
  // The three reel tables (seeded per match). The highlighted row is where each reel sits right now.
  ctx.fillStyle = "rgba(10,8,34,.86)";
  ctx.beginPath(); ctx.roundRect(20, 58, 350, 130, 14); ctx.fill();
  ctx.strokeStyle = "rgba(164,166,250,.35)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let i = 0; i < 3; i++) {
    const x = 85 + i * 110;
    ctx.fillStyle = "#b9a8ff"; ctx.font = "800 9px system-ui";
    ctx.fillText(t("slot.reel", { n: i + 1 }), x, 68);
    for (let j = 0; j < 8; j++) {
      const y = 80 + j * 13.5;
      if (s.positions[i] === j) {
        ctx.fillStyle = "rgba(255,211,106,.22)"; ctx.strokeStyle = "rgba(255,211,106,.8)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(x - 40, y - 6.5, 80, 13, 6); ctx.fill(); ctx.stroke();
      }
      symbol(ctx, s.strips[i][j], x, y, 14);
    }
  }
  // Pay table: eight chips plus the pair / seven lines.
  for (let id = 0; id < 8; id++) {
    const x = 20 + (id % 4) * 88, y = 194 + Math.floor(id / 4) * 26;
    ctx.fillStyle = "rgba(10,8,34,.78)"; ctx.beginPath(); ctx.roundRect(x, y, 84, 22, 11); ctx.fill();
    ctx.strokeStyle = id === 7 ? "rgba(255,74,95,.6)" : "rgba(255,211,106,.25)"; ctx.lineWidth = 1; ctx.stroke();
    symbol(ctx, id, x + 15, y + 11, 18);
    ctx.fillStyle = "#f5ecff"; ctx.textAlign = "left"; ctx.font = "800 11px system-ui";
    ctx.fillText(`×3`, x + 29, y + 11.5);
    ctx.fillStyle = GOLD; ctx.textAlign = "right";
    ctx.fillText(String(SLOT_RULES.tripleMultipliers[id] * 5), x + 76, y + 11.5);
  }
  ctx.textAlign = "center";
  for (const [x, label, amount] of [[107, t("slot.pair"), "10"], [283, t("slot.sevenNoPair"), "5"]] as const) {
    ctx.fillStyle = "#c9bff0"; ctx.font = "600 10px system-ui"; ctx.fillText(label, x - 12, 255);
    ctx.fillStyle = GOLD; ctx.font = "800 10px system-ui"; ctx.fillText(amount, x + 36, 255);
  }
  // Cabinet with chrome-gold frame and a ring of bulbs.
  const top = 270, height = 176, center = top + height / 2, pitch = 74, size = 60;
  const frame = ctx.createLinearGradient(0, top - 12, 0, top + height + 12);
  frame.addColorStop(0, "#fff0b8"); frame.addColorStop(0.25, "#c9902e"); frame.addColorStop(0.5, "#ffe08a"); frame.addColorStop(0.8, "#8a5a14"); frame.addColorStop(1, "#e8b85a");
  ctx.fillStyle = frame; ctx.beginPath(); ctx.roundRect(12, top - 12, 366, height + 24, 26); ctx.fill();
  ctx.fillStyle = "#2a0f3e"; ctx.beginPath(); ctx.roundRect(20, top - 4, 350, height + 8, 20); ctx.fill();
  bulbs(ctx, 28, top + 2, 334, height - 4, 23, s.tick + 3, win);
  for (let i = 0; i < 3; i++) {
    const x = 85 + i * 110, rx = x - 46, ry = top + 14, rw = 92, rh = height - 28;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(rx, ry, rw, rh, 12); ctx.clip();
    // Drum: bright in the middle, dark at the top and bottom edges.
    const drum = ctx.createLinearGradient(0, ry, 0, ry + rh);
    drum.addColorStop(0, "#5a5f7a"); drum.addColorStop(0.22, "#e9ecf7"); drum.addColorStop(0.5, "#ffffff"); drum.addColorStop(0.78, "#e9ecf7"); drum.addColorStop(1, "#5a5f7a");
    ctx.fillStyle = drum; ctx.fillRect(rx, ry, rw, rh);
    const p = slotReelPosition(s, i), index = Math.floor(p), fraction = p - index;
    const moving = spinning && Math.abs(p - Math.round(p)) > 0.02;
    for (let k = -1; k <= 2; k++) {
      const yy = center + (k - fraction) * pitch, id = s.strips[i][(((index + k) % 8) + 8) % 8];
      const onLine = Math.abs(yy - center) < 6 && !spinning;
      ctx.save();
      // Motion blur: squash vertically and ghost while spinning fast.
      if (moving) { ctx.globalAlpha = 0.75; ctx.translate(x, yy); ctx.scale(1, 1.18); ctx.translate(-x, -yy); }
      symbol(ctx, id, x, yy, size, onLine && win);
      ctx.restore();
    }
    const shade = ctx.createLinearGradient(0, ry, 0, ry + rh);
    shade.addColorStop(0, "rgba(10,4,30,.65)"); shade.addColorStop(0.28, "rgba(10,4,30,0)"); shade.addColorStop(0.72, "rgba(10,4,30,0)"); shade.addColorStop(1, "rgba(10,4,30,.65)");
    ctx.fillStyle = shade; ctx.fillRect(rx, ry, rw, rh);
    ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(rx + 6, ry, 8, rh);
    ctx.restore();
    ctx.strokeStyle = "#c9902e"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(rx, ry, rw, rh, 12); ctx.stroke();
    // Step counter as an LED pill.
    const label = String(slotVisibleSteps(s.steps[i]));
    ctx.fillStyle = "#08051a"; ctx.beginPath(); ctx.roundRect(x - 26, top + height + 18, 52, 26, 13); ctx.fill();
    ctx.strokeStyle = s.steps[i] === 0 ? "rgba(255,74,95,.8)" : "rgba(95,240,255,.6)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = s.steps[i] === 0 ? "#ff8a96" : "#9ff6ff"; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
    ctx.font = "900 15px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(label, x, top + height + 31.5);
    ctx.shadowBlur = 0;
  }
  // Payline: a laser across the middle with arrow tips.
  ctx.save();
  ctx.strokeStyle = win ? "#fff3b0" : "rgba(255,59,82,.85)"; ctx.lineWidth = win ? 3 : 2;
  ctx.shadowColor = win ? GOLD : "#ff3b52"; ctx.shadowBlur = win ? 16 : 8;
  ctx.beginPath(); ctx.moveTo(36, center); ctx.lineTo(354, center); ctx.stroke();
  ctx.fillStyle = ctx.strokeStyle;
  for (const [xx, d] of [[30, 1], [360, -1]] as const) { ctx.beginPath(); ctx.moveTo(xx, center - 8); ctx.lineTo(xx + 10 * d, center); ctx.lineTo(xx, center + 8); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  // Win: coin shower from the cabinet and a big glowing amount.
  if (win) {
    const n = big ? 60 : 26;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (hash01(i + s.spins * 7) - 0.5) * 2.4, sp = 2.4 + hash01(i * 3 + 1) * 3.2;
      const cx = 195 + Math.cos(a) * sp * since, cy = center + Math.sin(a) * sp * since + 0.05 * since * since;
      if (cy > 640) continue;
      const spin = Math.abs(Math.cos(since * 0.2 + i));
      ctx.fillStyle = "#ffd23f"; ctx.strokeStyle = "#a8680a"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(cx, cy, 6 * spin + 1, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    const pop = since < 20 ? 0.6 + 0.4 * Math.sin((since / 20) * Math.PI * 0.5) + 0.15 * Math.sin((since / 20) * Math.PI) : 1 + 0.03 * Math.sin(since * 0.15);
    ctx.save();
    ctx.translate(195, top - 32); ctx.scale(pop, pop);
    ctx.font = `900 ${big ? 26 : 22}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const label = t("slot.won", { n: formatNumber(s.lastPayout / 100) });
    ctx.fillStyle = "rgba(20,6,42,.85)"; const w = ctx.measureText(label).width + 36;
    ctx.beginPath(); ctx.roundRect(-w / 2, -18, w, 36, 18); ctx.fill();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.stroke();
    const g = ctx.createLinearGradient(0, -12, 0, 12);
    g.addColorStop(0, "#fff6c2"); g.addColorStop(0.5, "#ffd23f"); g.addColorStop(1, "#ff7a3d");
    ctx.fillStyle = g; ctx.shadowColor = "#ffb000"; ctx.shadowBlur = 14;
    ctx.fillText(label, 0, 1);
    ctx.restore();
  }
}
const hudLabel = (s: Readonly<SlotState>) =>
  `${t("slot.hud", { chips: formatNumber(s.balanceMinor / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), secs: formatNumber(Math.max(0, 21600 - s.tick) / 120, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}${s.steps.every(step => step === 0) ? ` · ${t("slot.hudNoZero")}` : ""}`;
const feedbackScore = (s: Readonly<SlotState>) => s.balanceMinor;
export default function GalacticSlot(props: GameRuntimeProps) {
  useI18n();
  return (
    <div className="slotVerified">
      <CoreCanvasGame
        {...props}
        core={SLOT_CORE_V3}
        name="Galactic Slot"
        instruction=""
        render={render}
        hideHudScore
        hudLabel={hudLabel}
        feedbackScore={feedbackScore}
        keys={{ " ": "SPIN" }}
        controls={[
          {
            action: "REEL_0_LESS",
            label: t("slot.less", { n: 1 }),
            symbol: "−",
          },
          {
            action: "REEL_0_MORE",
            label: t("slot.more", { n: 1 }),
            symbol: "+",
          },
          {
            action: "REEL_1_LESS",
            label: t("slot.less", { n: 2 }),
            symbol: "−",
          },
          {
            action: "REEL_1_MORE",
            label: t("slot.more", { n: 2 }),
            symbol: "+",
          },
          {
            action: "REEL_2_LESS",
            label: t("slot.less", { n: 3 }),
            symbol: "−",
          },
          {
            action: "REEL_2_MORE",
            label: t("slot.more", { n: 3 }),
            symbol: "+",
          },
          {
            action: "SPIN",
            label: t("slot.spinAria"),
            symbol: t("slot.spin"),
          },
        ]}
      />
    </div>
  );
}
