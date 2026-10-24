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
import { isDartsThrowGesture } from "@/lib/verified/dartsGesture.v2";
import { dartsAimAction } from "@/lib/verified/dartsProtocol.v1";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
import { t, formatNumber, useI18n } from "@/lib/i18n";
const cx = 195,
  cy = 285;
function ring(
  ctx: CanvasRenderingContext2D,
  r1: number,
  r2: number,
  start: number,
  end: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r2, start, end);
  ctx.arc(cx, cy, r1, end, start, true);
  ctx.closePath();
  ctx.fill();
}
// Visual zoom only (outer ring 161 * 1.15 = 185 of 195 half-width); aim input
// uses the inverse, so authoritative coordinates are unchanged.
const BOARD_ZOOM = 1.15;
function render(ctx: CanvasRenderingContext2D, s: DartsStateV3, view?: { width: number; height: number }) {
  const viewH = Math.max(620, view?.height ?? 620);
  drawSpaceBackdrop(ctx, 390, viewH, 0, s.tick);
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
  ctx.fillStyle = "#0a192a";
  ctx.beginPath();
  ctx.arc(cx, cy, 161, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#547689";
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let i = 0; i < 20; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 10 - Math.PI / 20,
      b = a + Math.PI / 10;
    ring(ctx, 24, 140, a, b, i % 2 ? "#c2ced1" : "#183444");
    ring(ctx, 78, 88, a, b, i % 2 ? "#d58a58" : "#37b89e");
    ring(ctx, 129, 140, a, b, i % 2 ? "#d58a58" : "#37b89e");
    ctx.strokeStyle = "rgba(2,15,27,.5)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 24, cy + Math.sin(a) * 24);
    ctx.lineTo(cx + Math.cos(a) * 140, cy + Math.sin(a) * 140);
    ctx.stroke();
    const angle = (a + b) / 2;
    ctx.fillStyle = "#d3e8ee";
    ctx.textAlign = "center";
    ctx.font = "bold 10px system-ui";
    ctx.fillText(
      String(DARTS_SECTORS[i]),
      cx + Math.cos(angle) * 151,
      cy + Math.sin(angle) * 151 + 3,
    );
  }
  ctx.fillStyle = "#3abb9f";
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e3a16e";
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fill();

  // The tip stays at the server-owned impact. Never display the newest
  // recorded impact before the flying dart has actually reached the board.
  for (let i = 0; i < s.impacts.length; i++) {
    const hit = s.impacts[i];
    const flying = i === s.impacts.length - 1 && s.phase === "flight";
    if (hit.timeout || (flying && s.phaseTicks < DARTS_RULES_V3.impactTicks)) continue;
    const pose = dartPerspectiveFlight(cx + hit.x / 1000, cy + hit.y / 1000, DARTS_RULES_V3.impactTicks);
    drawDart(ctx, { ...pose, scale: 0.52 }, i % 2 ? "#dfb885" : "#6bdde2");
  }
  const pose = s.phase === "flight" && s.phaseTicks >= DARTS_RULES_V3.impactTicks
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
function aimActions(point: CorePoint) {
  // Inverse of the visual board enlargement: the cursor and actual aim agree.
  const boardX = cx + (point.x - cx) / BOARD_ZOOM;
  const boardY = cy + (point.y - cy) / BOARD_ZOOM;
  return [
    dartsAimAction(
      "X",
      Math.max(0, Math.min(60, Math.round((boardX - cx) / 5) + 30)),
    ),
    dartsAimAction(
      "Y",
      Math.max(0, Math.min(60, Math.round((boardY - cy) / 5) + 30)),
    ),
  ];
}
const tones = { THROW: "tap" } as const,
  keys = { " ": "THROW", Enter: "THROW" };
const feedbackScore = (s: Readonly<DartsStateV3>) => s.total;
const hudLabel = (s: Readonly<DartsStateV3>) => t("play.points", { n: formatNumber(s.total) });
export default function Darts(props: GameRuntimeProps) {
  useI18n();
  const startRef = useRef<CorePoint | null>(null);
  useEffect(() => {
    startRef.current = null;
    return () => {
      startRef.current = null;
    };
  }, [props.active, props.seed]);
  const aim = useCallback(
    (point: CorePoint, phase: "down" | "move" | "up", state: DartsStateV3) => {
      if (state.phase !== "aim") {
        startRef.current = null;
        return null;
      }
      if (phase === "down") {
        startRef.current = point;
        return aimActions(point);
      }
      if (phase === "move") return aimActions(point);
      const start = startRef.current;
      startRef.current = null;
      return start && isDartsThrowGesture(start, point)
        ? [...aimActions(point), "THROW"]
        : null;
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
