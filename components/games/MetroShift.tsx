"use client";

import { useCallback, useEffect, useRef } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = {
  active: boolean;
  ghostEnabled: boolean;
  onFinish: (result: GameResult) => void;
};

type Lane = 0 | 1 | 2;
type Kind = "wall" | "barrier";
type Obstacle = {
  y: number;
  lane: Lane;
  kind: Kind;
  passed: boolean;
};

const W = 390;
const H = 620;
const CX = W / 2;
const DT = 1 / 120;
const PLAYER_Y = 500;
const PLAYER_TOP = 28;
const PLAYER_BOTTOM = 23;

type Point = { x: number; y: number };
type Rect = { x1: number; y1: number; x2: number; y2: number };
const LANES = [92, 195, 298] as const;

const LANE_PATTERN: Lane[] = [
  1,0,2,2,1,0,1,2,0,0,2,1,0,2,1,1,0,2,2,0,1,2,0,1,
];
const KIND_PATTERN: Kind[] = [
  "wall","wall","barrier","wall","barrier","wall","wall","barrier",
  "wall","barrier","wall","wall","barrier","wall","barrier","wall",
  "wall","barrier","wall","wall","barrier","wall","barrier","wall",
];
const GAP_PATTERN = [236,222,246,214,230,208,226,202,218,198,212,194];
const GHOST_LANES: Lane[] = [1,1,0,0,1,2,2,1,0,1,2,1,1,0,2,2,1,0,1,2,1,0,2,1];

function speedFor(passed: number) {
  return Math.min(330, 170 + passed * 3.2);
}

function sizeFor(y: number, kind: Kind) {
  const depth = Math.max(0.34, Math.min(1, (y - 70) / (PLAYER_Y - 70)));
  const width = 36 + 34 * depth;
  const height = kind === "wall" ? 42 + 54 * depth : 18 + 22 * depth;
  return { depth, width, height };
}

function obstacleX(lane: Lane, y: number) {
  const depth = Math.max(0.34, Math.min(1, (y - 70) / (PLAYER_Y - 70)));
  const spacing = 33 + 70 * depth;
  return W / 2 + (lane - 1) * spacing;
}

function makeInitialObstacles() {
  const items: Obstacle[] = [];
  let y = 155;

  for (let index = 0; index < 12; index += 1) {
    items.push({
      y,
      lane: LANE_PATTERN[index % LANE_PATTERN.length],
      kind: KIND_PATTERN[index % KIND_PATTERN.length],
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

function playerPolygon(
  centerX: number,
  centerY: number,
  angle: number
): Point[] {
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

function obstacleRects(obstacle: Obstacle): Rect[] {
  const { depth, width, height } = sizeFor(obstacle.y, obstacle.kind);
  const x = obstacleX(obstacle.lane, obstacle.y);
  const rects: Rect[] = [
    {
      x1: x - width / 2,
      y1: obstacle.y - height / 2,
      x2: x + width / 2,
      y2: obstacle.y + height / 2,
    },
  ];

  if (obstacle.kind === "barrier") {
    const legWidth = Math.max(4, 7 * depth);
    const legHeight = 11 * depth + 4;
    const top = obstacle.y + height / 2;
    rects.push(
      {
        x1: x - width / 2 + 6,
        y1: top,
        x2: x - width / 2 + 6 + legWidth,
        y2: top + legHeight,
      },
      {
        x1: x + width / 2 - 6 - legWidth,
        y1: top,
        x2: x + width / 2 - 6,
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

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return (
    ((o1 >= 0 && o2 <= 0) || (o1 <= 0 && o2 >= 0)) &&
    ((o3 >= 0 && o4 <= 0) || (o3 <= 0 && o4 >= 0))
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

export default function MetroShift({ active, ghostEnabled, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);

  const state = useRef({
    lane: 1 as Lane,
    x: LANES[1] as number,
    obstacles: [] as Obstacle[],
    nextIndex: 0,
    running: false,
    ticks: 0,
    last: 0,
    acc: 0,
    passed: 0,
    score: 0,
    jumpY: 0,
    jumpVy: 0,
  });

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  const finish = useCallback(() => {
    const s = state.current;
    if (!s.running) return;

    s.running = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    gameTone("bad");
    haptic([32, 25, 52]);

    finishRef.current({
      won: false,
      score: s.score,
      timeMs: Math.round((s.ticks * 1000) / 120),
    });
  }, []);

  const addObstacleAbove = useCallback(() => {
    const s = state.current;
    const index = s.nextIndex++;
    const topY = s.obstacles.reduce(
      (minimum, obstacle) => Math.min(minimum, obstacle.y),
      90
    );
    const compression = Math.max(0.76, 1 - Math.floor(s.passed / 18) * 0.03);

    s.obstacles.push({
      y: topY - GAP_PATTERN[index % GAP_PATTERN.length] * compression,
      lane: LANE_PATTERN[index % LANE_PATTERN.length],
      kind: KIND_PATTERN[index % KIND_PATTERN.length],
      passed: false,
    });

    if (s.obstacles.length > 20) {
      s.obstacles = s.obstacles.filter((obstacle) => obstacle.y < H + 100);
    }
  }, []);

  const step = useCallback(() => {
    const s = state.current;
    s.ticks += 1;

    const speed = speedFor(s.passed);
    s.x += (LANES[s.lane] - s.x) * 0.31;

    s.jumpVy += 1220 * DT;
    s.jumpY += s.jumpVy * DT;
    if (s.jumpY > 0) {
      s.jumpY = 0;
      s.jumpVy = 0;
    }

    const playerAngle = Math.max(
      -0.16,
      Math.min(0.16, (LANES[s.lane] - s.x) / 90)
    );
    const plane = playerPolygon(s.x, PLAYER_Y + s.jumpY, playerAngle);

    for (const obstacle of s.obstacles) {
      obstacle.y += speed * DT;

      if (obstacle.passed) continue;

      const rects = obstacleRects(obstacle);
      const mainRect = rects[0];

      if (rects.some((rect) => polygonHitsRect(plane, rect))) {
        finish();
        return;
      }

      if (mainRect.y1 > PLAYER_Y + PLAYER_BOTTOM + 18) {
        obstacle.passed = true;
        s.passed += 1;
        s.score += 280 + Math.min(520, s.passed * 16);
        addObstacleAbove();

        if (s.passed % 5 === 0) {
          gameTone("good");
          haptic(8);
        }
      }
    }
  }, [addObstacleAbove, finish]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = state.current;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#67b7df");
    sky.addColorStop(0.34, "#d9eef7");
    sky.addColorStop(0.35, "#5d6d60");
    sky.addColorStop(1, "#202827");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // City
    ctx.fillStyle = "rgba(33,49,63,.40)";
    const skylineOffset = (s.ticks * 0.22) % 96;
    for (let x = -96 - skylineOffset; x < W + 96; x += 96) {
      const index = Math.floor((x + skylineOffset + 96) / 96);
      const h1 = 62 + ((index % 3 + 3) % 3) * 24;
      ctx.fillRect(x, 112 - h1, 52, h1);
      ctx.fillRect(x + 59, 126 - h1 * 0.72, 30, h1 * 0.72);
    }

    // Road perspective.
    ctx.beginPath();
    ctx.moveTo(135, 92);
    ctx.lineTo(255, 92);
    ctx.lineTo(372, H);
    ctx.lineTo(18, H);
    ctx.closePath();
    ctx.fillStyle = "#2c343e";
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,.50)";
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 18]);
    for (const topX of [175, 215]) {
      ctx.beginPath();
      ctx.moveTo(topX, 92);
      ctx.lineTo(topX < CX ? 132 : 258, H);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Obstacles genuinely travel from the top of the screen toward the player.
    for (const obstacle of s.obstacles) {
      if (obstacle.y < 65 || obstacle.y > H + 90 || obstacle.passed) continue;

      const { depth, width, height } = sizeFor(obstacle.y, obstacle.kind);
      const x = obstacleX(obstacle.lane, obstacle.y);

      if (obstacle.kind === "wall") {
        ctx.fillStyle = "#e04e5e";
        ctx.fillRect(x - width / 2, obstacle.y - height / 2, width, height);
        ctx.fillStyle = "rgba(255,255,255,.28)";
        ctx.fillRect(x - width / 2 + 5, obstacle.y - height / 2 + 5, width - 10, 5);
        ctx.fillStyle = "#ffd360";
        ctx.fillRect(x - width / 2 + 5, obstacle.y + height / 2 - 13, width - 10, 7);
      } else {
        ctx.fillStyle = "#e0a53a";
        ctx.fillRect(x - width / 2, obstacle.y - height / 2, width, height);
        ctx.fillStyle = "rgba(255,255,255,.30)";
        ctx.fillRect(x - width / 2 + 4, obstacle.y - height / 2 + 4, width - 8, 4);

        // Legs make the low barrier visually obvious.
        ctx.fillStyle = "#9f7020";
        const leg = Math.max(4, 7 * depth);
        ctx.fillRect(x - width / 2 + 6, obstacle.y + height / 2, leg, 11 * depth + 4);
        ctx.fillRect(x + width / 2 - 6 - leg, obstacle.y + height / 2, leg, 11 * depth + 4);
      }
    }

    // Ghost is exactly at the player's vertical height.
    if (ghostEnabled) {
      const ghostLane = GHOST_LANES[s.passed % GHOST_LANES.length];
      const ghostX = LANES[ghostLane];
      const ghostY = PLAYER_Y + s.jumpY;

      ctx.save();
      ctx.globalAlpha = 0.34;
      ctx.translate(ghostX, ghostY);
      ctx.fillStyle = "#d7f8ff";
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.lineTo(17, 22);
      ctx.lineTo(0, 15);
      ctx.lineTo(-17, 22);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.86;
      ctx.fillStyle = "#f1fdff";
      ctx.font = "900 12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("👻", 0, -34);
      ctx.restore();
    }

    // Player.
    ctx.save();
    ctx.translate(s.x, PLAYER_Y + s.jumpY);
    ctx.rotate(Math.max(-0.16, Math.min(0.16, (LANES[s.lane] - s.x) / 90)));
    ctx.shadowBlur = 15;
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

    // Compact HUD.
    ctx.fillStyle = "rgba(20,32,52,.86)";
    ctx.fillRect(14, 14, W - 28, 48);
    ctx.font = "900 12px system-ui";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.fillText(`SUPERADOS ${s.passed}`, 26, 44);
    ctx.fillStyle = "#7de5f5";
    ctx.textAlign = "right";
    ctx.fillText(`CARRIL ${s.lane + 1}/3`, W - 26, 44);

    ctx.fillStyle = "rgba(255,255,255,.45)";
    ctx.font = "900 24px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("←      ↑      →", CX, H - 28);
    ctx.textAlign = "start";
  }, [ghostEnabled]);

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
    const initial = makeInitialObstacles();

    state.current = {
      lane: 1,
      x: LANES[1],
      obstacles: initial.items,
      nextIndex: initial.nextIndex,
      running: true,
      ticks: 0,
      last: 0,
      acc: 0,
      passed: 0,
      score: 0,
      jumpY: 0,
      jumpVy: 0,
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

  function move(direction: -1 | 1) {
    const s = state.current;
    if (!s.running) return;

    const next = Math.max(0, Math.min(2, s.lane + direction)) as Lane;
    if (next === s.lane) return;

    s.lane = next;
    gameTone("tap");
    haptic(5);
  }

  function jump() {
    const s = state.current;
    if (!s.running || s.jumpY < -2) return;
    s.jumpVy = -450;
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
      if (dx > 24) move(1);
      else if (dx < -24) move(-1);
    } else if (dy < -24) {
      jump();
    }
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
        onPointerUp={(event) => {
          if (!swipeRef.current) return;
          const point = localPoint(event.clientX, event.clientY);
          gesture(point.x - swipeRef.current.x, point.y - swipeRef.current.y);
          swipeRef.current = null;
        }}
        onPointerCancel={() => {
          swipeRef.current = null;
        }}
        aria-label="Metro Shift"
      />
      <div className="gameRule floatingGameRule">Desliza ← → para cambiar · ↑ para saltar</div>
    </div>
  );
}
