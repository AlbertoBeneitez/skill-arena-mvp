"use client";

import { useCallback, useEffect, useRef } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = { active: boolean; targetScore: number; onFinish: (result: GameResult) => void };
type Kind = "spike" | "block" | "pillar";
type Piece = { offset: number; kind: Kind; w: number; h: number };
type Pattern = { span: number; pieces: Piece[] };
type Obstacle = Piece & { x: number; passed: boolean };

const W = 390;
const H = 620;
const DT = 1 / 120;
const FLOOR = 522;
const PLAYER_X = 82;
const SIZE = 32;
const QUARTER_TURN = Math.PI / 2;

const PATTERNS: Pattern[] = [
  { span: 330, pieces: [{ offset: 0, kind: "spike", w: 30, h: 30 }] },
  { span: 350, pieces: [{ offset: 0, kind: "block", w: 42, h: 42 }] },
  {
    span: 370,
    pieces: [
      { offset: 0, kind: "spike", w: 28, h: 30 },
      { offset: 54, kind: "spike", w: 28, h: 30 },
    ],
  },
  {
    span: 390,
    pieces: [
      { offset: 0, kind: "block", w: 44, h: 50 },
      { offset: 118, kind: "spike", w: 30, h: 30 },
    ],
  },
  {
    span: 405,
    pieces: [
      { offset: 0, kind: "spike", w: 28, h: 30 },
      { offset: 88, kind: "block", w: 40, h: 38 },
      { offset: 174, kind: "spike", w: 28, h: 30 },
    ],
  },
  {
    span: 420,
    pieces: [
      { offset: 0, kind: "pillar", w: 40, h: 64 },
      { offset: 144, kind: "spike", w: 30, h: 30 },
    ],
  },
  {
    span: 430,
    pieces: [
      { offset: 0, kind: "spike", w: 28, h: 30 },
      { offset: 48, kind: "spike", w: 28, h: 30 },
      { offset: 162, kind: "block", w: 42, h: 46 },
    ],
  },
  {
    span: 445,
    pieces: [
      { offset: 0, kind: "block", w: 42, h: 54 },
      { offset: 122, kind: "spike", w: 28, h: 30 },
      { offset: 174, kind: "spike", w: 28, h: 30 },
    ],
  },
];

function speedFor(ticks: number) {
  const seconds = ticks / 120;
  return Math.min(278, 144 + Math.max(0, seconds - 7) * 1.55);
}

function intersectsPlayer(
  playerY: number,
  obstacle: Obstacle,
  scroll: number
) {
  const x = obstacle.x - scroll;
  const px1 = PLAYER_X + 4;
  const px2 = PLAYER_X + SIZE - 4;
  const py1 = playerY + 4;
  const py2 = playerY + SIZE - 3;

  if (obstacle.kind === "spike") {
    const ox1 = x + obstacle.w * 0.18;
    const ox2 = x + obstacle.w * 0.82;
    const oy1 = FLOOR - obstacle.h * 0.68;
    return px2 > ox1 && px1 < ox2 && py2 > oy1 && py1 < FLOOR;
  }

  const oy1 = FLOOR - obstacle.h;
  return px2 > x && px1 < x + obstacle.w && py2 > oy1 && py1 < FLOOR;
}

export default function PulseRunner({ active, targetScore, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const jumpHeld = useRef(false);

  const state = useRef({
    y: FLOOR - SIZE,
    vy: 0,
    angle: 0,
    scroll: 0,
    obstacles: [] as Obstacle[],
    nextPatternX: 780,
    nextPatternIndex: 0,
    running: false,
    ticks: 0,
    last: 0,
    acc: 0,
    passed: 0,
    score: 0,
    grounded: true,
    coyote: 8,
    jumpBuffer: 0,
    holdTicks: 0,
    flash: 0,
  });

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  const spawnPattern = useCallback(() => {
    const s = state.current;
    const pattern = PATTERNS[s.nextPatternIndex % PATTERNS.length];
    const baseX = s.nextPatternX;

    for (const piece of pattern.pieces) {
      s.obstacles.push({
        ...piece,
        x: baseX + piece.offset,
        passed: false,
      });
    }

    s.nextPatternX += pattern.span;
    s.nextPatternIndex += 1;
  }, []);

  const finish = useCallback((won = false) => {
    const s = state.current;
    if (!s.running) return;

    s.running = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    gameTone(won ? "win" : "bad");
    haptic(won ? [18, 28, 45] : [30, 25, 52]);

    finishRef.current({
      won,
      score: s.score,
      timeMs: Math.round((s.ticks * 1000) / 120),
    });
  }, []);

  const step = useCallback(() => {
    const s = state.current;
    s.ticks += 1;
    s.flash = Math.max(0, s.flash - 1);

    const speed = speedFor(s.ticks);
    s.scroll += speed * DT;

    while (s.nextPatternX - s.scroll < 1450) {
      spawnPattern();
    }

    s.jumpBuffer = Math.max(0, s.jumpBuffer - 1);
    if (s.grounded) s.coyote = 9;
    else s.coyote = Math.max(0, s.coyote - 1);

    if (s.jumpBuffer > 0 && s.coyote > 0) {
      s.vy = -485;
      s.grounded = false;
      s.coyote = 0;
      s.jumpBuffer = 0;
      s.holdTicks = 0;
      gameTone("tap");
      haptic(4);
    }

    if (!s.grounded) {
      if (jumpHeld.current && s.vy < 0 && s.holdTicks < 16) {
        s.vy -= 330 * DT;
        s.holdTicks += 1;
      } else if (!jumpHeld.current && s.vy < -175) {
        s.vy += 1150 * DT;
      }

      s.vy += 1375 * DT;
      s.y += s.vy * DT;
      s.angle += (speed * DT / 74) * QUARTER_TURN;
    }

    if (s.y + SIZE >= FLOOR) {
      const wasAirborne = !s.grounded;
      s.y = FLOOR - SIZE;
      s.vy = 0;
      s.grounded = true;
      s.angle = Math.round(s.angle / QUARTER_TURN) * QUARTER_TURN;
      if (wasAirborne) haptic(2);
    }

    for (const obstacle of s.obstacles) {
      const x = obstacle.x - s.scroll;
      if (x > W + 90 || x + obstacle.w < -70) continue;

      if (intersectsPlayer(s.y, obstacle, s.scroll)) {
        finish();
        return;
      }

      if (!obstacle.passed && x + obstacle.w < PLAYER_X + 2) {
        obstacle.passed = true;
        s.passed += 1;
        s.score += 430 + Math.min(520, s.passed * 18);
        s.flash = 16;

        if (s.score >= targetScore) {
          finish(true);
          return;
        }

        if (s.passed % 4 === 0) {
          gameTone("good");
          haptic(7);
        }
      }
    }

    if (s.obstacles.length > 70) {
      s.obstacles = s.obstacles.filter(
        (obstacle) => obstacle.x - s.scroll > -120
      );
    }
  }, [finish, spawnPattern, targetScore]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = state.current;
    const speed = speedFor(s.ticks);
    const sector = Math.min(5, 1 + Math.floor(s.passed / 8));

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#111b45");
    bg.addColorStop(0.58, "#1a315d");
    bg.addColorStop(0.581, "#111a35");
    bg.addColorStop(1, "#070d1f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const farOffset = (s.scroll * 0.18) % 56;
    ctx.strokeStyle = "rgba(87,205,238,.10)";
    ctx.lineWidth = 1;
    for (let x = -farOffset; x < W + 56; x += 56) {
      ctx.beginPath();
      ctx.moveTo(x, 92);
      ctx.lineTo(x, FLOOR);
      ctx.stroke();
    }

    const nearOffset = (s.scroll * 0.5) % 72;
    ctx.strokeStyle = "rgba(103,226,247,.14)";
    for (let x = -nearOffset; x < W + 72; x += 72) {
      ctx.beginPath();
      ctx.moveTo(x, FLOOR - 112);
      ctx.lineTo(x + 34, FLOOR - 112);
      ctx.stroke();
    }

    ctx.fillStyle = "#1d2b4b";
    ctx.fillRect(0, FLOOR, W, H - FLOOR);
    ctx.fillStyle = "#63d9ed";
    ctx.fillRect(0, FLOOR, W, 5);
    ctx.fillStyle = "rgba(255,218,88,.6)";
    for (let x = -((s.scroll * 0.85) % 44); x < W + 44; x += 44) {
      ctx.fillRect(x, FLOOR + 22, 22, 3);
    }

    for (const obstacle of s.obstacles) {
      const x = obstacle.x - s.scroll;
      if (x < -80 || x > W + 80) continue;

      if (obstacle.kind === "spike") {
        const gradient = ctx.createLinearGradient(
          x,
          FLOOR - obstacle.h,
          x,
          FLOOR
        );
        gradient.addColorStop(0, "#ffda5f");
        gradient.addColorStop(1, "#ef5d73");
        ctx.fillStyle = gradient;
        ctx.shadowBlur = 9;
        ctx.shadowColor = "rgba(239,93,115,.55)";
        ctx.beginPath();
        ctx.moveTo(x, FLOOR);
        ctx.lineTo(x + obstacle.w / 2, FLOOR - obstacle.h);
        ctx.lineTo(x + obstacle.w, FLOOR);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle =
          obstacle.kind === "pillar" ? "#8a5bd1" : "#3c78d3";
        ctx.shadowBlur = 9;
        ctx.shadowColor = "rgba(91,142,225,.45)";
        ctx.fillRect(
          x,
          FLOOR - obstacle.h,
          obstacle.w,
          obstacle.h
        );
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,.22)";
        ctx.fillRect(
          x + 4,
          FLOOR - obstacle.h + 5,
          obstacle.w - 8,
          5
        );
        ctx.fillStyle = "#f3c955";
        ctx.fillRect(
          x + 4,
          FLOOR - 9,
          obstacle.w - 8,
          4
        );
      }
    }

    ctx.save();
    ctx.globalAlpha = s.grounded ? 0.38 : 0.18;
    ctx.fillStyle = "#02050c";
    ctx.beginPath();
    ctx.ellipse(
      PLAYER_X + SIZE / 2,
      FLOOR + 8,
      s.grounded ? 21 : 14,
      6,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(PLAYER_X + SIZE / 2, s.y + SIZE / 2);
    ctx.rotate(s.angle);
    ctx.shadowBlur = 18 + s.flash * 0.45;
    ctx.shadowColor = s.flash > 0 ? "#ffdc68" : "#63e6f5";
    ctx.fillStyle = "#61dceb";
    ctx.fillRect(-SIZE / 2, -SIZE / 2, SIZE, SIZE);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#183d72";
    ctx.fillRect(-SIZE / 2 + 5, -SIZE / 2 + 5, SIZE - 10, SIZE - 10);
    ctx.fillStyle = "#fff4bc";
    ctx.fillRect(5, -7, 5, 5);
    ctx.restore();

    ctx.textAlign = "start";
  }, []);

  const loop = useCallback(
    (now: number) => {
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
    },
    [draw, step]
  );

  const start = useCallback(() => {
    state.current = {
      y: FLOOR - SIZE,
      vy: 0,
      angle: 0,
      scroll: 0,
      obstacles: [],
      nextPatternX: 780,
      nextPatternIndex: 0,
      running: true,
      ticks: 0,
      last: 0,
      acc: 0,
      passed: 0,
      score: 0,
      grounded: true,
      coyote: 8,
      jumpBuffer: 0,
      holdTicks: 0,
      flash: 0,
    };

    for (let i = 0; i < 6; i += 1) spawnPattern();

    jumpHeld.current = false;
    draw();
    rafRef.current = requestAnimationFrame(loop);
  }, [draw, loop, spawnPattern]);

  useEffect(() => {
    if (active) start();

    return () => {
      state.current.running = false;
      jumpHeld.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, start]);

  const down = () => {
    if (!state.current.running) return;
    jumpHeld.current = true;
    state.current.jumpBuffer = 10;
  };

  const up = () => {
    jumpHeld.current = false;
  };

  return (
    <div className="gameStage skillGameStage pulseRunnerArena">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          down();
        }}
        onPointerUp={(event) => {
          up();
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={up}
        onPointerLeave={up}
        aria-label="Pulse Runner"
      />
    </div>
  );
}
