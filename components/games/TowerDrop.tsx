"use client";

import { useCallback, useEffect, useRef } from "react";
import type { GameResult } from "@/lib/types";
import {
  beginLogicalCanvasFrame,
  configureLogicalCanvas,
  type CanvasViewportMetrics,
} from "@/lib/gameCanvas";
import { gameTone, haptic } from "@/lib/gameFeedback";
import { useVerifiedAttempt } from "@/lib/verified/useVerifiedAttempt";
import {
  createTowerDropState,
  dropTowerBlock,
  stepTowerDrop,
  TOWER_DROP_V2,
  type TowerDropInput,
  type TowerDropState,
} from "@/lib/verified/towerDropCore.v2";

type Props = {
  active: boolean;
  stake: number;
  ghostEnabled: boolean;
  targetScore: number;
  onFinish: (result: GameResult) => void;
};

const W = 390;
const H = 620;
const BLOCK_H = 44;
const CRANE_PIVOT_Y = 88;
const SWING_BLOCK_Y = 142;
const BASE_Y = H - 92;

const PALETTE = [
  "#3f82a8",
  "#536bb5",
  "#665ba7",
  "#347b7b",
  "#5a6c8d",
  "#725c91",
];

const CAMERA_RESPONSE = 8.5;

function ropeDropForBlock(x: number, width: number) {
  const centerX = x + width / 2;
  const dx = centerX - W / 2;
  const ropeLength = 132;
  return Math.sqrt(
    Math.max(12, ropeLength * ropeLength - dx * dx)
  );
}

function blockWorldY(index: number) {
  return BASE_Y - index * BLOCK_H;
}

function nextBlockWorldY(blockCount: number) {
  return BASE_Y - blockCount * BLOCK_H;
}

export default function TowerDrop({
  active,
  stake,
  ghostEnabled,
  targetScore,
  onFinish,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const metricsRef = useRef<CanvasViewportMetrics | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const stateRef = useRef<TowerDropState>(createTowerDropState());
  const loopingRef = useRef(false);
  const startFailureReportedRef = useRef(false);
  const cameraRef = useRef(0);
  const lastDrawTimeRef = useRef(0);
  const releaseScreenYRef = useRef(CRANE_PIVOT_Y + 132 + 5);

  const verifiedAttempt = useVerifiedAttempt<TowerDropInput>({
    active,
    gameId: "tower-drop",
    stakeMinor: Math.round(stake * 100),
    targetScore,
  });
  const {
    state: attemptState,
    recordInput,
    verifyAttempt,
  } = verifiedAttempt;

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  const drawBlock = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      paletteIndex: number,
      alpha = 1
    ) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      const body =
        PALETTE[Math.abs(paletteIndex) % PALETTE.length];
      ctx.shadowBlur = 12;
      ctx.shadowColor = "rgba(91,211,231,.18)";
      ctx.fillStyle = body;
      ctx.fillRect(x, y, width, BLOCK_H - 4);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(133,239,245,.45)";
      ctx.fillRect(x, y + 2, width, 3);
      ctx.fillStyle = "rgba(255,255,255,.14)";
      ctx.fillRect(x + 6, y + 8, Math.max(0, width - 12), 2);
      ctx.fillStyle = "rgba(3,12,25,.22)";
      ctx.fillRect(x + 6, y + 21, Math.max(0, width - 12), 2);
      ctx.fillStyle = "rgba(0,0,0,.18)";
      ctx.fillRect(x, y + BLOCK_H - 10, width, 6);

      for (let sx = x + 28; sx < x + width - 8; sx += 28) {
        ctx.fillStyle = "rgba(5,16,31,.20)";
        ctx.fillRect(sx, y + 7, 1, BLOCK_H - 18);
      }
      ctx.restore();
    },
    []
  );

  const draw = useCallback((now = performance.now()) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const metrics =
      metricsRef.current ??
      configureLogicalCanvas(canvas, W, H);
    metricsRef.current = metrics;
    beginLogicalCanvasFrame(ctx, canvas, metrics);

    const s = stateRef.current;
    const ticks = s.tick;
    const drawDeltaMs =
      lastDrawTimeRef.current > 0
        ? Math.min(50, Math.max(0, now - lastDrawTimeRef.current))
        : 16.67;
    lastDrawTimeRef.current = now;
    const stableBlocks = Math.max(1, s.blocks.length);
    const highestWorldY =
      BASE_Y - (stableBlocks - 1) * BLOCK_H;
    const targetCameraY = Math.max(
      0,
      CRANE_PIVOT_Y + 116 - highestWorldY
    );

    const cameraEase =
      1 -
      Math.exp(
        -CAMERA_RESPONSE * (drawDeltaMs / 1000)
      );
    cameraRef.current +=
      (targetCameraY - cameraRef.current) * cameraEase;
    if (Math.abs(targetCameraY - cameraRef.current) < 0.1) {
      cameraRef.current = targetCameraY;
    }
    const cameraY = cameraRef.current;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#040814");
    bg.addColorStop(0.55, "#0b1730");
    bg.addColorStop(1, "#111528");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const nebula = ctx.createRadialGradient(
      W * 0.78,
      H * 0.18,
      8,
      W * 0.78,
      H * 0.18,
      210
    );
    nebula.addColorStop(0, "rgba(80,109,201,.20)");
    nebula.addColorStop(0.55, "rgba(84,48,143,.08)");
    nebula.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, W, H);

    // Deterministic parallax stars: visual motion only.
    for (let i = 0; i < 46; i += 1) {
      const x = ((i * 83 + 29) % W);
      const depth = 0.22 + (i % 7) * 0.09;
      const y =
        ((i * 137 + ticks * depth * 0.11) %
          (H + 24)) -
        12;
      ctx.globalAlpha = 0.26 + (i % 5) * 0.1;
      ctx.fillStyle = "#deefff";
      ctx.fillRect(x, y, i % 6 === 0 ? 1.8 : 1, i % 6 === 0 ? 1.8 : 1);
    }
    ctx.globalAlpha = 1;

    // Orbital cargo gantry. Gameplay geometry remains unchanged.
    ctx.shadowBlur = 14;
    ctx.shadowColor = "rgba(83,216,233,.16)";
    ctx.strokeStyle = "#29455e";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(18, 72);
    ctx.lineTo(W - 18, 72);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "rgba(108,229,239,.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(24, 67);
    ctx.lineTo(W - 24, 67);
    ctx.stroke();

    ctx.fillStyle = "#263b58";
    ctx.fillRect(W / 2 - 24, 59, 48, 25);
    ctx.fillStyle = "#6fdde9";
    ctx.fillRect(W / 2 - 12, 63, 24, 3);
    ctx.fillStyle = "#1b2a42";
    ctx.fillRect(W / 2 - 7, 80, 14, 14);

    ctx.save();
    ctx.translate(0, cameraY);

    if (ghostEnabled) {
      const ghostWidth = TOWER_DROP_V2.blockWidthMilli / 1000;
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = "#6de6ff";
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 2;
      for (let index = 1; index <= 7; index += 1) {
        const x =
          (W - ghostWidth) / 2 +
          (index % 2 === 0 ? -7 : 7);
        ctx.strokeRect(
          x,
          blockWorldY(index),
          ghostWidth,
          BLOCK_H - 3
        );
      }
      ctx.restore();
    }

    s.blocks.forEach((block, index) => {
      drawBlock(
        ctx,
        block.xMilli / 1000,
        blockWorldY(index),
        block.wMilli / 1000,
        index
      );
    });

    const nextIndex = s.blocks.length;
    const targetY = nextBlockWorldY(nextIndex);
    const blockWidth = s.movingWMilli / 1000;

    if (s.status === "running" && s.phase === "swing") {
      const x = s.movingXMilli / 1000;
      const centerX = x + blockWidth / 2;
      const ropeDrop = ropeDropForBlock(x, blockWidth);
      const hookWorldY = CRANE_PIVOT_Y + ropeDrop - cameraY;

      ctx.strokeStyle = "#344760";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(W / 2, CRANE_PIVOT_Y - cameraY);
      ctx.lineTo(centerX, hookWorldY);
      ctx.stroke();

      ctx.fillStyle = "#344760";
      ctx.beginPath();
      ctx.arc(centerX, hookWorldY, 6, 0, Math.PI * 2);
      ctx.fill();

      drawBlock(
        ctx,
        x,
        hookWorldY + 5,
        blockWidth,
        nextIndex
      );
    } else if (
      s.phase === "falling" ||
      s.phase === "falling-out"
    ) {
      const progress = Math.max(
        0,
        Math.min(
          1,
          s.fallYMilli /
            TOWER_DROP_V2.dropDistanceMilli
        )
      );
      const releaseScreenY = releaseScreenYRef.current;
      const targetScreenY = targetY + cameraY;
      const screenY =
        releaseScreenY +
        (targetScreenY - releaseScreenY) * progress;
      const y = screenY - cameraY;

      drawBlock(
        ctx,
        s.fallXMilli / 1000,
        y,
        blockWidth,
        nextIndex
      );
    } else if (
      s.phase === "tipping-left" ||
      s.phase === "tipping-right"
    ) {
      const x = s.fallXMilli / 1000;
      const pivotX = s.tipPivotXMilli / 1000;
      const pivotY = targetY + BLOCK_H - 4;
      const radians =
        (s.tipDirection *
          (s.tipAngleMilliDeg / 1000) *
          Math.PI) /
        180;

      ctx.save();
      ctx.translate(pivotX, pivotY);
      ctx.rotate(radians);
      drawBlock(
        ctx,
        x - pivotX,
        targetY - pivotY,
        blockWidth,
        nextIndex
      );
      ctx.restore();
    }

    ctx.restore();
  }, [drawBlock]);

  const submitReplay = useCallback(
    async (state: TowerDropState) => {
      loopingRef.current = false;

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      const data = await verifyAttempt(state.tick);

      if (!data.ok || !data.verified) {
        finishRef.current({
          won: false,
          score: 0,
          timeMs: Math.round(
            (state.tick * 1000) /
              TOWER_DROP_V2.tickRate
          ),
          verified: false,
          verificationError:
            data.error ?? "REPLAY_MISMATCH",
        });
        return;
      }

      finishRef.current({
        won: data.won === true,
        score: data.score ?? 0,
        timeMs: data.time_ms ?? 0,
        verified: true,
        failureReason: data.failure ?? null,
      });
    },
    [verifyAttempt]
  );

  const step = useCallback(() => {
    const s = stateRef.current;
    if (s.status !== "running") return;

    const beforeBlocks = s.blocks.length;
    const beforePhase = s.phase;

    const stepped = stepTowerDrop(s, targetScore);

    if (stepped.blocks.length > beforeBlocks) {
      gameTone(stepped.combo > 0 ? "good" : "tap");
      haptic(stepped.combo > 0 ? 10 : 5);
    } else if (
      beforePhase === "falling" &&
      (stepped.phase === "tipping-left" ||
        stepped.phase === "tipping-right")
    ) {
      haptic(8);
    }

    if (
      stepped.status === "failed" ||
      stepped.status === "won"
    ) {
      draw();
      void submitReplay(stepped);
    }
  }, [draw, submitReplay, targetScore]);

  const loop = useCallback(
    (now: number) => {
      const s = stateRef.current;
      if (!loopingRef.current || s.status !== "running") {
        return;
      }

      const timing = stateRef.current as TowerDropState & {
        lastFrame?: number;
        accumulator?: number;
      };

      if (!timing.lastFrame) timing.lastFrame = now;
      timing.accumulator =
        (timing.accumulator ?? 0) +
        Math.min(0.05, (now - timing.lastFrame) / 1000);
      timing.lastFrame = now;

      const dt = 1 / TOWER_DROP_V2.tickRate;

      while (
        (timing.accumulator ?? 0) >= dt &&
        loopingRef.current &&
        stateRef.current.status === "running"
      ) {
        step();
        timing.accumulator =
          (timing.accumulator ?? 0) - dt;
      }

      draw();

      if (
        loopingRef.current &&
        stateRef.current.status === "running"
      ) {
        rafRef.current = requestAnimationFrame(loop);
      }
    },
    [draw, step]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      metricsRef.current = configureLogicalCanvas(
        canvas,
        W,
        H
      );
      draw();
    };

    resize();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(resize)
        : null;
    observer?.observe(canvas);
    window.addEventListener("orientationchange", resize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("orientationchange", resize);
    };
  }, [draw]);

  useEffect(() => {
    if (!active || attemptState.status !== "ready") {
      return;
    }

    cameraRef.current = 0;
    lastDrawTimeRef.current = 0;
    releaseScreenYRef.current = CRANE_PIVOT_Y + 132 + 5;
    startFailureReportedRef.current = false;
    const state =
      createTowerDropState() as TowerDropState & {
        lastFrame?: number;
        accumulator?: number;
      };
    state.lastFrame = 0;
    state.accumulator = 0;
    stateRef.current = state;
    loopingRef.current = true;
    draw();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      loopingRef.current = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [
    active,
    attemptState.status,
    attemptState.status === "ready"
      ? attemptState.manifest.match_id
      : "",
    draw,
    loop,
  ]);

  useEffect(() => {
    if (
      active &&
      attemptState.status === "rejected" &&
      stateRef.current.tick === 0 &&
      !startFailureReportedRef.current
    ) {
      startFailureReportedRef.current = true;
      finishRef.current({
        won: false,
        score: 0,
        timeMs: 0,
        verified: false,
        verificationError: attemptState.reason,
      });
    }
  }, [active, attemptState]);

  const place = useCallback(() => {
    const s = stateRef.current;

    if (
      attemptState.status !== "ready" ||
      !loopingRef.current ||
      s.status !== "running" ||
      s.phase !== "swing"
    ) {
      return;
    }

    const accepted = recordInput({
      tick: s.tick,
      action: "DROP",
    });
    if (!accepted) return;

    releaseScreenYRef.current =
      CRANE_PIVOT_Y +
      ropeDropForBlock(
        s.movingXMilli / 1000,
        s.movingWMilli / 1000
      ) +
      5;

    dropTowerBlock(s, targetScore);
    gameTone("tap");
    haptic(4);
  }, [attemptState.status, recordInput, targetScore]);

  return (
    <div className="gameStage skillGameStage towerDropArena verifiedArena">
      <canvas
        ref={canvasRef}
        className="gameCanvas deterministicCanvas"
        onPointerDown={(event) => {
          event.preventDefault();
          place();
        }}
        onKeyDown={(event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            place();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Tower Drop: toca para soltar el módulo orbital"
      />

      {(attemptState.status === "starting" ||
        attemptState.status === "verifying") && (
        <div className="verificationOverlay">
          <span>
            {attemptState.status === "starting"
              ? "PREPARANDO PARTIDA"
              : "COMPROBANDO RESULTADO"}
          </span>
        </div>
      )}
    </div>
  );
}
