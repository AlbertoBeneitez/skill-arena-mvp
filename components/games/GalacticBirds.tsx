"use client";
import { useRef, useEffect, useCallback } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import {
  BIRDS_CORE,
  BIRDS_RULES,
  type BirdKind,
  type BirdsState,
} from "@/lib/verified/galacticBirdsCore.v3";
import {
  birdsAimAction,
  birdsPowerAction,
} from "@/lib/verified/galacticBirdsProtocol.v1";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import { BIRDS_SCENE_LIFT, drawSpacePig } from "@/lib/birdsPresentation";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
const hudLabel = (s: Readonly<BirdsState>) =>
  `${s.kills}/${s.enemies.length} CERDOS · ${s.ammo} TIROS`;
const feedbackScore = (s: Readonly<BirdsState>) => s.kills * 10 + s.destroyed;
const inputTones = { SHOOT: "tap" } as const;
const materials = {
  glass: { fill: "rgba(124,225,249,.48)", edge: "#91d8e7" },
  ceramic: { fill: "#637aa1", edge: "#b3bbd7" },
  alloy: { fill: "#364a60", edge: "#8facca" },
};
function falcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  kind: BirdKind = "scout",
  thumbnail = false,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (thumbnail) ctx.scale(0.65, 0.65);
  ctx.fillStyle = "#d79d6f";
  ctx.beginPath();
  ctx.moveTo(-10, -4);
  ctx.lineTo(-25, -12);
  ctx.lineTo(-20, 0);
  ctx.lineTo(-25, 11);
  ctx.lineTo(-10, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle =
    kind === "dart" ? "#6fcbd6" : kind === "meteor" ? "#ce9b73" : "#739aae";
  ctx.strokeStyle = "#bddeeb";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(
    0,
    0,
    kind === "meteor" ? 18 : kind === "dart" ? 9 : 12,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#132f48";
  ctx.beginPath();
  ctx.ellipse(3, -2, 8, 6, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#edbf7a";
  ctx.beginPath();
  ctx.moveTo(11, -2);
  ctx.lineTo(20, 2);
  ctx.lineTo(11, 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#dcecf5";
  ctx.beginPath();
  ctx.arc(5, -4, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
export default function GalacticBirds(props: GameRuntimeProps) {
  const drag = useRef<{ from: CorePoint; to: CorePoint } | null>(null),
    launcher = useRef<CorePoint>({ x: 110, y: 520 - BIRDS_SCENE_LIFT });
  useEffect(() => {
    drag.current = null;
    const clear = () => {
      drag.current = null;
    };
    window.addEventListener("blur", clear);
    window.addEventListener("pointercancel", clear);
    window.addEventListener("lostpointercapture", clear);
    window.addEventListener("orientationchange", clear);
    return () => {
      window.removeEventListener("blur", clear);
      window.removeEventListener("pointercancel", clear);
      window.removeEventListener("lostpointercapture", clear);
      window.removeEventListener("orientationchange", clear);
      drag.current = null;
    };
  }, [props.active]);
  const render = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      s: BirdsState,
      viewport: { width: number; height: number },
    ) => {
      const width = viewport.width,
        camera = Math.max(
          0,
          Math.min(1600000 - width * 1000, (s.bird?.x ?? s.launcherX) - 110000),
        ),
        worldX = (x: number) => (x - camera) / 1000;
      launcher.current = { x: worldX(s.launcherX), y: 520 - BIRDS_SCENE_LIFT };
      drawSpaceBackdrop(ctx, width, 620, 2, s.tick);
      ctx.fillStyle = "rgba(15,35,51,.94)";
      ctx.fillRect(0, 560 - BIRDS_SCENE_LIFT, width, 60 + BIRDS_SCENE_LIFT);
      ctx.strokeStyle = "#71919f";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 560 - BIRDS_SCENE_LIFT);
      ctx.lineTo(width, 560 - BIRDS_SCENE_LIFT);
      ctx.stroke();
      ctx.strokeStyle = "rgba(104,164,187,.2)";
      ctx.lineWidth = 1;
      for (let x = -((camera / 1000) % 70); x < width; x += 70) {
        ctx.beginPath();
        ctx.moveTo(x, 562 - BIRDS_SCENE_LIFT);
        ctx.lineTo(x + 35, 620);
        ctx.stroke();
      }
      for (const b of s.bodies) {
        if (!b.alive) continue;
        const x = worldX(b.x),
          y = b.y / 1000 - BIRDS_SCENE_LIFT,
          w = b.w / 1000,
          h = b.h / 1000;
        if (x + w / 2 < 0 || x - w / 2 > width) continue;
        const c = materials[b.material];
        ctx.fillStyle = "rgba(0,3,15,.25)";
        ctx.fillRect(x - w / 2 + 4, y - h / 2 + 5, w, h);
        ctx.fillStyle = c.fill;
        ctx.strokeStyle = c.edge;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x - w / 2, y - h / 2, w, h, 3);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = b.hp < b.maxHp ? "#faad9b" : "rgba(225,240,255,.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (h > w) {
          for (let brace = -h / 2 + 6; brace < h / 2 - 6; brace += 22) {
            const bottom = Math.min(h / 2 - 6, brace + 22);
            ctx.moveTo(x - w / 3, y + brace);
            ctx.lineTo(x + w / 3, y + bottom);
            ctx.moveTo(x + w / 3, y + brace);
            ctx.lineTo(x - w / 3, y + bottom);
          }
        } else {
          ctx.moveTo(x - w / 2 + 6, y);
          ctx.lineTo(x + w / 2 - 6, y);
        }
        ctx.stroke();
        ctx.fillStyle = c.edge;
        for (const sign of [-1, 1])
          ctx.fillRect(x + sign * (w / 2 - 4) - 1, y - h / 2 + 3, 2, 2);
      }
      for (const e of s.enemies) {
        if (!e.alive) continue;
        const x = worldX(e.x),
          y = e.y / 1000 - BIRDS_SCENE_LIFT;
        if (x < -25 || x > width + 25) continue;
        drawSpacePig(ctx, x, y);
      }
      const lx = launcher.current.x;
      ctx.fillStyle = "#294c60";
      ctx.strokeStyle = "#87bcc4";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(lx - 27, 548 - BIRDS_SCENE_LIFT, 54, 12, 4);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(lx, 548 - BIRDS_SCENE_LIFT);
      ctx.lineTo(lx, 535 - BIRDS_SCENE_LIFT);
      ctx.moveTo(lx, 535 - BIRDS_SCENE_LIFT);
      ctx.lineTo(lx - 14, 512 - BIRDS_SCENE_LIFT);
      ctx.moveTo(lx, 535 - BIRDS_SCENE_LIFT);
      ctx.lineTo(lx + 14, 512 - BIRDS_SCENE_LIFT);
      ctx.stroke();
      const pulled = s.phase === "aim" ? drag.current : null,
        px = pulled ? lx + pulled.to.x - pulled.from.x : lx,
        py =
          (pulled ? 520 + pulled.to.y - pulled.from.y : 520) - BIRDS_SCENE_LIFT;
      if (s.phase === "aim") {
        ctx.strokeStyle = "#d6c28c";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(lx - 14, 512 - BIRDS_SCENE_LIFT);
        ctx.lineTo(px, py);
        ctx.lineTo(lx + 14, 512 - BIRDS_SCENE_LIFT);
        ctx.stroke();
        falcon(ctx, px, py, (-(10 + s.aim) * Math.PI) / 180, s.queue[s.shots]);
      }
      if (s.bird) {
        const b = s.bird,
          x = worldX(b.x),
          y = b.y / 1000 - BIRDS_SCENE_LIFT;
        ctx.strokeStyle = "rgba(148,210,231,.28)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - (b.vx / 1000) * 8, y - (b.vy / 1000) * 8);
        ctx.lineTo(x, y);
        ctx.stroke();
        falcon(ctx, x, y, Math.atan2(b.vy, b.vx), b.kind);
      }
      for (const e of s.events) {
        const age = s.tick - e.tick;
        if (age > 100) continue;
        const p = age / 100,
          x = worldX(e.x),
          y = e.y / 1000 - BIRDS_SCENE_LIFT;
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle =
          e.kind === "enemy" ? "#f0bfc2" : materials[e.kind].edge;
        ctx.lineWidth = 2 * (1 - p) + 0.5;
        ctx.beginPath();
        ctx.arc(x, y, 8 + 30 * p, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4 + e.x * 0.00001,
            r = 10 + p * (e.kind === "enemy" ? 55 : 40);
          ctx.fillRect(
            x + Math.cos(a) * r - 2,
            y + Math.sin(a) * r + p * p * 20 - 2,
            4,
            4,
          );
        }
        ctx.globalAlpha = 1;
      }
      // Radar shows the actual complete demolition field, never a predicted shot.
      const mapLeft = 18,
        mapTop = 74,
        mapWidth = width - 36,
        mapHeight = 78,
        mapScale = mapWidth / 1600;
      ctx.fillStyle = "rgba(5,16,30,.84)";
      ctx.strokeStyle = "#537488";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(mapLeft, mapTop, mapWidth, mapHeight, 9);
      ctx.fill();
      ctx.stroke();
      for (const body of s.bodies) {
        if (!body.alive) continue;
        ctx.fillStyle =
          body.material === "glass"
            ? "#69b9c8"
            : body.material === "ceramic"
              ? "#8d9abf"
              : "#65829a";
        ctx.fillRect(
          mapLeft + ((body.x - body.w / 2) / 1000) * mapScale,
          mapTop +
            mapHeight -
            8 -
            ((560000 - body.y + body.h / 2) / 1000) * 0.2,
          Math.max(2, (body.w / 1000) * mapScale),
          (body.h / 1000) * 0.2,
        );
      }
      for (const enemy of s.enemies) {
        if (!enemy.alive) continue;
        ctx.fillStyle = "#f0b3bd";
        ctx.beginPath();
        ctx.arc(
          mapLeft + (enemy.x / 1000) * mapScale,
          mapTop + mapHeight - 8 - ((560000 - enemy.y) / 1000) * 0.2,
          3,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.strokeStyle = "#deca94";
      ctx.strokeRect(
        mapLeft + (camera / 1000) * mapScale,
        mapTop + 4,
        Math.min(mapWidth, width * mapScale),
        mapHeight - 8,
      );
      const names = { scout: "EXPLORADOR", dart: "RÁPIDO", meteor: "PESADO" };
      for (const [i, kind] of (
        ["scout", "dart", "meteor"] as const
      ).entries()) {
        const count = s.queue.slice(s.shots).filter((k) => k === kind).length;
        const x = ((i + 0.5) * width) / 3;
        const next = s.queue[s.shots] === kind && s.phase === "aim";
        ctx.fillStyle = next ? "rgba(56,84,96,.8)" : "rgba(12,30,48,.7)";
        ctx.beginPath();
        ctx.roundRect(x - width / 6 + 8, 564, width / 3 - 16, 54, 8);
        ctx.fill();
        falcon(ctx, x - 18, 580, 0, kind, true);
        ctx.fillStyle = count ? "#ecdfb4" : "#71899b";
        ctx.textAlign = "center";
        ctx.font = "700 17px system-ui";
        ctx.fillText(`×${count}`, x + 18, 586);
        ctx.fillStyle = "#e1edf2";
        ctx.font = `bold ${Math.min(18, (14 * width) / 390)}px system-ui`;
        ctx.fillText(names[kind], x, 614);
      }
      // One field's persistent targets, not level/sector indicators.
      for (let i = 0; i < s.enemies.length; i++) {
        const x = width / 2 - 77 + i * 14;
        ctx.fillStyle = s.enemies[i].alive ? "#4f657c" : "#ddc297";
        ctx.beginPath();
        ctx.arc(x, 50, s.enemies[i].alive ? 3 : 4, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [],
  );
  return (
    <div className="birdsVerified">
      <CoreCanvasGame
        {...props}
        core={BIRDS_CORE}
        name="Galactic Birds"
        instruction=""
        render={render}
        expandHorizontalViewport
        hideHudScore
        hudLabel={hudLabel}
        feedbackScore={feedbackScore}
        inputTones={inputTones}
        keys={{
          ArrowLeft: "ANGLE_UP",
          ArrowRight: "ANGLE_DOWN",
          ArrowUp: "POWER_UP",
          ArrowDown: "POWER_DOWN",
          " ": "SHOOT",
        }}
        pointAction={(p, phase, s) => {
          if (s.phase !== "aim") {
            drag.current = null;
            return null;
          }
          if (phase === "down") {
            drag.current =
              Math.hypot(p.x - launcher.current.x, p.y - launcher.current.y) <
              64
                ? { from: p, to: p }
                : null;
            return null;
          }
          if (!drag.current) return null;
          drag.current.to = p;
          if (phase !== "up") return null;
          const { from, to } = drag.current;
          drag.current = null;
          const dx = from.x - to.x,
            dy = to.y - from.y,
            distance = Math.hypot(dx, dy);
          if (distance < 15 || dx <= 0) return null;
          const aim = Math.max(
              0,
              Math.min(
                60,
                Math.round((Math.atan2(dy, dx) * 180) / Math.PI) - 10,
              ),
            ),
            power = Math.max(0, Math.min(12, Math.round((distance - 15) / 7)));
          return [birdsAimAction(aim), birdsPowerAction(power), "SHOOT"];
        }}
      />
    </div>
  );
}
