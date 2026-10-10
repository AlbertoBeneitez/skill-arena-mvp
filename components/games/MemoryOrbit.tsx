"use client";

import { useCallback, useMemo, useRef } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import type { LogicalCanvasViewport } from "@/lib/gameCanvas";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import {
  MEMORY_CORE,
  MEMORY_RULES,
  memoryCardFaceUp,
  memoryCardMatched,
  type MemoryState,
} from "@/lib/verified/memoryMatchCore.v2";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";

type CardLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  pitchX: number;
  pitchY: number;
};

/** The topology never rotates: the same six columns/four rows in every viewport. */
export function memoryCardLayout(viewport: LogicalCanvasViewport): CardLayout {
  const horizontal = viewport.width > viewport.height,
    sideHud = viewport.width > 1200,
    pitchX = Math.min((viewport.width - 24) / 6, horizontal ? 180 : 138),
    pitchY = Math.min(
      (viewport.height - (sideHud ? 24 : 128)) / 4,
      pitchX * 1.55,
    ),
    width = pitchX - 4,
    height = pitchY - 6;
  return {
    x: (viewport.width - pitchX * 6) / 2 + 2,
    y: (viewport.height - pitchY * 4) / 2 + 3,
    width,
    height,
    pitchX,
    pitchY,
  };
}

function cardIndex(point: CorePoint, layout: CardLayout): number | null {
  const col = Math.floor((point.x - layout.x) / layout.pitchX),
    row = Math.floor((point.y - layout.y) / layout.pitchY);
  if (col < 0 || col >= 6 || row < 0 || row >= 4) return null;
  const x = layout.x + col * layout.pitchX,
    y = layout.y + row * layout.pitchY;
  return point.x >= x &&
    point.x <= x + layout.width &&
    point.y >= y &&
    point.y <= y + layout.height
    ? row * 6 + col
    : null;
}

const SYMBOL_COLORS = [
  "#f2d69d",
  "#81e1f1",
  "#e8b0d2",
  "#b1b7f4",
  "#a6e4c2",
  "#f0bf94",
  "#dde49e",
  "#b7d5f2",
  "#d4b5ed",
  "#c4dcaa",
  "#9ce7dc",
  "#ebc3a7",
] as const;

/** Twelve original orbital silhouettes; no external assets or simulation RNG. */
function symbol(ctx: CanvasRenderingContext2D, id: number, size: number) {
  ctx.lineWidth = Math.max(1.5, size * 0.055);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = SYMBOL_COLORS[id];
  ctx.fillStyle = SYMBOL_COLORS[id];
  const ring = (x: number, y: number, radius: number) => {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
  };
  const polygon = (
    points: readonly (readonly [number, number])[],
    fill = false,
  ) => {
    ctx.beginPath();
    points.forEach(([x, y], i) =>
      i ? ctx.lineTo(x * size, y * size) : ctx.moveTo(x * size, y * size),
    );
    ctx.closePath();
    fill ? ctx.fill() : ctx.stroke();
  };
  switch (id) {
    case 0: // Ringed world.
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.47, size * 0.17, -0.42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 1: // Comet, with three clearly separated trails.
      ctx.beginPath();
      ctx.arc(size * 0.17, size * 0.12, size * 0.2, 0, Math.PI * 2);
      ctx.fill();
      for (const d of [-0.17, 0, 0.17]) {
        ctx.beginPath();
        ctx.moveTo(size * (-0.43 + d), size * (-0.38 - d));
        ctx.lineTo(size * (-0.03 + d * 0.3), size * (-0.05 - d * 0.3));
        ctx.stroke();
      }
      break;
    case 2: // Scout spacecraft.
      polygon(
        [
          [0, -0.5],
          [0.29, 0.25],
          [0, 0.13],
          [-0.29, 0.25],
        ],
        true,
      );
      polygon([
        [-0.15, 0.25],
        [0, 0.5],
        [0.15, 0.25],
      ]);
      break;
    case 3: // Faceted asteroid.
      polygon([
        [-0.42, -0.1],
        [-0.2, -0.4],
        [0.2, -0.34],
        [0.43, 0.05],
        [0.18, 0.43],
        [-0.28, 0.3],
      ]);
      polygon([
        [-0.2, -0.4],
        [-0.09, 0.13],
        [0.43, 0.05],
      ]);
      break;
    case 4: // Three-armed galaxy.
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.1, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI * 2) / 3);
        ctx.beginPath();
        ctx.moveTo(size * 0.07, 0);
        ctx.bezierCurveTo(
          size * 0.46,
          -size * 0.35,
          size * 0.6,
          size * 0.3,
          size * 0.03,
          size * 0.46,
        );
        ctx.stroke();
        ctx.restore();
      }
      break;
    case 5: // World and its visible moon.
      ring(-size * 0.09, size * 0.08, size * 0.3);
      ctx.beginPath();
      ctx.arc(size * 0.31, -size * 0.3, size * 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 6: // Eight-point beacon.
      polygon(
        Array.from({ length: 16 }, (_, i) => {
          const radius = i % 2 ? 0.15 : i % 4 ? 0.34 : 0.48;
          return [
            Math.cos((i * Math.PI) / 8) * radius,
            Math.sin((i * Math.PI) / 8) * radius,
          ] as const;
        }),
        true,
      );
      break;
    case 7: // Crystal.
      polygon([
        [0, -0.49],
        [0.34, -0.16],
        [0.26, 0.24],
        [0, 0.49],
        [-0.26, 0.24],
        [-0.34, -0.16],
      ]);
      polygon([
        [0, -0.49],
        [0.12, -0.03],
        [0, 0.49],
        [-0.12, -0.03],
      ]);
      break;
    case 8: // Orbital station.
      ring(0, 0, size * 0.28);
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 2);
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.28);
        ctx.lineTo(0, -size * 0.48);
        ctx.stroke();
        ctx.fillRect(-size * 0.1, -size * 0.48, size * 0.2, size * 0.08);
        ctx.restore();
      }
      break;
    case 9: // Satellite with distinct rectangular solar panels.
      ctx.strokeRect(-size * 0.12, -size * 0.18, size * 0.24, size * 0.36);
      ctx.strokeRect(-size * 0.47, -size * 0.12, size * 0.24, size * 0.24);
      ctx.strokeRect(size * 0.23, -size * 0.12, size * 0.24, size * 0.24);
      ctx.beginPath();
      ctx.moveTo(-size * 0.23, 0);
      ctx.lineTo(size * 0.23, 0);
      ctx.moveTo(0, -size * 0.18);
      ctx.lineTo(size * 0.17, -size * 0.39);
      ctx.stroke();
      break;
    case 10: // Eclipse and offset orbit.
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.45, size * 0.24, -0.5, 0, Math.PI * 2);
      ctx.stroke();
      ring(0, 0, size * 0.16);
      ctx.beginPath();
      ctx.arc(size * 0.33, -size * 0.22, size * 0.07, 0, Math.PI * 2);
      ctx.fill();
      break;
    default: // Friendly alien silhouette.
      polygon([
        [-0.34, -0.35],
        [0.34, -0.35],
        [0.4, 0.04],
        [0.17, 0.38],
        [-0.17, 0.38],
        [-0.4, 0.04],
      ]);
      ctx.beginPath();
      ctx.ellipse(
        -size * 0.15,
        -size * 0.04,
        size * 0.08,
        size * 0.12,
        -0.3,
        0,
        Math.PI * 2,
      );
      ctx.ellipse(
        size * 0.15,
        -size * 0.04,
        size * 0.08,
        size * 0.12,
        0.3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      break;
  }
}

function draw(
  ctx: CanvasRenderingContext2D,
  state: MemoryState,
  viewport: LogicalCanvasViewport,
  layout: CardLayout,
) {
  drawSpaceBackdrop(ctx, viewport.width, viewport.height, 0, state.tick);
  const age = state.tick - state.lastEventTick;
  for (let index = 0; index < 24; index++) {
    const faceUp = memoryCardFaceUp(state, index),
      matched = memoryCardMatched(state, index),
      isSelected = state.first === index || state.second === index,
      recentPair =
        state.lastMatch?.includes(index) &&
        age >= 0 &&
        age < 90 &&
        state.lastEvent === "match",
      shaking =
        isSelected && state.lastEvent === "mismatch" && age >= 0 && age < 24,
      shake = shaking ? Math.sin(age * 1.1) * (1 - age / 24) * 3 : 0,
      x = layout.x + (index % 6) * layout.pitchX + shake,
      y = layout.y + Math.floor(index / 6) * layout.pitchY,
      w = layout.width,
      h = layout.height,
      rounding = Math.min(10, w * 0.17),
      reveal =
        state.phase !== "preview" &&
        age >= 0 &&
        age < 14 &&
        ((state.lastEvent === "flip" && state.first === index) ||
          (state.lastEvent === "mismatch" && state.second === index));
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    if (reveal)
      ctx.scale(
        0.24 + 0.76 * Math.sin((Math.min(1, age / 14) * Math.PI) / 2),
        1,
      );
    const panel = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    panel.addColorStop(
      0,
      faceUp ? (matched ? "#173c43" : "#1c344f") : "#15283c",
    );
    panel.addColorStop(
      1,
      faceUp ? (matched ? "#0b2631" : "#0c1e34") : "#0b192c",
    );
    ctx.fillStyle = panel;
    ctx.strokeStyle = recentPair
      ? "#b1f0d5"
      : shaking
        ? "#ec99ac"
        : matched
          ? "#4b928b"
          : isSelected
            ? "#afdff0"
            : faceUp
              ? "#57728c"
              : "#3a546f";
    ctx.lineWidth = recentPair || isSelected ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, rounding);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = matched
      ? "rgba(127,192,177,.16)"
      : "rgba(135,185,219,.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(
      -w / 2 + 4,
      -h / 2 + 4,
      w - 8,
      h - 8,
      Math.max(2, rounding - 3),
    );
    ctx.stroke();
    if (faceUp) {
      // Access the symbol only after it is legally visible. Back sides are identical.
      const id = state.board[index],
        size = Math.min(w * 0.7, h * 0.53);
      ctx.save();
      ctx.translate(0, -h * 0.075);
      if (matched) ctx.globalAlpha = 0.82;
      symbol(ctx, id, size);
      ctx.restore();
      ctx.fillStyle = matched ? "#9acbc4" : "#c3d6e6";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `600 ${Math.max(11, Math.min(14, w * 0.19))}px system-ui`;
      ctx.fillText(String(id + 1).padStart(2, "0"), 0, h * 0.3);
      if (matched) {
        ctx.strokeStyle = "#a6e1c7";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(w * 0.25, -h * 0.35);
        ctx.lineTo(w * 0.3, -h * 0.3);
        ctx.lineTo(w * 0.39, -h * 0.39);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = "#769aac";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.25, w * 0.12, -0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#6aa9b6";
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.065, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#a9ced1";
      const orbit = (state.tick * 0.002 + index * 0.6) % (Math.PI * 2);
      ctx.beginPath();
      ctx.arc(
        Math.cos(orbit) * w * 0.21,
        Math.sin(orbit) * w * 0.11,
        w * 0.025,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();
    if (recentPair) {
      const progress = age / 90;
      ctx.save();
      ctx.globalAlpha = (1 - progress) * 0.6;
      ctx.strokeStyle = "#a7e8cf";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(
        x - progress * 3,
        y - progress * 3,
        w + progress * 6,
        h + progress * 6,
        rounding + progress * 3,
      );
      ctx.stroke();
      ctx.restore();
    }
  }
  // These are live game states/timing, not tutorial or procedural copy.
  const preview = state.phase === "preview",
    remaining = preview
      ? Math.max(0, state.previewUntil - state.tick) / MEMORY_CORE.tickRate
      : Math.max(0, MEMORY_CORE.maxFinalTick - state.tick) /
        MEMORY_CORE.tickRate,
    cx = viewport.width / 2,
    sideHud = viewport.width > 1200,
    cy = sideHud ? viewport.height / 2 : layout.y + layout.pitchY * 4 + 30,
    timerX = sideHud ? layout.x / 2 : cx,
    timerRadius = sideHud ? 42 : 19,
    ratio = preview
      ? Math.max(
          0,
          (state.previewUntil - state.tick) / MEMORY_RULES.previewTicks,
        )
      : Math.max(
          0,
          (MEMORY_CORE.maxFinalTick - state.tick) / MEMORY_CORE.maxFinalTick,
        );
  ctx.strokeStyle = "rgba(149,186,206,.19)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(timerX, cy, timerRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = preview
    ? "#a9d8ed"
    : remaining <= 20
      ? "#e9ad98"
      : "#7dcfc3";
  ctx.beginPath();
  ctx.arc(
    timerX,
    cy,
    timerRadius,
    -Math.PI / 2,
    -Math.PI / 2 + ratio * Math.PI * 2,
  );
  ctx.stroke();
  ctx.fillStyle = "#d0e4ee";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${sideHud ? 32 : 14}px system-ui`;
  ctx.fillText(
    preview ? remaining.toFixed(1) : `${Math.ceil(remaining)}`,
    timerX,
    cy,
  );
}

const inputTones = Object.fromEntries(
  MEMORY_CORE.actions.map((action) => [action, "tap" as const]),
);
const feedbackScore = (state: MemoryState) =>
  state.matchedPairs * 1000 - state.mistakes;
const hudLabel = (state: Readonly<MemoryState>) =>
  `${state.matchedPairs}/12 PAREJAS`;

export default function MemoryOrbit(props: GameRuntimeProps) {
  const layoutRef = useRef<CardLayout>(
      memoryCardLayout({ width: 390, height: 620 }),
    ),
    pressRef = useRef<number | null>(null),
    render = useCallback(
      (
        ctx: CanvasRenderingContext2D,
        state: MemoryState,
        viewport: LogicalCanvasViewport,
      ) => {
        const layout = memoryCardLayout(viewport);
        layoutRef.current = layout;
        draw(ctx, state, viewport, layout);
      },
      [],
    ),
    pointAction = useCallback(
      (point: CorePoint, phase: "down" | "move" | "up") => {
        if (phase === "down") {
          pressRef.current = cardIndex(point, layoutRef.current);
          return null;
        }
        if (phase !== "up") return null;
        const original = pressRef.current;
        pressRef.current = null;
        return original !== null &&
          cardIndex(point, layoutRef.current) === original
          ? `FLIP_${original}`
          : null;
      },
      [],
    ),
    failureFinale = useMemo(
      () => ({
        durationMs: 420,
        render(
          ctx: CanvasRenderingContext2D,
          state: MemoryState,
          elapsedMs: number,
        ) {
          const layout = layoutRef.current,
            progress = Math.min(1, elapsedMs / 420),
            positions =
              state.first !== null && state.second !== null
                ? [state.first, state.second]
                : [];
          ctx.save();
          ctx.globalAlpha = (1 - progress) * 0.8;
          ctx.strokeStyle = "#edafac";
          ctx.lineWidth = 2;
          for (const index of positions) {
            const x = layout.x + (index % 6) * layout.pitchX,
              y = layout.y + Math.floor(index / 6) * layout.pitchY,
              spread = progress * 6;
            ctx.beginPath();
            ctx.roundRect(
              x - spread,
              y - spread,
              layout.width + spread * 2,
              layout.height + spread * 2,
              10 + spread,
            );
            ctx.stroke();
          }
          if (!positions.length) {
            ctx.beginPath();
            ctx.roundRect(
              layout.x - 4,
              layout.y - 4,
              layout.pitchX * 6 + 4,
              layout.pitchY * 4 + 4,
              12,
            );
            ctx.stroke();
          }
          ctx.restore();
        },
      }),
      [],
    );
  return (
    <div className="memoryOrbitVerified">
      <CoreCanvasGame
        {...props}
        core={MEMORY_CORE}
        name="Memoria"
        instruction="Selecciona dos cartas con el mismo símbolo."
        expandHorizontalViewport
        hideHudScore
        render={render}
        pointAction={pointAction}
        feedbackScore={feedbackScore}
        failureFinale={failureFinale}
        inputTones={inputTones}
        hudLabel={hudLabel}
      />
    </div>
  );
}
