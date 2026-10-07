"use client";

/**
 * Alien Dash presentation/input adapter; historical dino-dash identity retained.
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
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import { useVerifiedAttempt } from "@/lib/verified/useVerifiedAttempt";
import {
  applyDinoDashAction,
  createDinoDashState,
  DINO_DASH_V1,
  dinoDashIsGrounded,
  dinoDashScore,
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
    drawSpaceBackdrop(ctx, W, H, state.scroll, state.tick);
    const floor = ctx.createLinearGradient(0, GROUND, 0, H);
    floor.addColorStop(0, "#142c42");
    floor.addColorStop(1, "#060f20");
    ctx.fillStyle = floor;
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = "#5acddb";
    ctx.fillRect(0, GROUND, W, 2);
    ctx.strokeStyle = "rgba(95,185,215,.16)";
    for (let x = -(state.scroll % 55); x < W; x += 55) {
      ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x - 30, H); ctx.stroke();
    }
    for (let y = GROUND + 20; y < H; y += 25) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    for (const obstacle of state.obstacles) {
      const x = obstacle.worldX - state.scroll;
      if (x < -80 || x > W + 80) continue;
      if (obstacle.kind === "flyer") {
        ctx.fillStyle = "#ba80e9";
        ctx.beginPath();
        ctx.ellipse(x + obstacle.w / 2, obstacle.y, obstacle.w / 2, obstacle.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffce82";
        ctx.fillRect(x + 10, obstacle.y - 2, obstacle.w - 20, 4);
      } else {
        const top = obstacle.y - obstacle.h;
        const plasma = ctx.createLinearGradient(0, top, 0, obstacle.y);
        plasma.addColorStop(0, "#d99af6"); plasma.addColorStop(1, "#694797");
        ctx.fillStyle = plasma;
        ctx.fillRect(x, top, obstacle.w, obstacle.h);
        ctx.strokeStyle = "#eed3ff"; ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, top + 1, obstacle.w - 2, obstacle.h - 2);
        ctx.fillStyle = "rgba(255,255,255,.65)";
        ctx.fillRect(x + 5, top + 8, obstacle.w - 10, 3);
      }
    }

    const grounded = dinoDashIsGrounded(state);
    const playerHeight = state.ducking && grounded ? DINO_DASH_V1.playerDuckHeight : DINO_DASH_V1.playerStandingHeight;
    const playerY = state.ducking && grounded ? GROUND - playerHeight : state.y;
    const headHeight = Math.min(20, playerHeight - 8);
    ctx.fillStyle = "#40bcae";
    ctx.fillRect(PLAYER_X + 9, playerY + headHeight - 2, 23, playerHeight - headHeight);
    ctx.fillStyle = "#9cf9dd";
    ctx.beginPath(); ctx.ellipse(PLAYER_X + 21, playerY + headHeight / 2 + 2, 15, headHeight / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#12383f";
    ctx.beginPath(); ctx.ellipse(PLAYER_X + 15, playerY + headHeight / 2 + 2, 3, 5, -.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(PLAYER_X + 28, playerY + headHeight / 2 + 2, 3, 5, .2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#73dccf";
    const stride = grounded ? Math.floor(state.tick / 8) % 2 * 3 : 0;
    ctx.fillRect(PLAYER_X + 10, playerY + playerHeight - 6, 7, 6 - stride);
    ctx.fillRect(PLAYER_X + 24, playerY + playerHeight - 6, 7, 3 + stride);

    ctx.fillStyle = "#d7f4ff"; ctx.font = "bold 12px system-ui";
    ctx.fillText("COLONIA ORBITAL", 20, 38);
    ctx.font = "bold 20px system-ui";
    ctx.textAlign = "right"; ctx.fillText(String(dinoDashScore(state)), W - 20, 39); ctx.textAlign = "left";
    ctx.fillStyle = "#97bacf"; ctx.font = "11px system-ui";
    ctx.fillText("TOCA · SALTA  /  ↓ · ESQUIVA", 18, H - 32);

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
      if (result.error === "VERIFICATION_ABORTED") return;

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

  useEffect(() => {
    const release = () => duckUp();
    const visibility = () => { if (document.hidden) release(); };
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [duckUp]);

  return (
    <div className="detGameSurface dinoDashGame verifiedArena">
      <canvas
        ref={canvasRef}
        className="gameCanvas deterministicCanvas"
        aria-label="Alien Dash: toca para saltar"
        role="button"
        tabIndex={0}
        onBlur={duckUp}
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
