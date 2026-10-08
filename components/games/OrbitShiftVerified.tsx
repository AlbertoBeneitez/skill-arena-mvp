"use client";
import type { GameRuntimeProps } from "@/lib/games";
import {
  ORBIT_CORE,
  ORBIT_RADII,
  type OrbitState,
} from "@/lib/verified/orbitShiftCore.v1";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import CoreCanvasGame from "./CoreCanvasGame";
const CX = 195,
  CY = 310,
  TAU = Math.PI * 2;
function render(ctx: CanvasRenderingContext2D, s: OrbitState) {
  drawSpaceBackdrop(ctx, 390, 620, s.tick * 0.02, s.tick);
  const reactor = ctx.createRadialGradient(CX - 8, CY - 12, 4, CX, CY, 58);
  reactor.addColorStop(0, "#32466d");
  reactor.addColorStop(1, "#111d35");
  ctx.fillStyle = reactor;
  ctx.beginPath();
  ctx.arc(CX, CY, 49, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(136,191,225,.22)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12 + s.tick * 0.0005;
    ctx.beginPath();
    ctx.moveTo(CX + Math.cos(a) * 51, CY + Math.sin(a) * 51);
    ctx.lineTo(CX + Math.cos(a) * 184, CY + Math.sin(a) * 184);
    ctx.stroke();
  }
  ORBIT_RADII.forEach((r, i) => {
    ctx.strokeStyle =
      i === s.lane ? "rgba(128,214,239,.7)" : "rgba(113,148,184,.28)";
    ctx.lineWidth = i === s.lane ? 3 : 1;
    ctx.beginPath();
    ctx.arc(CX, CY, r / 1000, 0, TAU);
    ctx.stroke();
  });
  for (const gate of s.gates.slice(s.passed, s.passed + 8)) {
    const delta = gate.angle - s.progress;
    if (delta < 0 || delta > 65536) continue;
    const a = -Math.PI / 2 + (delta / 65536) * TAU,
      alpha = Math.max(0.25, 1 - delta / 65536);
    for (const lane of gate.lanes) {
      ctx.strokeStyle = `rgba(243,127,147,${alpha})`;
      ctx.lineWidth = gate.index === s.passed ? 14 : 10;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(CX, CY, ORBIT_RADII[lane] / 1000, a - 0.11, a + 0.11);
      ctx.stroke();
      if (gate.index === s.passed && delta < 9000) {
        ctx.strokeStyle = "#f3d392";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(CX, CY, ORBIT_RADII[lane] / 1000, a - 0.17, a + 0.17);
        ctx.stroke();
      }
    }
    if (gate.pickup !== null) {
      const r = ORBIT_RADII[gate.pickup] / 1000,
        x = CX + Math.cos(a) * r,
        y = CY + Math.sin(a) * r;
      ctx.fillStyle = "#91e3b6";
      ctx.fillRect(x - 5, y - 5, 10, 10);
      ctx.strokeStyle = "#daf5df";
      ctx.strokeRect(x - 7, y - 7, 14, 14);
    }
  }
  const py = CY - s.radius / 1000;
  ctx.strokeStyle = "rgba(130,224,242,.27)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(CX, CY, s.radius / 1000, -Math.PI / 2 + 0.04, -Math.PI / 2 + 0.32);
  ctx.stroke();
  ctx.fillStyle = "#9debf4";
  ctx.beginPath();
  ctx.arc(CX, py, 10, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#e5fbff";
  ctx.beginPath();
  ctx.arc(CX - 2, py - 3, 3, 0, TAU);
  ctx.fill();
  if (s.tick < s.protectedUntil) {
    ctx.strokeStyle = "#f4dca2";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CX, py, 15, 0, TAU);
    ctx.stroke();
  }
  const hit = s.tick - s.lastImpactTick;
  if (hit >= 0 && hit < 45) {
    ctx.fillStyle = `rgba(223,85,121,${0.2 * (1 - hit / 45)})`;
    ctx.fillRect(0, 0, 390, 620);
  }
  const collected = s.tick - s.lastPickupTick;
  if (collected >= 0 && collected < 40) {
    ctx.strokeStyle = `rgba(154,249,190,${1 - collected / 40})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CX, py, 17 + collected, 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = "#c7dfef";
  ctx.textAlign = "center";
  ctx.font = "13px system-ui";
  ctx.fillText(
    s.passed < 8
      ? "Interior acerca · exterior aleja · evita los arcos rosas"
      : "Anticipa el siguiente arco · verde recarga escudos",
    195,
    82,
  );
}
const keys = {
  ArrowDown: "IN",
  ArrowLeft: "IN",
  ArrowUp: "OUT",
  ArrowRight: "OUT",
} as const;
const controls = [
  { action: "IN", label: "Órbita interior", symbol: "− INTERIOR" },
  { action: "OUT", label: "Órbita exterior", symbol: "+ EXTERIOR" },
] as const;
const hudLabel = (s: Readonly<OrbitState>) =>
  `${s.passed}/60 · SECTOR ${Math.min(3, 1 + Math.floor(s.passed / 20))} · ÓRBITA ${s.lane + 1}`;
const gestureAction = (
  from: { x: number; y: number },
  to: { x: number; y: number },
) => (Math.abs(to.y - from.y) > 20 ? (to.y < from.y ? "OUT" : "IN") : null);
const failureFinale = {
  durationMs: 300,
  render: (ctx: CanvasRenderingContext2D, s: OrbitState, ms: number) => {
    render(ctx, s);
    ctx.strokeStyle = `rgba(250,184,134,${1 - ms / 300})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(195, 310 - s.radius / 1000, 10 + ms * 0.16, 0, TAU);
    ctx.stroke();
  },
};
export default function OrbitShiftVerified(props: GameRuntimeProps) {
  return (
    <div className="orbitShiftVerified">
      <CoreCanvasGame
        {...props}
        core={ORBIT_CORE}
        name="Orbit Shift"
        render={render}
        hudLabel={hudLabel}
        keys={keys}
        controls={controls}
        gestureAction={gestureAction}
        failureFinale={failureFinale}
        instruction="− cambia al interior · + al exterior · evita arcos rosas"
      />
    </div>
  );
}
