"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { GameResult } from "@/lib/types";
import { createRng } from "@/lib/deterministic/seeded";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = {
  active: boolean;
  targetScore: number;
  seed: string;
  onFinish: (result: GameResult) => void;
};

type Note = {
  lane: number;
  y: number;
  hit: boolean;
  missed: boolean;
  id: number;
};

const W = 390;
const H = 620;
const LANES = 4;
const LANE_W = W / LANES;
const HIT_Y = 538;
const NOTE_H = 116;
const DT = 1 / 120;

function buildLaneSequence(seed: string) {
  const rng = createRng(`${seed}:piano-sequence`);
  const lanes: number[] = [];
  let previous = -1;
  let run = 0;

  for (let index = 0; index < 1000; index += 1) {
    let lane = rng.nextInt(LANES);

    if (lane === previous) {
      run += 1;
      if (run >= 2) {
        lane = (lane + 1 + rng.nextInt(LANES - 1)) % LANES;
        run = 0;
      }
    } else {
      previous = lane;
      run = 0;
    }

    lanes.push(lane);
    previous = lane;
  }

  return lanes;
}

export default function PianoRush({
  active,
  targetScore,
  seed,
  onFinish,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const sequence = useMemo(() => buildLaneSequence(seed), [seed]);

  const stateRef = useRef({
    notes: [] as Note[],
    sequenceIndex: 0,
    score: 0,
    combo: 0,
    running: false,
    ticks: 0,
    last: 0,
    acc: 0,
    spawnAccumulator: 0,
    flashLane: -1,
    flashTicks: 0,
  });

  const speedFor = (score: number) =>
    Math.min(425, 220 + Math.floor(score / 2500) * 18);

  const spawnEveryFor = (score: number) =>
    Math.max(0.44, 0.68 - Math.floor(score / 4200) * 0.035);

  const finish = useCallback(
    (won: boolean) => {
      const s = stateRef.current;
      if (!s.running) return;

      s.running = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

      gameTone(won ? "win" : "bad");
      haptic(won ? [18, 30, 46] : 30);

      onFinish({
        won,
        score: s.score,
        timeMs: Math.round(performance.now() - startRef.current),
      });
    },
    [onFinish]
  );

  const spawnNote = useCallback(() => {
    const s = stateRef.current;
    const lane = sequence[s.sequenceIndex % sequence.length];

    s.notes.push({
      lane,
      y: -NOTE_H,
      hit: false,
      missed: false,
      id: s.sequenceIndex,
    });
    s.sequenceIndex += 1;
  }, [sequence]);

  const step = useCallback(() => {
    const s = stateRef.current;
    s.ticks += 1;
    s.flashTicks = Math.max(0, s.flashTicks - 1);

    const speed = speedFor(s.score);
    s.spawnAccumulator += DT;

    if (s.spawnAccumulator >= spawnEveryFor(s.score)) {
      s.spawnAccumulator = 0;
      spawnNote();
    }

    for (const note of s.notes) {
      if (!note.hit) note.y += speed * DT;

      if (
        !note.hit &&
        !note.missed &&
        note.y > HIT_Y + 38
      ) {
        note.missed = true;
        finish(false);
        return;
      }
    }

    s.notes = s.notes.filter(
      (note) => !note.hit && note.y < H + NOTE_H
    );
  }, [finish, spawnNote]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = stateRef.current;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#101322");
    bg.addColorStop(0.72, "#181d32");
    bg.addColorStop(1, "#090b12");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    for (let lane = 0; lane < LANES; lane += 1) {
      const x = lane * LANE_W;

      ctx.fillStyle =
        lane % 2 === 0
          ? "rgba(255,255,255,.028)"
          : "rgba(255,255,255,.052)";
      ctx.fillRect(x, 0, LANE_W, H);

      if (lane > 0) {
        ctx.strokeStyle = "rgba(255,255,255,.13)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }

      if (s.flashTicks > 0 && s.flashLane === lane) {
        ctx.fillStyle = "rgba(99,226,196,.18)";
        ctx.fillRect(x + 2, HIT_Y - NOTE_H + 4, LANE_W - 4, NOTE_H - 8);
      }
    }

    ctx.fillStyle = "rgba(255,255,255,.10)";
    ctx.fillRect(0, HIT_Y, W, 4);

    for (const note of s.notes) {
      if (note.hit) continue;
      const x = note.lane * LANE_W + 7;
      const width = LANE_W - 14;
      const y = note.y;

      const nearHit = Math.abs(y + NOTE_H - HIT_Y) < 44;
      ctx.fillStyle = nearHit ? "#f5f2e8" : "#d9dce7";
      ctx.shadowBlur = nearHit ? 16 : 6;
      ctx.shadowColor = nearHit
        ? "rgba(255,220,120,.55)"
        : "rgba(90,120,220,.18)";
      ctx.fillRect(x, y, width, NOTE_H - 7);
      ctx.shadowBlur = 0;

      ctx.fillStyle = "#151b2e";
      ctx.fillRect(x + 7, y + NOTE_H - 26, width - 14, 8);
    }
  }, []);

  const loop = useCallback(
    (now: number) => {
      const s = stateRef.current;
      if (!s.running) return;

      if (!s.last) s.last = now;
      s.acc += Math.min(0.05, (now - s.last) / 1000);
      s.last = now;

      while (s.acc >= DT && s.running) {
        step();
        s.acc -= DT;
      }

      draw();

      if (s.running) {
        rafRef.current = requestAnimationFrame(loop);
      }
    },
    [draw, step]
  );

  useEffect(() => {
    if (!active) return;

    stateRef.current = {
      notes: [],
      sequenceIndex: 0,
      score: 0,
      combo: 0,
      running: true,
      ticks: 0,
      last: 0,
      acc: 0,
      spawnAccumulator: 0,
      flashLane: -1,
      flashTicks: 0,
    };

    startRef.current = performance.now();

    for (let index = 0; index < 3; index += 1) {
      spawnNote();
      stateRef.current.notes[index].y = -NOTE_H - index * 150;
    }

    draw();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      stateRef.current.running = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, draw, loop, spawnNote]);

  function tapLane(lane: number) {
    const s = stateRef.current;
    if (!s.running) return;

    const candidates = s.notes
      .filter((note) => !note.hit && !note.missed && note.lane === lane)
      .sort((a, b) => b.y - a.y);

    const note = candidates[0];
    if (!note) {
      finish(false);
      return;
    }

    const noteBottom = note.y + NOTE_H;
    const error = Math.abs(noteBottom - HIT_Y);
    const tolerance = 54;

    if (error > tolerance) {
      finish(false);
      return;
    }

    note.hit = true;
    s.combo += 1;
    const precision = Math.max(0, 1 - error / tolerance);
    s.score +=
      350 +
      Math.round(precision * 450) +
      Math.min(400, s.combo * 12);

    s.flashLane = lane;
    s.flashTicks = 10;

    gameTone(precision > 0.72 ? "good" : "tap");
    haptic(precision > 0.72 ? 5 : 2);

    if (s.score >= targetScore) {
      finish(true);
    }
  }

  return (
    <div className="detGameSurface pianoRushGame">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas deterministicCanvas"
        aria-label="Piano Rush"
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const localX =
            ((event.clientX - rect.left) / rect.width) * W;
          const lane = Math.max(
            0,
            Math.min(LANES - 1, Math.floor(localX / LANE_W))
          );
          tapLane(lane);
        }}
      />
    </div>
  );
}
