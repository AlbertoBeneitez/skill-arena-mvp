"use client";
import { useMemo } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import {
  BILLIARDS_CORE,
  BILLIARDS_POCKETS,
  BILLIARDS_RULES,
  forecastBilliards,
  type BilliardsState,
} from "@/lib/verified/billiardsCore.v1";
import { billiardsAimAction } from "@/lib/verified/billiardsProtocol.v1";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
function renderer() {
  let cacheKey = "",
    path: { x: number; y: number }[] = [];
  return (ctx: CanvasRenderingContext2D, s: BilliardsState) => {
    drawSpaceBackdrop(ctx, 390, 620, 0, s.tick);
    ctx.fillStyle = "#091724";
    ctx.beginPath();
    ctx.roundRect(24, 76, 342, 447, 26);
    ctx.fill();
    ctx.shadowColor = "rgba(69,210,195,.2)";
    ctx.shadowBlur = 12;
    ctx.strokeStyle = "#52768c";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.shadowBlur = 0;
    const cloth = ctx.createLinearGradient(42, 94, 348, 504);
    cloth.addColorStop(0, "#134953");
    cloth.addColorStop(0.5, "#123745");
    cloth.addColorStop(1, "#102d3d");
    ctx.fillStyle = cloth;
    ctx.fillRect(42, 94, 306, 410);
    ctx.strokeStyle = "rgba(132,208,215,.1)";
    ctx.lineWidth = 1;
    for (let x = 62; x < 348; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 94);
      ctx.lineTo(x, 504);
      ctx.stroke();
    }
    for (let y = 118; y < 504; y += 24) {
      ctx.beginPath();
      ctx.moveTo(42, y);
      ctx.lineTo(348, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "#60acb5";
    ctx.lineWidth = 3;
    ctx.strokeRect(42, 94, 306, 410);
    for (const p of BILLIARDS_POCKETS) {
      ctx.fillStyle = "#030b14";
      ctx.beginPath();
      ctx.arc(p.x / 1000, p.y / 1000, 21, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#7395a6";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = "#55d9c7";
      ctx.beginPath();
      ctx.arc(p.x / 1000, p.y / 1000, 15, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const b of s.bumpers) {
      ctx.fillStyle = "#182231";
      ctx.beginPath();
      ctx.arc(b.x / 1000, b.y / 1000, b.radius / 1000, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#dfa06e";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#e8b986";
      ctx.fillRect(b.x / 1000 - 4, b.y / 1000 - 1, 8, 2);
    }
    if (s.phase === "aim") {
      const key = [
        s.stage,
        s.aim,
        s.power,
        ...s.balls.flatMap((b) => [b.x, b.y, +b.potted]),
      ].join(":");
      if (key !== cacheKey) {
        cacheKey = key;
        path = forecastBilliards(s, s.aim, s.power, 320).path;
      }
      ctx.strokeStyle = "rgba(220,254,248,.65)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(s.balls[0].x / 1000, s.balls[0].y / 1000);
      for (const p of path) ctx.lineTo(p.x / 1000, p.y / 1000);
      ctx.stroke();
      ctx.setLineDash([]);
      if (path.length) {
        const p = path.at(-1)!;
        ctx.strokeStyle = "rgba(220,254,248,.4)";
        ctx.beginPath();
        ctx.arc(p.x / 1000, p.y / 1000, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    for (const b of s.balls) {
      if (b.potted) continue;
      const x = b.x / 1000,
        y = b.y / 1000;
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.beginPath();
      ctx.ellipse(x + 3, y + 5, 10, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      const colors = ["#eaf8ff", "#72e4d1", "#ffc777", "#bda4f7", "#8fc9ff"],
        c = colors[b.id % 5];
      const g = ctx.createRadialGradient(x - 4, y - 4, 1, x, y, 10);
      g.addColorStop(0, "#fff");
      g.addColorStop(0.25, c);
      g.addColorStop(1, b.id ? "#294553" : "#8da7b7");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      if (b.id) {
        ctx.fillStyle = "#112535";
        ctx.textAlign = "center";
        ctx.font = "bold 10px system-ui";
        ctx.fillText(String(b.id), x, y + 3);
      }
    }
    if (s.tick - s.lastPotTick < 70) {
      const age = (s.tick - s.lastPotTick) / 70;
      ctx.strokeStyle = `rgba(142,255,210,${1 - age})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(
        s.lastPotX / 1000,
        s.lastPotY / 1000,
        12 + age * 32,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    ctx.textAlign = "center";
    ctx.font = "bold 13px system-ui";
    ctx.fillStyle = "#d4ebf4";
    ctx.fillText(`MESA ${s.stage + 1} / 5`, 195, 60);
    ctx.textAlign = "left";
    ctx.font = "bold 12px system-ui";
    ctx.fillStyle = "#aacecf";
    ctx.fillText(`${s.shotsLeft} TIROS`, 46, 546);
    ctx.textAlign = "right";
    ctx.fillText(
      `${s.balls.slice(1).filter((b) => !b.potted).length} BOLAS`,
      344,
      546,
    );
    ctx.textAlign = "center";
    ctx.fillStyle = "#d1e5e9";
    ctx.font = "12px system-ui";
    ctx.fillText(
      s.phase === "moving"
        ? s.scratch
          ? "BLANCA EMBOCADA · −250"
          : "TIRO EN CURSO"
        : s.phase === "settle"
          ? "MESA DESPEJADA"
          : "",
      195,
      579,
    );
    if (s.phase === "aim") {
      ctx.font = "bold 10px system-ui";
      ctx.fillStyle = "#7de4cc";
      ctx.fillText(
        `POTENCIA ${["SUAVE", "MEDIA", "FUERTE"][s.power]}`,
        195,
        600,
      );
    }
    ctx.textAlign = "left";
  };
}
function aim(
  point: CorePoint,
  phase: "down" | "move" | "up",
  s: BilliardsState,
) {
  if (phase === "up" || s.phase !== "aim") return null;
  const cue = s.balls[0],
    dx = point.x - cue.x / 1000,
    dy = point.y - cue.y / 1000;
  if (dx * dx + dy * dy < 100) return null;
  const a = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
  return billiardsAimAction(Math.round((a * 180) / (Math.PI * 2)) % 180);
}
const controls = [
  { action: "POWER_LOW", label: "Potencia suave", symbol: "SUAVE" },
  { action: "POWER_MEDIUM", label: "Potencia media", symbol: "MEDIA" },
  { action: "POWER_HIGH", label: "Potencia fuerte", symbol: "FUERTE" },
  { action: "SHOOT", label: "Tirar bola", symbol: "TIRAR" },
];
const tones = { SHOOT: "tap" } as const;
const keys = {
  " ": "SHOOT",
  Enter: "SHOOT",
  "1": "POWER_LOW",
  "2": "POWER_MEDIUM",
  "3": "POWER_HIGH",
};
export default function Billiards(props: GameRuntimeProps) {
  const render = useMemo(renderer, []);
  return (
    <div className="billiardsVerified">
      <CoreCanvasGame
        {...props}
        core={BILLIARDS_CORE}
        name="Billar"
        render={render}
        pointAction={aim}
        controls={controls}
        keys={keys}
        inputTones={tones}
        instruction="Apunta tocando la mesa. Potencia y TIRAR. Emboca las de color; evita la blanca."
        hideHudLabel
      />
    </div>
  );
}
