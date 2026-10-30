"use client";
import { useCallback, useEffect, useRef } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import {
  DARTS_CORE_V3,
  DARTS_RULES_V3,
  dartsStageV3,
  type DartsStateV3,
} from "@/lib/verified/dartsCore.v3";
import { DARTS_SECTORS } from "@/lib/verified/dartsCore.v1";
import {
  dartPerspectiveFlight,
  dartPerspectivePose,
} from "@/lib/dartsFlightPerspective";
import { drawDart } from "@/lib/dartsPresentation";
import { dartsAimAction } from "@/lib/verified/dartsProtocol.v1";
import { dartsFlickAimV4, type DartsGestureSample } from "@/lib/verified/dartsGesture.v4";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
import { t, formatNumber, useI18n } from "@/lib/i18n";
const cx = 195,
  cy = 285;
// Visual zoom only (outer ring 161 * 1.15 = 185 of 195 half-width); aim input
// uses the inverse, so authoritative coordinates are unchanged.
const BOARD_ZOOM = 1.15;
/** Dart held under the finger while aiming (presentation only). */
const held = { active: false, x: 0, y: 0, trail: [] as { x: number; y: number }[] };
/**
 * v123 · Tournament arena (presentation only; the V3 scoring geometry is untouched): a dark hall under a lighting truss,
 * two spotlights crossing on the board with dust in the beams, crowd lights out of focus, the board in a black
 * surround with a chrome number ring, classic tournament colours on sisal, a silver spider, an LED halo, the oche
 * glowing on the floor, and a flash + shockwave on every impact (stronger on bull, treble and double).
 * The static board is cached in an offscreen canvas once.
 */
const BOARD_CLASSIC = { dark: "#16161b", light: "#ece2c6", red: "#c8202f", green: "#14915a" };
let boardCache: HTMLCanvasElement | null = null;
const BOARD_PX = 2, BOARD_R = 160; // cached at 2× around the board centre (logical radius incl. surround)
function boardSprite() {
  if (boardCache || typeof document === "undefined") return boardCache;
  const c = document.createElement("canvas");
  c.width = c.height = BOARD_R * 2 * BOARD_PX;
  const g = c.getContext("2d");
  if (!g) return null;
  g.scale(BOARD_PX, BOARD_PX);
  g.translate(BOARD_R, BOARD_R);
  // Surround: black rubber disc with a brushed rim.
  const sur = g.createRadialGradient(-40, -50, 20, 0, 0, BOARD_R);
  sur.addColorStop(0, "#2a2a31"); sur.addColorStop(1, "#060609");
  g.fillStyle = sur; g.beginPath(); g.arc(0, 0, BOARD_R - 1, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#8d96a6"; g.lineWidth = 2; g.stroke();
  g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, BOARD_R - 4, Math.PI * 1.05, Math.PI * 1.7); g.stroke();
  const seg = (r1: number, r2: number, a: number, b: number, color: string) => {
    g.fillStyle = color; g.beginPath(); g.arc(0, 0, r2, a, b); g.arc(0, 0, r1, b, a, true); g.closePath(); g.fill();
  };
  for (let i = 0; i < 20; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 10 - Math.PI / 20, b = a + Math.PI / 10, even = i % 2 === 0;
    seg(24, 140, a, b, even ? BOARD_CLASSIC.dark : BOARD_CLASSIC.light);
    seg(78, 88, a, b, even ? BOARD_CLASSIC.red : BOARD_CLASSIC.green);
    seg(129, 140, a, b, even ? BOARD_CLASSIC.red : BOARD_CLASSIC.green);
  }
  g.fillStyle = BOARD_CLASSIC.green; g.beginPath(); g.arc(0, 0, 24, 0, Math.PI * 2); g.fill();
  g.fillStyle = BOARD_CLASSIC.red; g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.fill();
  // Sisal: fine deterministic fibres.
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let k = 0; k < 2600; k++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 140;
    g.fillStyle = rnd() < 0.5 ? "rgba(0,0,0,.16)" : "rgba(255,255,255,.07)";
    g.fillRect(Math.cos(a) * r, Math.sin(a) * r, 0.9, 0.9);
  }
  // Silver spider: radial wires and ring wires.
  g.strokeStyle = "rgba(214,222,232,.85)"; g.lineWidth = 0.7;
  for (let i = 0; i < 20; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 10 - Math.PI / 20;
    g.beginPath(); g.moveTo(Math.cos(a) * 24, Math.sin(a) * 24); g.lineTo(Math.cos(a) * 140, Math.sin(a) * 140); g.stroke();
  }
  for (const r of [10, 24, 78, 88, 129, 140]) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
  // Chrome number ring.
  g.textAlign = "center"; g.textBaseline = "middle"; g.font = "900 12px system-ui, sans-serif";
  for (let i = 0; i < 20; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 10, x = Math.cos(angle) * 150, y = Math.sin(angle) * 150;
    const chrome = g.createLinearGradient(x, y - 7, x, y + 7);
    chrome.addColorStop(0, "#ffffff"); chrome.addColorStop(0.5, "#c9d1dc"); chrome.addColorStop(1, "#8a94a3");
    g.fillStyle = chrome; g.fillText(String(DARTS_SECTORS[i]), x, y + 0.5);
  }
  // Key light from the upper left, falloff to the lower right.
  const light = g.createRadialGradient(-60, -70, 10, 0, 0, 175);
  light.addColorStop(0, "rgba(255,246,226,.16)"); light.addColorStop(0.55, "rgba(0,0,0,0)"); light.addColorStop(1, "rgba(0,0,0,.42)");
  g.fillStyle = light; g.beginPath(); g.arc(0, 0, BOARD_R, 0, Math.PI * 2); g.fill();
  boardCache = c;
  return c;
}
function drawArena(ctx: CanvasRenderingContext2D, viewH: number, tick: number) {
  drawSpaceBackdrop(ctx, 390, viewH, 0, tick);
  // Indoor hall over the space backdrop.
  const hall = ctx.createLinearGradient(0, 0, 0, viewH);
  hall.addColorStop(0, "rgba(6,8,18,.78)"); hall.addColorStop(0.5, "rgba(8,10,24,.7)"); hall.addColorStop(1, "rgba(3,4,10,.9)");
  ctx.fillStyle = hall; ctx.fillRect(0, 0, 390, viewH);
  // Crowd lights out of focus (behind the board, both sides and above).
  for (let k = 0; k < 34; k++) {
    const x = (k * 97.3) % 390, y = 40 + ((k * 53.7) % 150) + (k % 3) * 120;
    const tw = 0.5 + 0.5 * Math.sin(tick * 0.03 + k * 1.7), col = k % 4 === 0 ? "255,190,110" : k % 4 === 1 ? "127,227,238" : k % 4 === 2 ? "255,110,160" : "200,210,255";
    const r = 6 + (k % 5) * 3;
    const bo = ctx.createRadialGradient(x, y, 0, x, y, r);
    bo.addColorStop(0, `rgba(${col},${0.26 + 0.16 * tw})`); bo.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = bo; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // Lighting truss across the top with three lamps.
  ctx.fillStyle = "#151924"; ctx.fillRect(0, 4, 390, 10);
  ctx.strokeStyle = "rgba(150,165,190,.35)"; ctx.lineWidth = 1;
  for (let x = 0; x < 390; x += 14) { ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x + 7, 14); ctx.lineTo(x + 14, 4); ctx.stroke(); }
  // Spotlight cones crossing on the board, with a slow breath and dust motes.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [lx, side] of [[48, 1], [342, -1]] as const) {
    const breath = 0.85 + 0.15 * Math.sin(tick * 0.02 + side);
    const cone = ctx.createLinearGradient(lx, 14, cx, cy + 40);
    cone.addColorStop(0, `rgba(255,244,220,${0.32 * breath})`); cone.addColorStop(1, "rgba(255,244,220,0)");
    ctx.fillStyle = cone;
    ctx.beginPath(); ctx.moveTo(lx - 8, 14); ctx.lineTo(lx + 8, 14); ctx.lineTo(cx + side * -40 + 150 * side, cy + 160); ctx.lineTo(cx + side * -40 - 120 * side, cy + 190); ctx.closePath(); ctx.fill();
  }
  for (let k = 0; k < 26; k++) {
    const t0 = (tick * (0.15 + (k % 5) * 0.04) + k * 37) % 300;
    const x = 70 + ((k * 61) % 250) + Math.sin((tick + k * 40) * 0.01) * 10, y = 30 + t0;
    ctx.fillStyle = `rgba(255,246,226,${0.25 * (1 - t0 / 300)})`; ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.restore();
  for (const lx of [48, 195, 342]) {
    ctx.fillStyle = "#262c3a"; ctx.fillRect(lx - 10, 10, 20, 12);
    const lamp = ctx.createRadialGradient(lx, 22, 0, lx, 22, 16);
    lamp.addColorStop(0, "rgba(255,248,230,.95)"); lamp.addColorStop(1, "rgba(255,248,230,0)");
    ctx.fillStyle = lamp; ctx.beginPath(); ctx.arc(lx, 22, 16, 0, Math.PI * 2); ctx.fill();
  }
  // Coloured washes on the back wall, low on both sides (stage lighting).
  for (const [x0, col] of [[0, "255,70,150"], [390, "60,200,230"]] as const) {
    const wash = ctx.createRadialGradient(x0, viewH * 0.62, 0, x0, viewH * 0.62, 260);
    wash.addColorStop(0, `rgba(${col},.22)`); wash.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = wash; ctx.fillRect(0, 0, 390, viewH);
  }
  // Floor and the oche (throw line) near the bottom.
  const floorY = viewH - 150;
  const fl = ctx.createLinearGradient(0, floorY, 0, viewH);
  fl.addColorStop(0, "rgba(20,24,40,0)"); fl.addColorStop(0.3, "rgba(22,26,44,.85)"); fl.addColorStop(1, "rgba(10,12,22,.95)");
  ctx.fillStyle = fl; ctx.fillRect(0, floorY, 390, viewH - floorY);
  ctx.strokeStyle = "rgba(127,227,238,.06)"; ctx.lineWidth = 1;
  for (let k = -8; k <= 8; k++) { ctx.beginPath(); ctx.moveTo(195 + k * 18, floorY + 30); ctx.lineTo(195 + k * 60, viewH); ctx.stroke(); }
  const ocheY = viewH - 48;
  const oche = ctx.createLinearGradient(40, 0, 350, 0);
  oche.addColorStop(0, "rgba(255,210,122,0)"); oche.addColorStop(0.5, "rgba(255,210,122,.75)"); oche.addColorStop(1, "rgba(255,210,122,0)");
  ctx.fillStyle = oche; ctx.fillRect(40, ocheY, 310, 3);
}
function render(ctx: CanvasRenderingContext2D, s: DartsStateV3, view?: { width: number; height: number }) {
  const viewH = Math.max(620, view?.height ?? 620);
  drawArena(ctx, viewH, s.tick);
  // Enlarged dartboard and embedded impacts; keep the V3 scoring geometry.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(BOARD_ZOOM, BOARD_ZOOM);
  ctx.translate(-cx, -cy);
  const stage = dartsStageV3(s),
    remaining = Math.max(
      0,
      DARTS_RULES_V3.deadlineSeconds[stage] - s.phaseTicks / 120,
    );
  // Board shadow on the wall and the LED halo around the surround.
  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.beginPath(); ctx.ellipse(cx + 7, cy + 11, 166, 166, 0, 0, Math.PI * 2); ctx.fill();
  const halo = 0.6 + 0.4 * Math.sin(s.tick * 0.025);
  const ring = ctx.createRadialGradient(cx, cy, 156, cx, cy, 180);
  ring.addColorStop(0, `rgba(127,227,238,${0.55 * halo})`); ring.addColorStop(0.35, `rgba(127,227,238,${0.18 * halo})`); ring.addColorStop(1, "rgba(127,227,238,0)");
  ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(cx, cy, 180, 0, Math.PI * 2); ctx.fill();
  const sprite = boardSprite();
  if (sprite) ctx.drawImage(sprite, cx - BOARD_R, cy - BOARD_R, BOARD_R * 2, BOARD_R * 2);
  ctx.strokeStyle = `rgba(160,240,248,${0.5 + 0.3 * halo})`; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, BOARD_R + 1, 0, Math.PI * 2); ctx.stroke();
  // Impact flash and shockwave (stronger on bull, treble and double).
  {
    const hitNow = s.impacts.at(-1);
    const age = s.phase === "flight" ? s.phaseTicks - DARTS_RULES_V3.impactTicks : 999;
    if (hitNow && !hitNow.timeout && age >= 0 && age < 50) {
      const hx = cx + hitNow.x / 1000, hy = cy + hitNow.y / 1000, r = Math.hypot(hitNow.x, hitNow.y) / 1000;
      const big = r <= 24 || (r >= 78 && r <= 88) || (r >= 129 && r <= 140);
      const k = age / 50, col = big ? "255,214,110" : "190,248,255";
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const fl = ctx.createRadialGradient(hx, hy, 0, hx, hy, (big ? 46 : 26) * (0.6 + k));
      fl.addColorStop(0, `rgba(${col},${(big ? 0.9 : 0.6) * (1 - k)})`); fl.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = fl; ctx.beginPath(); ctx.arc(hx, hy, (big ? 46 : 26) * (0.6 + k), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(${col},${0.8 * (1 - k)})`; ctx.lineWidth = big ? 2.5 : 1.5;
      ctx.beginPath(); ctx.arc(hx, hy, 6 + k * (big ? 60 : 34), 0, Math.PI * 2); ctx.stroke();
      if (big) for (let q = 0; q < 10; q++) {
        const a = q * 0.628 + 0.3, d0 = 6 + k * 18, d1 = d0 + 10 + k * 26;
        ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * d0, hy + Math.sin(a) * d0); ctx.lineTo(hx + Math.cos(a) * d1, hy + Math.sin(a) * d1); ctx.stroke();
      }
      ctx.restore();
    }
  }

  // The tip stays at the server-owned impact. Never display the newest
  // recorded impact before the flying dart has actually reached the board.
  for (let i = 0; i < s.impacts.length; i++) {
    const hit = s.impacts[i];
    const flying = i === s.impacts.length - 1 && s.phase === "flight";
    if (hit.timeout || (flying && s.phaseTicks < DARTS_RULES_V3.impactTicks)) continue;
    const pose = dartPerspectiveFlight(cx + hit.x / 1000, cy + hit.y / 1000, DARTS_RULES_V3.impactTicks);
    drawDart(ctx, { ...pose, scale: 0.52 }, i % 2 ? "#dfb885" : "#6bdde2");
  }
  const pose = (s.phase === "flight" && s.phaseTicks >= DARTS_RULES_V3.impactTicks) || (s.phase === "aim" && held.active)
    ? null : dartPerspectivePose(s);
  if (pose) {
    const impact = s.impacts.at(-1);
    if (s.phase === "flight" && s.phaseTicks < 120 && impact) {
      ctx.strokeStyle = "rgba(184,246,255,.42)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (
        let age = Math.max(0, s.phaseTicks - 6);
        age <= s.phaseTicks;
        age += 2
      ) {
        const p = dartPerspectiveFlight(
          cx + impact.x / 1000,
          cy + impact.y / 1000,
          age,
        );
        if (age === Math.max(0, s.phaseTicks - 6)) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    drawDart(ctx, pose);
  }
  ctx.restore();
  if (s.phase === "aim" && held.active) {
    // The dart sits in the fingers: a short motion trail and the dart tilted along the movement.
    const tr = held.trail, a = tr.length > 2 ? tr[tr.length - 3] : tr[0];
    for (let i = 1; i < tr.length; i++) {
      ctx.strokeStyle = `rgba(142,233,214,${(i / tr.length) * 0.5})`; ctx.lineWidth = 2 + 6 * (i / tr.length);
      ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y - 30); ctx.lineTo(tr[i].x, tr[i].y - 30); ctx.stroke();
    }
    const tilt = a ? Math.max(-0.6, Math.min(0.6, (held.x - a.x) / 40)) : 0;
    drawDart(ctx, { x: held.x, y: held.y - 30, angle: tilt, scale: 1.35 });
  }
  const hit = s.impacts.at(-1);
  if (hit && s.phase === "flight" && s.phaseTicks >= DARTS_RULES_V3.impactTicks) {
    ctx.fillStyle = hit.points ? "#a1eed3" : "#e6b597";
    ctx.textAlign = "center";
    ctx.font = "900 32px system-ui";
    ctx.fillText(`+${hit.points}`, cx, 500);
  }
  ctx.fillStyle = "#b4d3df";
  ctx.textAlign = "center";
  ctx.font = "bold 13px system-ui";
  const left = Math.max(0, 20 - s.impacts.length);
  ctx.fillText(t("darts.left", { n: left }), cx, 61);
  // Fila de dardos restantes (themed counter) at the bottom of the screen.
  const rowY = viewH - 26;
  for (let i = 0; i < 20; i++) {
    const dx = 195 + (i - 9.5) * 16;
    ctx.fillStyle = i < left ? "#8ee9d6" : "rgba(120,150,170,.25)";
    ctx.beginPath();
    ctx.moveTo(dx, rowY - 9);
    ctx.lineTo(dx + 4, rowY + 7);
    ctx.lineTo(dx - 4, rowY + 7);
    ctx.closePath();
    ctx.fill();
  }
  if (s.phase === "aim") {
    // Handle for the throw swipe: pulsing ring + chevrons in the lower thumb zone.
    const pulse = 0.5 + 0.5 * Math.sin(s.tick / 14);
    const hy = viewH - 92;
    ctx.strokeStyle = `rgba(142,233,214,${0.25 + pulse * 0.35})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(195, hy, 26 + pulse * 6, 0, Math.PI * 2);
    ctx.stroke();
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = `rgba(142,233,214,${0.2 + ((pulse + k / 3) % 1) * 0.6})`;
      ctx.beginPath();
      ctx.moveTo(183, hy - 4 - k * 9);
      ctx.lineTo(195, hy - 12 - k * 9);
      ctx.lineTo(207, hy - 4 - k * 9);
      ctx.stroke();
    }
  }
  ctx.fillStyle = "#294257";
  ctx.beginPath();
  ctx.roundRect(105, 85, 180, 4, 2);
  ctx.fill();
  ctx.fillStyle = remaining < 3 ? "#e7b488" : "#81d6b7";
  ctx.beginPath();
  ctx.roundRect(
    105,
    85,
    180 *
      (s.phase === "aim"
        ? remaining / DARTS_RULES_V3.deadlineSeconds[stage]
        : 1),
    4,
    2,
  );
  ctx.fill();
  ctx.textAlign = "left";
}
const tones = { THROW: "tap" } as const,
  keys = { " ": "THROW", Enter: "THROW" };
const feedbackScore = (s: Readonly<DartsStateV3>) => s.total;
const hudLabel = (s: Readonly<DartsStateV3>) => t("play.points", { n: formatNumber(s.total) });
export default function Darts(props: GameRuntimeProps) {
  useI18n();
  // Grab-and-throw: touching anywhere picks the dart up (it follows the finger); the flick itself — direction and
  // speed at release — decides where it lands (dartsFlickAimV4). A slow or downward release puts it back.
  const pathRef = useRef<DartsGestureSample[] | null>(null);
  useEffect(() => {
    pathRef.current = null;
    held.active = false;
    return () => {
      pathRef.current = null;
      held.active = false;
    };
  }, [props.active, props.seed]);
  const aim = useCallback(
    (point: CorePoint, phase: "down" | "move" | "up", state: DartsStateV3) => {
      if (state.phase !== "aim") {
        pathRef.current = null;
        held.active = false;
        return null;
      }
      const now = typeof performance === "undefined" ? 0 : performance.now();
      if (phase === "down") {
        pathRef.current = [{ x: point.x, y: point.y, t: now }];
        held.active = true; held.x = point.x; held.y = point.y; held.trail = [{ x: point.x, y: point.y }];
        return null;
      }
      const path = pathRef.current;
      if (!path) return null;
      path.push({ x: point.x, y: point.y, t: now });
      held.x = point.x; held.y = point.y; held.trail.push({ x: point.x, y: point.y }); if (held.trail.length > 12) held.trail.shift();
      if (phase === "move") return null;
      pathRef.current = null;
      held.active = false;
      const flick = dartsFlickAimV4(path);
      if (!flick) return null;
      const out: string[] = [];
      if (flick.x !== state.aimX) out.push(dartsAimAction("X", flick.x));
      if (flick.y !== state.aimY) out.push(dartsAimAction("Y", flick.y));
      out.push("THROW");
      return out;
    },
    [],
  );
  return (
    <div className="dartsVerified">
      <CoreCanvasGame
        {...props}
        core={DARTS_CORE_V3}
        name="Dardos"
        render={render}
        pointAction={aim}
        controls={[]}
        inputTones={tones}
        keys={keys}
        hideHudScore
        expandVerticalViewport
        hudLabel={hudLabel}
        feedbackScore={feedbackScore}
        instruction=""
      />
    </div>
  );
}
