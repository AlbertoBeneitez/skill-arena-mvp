"use client";

/**
 * Precision Stack presentation/input adapter.
 *
 * Competitive rules, movement, overlap, scoring and terminal state live in
 * precisionStackCore.v1.ts. This component owns only Canvas presentation,
 * camera, effects, audio/haptics and translation of pointer input into DROP.
 *
 * Gameplay provenance:
 * - Balance Stack, sausi-7/games, MIT
 * - audited commit c97ef8bec4a4ce3154b4345a79aeda3ea2a6a465
 */

import { useCallback, useEffect, useRef } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import { gameTone, haptic } from "@/lib/gameFeedback";
import { useVerifiedAttempt } from "@/lib/verified/useVerifiedAttempt";
import {
  createPrecisionStackState,
  dropPrecisionStack,
  PRECISION_STACK_V1,
  stepPrecisionStack,
  type PrecisionStackInput,
  type PrecisionStackState,
} from "@/lib/verified/precisionStackCore.v1";

const W = 390;
const H = 620;
const BLOCK_H = 38;
const BASE_Y = H - 72;
const DROP_DISTANCE = 78;
const DROP_DURATION_MS = 250;
const FAILURE_DURATION_MS = 520;
const DT = 1 / PRECISION_STACK_V1.tickRate;

type DropFx = {
  startedAt: number;
  durationMs: number;
  sourceX: number;
  sourceW: number;
  targetX: number;
  targetW: number;
  startWorldY: number;
  targetWorldY: number;
  level: number;
  failed: boolean;
  perfect: boolean;
  overhangLeft: number;
  overhangRight: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
};

function worldYForBlock(index: number) {
  return BASE_Y - index * BLOCK_H;
}

function cubicIn(value: number) {
  return value * value * value;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function configureCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const width = Math.round(W * dpr);
  const height = Math.round(H * dpr);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  canvas.style.aspectRatio = `${W} / ${H}`;
  return dpr;
}

export default function PrecisionStack({
  active,
  stake,
  targetScore,
  onFinish,
}: GameRuntimeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const loopingRef = useRef(false);
  const terminalSubmittedRef = useRef(false);
  const startFailureReportedRef = useRef(false);
  const cameraRef = useRef(0);
  const dropFxRef = useRef<DropFx | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const shakeUntilRef = useRef(0);
  const stateRef = useRef<PrecisionStackState>(
    createPrecisionStackState("preview")
  );

  const verifiedAttempt = useVerifiedAttempt<PrecisionStackInput>({
    active,
    gameId: "precision-stack",
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
      level: number,
      alpha = 1
    ) => {
      const hue = (205 + level * 17) % 360;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 10;
      ctx.shadowColor = `hsla(${hue} 85% 65% / .28)`;
      ctx.fillStyle = `hsl(${hue} 70% 60%)`;
      ctx.fillRect(x, y, width, BLOCK_H - 4);
      ctx.shadowBlur = 0;

      ctx.fillStyle = "rgba(255,255,255,.22)";
      ctx.fillRect(x + 4, y + 4, Math.max(0, width - 8), 4);
      ctx.fillStyle = "rgba(0,0,0,.10)";
      ctx.fillRect(x, y + BLOCK_H - 9, width, 5);
      ctx.restore();
    },
    []
  );

  const draw = useCallback(
    (now = performance.now()) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = configureCanvas(canvas);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const state = stateRef.current;
      const highestY = worldYForBlock(
        Math.max(0, state.blocks.length - 1)
      );
      const targetCamera = Math.max(0, 208 - highestY);
      cameraRef.current +=
        (targetCamera - cameraRef.current) * 0.1;

      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#171b3d");
      bg.addColorStop(0.58, "#202a50");
      bg.addColorStop(1, "#0a0f22");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const gridOffset =
        (state.tick * 0.18 + cameraRef.current * 0.25) % 42;
      ctx.strokeStyle = "rgba(125,155,255,.055)";
      ctx.lineWidth = 1;
      for (let y = -42 + gridOffset; y < H; y += 42) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      const shakeActive = now < shakeUntilRef.current;
      const shakeX = shakeActive ? Math.sin(now * 0.09) * 2.2 : 0;
      const shakeY = shakeActive ? Math.cos(now * 0.11) * 1.6 : 0;

      ctx.save();
      ctx.translate(
        shakeX,
        cameraRef.current + shakeY
      );

      ctx.fillStyle = "#263754";
      ctx.fillRect(34, BASE_Y + 3, W - 68, 20);
      ctx.fillStyle = "rgba(255,255,255,.10)";
      ctx.fillRect(43, BASE_Y + 6, W - 86, 3);

      const fx = dropFxRef.current;
      const fxProgress = fx
        ? clamp01((now - fx.startedAt) / fx.durationMs)
        : 1;
      const hideLastPlaced =
        fx &&
        !fx.failed &&
        fxProgress < 1 &&
        state.blocks.length > 1;
      const stableLimit = hideLastPlaced
        ? state.blocks.length - 1
        : state.blocks.length;

      for (let index = 0; index < stableLimit; index += 1) {
        const block = state.blocks[index];
        drawBlock(
          ctx,
          block.xMilli / 1000,
          worldYForBlock(index),
          block.wMilli / 1000,
          index
        );
      }

      if (fx && fxProgress < 1) {
        if (fx.failed) {
          const t = cubicIn(fxProgress);
          const y =
            fx.startWorldY +
            (H + 120 - fx.startWorldY) * t;
          ctx.save();
          ctx.translate(
            fx.sourceX + fx.sourceW / 2,
            y + BLOCK_H / 2
          );
          ctx.rotate(fxProgress * 0.62);
          drawBlock(
            ctx,
            -fx.sourceW / 2,
            -BLOCK_H / 2,
            fx.sourceW,
            fx.level,
            1 - fxProgress * 0.35
          );
          ctx.restore();
        } else {
          const fallProgress = clamp01(fxProgress / 0.68);
          const contactProgress = clamp01(
            (fxProgress - 0.68) / 0.32
          );
          const y =
            fx.startWorldY +
            (fx.targetWorldY - fx.startWorldY) *
              cubicIn(fallProgress);

          if (fallProgress < 1) {
            drawBlock(
              ctx,
              fx.sourceX,
              y,
              fx.sourceW,
              fx.level
            );
          } else {
            drawBlock(
              ctx,
              fx.targetX,
              fx.targetWorldY,
              fx.targetW,
              fx.level
            );

            const fragmentFall =
              8 + 88 * cubicIn(contactProgress);
            const fragmentAlpha =
              1 - contactProgress * 0.72;

            if (fx.overhangLeft > 0) {
              drawBlock(
                ctx,
                fx.sourceX,
                fx.targetWorldY + fragmentFall,
                fx.overhangLeft,
                fx.level,
                fragmentAlpha
              );
            }

            if (fx.overhangRight > 0) {
              drawBlock(
                ctx,
                fx.sourceX +
                  fx.sourceW -
                  fx.overhangRight,
                fx.targetWorldY + fragmentFall,
                fx.overhangRight,
                fx.level,
                fragmentAlpha
              );
            }
          }
        }
      }

      if (
        state.status === "running" &&
        state.phase === "moving"
      ) {
        const nextIndex = state.blocks.length;
        const targetWorldY = worldYForBlock(nextIndex);
        drawBlock(
          ctx,
          state.movingXMilli / 1000,
          targetWorldY - DROP_DISTANCE,
          state.movingWMilli / 1000,
          nextIndex
        );

        ctx.strokeStyle = "rgba(180,205,255,.16)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 7]);
        ctx.beginPath();
        ctx.moveTo(16, targetWorldY);
        ctx.lineTo(W - 16, targetWorldY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const nextParticles: Particle[] = [];
      for (const particle of particlesRef.current) {
        const next = {
          ...particle,
          x: particle.x + particle.vx,
          y: particle.y + particle.vy,
          vy: particle.vy + 0.06,
          life: particle.life - 0.045,
        };

        if (next.life <= 0) continue;
        nextParticles.push(next);

        ctx.globalAlpha = next.life;
        ctx.fillStyle = "#f4d36b";
        ctx.fillRect(next.x, next.y, 3, 3);
      }
      ctx.globalAlpha = 1;
      particlesRef.current = nextParticles;

      ctx.restore();

      if (fx && fxProgress >= 1) {
        dropFxRef.current = null;
      }
    },
    [drawBlock]
  );

  const submitTerminal = useCallback(
    async (state: PrecisionStackState) => {
      if (terminalSubmittedRef.current) return;
      terminalSubmittedRef.current = true;
      loopingRef.current = false;

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      const result = await verifyAttempt(state.tick);

      if (!result.ok || !result.verified) {
        finishRef.current({
          won: false,
          score: 0,
          timeMs: Math.round(
            (state.tick * 1000) /
              PRECISION_STACK_V1.tickRate
          ),
          verified: false,
          verificationError:
            result.error ?? "REPLAY_MISMATCH",
        });
        return;
      }

      finishRef.current({
        won: result.won === true,
        score: result.score ?? 0,
        timeMs: result.time_ms ?? 0,
        verified: true,
        failureReason: result.failure ?? null,
      });
    },
    [verifyAttempt]
  );

  const step = useCallback(() => {
    const state = stateRef.current;
    if (state.status !== "running") return;

    stepPrecisionStack(
      state,
      attemptState.status === "ready"
        ? attemptState.manifest.seed
        : "inactive",
      targetScore
    );
  }, [attemptState, targetScore]);

  const loop = useCallback(
    (now: number) => {
      if (!loopingRef.current) return;

      const state = stateRef.current as PrecisionStackState & {
        lastFrame?: number;
        accumulator?: number;
      };

      if (!state.lastFrame) state.lastFrame = now;
      state.accumulator =
        (state.accumulator ?? 0) +
        Math.min(0.05, (now - state.lastFrame) / 1000);
      state.lastFrame = now;

      while (
        state.status === "running" &&
        (state.accumulator ?? 0) >= DT
      ) {
        step();
        state.accumulator =
          (state.accumulator ?? 0) - DT;
      }

      draw(now);

      if (state.status !== "running") {
        const fx = dropFxRef.current;
        if (
          !fx ||
          now - fx.startedAt >= fx.durationMs
        ) {
          void submitTerminal(state);
          return;
        }
      }

      if (loopingRef.current) {
        rafRef.current = requestAnimationFrame(loop);
      }
    },
    [draw, step, submitTerminal]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      configureCanvas(canvas);
      draw();
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
    };
  }, [draw]);

  useEffect(() => {
    if (!active || attemptState.status !== "ready") {
      return;
    }

    const state =
      createPrecisionStackState(
        attemptState.manifest.seed
      ) as PrecisionStackState & {
        lastFrame?: number;
        accumulator?: number;
      };

    state.lastFrame = 0;
    state.accumulator = 0;
    stateRef.current = state;

    terminalSubmittedRef.current = false;
    startFailureReportedRef.current = false;
    cameraRef.current = 0;
    dropFxRef.current = null;
    particlesRef.current = [];
    shakeUntilRef.current = 0;
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

  const drop = useCallback(() => {
    const state = stateRef.current;
    if (
      attemptState.status !== "ready" ||
      !loopingRef.current ||
      state.status !== "running" ||
      state.phase !== "moving"
    ) {
      return;
    }

    const accepted = recordInput({
      tick: state.tick,
      action: "DROP",
    });
    if (!accepted) return;

    const sourceX = state.movingXMilli / 1000;
    const sourceW = state.movingWMilli / 1000;
    const level = state.blocks.length;
    const targetWorldY = worldYForBlock(level);

    dropPrecisionStack(
      state,
      attemptState.manifest.seed,
      targetScore
    );

    const placement = state.lastPlacement;
    const failed = state.status === "failed";

    dropFxRef.current = {
      startedAt: performance.now(),
      durationMs: failed
        ? FAILURE_DURATION_MS
        : DROP_DURATION_MS,
      sourceX,
      sourceW,
      targetX:
        placement?.xMilli !== undefined
          ? placement.xMilli / 1000
          : sourceX,
      targetW:
        placement?.wMilli !== undefined
          ? placement.wMilli / 1000
          : sourceW,
      startWorldY: targetWorldY - DROP_DISTANCE,
      targetWorldY,
      level,
      failed,
      perfect: placement?.perfect === true,
      overhangLeft:
        (placement?.overhangLeftMilli ?? 0) / 1000,
      overhangRight:
        (placement?.overhangRightMilli ?? 0) / 1000,
    };

    if (failed) {
      gameTone("bad");
      haptic([24, 18, 42]);
      shakeUntilRef.current =
        performance.now() + 240;
      return;
    }

    if (placement?.perfect) {
      gameTone("good");
      haptic([5, 12, 5]);
      const centerX =
        (placement.xMilli + placement.wMilli / 2) / 1000;
      const y = targetWorldY + 5;
      particlesRef.current = Array.from(
        { length: 10 },
        (_, index) => {
          const angle =
            (Math.PI * 2 * index) / 10;
          return {
            x: centerX,
            y,
            vx: Math.cos(angle) * 1.6,
            vy: Math.sin(angle) * 1.2 - 0.8,
            life: 1,
          };
        }
      );
    } else {
      gameTone("tap");
      haptic(4);
    }
  }, [
    attemptState,
    recordInput,
    targetScore,
  ]);

  return (
    <div className="detGameSurface precisionStackGame">
      <canvas
        ref={canvasRef}
        className="gameCanvas deterministicCanvas"
        aria-label="Stack"
        onPointerDown={(event) => {
          event.preventDefault();
          drop();
        }}
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
