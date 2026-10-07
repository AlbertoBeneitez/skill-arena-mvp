"use client";

/**
 * Precision Stack presentation/input adapter.
 *
 * Competitive movement, overlap, scoring and terminal state remain isolated in
 * precisionStackCore.v2.ts. This component owns only presentation, feedback,
 * lifecycle and translation of user input into the versioned DROP protocol.
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
  PRECISION_STACK_V2,
  stepPrecisionStack,
  type PrecisionStackInput,
  type PrecisionStackState,
} from "@/lib/verified/precisionStackCore.v2";
import {
  beginStackFrame,
  configureStackCanvas,
  drawDockingBase,
  drawDockingPreview,
  drawOrbitalBackground,
  drawStationModule,
  STACK_VIEW,
  worldYForStackBlock,
  type StackCanvasMetrics,
} from "./precision-stack/presentation";

const DROP_DURATION_MS = 180;
const FAILURE_DURATION_MS = 520;
const DT = 1 / PRECISION_STACK_V2.tickRate;
const CAMERA_RESPONSE = 10.5;

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
  ageMs: number;
  lifeMs: number;
};

function cubicIn(value: number) {
  return value * value * value;
}

function easeOutCubic(value: number) {
  const inv = 1 - value;
  return 1 - inv * inv * inv;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function currentStatus(
  state: PrecisionStackState
): PrecisionStackState["status"] {
  return state.status;
}

export default function PrecisionStack({
  active,
  stake,
  targetScore,
  onFinish,
}: GameRuntimeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const metricsRef = useRef<StackCanvasMetrics | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);

  const stateRef = useRef<PrecisionStackState>(
    createPrecisionStackState("preview")
  );
  const loopingRef = useRef(false);
  const terminalSubmittedRef = useRef(false);
  const startFailureReportedRef = useRef(false);

  const lastFrameTimeRef = useRef(0);
  const accumulatorRef = useRef(0);
  const lastDrawTimeRef = useRef(0);

  const cameraRef = useRef(0);
  const dropFxRef = useRef<DropFx | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const shakeUntilRef = useRef(0);

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

  const draw = useCallback((now = performance.now()) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const metrics =
      metricsRef.current ?? configureStackCanvas(canvas);
    metricsRef.current = metrics;
    beginStackFrame(ctx, canvas, metrics);

    const state = stateRef.current;
    const drawDeltaMs =
      lastDrawTimeRef.current > 0
        ? Math.min(50, Math.max(0, now - lastDrawTimeRef.current))
        : 16.67;
    lastDrawTimeRef.current = now;

    const highestY = worldYForStackBlock(
      Math.max(0, state.blocks.length - 1)
    );
    const targetCamera = Math.max(0, 208 - highestY);
    const cameraEase =
      1 - Math.exp(-CAMERA_RESPONSE * (drawDeltaMs / 1000));
    cameraRef.current +=
      (targetCamera - cameraRef.current) * cameraEase;

    drawOrbitalBackground(ctx, state, cameraRef.current);

    const shakeActive = now < shakeUntilRef.current;
    const shakeStrength = shakeActive
      ? clamp01((shakeUntilRef.current - now) / 240)
      : 0;
    const shakeX =
      Math.sin(now * 0.075) * 2.4 * shakeStrength;
    const shakeY =
      Math.cos(now * 0.091) * 1.7 * shakeStrength;

    ctx.save();
    ctx.translate(
      shakeX,
      cameraRef.current + shakeY
    );

    drawDockingBase(ctx);

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
      drawStationModule(
        ctx,
        block.xMilli / 1000,
        worldYForStackBlock(index),
        block.wMilli / 1000,
        index
      );
    }

    if (fx && fxProgress < 1) {
      if (fx.failed) {
        const t = cubicIn(fxProgress);
        const y =
          fx.startWorldY +
          (STACK_VIEW.height + 110 - fx.startWorldY) * t;

        ctx.save();
        ctx.translate(
          fx.sourceX + fx.sourceW / 2,
          y + STACK_VIEW.blockHeight / 2
        );
        ctx.rotate(fxProgress * 0.78);
        drawStationModule(
          ctx,
          -fx.sourceW / 2,
          -STACK_VIEW.blockHeight / 2,
          fx.sourceW,
          fx.level,
          {
            danger: true,
            alpha: 1 - fxProgress * 0.42,
          }
        );
        ctx.restore();
      } else {
        const fallProgress = clamp01(fxProgress / 0.58);
        const contactProgress = clamp01(
          (fxProgress - 0.58) / 0.42
        );
        const y =
          fx.startWorldY +
          (fx.targetWorldY - fx.startWorldY) *
            cubicIn(fallProgress);

        if (fallProgress < 1) {
          drawStationModule(
            ctx,
            fx.sourceX,
            y,
            fx.sourceW,
            fx.level,
            { moving: true }
          );
        } else {
          drawStationModule(
            ctx,
            fx.targetX,
            fx.targetWorldY,
            fx.targetW,
            fx.level,
            { perfect: fx.perfect }
          );

          const fragmentFall =
            5 + 96 * cubicIn(contactProgress);
          const fragmentAlpha =
            1 - contactProgress * 0.82;
          const rotation =
            easeOutCubic(contactProgress) * 0.34;

          if (fx.overhangLeft > 0) {
            ctx.save();
            const cx = fx.sourceX + fx.overhangLeft / 2;
            const cy =
              fx.targetWorldY +
              fragmentFall +
              STACK_VIEW.blockHeight / 2;
            ctx.translate(cx, cy);
            ctx.rotate(-rotation);
            drawStationModule(
              ctx,
              -fx.overhangLeft / 2,
              -STACK_VIEW.blockHeight / 2,
              fx.overhangLeft,
              fx.level,
              { alpha: fragmentAlpha }
            );
            ctx.restore();
          }

          if (fx.overhangRight > 0) {
            ctx.save();
            const cx =
              fx.sourceX +
              fx.sourceW -
              fx.overhangRight / 2;
            const cy =
              fx.targetWorldY +
              fragmentFall +
              STACK_VIEW.blockHeight / 2;
            ctx.translate(cx, cy);
            ctx.rotate(rotation);
            drawStationModule(
              ctx,
              -fx.overhangRight / 2,
              -STACK_VIEW.blockHeight / 2,
              fx.overhangRight,
              fx.level,
              { alpha: fragmentAlpha }
            );
            ctx.restore();
          }

          if (fx.perfect) {
            const pulse = Math.sin(contactProgress * Math.PI);
            const centerX = fx.targetX + fx.targetW / 2;

            ctx.save();
            ctx.globalAlpha = 0.72 * pulse;
            ctx.strokeStyle = "#8ff6f4";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(
              centerX,
              fx.targetWorldY + STACK_VIEW.blockHeight / 2,
              24 + contactProgress * 34,
              8 + contactProgress * 10,
              0,
              0,
              Math.PI * 2
            );
            ctx.stroke();

            ctx.fillStyle = "#c8ffff";
            ctx.font =
              "700 9px ui-monospace, SFMono-Regular, Menlo, monospace";
            ctx.textAlign = "center";
            ctx.fillText(
              "SYNC",
              centerX,
              fx.targetWorldY - 8 - contactProgress * 5
            );
            ctx.restore();
          }
        }
      }
    }

    if (
      state.status === "running" &&
      state.phase === "moving"
    ) {
      const nextIndex = state.blocks.length;
      const targetWorldY = worldYForStackBlock(nextIndex);

      drawDockingPreview(ctx, state, targetWorldY);

      const movingX = state.movingXMilli / 1000;
      const movingW = state.movingWMilli / 1000;
      const movingY =
        targetWorldY - STACK_VIEW.dropDistance;

      // Magnetic guide: presentation only. It makes the eventual landing
      // plane unambiguous without changing the competitive tolerance.
      ctx.strokeStyle = "rgba(96,208,231,.13)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 7]);
      ctx.beginPath();
      ctx.moveTo(movingX + movingW / 2, movingY + 34);
      ctx.lineTo(movingX + movingW / 2, targetWorldY + 2);
      ctx.stroke();
      ctx.setLineDash([]);

      drawStationModule(
        ctx,
        movingX,
        movingY,
        movingW,
        nextIndex,
        { moving: true }
      );
    }

    const dtSeconds = drawDeltaMs / 1000;
    for (let index = particlesRef.current.length - 1; index >= 0; index -= 1) {
      const particle = particlesRef.current[index];
      particle.ageMs += drawDeltaMs;

      if (particle.ageMs >= particle.lifeMs) {
        particlesRef.current.splice(index, 1);
        continue;
      }

      particle.x += particle.vx * dtSeconds;
      particle.y += particle.vy * dtSeconds;
      particle.vy += 125 * dtSeconds;

      const life = 1 - particle.ageMs / particle.lifeMs;
      ctx.globalAlpha = life;
      ctx.fillStyle = life > 0.45 ? "#a8fbf5" : "#f0d582";
      ctx.fillRect(
        particle.x - 1.5,
        particle.y - 1.5,
        3,
        3
      );
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    if (fx && fxProgress >= 1) {
      dropFxRef.current = null;
    }
  }, []);

  const submitTerminal = useCallback(
    async (state: PrecisionStackState) => {
      if (terminalSubmittedRef.current) return;
      terminalSubmittedRef.current = true;
      loopingRef.current = false;

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      const result = await verifyAttempt(state.tick);

      if (!result.ok || !result.verified) {
        finishRef.current({
          won: false,
          score: 0,
          timeMs: Math.round(
            (state.tick * 1000) /
              PRECISION_STACK_V2.tickRate
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

      if (lastFrameTimeRef.current <= 0) {
        lastFrameTimeRef.current = now;
      }

      const frameSeconds = Math.min(
        0.05,
        Math.max(0, (now - lastFrameTimeRef.current) / 1000)
      );
      lastFrameTimeRef.current = now;
      accumulatorRef.current += frameSeconds;

      while (
        stateRef.current.status === "running" &&
        accumulatorRef.current >= DT
      ) {
        step();
        accumulatorRef.current -= DT;
      }

      draw(now);

      const state = stateRef.current;
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
      metricsRef.current = configureStackCanvas(canvas);
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

    stateRef.current = createPrecisionStackState(
      attemptState.manifest.seed
    );

    terminalSubmittedRef.current = false;
    startFailureReportedRef.current = false;
    lastFrameTimeRef.current = 0;
    accumulatorRef.current = 0;
    lastDrawTimeRef.current = 0;
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
        rafRef.current = null;
      }
      particlesRef.current = [];
      dropFxRef.current = null;
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
    const targetWorldY = worldYForStackBlock(level);

    dropPrecisionStack(
      state,
      attemptState.manifest.seed,
      targetScore
    );

    const placement = state.lastPlacement;
    const failed = currentStatus(state) === "failed";
    const now = performance.now();

    dropFxRef.current = {
      startedAt: now,
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
      startWorldY:
        targetWorldY - STACK_VIEW.dropDistance,
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
      shakeUntilRef.current = now + 240;
      draw(now);
      return;
    }

    if (placement?.perfect) {
      gameTone("good");
      haptic([5, 12, 5]);
      const centerX =
        (placement.xMilli + placement.wMilli / 2) / 1000;
      const y = targetWorldY + 5;
      const count = 12;

      particlesRef.current = Array.from(
        { length: count },
        (_, index) => {
          const angle =
            (Math.PI * 2 * index) / count;
          const speed = 58 + (index % 3) * 18;
          return {
            x: centerX,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 24,
            ageMs: 0,
            lifeMs: 360 + (index % 4) * 35,
          };
        }
      );
    } else {
      gameTone("tap");
      haptic(4);

      if (placement) {
        const centerX =
          (placement.xMilli + placement.wMilli / 2) / 1000;
        particlesRef.current.push(
          {
            x: centerX - 8,
            y: targetWorldY + 7,
            vx: -24,
            vy: -42,
            ageMs: 0,
            lifeMs: 240,
          },
          {
            x: centerX + 8,
            y: targetWorldY + 7,
            vx: 24,
            vy: -42,
            ageMs: 0,
            lifeMs: 240,
          }
        );
      }
    }

    draw(now);
  }, [
    attemptState,
    draw,
    recordInput,
    targetScore,
  ]);

  return (
    <div className="detGameSurface precisionStackGame">
      <canvas
        ref={canvasRef}
        className="gameCanvas deterministicCanvas"
        aria-label="Stack: toca para acoplar el módulo"
        role="button"
        tabIndex={0}
        onPointerDown={(event) => {
          event.preventDefault();
          drop();
        }}
        onKeyDown={(event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            drop();
          }
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
