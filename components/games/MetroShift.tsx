"use client";

import { useCallback, useEffect, useRef } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = {
  active: boolean;
  ghostEnabled: boolean;
  targetScore: number;
  onFinish: (result: GameResult) => void;
};

type Lane = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type Kind = "wall" | "barrier";
type Hazard = { lane: Lane; kind: Kind };
type ObstacleGroup = {
  y: number;
  hazards: Hazard[];
  passed: boolean;
};

type Point = { x: number; y: number };
type Rect = { x1: number; y1: number; x2: number; y2: number };

const W = 390;
const H = 620;
const CX = W / 2;
const DT = 1 / 120;
const HORIZON_Y = 96;
const PLAYER_Y = 500;
const PLAYER_BOTTOM = 23;
const PLAYER_LANES = [32, 86, 140, 195, 250, 304, 358] as const;

const GROUP_PATTERN: Hazard[][] = [
  [{ lane: 3, kind: "wall" }],
  [{ lane: 1, kind: "wall" }, { lane: 5, kind: "wall" }],
  [{ lane: 0, kind: "barrier" }, { lane: 3, kind: "wall" }, { lane: 6, kind: "barrier" }],
  [{ lane: 2, kind: "wall" }, { lane: 4, kind: "wall" }],
  [{ lane: 0, kind: "wall" }, { lane: 2, kind: "barrier" }, { lane: 5, kind: "wall" }],
  [{ lane: 1, kind: "barrier" }, { lane: 3, kind: "wall" }, { lane: 6, kind: "wall" }],
  [{ lane: 0, kind: "wall" }, { lane: 2, kind: "wall" }, { lane: 4, kind: "barrier" }, { lane: 6, kind: "wall" }],
  [{ lane: 1, kind: "wall" }, { lane: 4, kind: "wall" }, { lane: 5, kind: "barrier" }],
  [{ lane: 0, kind: "barrier" }, { lane: 3, kind: "wall" }, { lane: 5, kind: "wall" }],
  [{ lane: 2, kind: "barrier" }, { lane: 4, kind: "wall" }, { lane: 6, kind: "barrier" }],
  [{ lane: 0, kind: "wall" }, { lane: 1, kind: "wall" }, { lane: 5, kind: "barrier" }],
  [{ lane: 2, kind: "wall" }, { lane: 3, kind: "barrier" }, { lane: 6, kind: "wall" }],
  [{ lane: 0, kind: "barrier" }, { lane: 4, kind: "wall" }, { lane: 6, kind: "wall" }],
  [{ lane: 1, kind: "wall" }, { lane: 3, kind: "wall" }, { lane: 5, kind: "wall" }],
  [{ lane: 0, kind: "wall" }, { lane: 2, kind: "barrier" }, { lane: 4, kind: "wall" }, { lane: 6, kind: "barrier" }],
  [{ lane: 1, kind: "barrier" }, { lane: 2, kind: "wall" }, { lane: 5, kind: "wall" }],
]

const GAP_PATTERN = [250, 232, 246, 220, 238, 216, 230, 210, 224, 206, 218, 202];
const GHOST_LANES: Lane[] = [
  3,2,2,3,4,5,6,5,4,3,2,1,0,1,2,3,4,5,6,5,4,3,2,1,2,3,4,4,3,2,
]

function speedFor(ticks: number) {
  const seconds = ticks / 120;
  return Math.min(358, 188 + seconds * 1.35);
}

function depthFor(y: number) {
  return Math.max(0.18, Math.min(1, (y - HORIZON_Y) / (PLAYER_Y - HORIZON_Y)));
}

function laneX(lane: Lane, y: number) {
  const depth = depthFor(y);
  const topSpacing = 17;
  const bottomSpacing = 54.3;
  const spacing = topSpacing + (bottomSpacing - topSpacing) * depth;
  return CX + (lane - 3) * spacing;
}

function sizeFor(y: number, kind: Kind) {
  const depth = depthFor(y);
  const width = 22 + 48 * depth;
  const height = kind === "wall" ? 28 + 70 * depth : 14 + 28 * depth;
  return { depth, width, height };
}

function makeInitialGroups() {
  const items: ObstacleGroup[] = [];
  let y = 118;

  for (let index = 0; index < 12; index += 1) {
    items.push({
      y,
      hazards: GROUP_PATTERN[index % GROUP_PATTERN.length],
      passed: false,
    });
    y -= GAP_PATTERN[index % GAP_PATTERN.length];
  }

  return { items, nextIndex: 12 };
}

function rotatePoint(point: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function playerPolygon(centerX: number, centerY: number, angle: number): Point[] {
  return [
    { x: 0, y: -28 },
    { x: 17, y: 23 },
    { x: 0, y: 16 },
    { x: -17, y: 23 },
  ].map((point) => {
    const rotated = rotatePoint(point, angle);
    return { x: centerX + rotated.x, y: centerY + rotated.y };
  });
}

function hazardRects(groupY: number, hazard: Hazard): Rect[] {
  const { depth, width, height } = sizeFor(groupY, hazard.kind);
  const x = laneX(hazard.lane, groupY);
  const rects: Rect[] = [
    {
      x1: x - width / 2,
      y1: groupY - height / 2,
      x2: x + width / 2,
      y2: groupY + height / 2,
    },
  ];

  if (hazard.kind === "barrier") {
    const legWidth = Math.max(3, 6 * depth);
    const legHeight = 9 * depth + 4;
    const top = groupY + height / 2;

    rects.push(
      {
        x1: x - width / 2 + 5,
        y1: top,
        x2: x - width / 2 + 5 + legWidth,
        y2: top + legHeight,
      },
      {
        x1: x + width / 2 - 5 - legWidth,
        y1: top,
        x2: x + width / 2 - 5,
        y2: top + legHeight,
      }
    );
  }

  return rects;
}

function pointInRect(point: Point, rect: Rect) {
  return (
    point.x >= rect.x1 &&
    point.x <= rect.x2 &&
    point.y >= rect.y1 &&
    point.y <= rect.y2
  );
}

function pointInPolygon(point: Point, polygon: Point[]) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses =
      (a.y > point.y) !== (b.y > point.y) &&
      point.x <
        ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1e-9) + a.x;

    if (crosses) inside = !inside;
  }

  return inside;
}

function orientation(a: Point, b: Point, c: Point) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: Point, b: Point, point: Point) {
  const epsilon = 1e-9;
  return (
    Math.abs(orientation(a, b, point)) <= epsilon &&
    point.x >= Math.min(a.x, b.x) - epsilon &&
    point.x <= Math.max(a.x, b.x) + epsilon &&
    point.y >= Math.min(a.y, b.y) - epsilon &&
    point.y <= Math.max(a.y, b.y) + epsilon
  );
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point) {
  const epsilon = 1e-9;
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (
    ((o1 > epsilon && o2 < -epsilon) || (o1 < -epsilon && o2 > epsilon)) &&
    ((o3 > epsilon && o4 < -epsilon) || (o3 < -epsilon && o4 > epsilon))
  ) {
    return true;
  }

  return (
    onSegment(a, b, c) ||
    onSegment(a, b, d) ||
    onSegment(c, d, a) ||
    onSegment(c, d, b)
  );
}

function polygonHitsRect(polygon: Point[], rect: Rect) {
  if (polygon.some((point) => pointInRect(point, rect))) return true;

  const corners: Point[] = [
    { x: rect.x1, y: rect.y1 },
    { x: rect.x2, y: rect.y1 },
    { x: rect.x2, y: rect.y2 },
    { x: rect.x1, y: rect.y2 },
  ];

  if (corners.some((point) => pointInPolygon(point, polygon))) return true;

  const rectEdges = corners.map((point, index) => [
    point,
    corners[(index + 1) % corners.length],
  ] as const);

  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];

    if (rectEdges.some(([c, d]) => segmentsIntersect(a, b, c, d))) {
      return true;
    }
  }

  return false;
}

export default function MetroShift({ active, ghostEnabled, targetScore, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);

  const state = useRef({
    lane: 3 as Lane,
    x: PLAYER_LANES[3] as number,
    vx: 0,
    groups: [] as ObstacleGroup[],
    nextIndex: 0,
    running: false,
    ticks: 0,
    last: 0,
    acc: 0,
    passed: 0,
    score: 0,
    jumpY: 0,
    jumpVy: 0,
    laneChanges: 0,
    travel: 0,
  });

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  const finish = useCallback((won = false) => {
    const s = state.current;
    if (!s.running) return;

    s.running = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    gameTone(won ? "win" : "bad");
    haptic(won ? [18, 28, 45] : [32, 25, 52]);

    finishRef.current({
      won,
      score: s.score,
      timeMs: Math.round((s.ticks * 1000) / 120),
    });
  }, []);

  const addGroupAbove = useCallback(() => {
    const s = state.current;
    const index = s.nextIndex++;
    const topY = s.groups.reduce(
      (minimum, group) => Math.min(minimum, group.y),
      HORIZON_Y
    );
    const compression = Math.max(0.74, 1 - Math.floor(s.passed / 16) * 0.026);

    s.groups.push({
      y: topY - GAP_PATTERN[index % GAP_PATTERN.length] * compression,
      hazards: GROUP_PATTERN[index % GROUP_PATTERN.length],
      passed: false,
    });

    if (s.groups.length > 20) {
      s.groups = s.groups.filter((group) => group.y < H + 120);
    }
  }, []);

  const step = useCallback(() => {
    const s = state.current;
    s.ticks += 1;

    const speed = speedFor(s.ticks);
    s.travel += speed * DT;

    // Critically damped-ish lateral motion: quick, continuous and readable.
    const targetX = PLAYER_LANES[s.lane];
    const lateralAcceleration = (targetX - s.x) * 92 - s.vx * 15;
    s.vx += lateralAcceleration * DT;
    s.x += s.vx * DT;

    s.jumpVy += 1220 * DT;
    s.jumpY += s.jumpVy * DT;
    if (s.jumpY > 0) {
      s.jumpY = 0;
      s.jumpVy = 0;
    }

    const playerAngle = Math.max(
      -0.22,
      Math.min(0.22, s.vx / 420)
    );
    const plane = playerPolygon(s.x, PLAYER_Y + s.jumpY, playerAngle);

    for (const group of s.groups) {
      const perspectiveSpeed = 0.58 + depthFor(group.y) * 0.72;
      group.y += speed * perspectiveSpeed * DT;
      if (group.passed) continue;

      for (const hazard of group.hazards) {
        const rects = hazardRects(group.y, hazard);
        if (rects.some((rect) => polygonHitsRect(plane, rect))) {
          finish();
          return;
        }
      }

      const lowestBottom = Math.max(
        ...group.hazards.flatMap((hazard) =>
          hazardRects(group.y, hazard).map((rect) => rect.y2)
        )
      );

      if (lowestBottom > PLAYER_Y + PLAYER_BOTTOM + 18) {
        group.passed = true;
        s.passed += 1;
        s.score += 300 + Math.min(540, s.passed * 18);

        if (s.score >= targetScore) {
          finish(true);
          return;
        }

        addGroupAbove();

        if (s.passed % 5 === 0) {
          gameTone("good");
          haptic(8);
        }
      }
    }
  }, [addGroupAbove, finish, targetScore]);

  const drawRoad = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.beginPath();
    ctx.moveTo(112, HORIZON_Y);
    ctx.lineTo(278, HORIZON_Y);
    ctx.lineTo(388, H);
    ctx.lineTo(2, H);
    ctx.closePath();
    ctx.fillStyle = "#252d38";
    ctx.fill();

    const boundaries = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5];

    ctx.lineWidth = 2;
    ctx.setLineDash([18, 19]);
    ctx.strokeStyle = "rgba(236,245,255,.40)";

    for (const boundary of boundaries) {
      ctx.beginPath();
      ctx.moveTo(CX + boundary * 17, HORIZON_Y);
      ctx.lineTo(CX + boundary * 54.3, H);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    ctx.strokeStyle = "rgba(91,221,240,.38)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(112, HORIZON_Y);
    ctx.lineTo(2, H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(278, HORIZON_Y);
    ctx.lineTo(388, H);
    ctx.stroke();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = state.current;

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#4a8fb8");
    sky.addColorStop(0.34, "#d8ecf6");
    sky.addColorStop(0.35, "#596a61");
    sky.addColorStop(1, "#171d26");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const skylineOffset = (s.travel * 0.18) % 92;
    ctx.fillStyle = "rgba(25,42,57,.44)";
    for (let x = -92 - skylineOffset; x < W + 92; x += 92) {
      const index = Math.floor((x + skylineOffset + 92) / 92);
      const h1 = 54 + ((index % 4 + 4) % 4) * 18;
      ctx.fillRect(x, HORIZON_Y + 10 - h1, 48, h1);
      ctx.fillRect(x + 55, HORIZON_Y + 18 - h1 * 0.7, 29, h1 * 0.7);
    }

    drawRoad(ctx);

    // Cross-road motion markers keep forward velocity visually continuous.
    ctx.strokeStyle = "rgba(236,245,255,.13)";
    ctx.lineWidth = 1;
    const roadPhase = (s.travel * 0.0032) % 1;
    for (let index = 0; index < 9; index += 1) {
      const t = (index / 9 + roadPhase) % 1;
      const eased = t * t;
      const y = HORIZON_Y + (H - HORIZON_Y) * eased;
      const halfWidth = 83 + 110 * eased;
      ctx.beginPath();
      ctx.moveTo(CX - halfWidth, y);
      ctx.lineTo(CX + halfWidth, y);
      ctx.stroke();
    }

    // Lane focus glow: gives immediate spatial feedback without adding UI chrome.
    const activeLaneX = laneX(s.lane, PLAYER_Y);
    const laneGlow = ctx.createLinearGradient(activeLaneX, HORIZON_Y, activeLaneX, H);
    laneGlow.addColorStop(0, "rgba(89,224,242,0)");
    laneGlow.addColorStop(1, "rgba(89,224,242,.12)");
    ctx.fillStyle = laneGlow;
    ctx.beginPath();
    ctx.moveTo(CX + (s.lane - 3) * 17 - 9, HORIZON_Y);
    ctx.lineTo(CX + (s.lane - 3) * 17 + 9, HORIZON_Y);
    ctx.lineTo(activeLaneX + 34, H);
    ctx.lineTo(activeLaneX - 34, H);
    ctx.closePath();
    ctx.fill();

    // Next-wave lane preview near the horizon.
    const nextGroup = s.groups.find((group) => !group.passed && group.y > HORIZON_Y - 80);
    if (nextGroup && nextGroup.y < 250) {
      const blocked = new Set(nextGroup.hazards.map((hazard) => hazard.lane));
      for (let lane = 0; lane < 7; lane += 1) {
        const x = 108 + lane * 27;
        ctx.fillStyle = blocked.has(lane as Lane)
          ? "rgba(239,82,100,.78)"
          : "rgba(98,218,145,.72)";
        ctx.fillRect(x, 74, 16, 4);
      }
    }

    for (const group of s.groups) {
      if (group.y < 60 || group.y > H + 110) continue;

      for (const hazard of group.hazards) {
        const { depth, width, height } = sizeFor(group.y, hazard.kind);
        const x = laneX(hazard.lane, group.y);

        ctx.save();
        ctx.shadowBlur = 8 * depth;
        ctx.shadowColor = "rgba(0,0,0,.28)";

        const trail = Math.max(4, 18 * depth);
        ctx.fillStyle = "rgba(105,220,240,.10)";
        ctx.fillRect(x - width / 2, group.y - height / 2 - trail, width, trail);

        if (hazard.kind === "wall") {
          ctx.fillStyle = "#db4e60";
          ctx.fillRect(x - width / 2, group.y - height / 2, width, height);
          ctx.fillStyle = "rgba(255,255,255,.27)";
          ctx.fillRect(x - width / 2 + 4, group.y - height / 2 + 4, width - 8, Math.max(3, 5 * depth));
          ctx.fillStyle = "#ffd05b";
          ctx.fillRect(x - width / 2 + 4, group.y + height / 2 - 12 * depth, width - 8, Math.max(4, 6 * depth));
        } else {
          ctx.fillStyle = "#dda23a";
          ctx.fillRect(x - width / 2, group.y - height / 2, width, height);
          ctx.fillStyle = "rgba(255,255,255,.30)";
          ctx.fillRect(x - width / 2 + 4, group.y - height / 2 + 3, width - 8, Math.max(3, 4 * depth));

          ctx.fillStyle = "#92651b";
          const legWidth = Math.max(3, 6 * depth);
          const legHeight = 9 * depth + 4;
          ctx.fillRect(x - width / 2 + 5, group.y + height / 2, legWidth, legHeight);
          ctx.fillRect(x + width / 2 - 5 - legWidth, group.y + height / 2, legWidth, legHeight);
        }

        ctx.restore();
      }
    }

    if (ghostEnabled) {
      const ghostLane = GHOST_LANES[s.passed % GHOST_LANES.length];
      const ghostX = PLAYER_LANES[ghostLane];
      const ghostY = PLAYER_Y + s.jumpY;

      ctx.save();
      ctx.globalAlpha = 0.33;
      ctx.translate(ghostX, ghostY);
      ctx.fillStyle = "#d7f8ff";
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.lineTo(17, 23);
      ctx.lineTo(0, 16);
      ctx.lineTo(-17, 23);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.82;
      ctx.fillStyle = "#effdff";
      ctx.font = "900 12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("👻", 0, -34);
      ctx.restore();
    }

    const playerAngle = Math.max(
      -0.22,
      Math.min(0.22, s.vx / 420)
    );

    // Ground shadow makes jumping height immediately legible.
    ctx.save();
    ctx.globalAlpha = Math.max(0.15, 0.38 + s.jumpY / 180);
    ctx.fillStyle = "#05090f";
    ctx.beginPath();
    ctx.ellipse(s.x, PLAYER_Y + 26, 20, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(s.x, PLAYER_Y + s.jumpY);
    ctx.rotate(playerAngle);
    ctx.shadowBlur = 17;
    ctx.shadowColor = "#ffd34f";
    ctx.fillStyle = "#ffd34f";
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(17, 23);
    ctx.lineTo(0, 16);
    ctx.lineTo(-17, 23);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#315fae";
    ctx.fillRect(-7, -11, 14, 20);
    ctx.restore();

    ctx.textAlign = "start";
  }, [drawRoad, ghostEnabled]);

  const loop = useCallback((now: number) => {
    const s = state.current;
    if (!s.running) return;

    if (!s.last) s.last = now;
    s.acc += Math.min(0.05, (now - s.last) / 1000);
    s.last = now;

    while (s.acc >= DT && s.running) {
      step();
      s.acc -= DT;
    }

    draw();
    if (s.running) rafRef.current = requestAnimationFrame(loop);
  }, [draw, step]);

  const start = useCallback(() => {
    const initial = makeInitialGroups();

    state.current = {
      lane: 3,
      x: PLAYER_LANES[3],
      vx: 0,
      groups: initial.items,
      nextIndex: initial.nextIndex,
      running: true,
      ticks: 0,
      last: 0,
      acc: 0,
      passed: 0,
      score: 0,
      jumpY: 0,
      jumpVy: 0,
      laneChanges: 0,
      travel: 0,
    };

    draw();
    rafRef.current = requestAnimationFrame(loop);
  }, [draw, loop]);

  useEffect(() => {
    if (active) start();

    return () => {
      state.current.running = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, start]);

  function move(direction: -1 | 1, steps = 1) {
    const s = state.current;
    if (!s.running) return;

    const next = Math.max(
      0,
      Math.min(6, s.lane + direction * steps)
    ) as Lane;

    if (next === s.lane) return;

    const delta = Math.abs(next - s.lane);
    s.lane = next;
    s.laneChanges += delta;
    gameTone("tap");
    haptic(5);
  }

  function jump() {
    const s = state.current;
    if (!s.running || s.jumpY < -2) return;

    s.jumpVy = -455;
    gameTone("tap");
    haptic(5);
  }

  function localPoint(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }

  function gesture(dx: number, dy: number) {
    if (Math.abs(dx) > Math.abs(dy)) {
      const steps = Math.abs(dx) > 86 ? 2 : 1;
      if (dx > 22) move(1, steps);
      else if (dx < -22) move(-1, steps);
      return;
    }

    if (dy < -22) jump();
  }

  return (
    <div className="gameStage skillGameStage metroShiftArena">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas"
        onPointerDown={(event) => {
          swipeRef.current = localPoint(event.clientX, event.clientY);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!swipeRef.current || !event.buttons) return;
          const point = localPoint(event.clientX, event.clientY);
          const dx = point.x - swipeRef.current.x;
          const dy = point.y - swipeRef.current.y;
          if (Math.abs(dx) > 34 || Math.abs(dy) > 34) {
            gesture(dx, dy);
            swipeRef.current = point;
          }
        }}
        onPointerUp={(event) => {
          if (swipeRef.current) {
            const point = localPoint(event.clientX, event.clientY);
            const dx = point.x - swipeRef.current.x;
            const dy = point.y - swipeRef.current.y;
            if (Math.abs(dx) > 22 || Math.abs(dy) > 22) {
              gesture(dx, dy);
            }
          }
          swipeRef.current = null;

          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => {
          swipeRef.current = null;
        }}
        aria-label="Metro Shift"
      />
      <div className="metroTouchControls" aria-label="Controles táctiles">
        <button type="button" onPointerDown={(event) => { event.preventDefault(); move(-1); }}>←</button>
        <button type="button" className="jump" onPointerDown={(event) => { event.preventDefault(); jump(); }}>↑</button>
        <button type="button" onPointerDown={(event) => { event.preventDefault(); move(1); }}>→</button>
      </div>
    </div>
  );
}
