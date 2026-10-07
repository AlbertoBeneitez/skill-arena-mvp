"use client";

/**
 * Dino Dash presentation/input adapter.
 *
 * Competitive physics, obstacle generation, collision, scoring and replay live
 * in dinoDashCore.v1.ts. This component owns presentation, feedback and input.
 */

import { useCallback, useEffect, useRef } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import {
  beginLogicalCanvasFrame,
  configureLogicalCanvas,
  type CanvasViewportMetrics,
} from "@/lib/gameCanvas";
import { gameTone, haptic } from "@/lib/gameFeedback";
import { useVerifiedAttempt } from "@/lib/verified/useVerifiedAttempt";
import {
  applyDinoDashAction,
  createDinoDashState,
  DINO_DASH_V1,
  dinoDashIsGrounded,
  stepDinoDash,
  type DinoDashAction,
  type DinoDashInput,
  type DinoDashState,
} from "@/lib/verified/dinoDashCore.v1";

const DT = 1 / DINO_DASH_V1.tickRate;
const TERMINAL_FEEDBACK_MS = 260;
const W = DINO_DASH_V1.coordinateWidth;
const H = DINO_DASH_V1.coordinateHeight;
const GROUND = DINO_DASH_V1.groundY;
const PLAYER_X = DINO_DASH_V1.playerX;

type DuckAction = Extract<
  DinoDashAction,
  "DUCK_DOWN" | "DUCK_UP"
>;

export default function DinoDash({
  active,
  stake,
  targetScore,
  onFinish,
}: GameRuntimeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const metricsRef = useRef<CanvasViewportMetrics | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);

  const stateRef = useRef<DinoDashState>(
    createDinoDashState("preview")
  );
  const loopingRef = useRef(false);
  const terminalSubmittedRef = useRef(false);
  const startFailureReportedRef = useRef(false);
  const terminalStartedAtRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const accumulatorRef = useRef(0);
  const failureFlashUntilRef = useRef(0);
  const pendingDuckActionRef = useRef<DuckAction | null>(null);

  const verifiedAttempt = useVerifiedAttempt<DinoDashInput>({
    active,
    gameId: "dino-dash",
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
      metricsRef.current ?? configureLogicalCanvas(canvas, W, H);
    metricsRef.current = metrics;
    beginLogicalCanvasFrame(ctx, canvas, metrics);

    const state = stateRef.current;
    const phase = (state.tick / DINO_DASH_V1.tickRate) % 46;
    const night = phase > 31;
    const sky = ctx.createLinearGradient(0, 0, 0, H);

    if (night) {
      sky.addColorStop(0, "#0b1329");
      sky.addColorStop(0.62, "#182943");
      sky.addColorStop(1, "#30445b");
    } else {
      sky.addColorStop(0, "#d9eff7");
      sky.addColorStop(0.68, "#edf0dd");
      sky.addColorStop(1, "#f3d8a8");
    }

    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    if (night) {
      ctx.fillStyle = "rgba(255,255,255,.72)";
      for (let index = 0; index < 22; index += 1) {
        const x =
          (index * 71 - state.scroll * 0.03 + W * 4) % W;
        const y = 38 + ((index * 47) % 210);
        ctx.fillRect(x, y, 2, 2);
      }
    } else {
      const sun = ctx.createRadialGradient(318, 92, 8, 318, 92, 74);
      sun.addColorStop(0, "rgba(255,247,205,.92)");
      sun.addColorStop(1, "rgba(255,247,205,0)");
      ctx.fillStyle = sun;
      ctx.fillRect(240, 14, 150, 150);
    }

    ctx.fillStyle = night ? "#283447" : "#65685f";
    ctx.fillRect(0, GROUND, W, 4);

    ctx.fillStyle = night
      ? "rgba(255,255,255,.18)"
      : "rgba(38,44,42,.16)";
    for (let x = -((state.scroll * 0.7) % 34); x < W; x += 34) {
      ctx.fillRect(x, GROUND + 18, 20, 2);
    }

    for (const obstacle of state.obstacles) {
      const x = obstacle.worldX - state.scroll;
      if (x < -80 || x > W + 80) continue;

      if (obstacle.kind === "flyer") {
        const wing = Math.sin(state.tick * 0.18) * 5;
        ctx.fillStyle = night ? "#c46a8d" : "#b35d75";
        ctx.beginPath();
        ctx.moveTo(x, obstacle.y);
        ctx.lineTo(x + 18, obstacle.y - 12 - wing);
        ctx.lineTo(x + obstacle.w, obstacle.y);
        ctx.lineTo(x + 18, obstacle.y + 10 + wing * 0.3);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#f4d27c";
        ctx.fillRect(x + obstacle.w - 6, obstacle.y - 2, 7, 4);
      } else {
        ctx.fillStyle =
          obstacle.kind === "double" ? "#3d8c62" : "#4f9d6b";
        const count = obstacle.kind === "double" ? 2 : 1;

        for (let part = 0; part < count; part += 1) {
          const cx = x + part * 21;
          ctx.fillRect(cx + 7, GROUND - obstacle.h, 12, obstacle.h);
          ctx.fillRect(cx, GROUND - obstacle.h + 16, 8, 8);
          ctx.fillRect(cx + 18, GROUND - obstacle.h + 24, 8, 8);
        }
      }
    }

    const grounded = dinoDashIsGrounded(state);
    const playerHeight =
      state.ducking && grounded
        ? DINO_DASH_V1.playerDuckHeight
        : DINO_DASH_V1.playerStandingHeight;
    const playerY =
      state.ducking && grounded
        ? GROUND - playerHeight
        : state.y;

    ctx.fillStyle = night ? "#91a8c7" : "#243a58";
    ctx.fillRect(
      PLAYER_X + 7,
      playerY + 10,
      24,
      Math.max(8, playerHeight - 10)
    );

    ctx.fillStyle = "#f0c95c";
    ctx.fillRect(PLAYER_X + 22, playerY + 3, 17, 13);

    ctx.fillStyle = "#0d1423";
    ctx.fillRect(PLAYER_X + 33, playerY + 7, 3, 3);

    if (!(state.ducking && grounded)) {
      const legPhase = Math.floor(state.tick / 8) % 2;
      ctx.fillStyle = night ? "#91a8c7" : "#243a58";
      ctx.fillRect(
        PLAYER_X + 11,
        playerY + playerHeight - 2,
        5,
        legPhase ? 8 : 4
      );
      ctx.fillRect(
        PLAYER_X + 25,
        playerY + playerHeight - 2,
        5,
        legPhase ? 4 : 8
      );
    }

    if (now < failureFlashUntilRef.current) {
      const remaining =
        (failureFlashUntilRef.current - now) / TERMINAL_FEEDBACK_MS;
      ctx.fillStyle = `rgba(255,76,93,${0.06 + remaining * 0.12})`;
      ctx.fillRect(0, 0, W, H);
    }
  }, []);

  const submitTerminal = useCallback(
    async (state: DinoDashState) => {
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
            (state.tick * 1000) / DINO_DASH_V1.tickRate
          ),
          verified: false,
          verificationError: result.error ?? "REPLAY_MISMATCH",
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

  const markTerminalFeedback = useCallback((now: number) => {
    if (terminalStartedAtRef.current > 0) return;
    terminalStartedAtRef.current = now;

    if (stateRef.current.status === "won") {
      gameTone("win");
      haptic([16, 28, 46]);
    } else {
      failureFlashUntilRef.current = now + TERMINAL_FEEDBACK_MS;
      gameTone("bad");
      haptic([28, 20, 48]);
    }
  }, []);

  const flushPendingDuckAction = useCallback(() => {
    const action = pendingDuckActionRef.current;
    const state = stateRef.current;

    if (
      !action ||
      attemptState.status !== "ready" ||
      state.status !== "running"
    ) {
      return;
    }

    const accepted = recordInput({
      tick: state.tick,
      action,
    });
    if (!accepted) return;

    applyDinoDashAction(state, action);
    pendingDuckActionRef.current = null;
  }, [attemptState.status, recordInput]);

  const step = useCallback(() => {
    const state = stateRef.current;
    if (
      state.status !== "running" ||
      attemptState.status !== "ready"
    ) {
      return;
    }

    flushPendingDuckAction();
    const beforePassed = state.passedCount;
    stepDinoDash(state, targetScore);

    if (state.passedCount > beforePassed) {
      gameTone("good");
      haptic(3);
    }

    if (state.status !== "running") {
      markTerminalFeedback(performance.now());
    }
  }, [
    attemptState.status,
    flushPendingDuckAction,
    markTerminalFeedback,
    targetScore,
  ]);

  const loop = useCallback(
    (now: number) => {
      if (!loopingRef.current) return;

      if (lastFrameTimeRef.current <= 0) {
        lastFrameTimeRef.current = now;
      }

      // Do not discard elapsed simulation time on a late frame. Competitive
      // time must advance independently of render cadence; after throttling,
      // the fixed-step loop catches up before accepting a different outcome.
      accumulatorRef.current += Math.max(
        0,
        (now - lastFrameTimeRef.current) / 1000
      );
      lastFrameTimeRef.current = now;

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
        markTerminalFeedback(now);

        if (
          now - terminalStartedAtRef.current >= TERMINAL_FEEDBACK_MS
        ) {
          void submitTerminal(state);
          return;
        }
      }

      if (loopingRef.current) {
        rafRef.current = requestAnimationFrame(loop);
      }
    },
    [draw, markTerminalFeedback, step, submitTerminal]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      metricsRef.current = configureLogicalCanvas(canvas, W, H);
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
    if (!active || attemptState.status !== "ready") return;

    stateRef.current = createDinoDashState(attemptState.manifest.seed);
    loopingRef.current = true;
    terminalSubmittedRef.current = false;
    startFailureReportedRef.current = false;
    terminalStartedAtRef.current = 0;
    lastFrameTimeRef.current = 0;
    accumulatorRef.current = 0;
    failureFlashUntilRef.current = 0;
    pendingDuckActionRef.current = null;

    draw();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      loopingRef.current = false;
      pendingDuckActionRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
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

  const jump = useCallback(() => {
    const state = stateRef.current;
    if (
      attemptState.status !== "ready" ||
      !loopingRef.current ||
      state.status !== "running" ||
      !dinoDashIsGrounded(state)
    ) {
      return;
    }

    pendingDuckActionRef.current = null;
    const accepted = recordInput({
      tick: state.tick,
      action: "JUMP",
    });
    if (!accepted) return;

    applyDinoDashAction(state, "JUMP");
    gameTone("tap");
    haptic(3);
    draw();
  }, [attemptState.status, draw, recordInput]);

  const duckDown = useCallback(() => {
    const state = stateRef.current;
    if (
      attemptState.status !== "ready" ||
      !loopingRef.current ||
      state.status !== "running" ||
      state.ducking
    ) {
      return;
    }

    const accepted = recordInput({
      tick: state.tick,
      action: "DUCK_DOWN",
    });
    if (accepted) {
      applyDinoDashAction(state, "DUCK_DOWN");
      pendingDuckActionRef.current = null;
      haptic(2);
      draw();
      return;
    }

    pendingDuckActionRef.current = "DUCK_DOWN";
  }, [attemptState.status, draw, recordInput]);

  const duckUp = useCallback(() => {
    const state = stateRef.current;

    if (pendingDuckActionRef.current === "DUCK_DOWN" && !state.ducking) {
      pendingDuckActionRef.current = null;
      return;
    }

    if (
      attemptState.status !== "ready" ||
      !loopingRef.current ||
      state.status !== "running" ||
      !state.ducking
    ) {
      return;
    }

    const accepted = recordInput({
      tick: state.tick,
      action: "DUCK_UP",
    });
    if (accepted) {
      applyDinoDashAction(state, "DUCK_UP");
      pendingDuckActionRef.current = null;
      draw();
      return;
    }

    pendingDuckActionRef.current = "DUCK_UP";
  }, [attemptState.status, draw, recordInput]);

  return (
    <div className="detGameSurface dinoDashGame verifiedArena">
      <canvas
        ref={canvasRef}
        className="gameCanvas deterministicCanvas"
        aria-label="Dino Dash: toca para saltar"
        role="button"
        tabIndex={0}
        onPointerDown={(event) => {
          event.preventDefault();
          jump();
        }}
        onKeyDown={(event) => {
          if (
            event.key === " " ||
            event.key === "Enter" ||
            event.key === "ArrowUp"
          ) {
            event.preventDefault();
            jump();
          } else if (event.key === "ArrowDown" && !event.repeat) {
            event.preventDefault();
            duckDown();
          }
        }}
        onKeyUp={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            duckUp();
          }
        }}
      />

      <button
        type="button"
        className="dinoDuckButton"
        aria-label="Agacharse"
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          duckDown();
        }}
        onPointerUp={(event) => {
          duckUp();
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={duckUp}
        onLostPointerCapture={duckUp}
      >
        ↓
      </button>

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
