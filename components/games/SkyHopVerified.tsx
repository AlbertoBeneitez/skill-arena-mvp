"use client";
/** Original GALACTIC GAMES presentation; MIT mechanic lineage is documented in THIRD_PARTY_NOTICES. */
import type { GameRuntimeProps } from "@/lib/games";
import {
  hopPlatformX,
  type SkyHopState,
} from "@/lib/verified/skyHopCore.v1";
import { SKY_HOP_CORE_V2 } from "@/lib/verified/skyHopCore.v2";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import CoreCanvasGame from "./CoreCanvasGame";
function render(ctx: CanvasRenderingContext2D, s: SkyHopState) {
  drawSpaceBackdrop(ctx, 390, 620, -s.camera / 1800, s.tick);
  // Distant orbital structures stay quiet behind the high-contrast landing surfaces.
  ctx.strokeStyle = "rgba(116,174,207,.11)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = ((((i * 177 - s.camera / 5000) % 760) + 760) % 760) - 70;
    ctx.strokeRect(12 + (i % 2) * 318, y, 48, 116);
    ctx.beginPath();
    ctx.moveTo(12 + (i % 2) * 318, y + 36);
    ctx.lineTo(60 + (i % 2) * 318, y + 80);
    ctx.stroke();
  }
  for (let i = 0; i < s.platforms.length; i++) {
    const p = s.platforms[i],
      y = (p.y - s.camera) / 1000;
    if (y < -30 || y > 660 || (s.brokenAt[i] >= 0 && s.tick >= s.brokenAt[i]))
      continue;
    const x = hopPlatformX(p, s.tick) / 1000,
      w = p.width / 1000;
    const color =
      p.kind === "boost"
        ? "#a999fa"
        : p.kind === "moving"
          ? "#f4c272"
          : p.kind === "crumble"
            ? "#ef94aa"
            : p.kind === "checkpoint"
              ? "#87e8c4"
              : "#7fcde5";
    ctx.save();
    if (s.brokenAt[i] >= 0)
      ctx.globalAlpha = Math.max(0.25, (s.brokenAt[i] - s.tick) / 72);
    ctx.fillStyle = "#1a3044";
    ctx.fillRect(x, y, w, 13);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, 4);
    ctx.strokeStyle = color;
    ctx.globalAlpha *= 0.5;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 12);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.fillRect(x + 5, y + 9, w - 10, 4);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    if (p.kind === "crumble") {
      for (let k = 18; k < w; k += 24) {
        ctx.beginPath();
        ctx.moveTo(x + k, y + 3);
        ctx.lineTo(x + k + 4, y + 7);
        ctx.lineTo(x + k + 1, y + 12);
        ctx.stroke();
      }
    }
    if (p.kind === "moving") {
      ctx.font = "bold 13px system-ui";
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.fillText("↔", x + w / 2, y + 22);
    }
    if (p.kind === "boost") {
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.moveTo(x + w / 2 - 7, y + 11 - k * 6);
        ctx.lineTo(x + w / 2, y + 6 - k * 6);
        ctx.lineTo(x + w / 2 + 7, y + 11 - k * 6);
        ctx.stroke();
      }
    }
    if (p.kind === "checkpoint") {
      ctx.fillStyle = color;
      ctx.font = "bold 10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(
        i === 0 ? "DESPEGUE" : i === 75 ? "META" : `BALIZA ${i}`,
        x + w / 2,
        y + 26,
      );
    }
    if (p.pickup && !s.collected[i]) {
      ctx.fillStyle = "#b4f2d2";
      ctx.beginPath();
      ctx.arc(x + w / 2, y - 23, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#183d39";
      ctx.fillRect(x + w / 2 - 1, y - 28, 2, 10);
      ctx.fillRect(x + w / 2 - 5, y - 24, 10, 2);
    }
    const age = s.tick - s.lastLandingTick;
    if (i === s.lastLandingIndex && age >= 0 && age < 24) {
      ctx.strokeStyle = `rgba(221,249,255,${1 - age / 24})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(
        x - age * 0.35,
        y - age * 0.12,
        w + age * 0.7,
        14 + age * 0.24,
      );
    }
    ctx.restore();
  }
  const py = (s.y - s.camera) / 1000;
  ctx.save();
  ctx.translate(s.x / 1000, py);
  ctx.rotate(s.vx / 10000);
  if (s.tick < s.respawnUntil && s.tick % 12 < 6) ctx.globalAlpha = 0.5;
  if (s.vy < 0) {
    ctx.fillStyle = "rgba(115,201,248,.3)";
    ctx.beginPath();
    ctx.moveTo(-7, 13);
    ctx.lineTo(0, 31 + (s.tick % 7));
    ctx.lineTo(7, 13);
    ctx.fill();
  }
  ctx.fillStyle = "#edf4fd";
  ctx.beginPath();
  ctx.moveTo(0, -19);
  ctx.lineTo(16, 12);
  ctx.lineTo(8, 16);
  ctx.lineTo(-8, 16);
  ctx.lineTo(-16, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#62bdd7";
  ctx.beginPath();
  ctx.ellipse(0, -1, 6, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#223951";
  ctx.fillRect(-8, 11, 16, 4);
  ctx.restore();
  ctx.textAlign = "center";
  ctx.font = "12px system-ui";
  ctx.fillStyle = "#dceaf7";
  const hit = s.tick - s.lastDamageTick;
  if (hit >= 0 && hit < 60) {
    ctx.fillStyle = `rgba(219,88,119,${0.15 * (1 - hit / 60)})`;
    ctx.fillRect(0, 0, 390, 620);
  }
}
const hudLabel = (s: Readonly<SkyHopState>) =>
  `ALTURA ${s.highest}/75`;
const keys = {
  ArrowLeft: "LEFT_DOWN",
  ArrowRight: "RIGHT_DOWN",
  a: "LEFT_DOWN",
  d: "RIGHT_DOWN",
} as const;
const keyUp = {
  ArrowLeft: "LEFT_UP",
  ArrowRight: "RIGHT_UP",
  a: "LEFT_UP",
  d: "RIGHT_UP",
} as const;
const controls = [
  {
    action: "LEFT_DOWN",
    releaseAction: "LEFT_UP",
    label: "Dirigir izquierda",
    symbol: "←",
  },
  {
    action: "RIGHT_DOWN",
    releaseAction: "RIGHT_UP",
    label: "Dirigir derecha",
    symbol: "→",
  },
] as const;
export default function SkyHopVerified(props: GameRuntimeProps) {
  return (
    <div className="skyHopVerified">
      <CoreCanvasGame
        {...props}
        core={SKY_HOP_CORE_V2}
        name="Sky Hop"
        render={render}
        hudLabel={hudLabel}
        keys={keys}
        keyReleases={keyUp}
        controls={controls}
        instruction="Mantén ← → para dirigir · rebote automático"
      />
    </div>
  );
}
