"use client";

import { useCallback, useEffect, useRef } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = { active: boolean; onFinish: (result: GameResult) => void };
type Kind = "crate" | "pillar" | "spike";
type Obstacle = {
  x: number;
  w: number;
  h: number;
  kind: Kind;
  passed: boolean;
};
type Ring = {
  x: number;
  y: number;
  collected: boolean;
};

const W = 390;
const H = 620;
const DT = 1 / 120;
const FLOOR = 524;
const PLAYER_X = 86;
const PW = 28;
const PH = 36;

const GAP_PATTERN = [245,220,268,205,236,198,252,212,230,194,244,206,226,188];
const HEIGHT_PATTERN = [34,50,40,62,44,68,38,56,46,64,42,70,52,58];
const KIND_PATTERN: Kind[] = [
  "crate","spike","crate","pillar","spike","crate","pillar",
  "crate","spike","pillar","crate","spike","crate","pillar",
];

function speedFor(passed: number) {
  return Math.min(348, 168 + passed * 3.7);
}

function obstacleWidth(kind: Kind, index: number) {
  if (kind === "spike") return 28;
  if (kind === "pillar") return 34 + (index % 2) * 5;
  return 38 + (index % 3) * 4;
}

export default function PulseRunner({ active, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const jumpHeld = useRef(false);

  const state = useRef({
    y: FLOOR - PH,
    vy: 0,
    scroll: 0,
    obstacles: [] as Obstacle[],
    rings: [] as Ring[],
    nextX: 600,
    nextIndex: 0,
    running: false,
    ticks: 0,
    last: 0,
    acc: 0,
    passed: 0,
    score: 0,
    grounded: true,
    coyote: 0,
    jumpBuffer: 0,
    combo: 0,
    pulse: 0,
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
    haptic([30, 25, 52]);

    finishRef.current({
      won: false,
      score: s.score,
      timeMs: Math.round((s.ticks * 1000) / 120),
    });
  }, []);

  const addPattern = useCallback(() => {
    const s = state.current;
    const index = s.nextIndex++;
    const compression = Math.max(
      0.72,
      1 - Math.floor(s.passed / 18) * 0.035
    );
    const kind = KIND_PATTERN[index % KIND_PATTERN.length];
    const height =
      kind === "spike"
        ? 30
        : HEIGHT_PATTERN[index % HEIGHT_PATTERN.length];

    s.nextX += GAP_PATTERN[index % GAP_PATTERN.length] * compression;

    s.obstacles.push({
      x: s.nextX,
      w: obstacleWidth(kind, index),
      h: height,
      kind,
      passed: false,
    });

    // Deterministic mid-air reward line. It creates a reason to control jump length.
    if (index % 2 === 0) {
      const ringY =
        FLOOR - Math.min(150, 78 + (index % 4) * 20);
      s.rings.push({
        x: s.nextX - 72,
        y: ringY,
        collected: false,
      });
    }

    // Occasional double obstacle creates rhythm changes without randomness.
    if (index % 7 === 5) {
      s.obstacles.push({
        x: s.nextX + 82,
        w: 28,
        h: 30,
        kind: "spike",
        passed: false,
      });
    }

    if (s.obstacles.length > 26) s.obstacles.shift();
    if (s.rings.length > 18) s.rings.shift();
  }, []);

  const step = useCallback(() => {
    const s = state.current;
    s.ticks += 1;
    s.pulse = Math.max(0, s.pulse - 1);

    const speed = speedFor(s.passed);
    s.scroll += speed * DT;

    s.jumpBuffer = Math.max(0, s.jumpBuffer - 1);
    if (s.grounded) s.coyote = 8;
    else s.coyote = Math.max(0, s.coyote - 1);

    if (s.jumpBuffer > 0 && s.coyote > 0) {
      s.vy = -510;
      s.grounded = false;
      s.coyote = 0;
      s.jumpBuffer = 0;
      gameTone("tap");
      haptic(4);
    }

    if (!jumpHeld.current && s.vy < -175) {
      s.vy += 1450 * DT * 1.55;
    }

    s.vy += 1450 * DT;
    s.y += s.vy * DT;

    if (s.y + PH >= FLOOR) {
      s.y = FLOOR - PH;
      s.vy = 0;
      s.grounded = true;
    }

    const px1 = PLAYER_X;
    const px2 = PLAYER_X + PW;
    const py1 = s.y;
    const py2 = s.y + PH;

    for (const obstacle of s.obstacles) {
      const x = obstacle.x - s.scroll;
      if (x > W + 80 || x + obstacle.w < -60) continue;

      const oy1 = FLOOR - obstacle.h;

      if (
        px2 > x &&
        px1 < x + obstacle.w &&
        py2 > oy1 &&
        py1 < FLOOR
      ) {
        finish();
        return;
      }

      if (!obstacle.passed && x + obstacle.w < PLAYER_X) {
        obstacle.passed = true;
        s.passed += 1;
        s.combo += 1;
        s.pulse = 18;
        s.score += 300 + Math.min(540, s.combo * 24);

        gameTone(s.combo % 5 === 0 ? "good" : "tap");
        if (s.combo % 5 === 0) haptic(8);
        addPattern();
      }
    }

    for (const ring of s.rings) {
      if (ring.collected) continue;

      const x = ring.x - s.scroll;
      const dx = PLAYER_X + PW / 2 - x;
      const dy = s.y + PH / 2 - ring.y;

      if (dx * dx + dy * dy < 28 * 28) {
        ring.collected = true;
        s.combo += 1;
        s.score += 180 + s.combo * 8;
        s.pulse = 24;
        gameTone("good");
        haptic(6);
      }
    }
  }, [addPattern, finish]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = state.current;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0f2854");
    bg.addColorStop(0.52, "#244f86");
    bg.addColorStop(0.53, "#18243f");
    bg.addColorStop(1, "#080f22");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Multi-layer parallax gives speed without changing physics.
    ctx.fillStyle = "rgba(111,192,255,.08)";
    for (let x = -((s.scroll * 0.14) % 72); x < W + 72; x += 72) {
      ctx.fillRect(x, 92, 3, FLOOR - 92);
    }

    ctx.fillStyle = "rgba(111,192,255,.12)";
    for (let x = -((s.scroll * 0.32) % 48); x < W + 48; x += 48) {
      ctx.fillRect(x, 178, 2, FLOOR - 178);
    }

    // Speed streaks.
    ctx.strokeStyle = "rgba(132,222,255,.18)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i += 1) {
      const y = 120 + i * 45;
      const offset = (s.scroll * (0.5 + i * 0.02)) % 180;
      ctx.beginPath();
      ctx.moveTo(W - offset, y);
      ctx.lineTo(W - offset + 42, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#263958";
    ctx.fillRect(0, FLOOR, W, H - FLOOR);
    ctx.fillStyle = "#58d0e8";
    ctx.fillRect(0, FLOOR, W, 5);

    for (const ring of s.rings) {
      if (ring.collected) continue;
      const x = ring.x - s.scroll;
      if (x < -40 || x > W + 40) continue;

      ctx.strokeStyle = "#ffd95a";
      ctx.lineWidth = 5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#ffd95a";
      ctx.beginPath();
      ctx.arc(x, ring.y, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    for (const obstacle of s.obstacles) {
      const x = obstacle.x - s.scroll;
      if (x < -70 || x > W + 70) continue;

      if (obstacle.kind === "spike") {
        ctx.fillStyle = "#ff6b68";
        ctx.beginPath();
        ctx.moveTo(x, FLOOR);
        ctx.lineTo(x + obstacle.w / 2, FLOOR - obstacle.h);
        ctx.lineTo(x + obstacle.w, FLOOR);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ffd05e";
        ctx.fillRect(x + 4, FLOOR - 6, obstacle.w - 8, 4);
      } else {
        ctx.fillStyle =
          obstacle.kind === "pillar" ? "#b45fe0" : "#ef586a";
        ctx.fillRect(
          x,
          FLOOR - obstacle.h,
          obstacle.w,
          obstacle.h
        );
        ctx.fillStyle = "rgba(255,255,255,.28)";
        ctx.fillRect(
          x + 4,
          FLOOR - obstacle.h + 4,
          obstacle.w - 8,
          5
        );
        ctx.fillStyle = "#ffcc59";
        ctx.fillRect(
          x + 4,
          FLOOR - 10,
          obstacle.w - 8,
          5
        );
      }
    }

    // Shadow and subtle squash/stretch cues.
    ctx.save();
    ctx.globalAlpha = s.grounded ? 0.36 : 0.2;
    ctx.fillStyle = "#02060d";
    ctx.beginPath();
    ctx.ellipse(
      PLAYER_X + PW / 2,
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
    ctx.translate(PLAYER_X + PW / 2, s.y + PH / 2);
    ctx.rotate(Math.max(-0.26, Math.min(0.26, s.vy / 760)));
    const stretch = s.grounded ? 1 : 1.04;
    ctx.scale(1 / stretch, stretch);
    ctx.shadowBlur = 18 + s.pulse * 0.25;
    ctx.shadowColor = s.pulse > 0 ? "#ffd95a" : "#6de6ff";
    ctx.fillStyle = s.pulse > 0 ? "#82efff" : "#6de6ff";
    ctx.fillRect(-PW / 2, -PH / 2, PW, PH);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.fillRect(6, -8, 5, 5);
    ctx.restore();

    ctx.fillStyle = "rgba(7,14,34,.86)";
    ctx.fillRect(14, 14, W - 28, 52);
    ctx.font = "900 14px system-ui";
    ctx.fillStyle = "#fff";
    ctx.fillText(`SUPERADOS ${s.passed}`, 26, 44);
    ctx.fillStyle = "#ffd95a";
    ctx.textAlign = "right";
    ctx.fillText(`RACHA ×${Math.max(1, s.combo)}`, W - 26, 44);
    ctx.textAlign = "start";

    if (s.passed < 3) {
      ctx.fillStyle = "rgba(255,255,255,.58)";
      ctx.font = "900 13px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("TOCA · MANTÉN PARA SALTAR MÁS", W / 2, H - 28);
      ctx.textAlign = "start";
    }
  }, []);

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
    const obstacles: Obstacle[] = [];
    const rings: Ring[] = [];
    let x = 620;

    for (let i = 0; i < 10; i += 1) {
      const kind = KIND_PATTERN[i % KIND_PATTERN.length];
      obstacles.push({
        x,
        w: obstacleWidth(kind, i),
        h: kind === "spike" ? 30 : HEIGHT_PATTERN[i % HEIGHT_PATTERN.length],
        kind,
        passed: false,
      });

      if (i % 2 === 0) {
        rings.push({
          x: x - 72,
          y: FLOOR - Math.min(150, 78 + (i % 4) * 20),
          collected: false,
        });
      }

      x += GAP_PATTERN[i % GAP_PATTERN.length];
    }

    state.current = {
      y: FLOOR - PH,
      vy: 0,
      scroll: 0,
      obstacles,
      rings,
      nextX: obstacles[obstacles.length - 1].x,
      nextIndex: 10,
      running: true,
      ticks: 0,
      last: 0,
      acc: 0,
      passed: 0,
      score: 0,
      grounded: true,
      coyote: 8,
      jumpBuffer: 0,
      combo: 0,
      pulse: 0,
    };

    jumpHeld.current = false;
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

  const down = () => {
    jumpHeld.current = true;
    state.current.jumpBuffer = 8;
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
        aria-label="Pulse Runner"
      />
    </div>
  );
}
