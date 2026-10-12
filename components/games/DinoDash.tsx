"use client";

/**
 * Dino Dash presentation/input adapter.
 *
 * The competitive runner rules live in dinoDashCore.v1.ts. This component
 * owns rendering, mobile input, feedback and server-replay submission only.
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
  applyDinoDashInput,
  createDinoDashState,
  DINO_DASH_V1,
  dinoDashPlayerGroundYMilli,
  isDinoDashGrounded,
  stepDinoDash,
  type DinoDashAction,
  type DinoDashInput,
  type DinoDashObstacle,
  type DinoDashState,
} from "@/lib/verified/dinoDashCore.v1";

const DT = 1 / DINO_DASH_V1.tickRate;
const VIEW = {
  width: DINO_DASH_V1.coordinateWidth,
  height: DINO_DASH_V1.coordinateHeight,
} as const;
const TERMINAL_FEEDBACK_MS = 280;
const MAX_CATCH_UP_SECONDS =
  DINO_DASH_V1.maxFinalTick / DINO_DASH_V1.tickRate + 1;

function px(milli: number) {
  return milli / 1000;
}

function playerHeight(state: DinoDashState) {
  return state.ducking && isDinoDashGrounded(state)
    ? DINO_DASH_V1.playerDuckingHeightMilli
    : DINO_DASH_V1.playerStandingHeightMilli;
}

function playerY(state: DinoDashState) {
  return state.ducking && isDinoDashGrounded(state)
    ? DINO_DASH_V1.groundYMilli - playerHeight(state)
    : state.yMilli;
}

function drawObstacle(
  ctx: CanvasRenderingContext2D,
  obstacle: DinoDashObstacle,
  x: number
) {
  const ground = px(DINO_DASH_V1.groundYMilli);

  if (obstacle.kind === "flyer") {
    const y = px(obstacle.yMilli);
    const wing = Math.max(8, px(obstacle.wMilli) * 0.45);

    ctx.fillStyle = "#b35d75";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + wing, y - 13);
    ctx.lineTo(x + px(obstacle.wMilli), y);
    ctx.lineTo(x + wing, y + 11);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#f4d27c";
    ctx.fillRect(x + px(obstacle.wMilli) - 6, y - 2, 7, 4);
    return;
  }

  ctx.fillStyle =
    obstacle.kind === "double" ? "#3d8c62" : "#4f9d6b";
  const count = obstacle.kind === "double" ? 2 : 1;

  for (let part = 0; part < count; part += 1) {
    const cx = x + part * 21;
    const h = px(obstacle.hMilli);
    ctx.fillRect(cx + 7, ground - h, 12, h);
    ctx.fillRect(cx, ground - h + 16, 8, 8);
    ctx.fillRect(cx + 18, ground - h + 24, 8, 8);
  }
}

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
  const runGenerationRef = useRef(0);

  const lastFrameTimeRef = useRef(0);
  const accumulatorRef = useRef(0);
  const failureFlashUntilRef = useRef(0);
  const lastRecordedTickRef = useRef(-1);
  const pendingActionRef = useRef<DinoDashAction | null>(null);

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
      metricsRef.current ??
      configureLogicalCanvas(
        canvas,
        VIEW.width,
        VIEW.height
      );
    metricsRef.current = metrics;
    beginLogicalCanvasFrame(ctx, canvas, metrics);

    const state = stateRef.current;
    const phase = (state.tick / DINO_DASH_V1.tickRate) % 46;
    const night = phase > 31;
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW.height);

    if (night) {
      sky.addColorStop(0, "#18223f");
      sky.addColorStop(1, "#495b78");
    } else {
      sky.addColorStop(0, "#d9eff7");
      sky.addColorStop(1, "#f5e5bf");
    }

    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    if (night) {
      ctx.fillStyle = "rgba(255,255,255,.72)";
      for (let index = 0; index < 22; index += 1) {
        const x =
          (index * 71 - px(state.scrollMilli) * 0.03) %
          VIEW.width;
        const y = 38 + ((index * 47) % 210);
        ctx.fillRect((x + VIEW.width) % VIEW.width, y, 2, 2);
      }
    }

    const ground = px(DINO_DASH_V1.groundYMilli);
    ctx.fillStyle = night ? "#27303f" : "#66685f";
    ctx.fillRect(0, ground, VIEW.width, 4);

    ctx.fillStyle = night
      ? "rgba(255,255,255,.20)"
      : "rgba(50,50,50,.18)";
    for (
      let x = -((px(state.scrollMilli) * 0.7) % 34);
      x < VIEW.width;
      x += 34
    ) {
      ctx.fillRect(x, ground + 18, 20, 2);
    }

    for (const obstacle of state.obstacles) {
      const x = px(obstacle.worldXMilli - state.scrollMilli);
      if (x < -80 || x > VIEW.width + 80) continue;
      drawObstacle(ctx, obstacle, x);
    }

    const standingY = px(dinoDashPlayerGroundYMilli());
    const height = px(playerHeight(state));
    const y = px(playerY(state));
    const playerX = px(DINO_DASH_V1.playerXMilli);
    const grounded = isDinoDashGrounded(state);

    ctx.save();
    if (!grounded) {
      ctx.translate(0, Math.sin(state.tick * 0.18) * 1.5);
    }

    ctx.fillStyle = "#243a58";
    ctx.fillRect(playerX + 7, y + 10, 24, height - 10);

    ctx.fillStyle = "#f0c95c";
    ctx.fillRect(playerX + 22, y + 3, 17, 13);

    ctx.fillStyle = "#0d1423";
    ctx.fillRect(playerX + 33, y + 7, 3, 3);

    const legPhase = Math.floor(state.tick / 8) % 2;
    const footY = state.ducking && grounded ? standingY + 17 : y + height - 2;
    ctx.fillStyle = "#243a58";
    ctx.fillRect(playerX + 11, footY, 5, legPhase ? 8 : 4);
    ctx.fillRect(playerX + 25, footY, 5, legPhase ? 4 : 8);
    ctx.restore();

    if (now < failureFlashUntilRef.current) {
      const remaining =
        (failureFlashUntilRef.current - now) /
        TERMINAL_FEEDBACK_MS;
      ctx.fillStyle = `rgba(255,76,93,${0.06 + remaining * 0.14})`;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
  }, []);

  const submitTerminal = useCallback(
    async (state: DinoDashState) => {
      if (terminalSubmittedRef.current) return;
      const runGeneration = runGenerationRef.current;
      terminalSubmittedRef.current = true;
      loopingRef.current = false;

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      const result = await verifyAttempt(state.tick);

      if (runGeneration !== runGenerationRef.current) {
        return;
      }

      if (!result.ok || !result.verified) {
        finishRef.current({
          won: false,
          score: 0,
          timeMs: Math.round(
            (state.tick * 1000) /
              DINO_DASH_V1.tickRate
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

  const recordActionNow = useCallback(
    (action: DinoDashAction) => {
      const state = stateRef.current;
      const accepted = recordInput({
        tick: state.tick,
        action,
      });
      if (!accepted) return false;

      lastRecordedTickRef.current = state.tick;
      applyDinoDashInput(state, action);
      return true;
    },
    [recordInput]
  );

  const flushPendingAction = useCallback(() => {
    const action = pendingActionRef.current;
    const state = stateRef.current;
    if (
      !action ||
      attemptState.status !== "ready" ||
      state.tick <= lastRecordedTickRef.current
    ) {
      return;
    }

    if (recordActionNow(action)) {
      pendingActionRef.current = null;
    }
  }, [attemptState.status, recordActionNow]);

  const step = useCallback(() => {
    const state = stateRef.current;
    if (
      state.status !== "running" ||
      attemptState.status !== "ready"
    ) {
      return;
    }

    flushPendingAction();
    const beforePassed = state.passed;

    stepDinoDash(
      state,
      attemptState.manifest.seed,
      targetScore
    );

    if (state.passed > beforePassed) {
      gameTone("good");
      haptic(5);
    }

    if (state.status !== "running") {
      markTerminalFeedback(performance.now());
    }
  }, [
    attemptState,
    flushPendingAction,
    markTerminalFeedback,
    targetScore,
  ]);

  const loop = useCallback(
    (now: number) => {
      if (!loopingRef.current) return;

      if (lastFrameTimeRef.current <= 0) {
        lastFrameTimeRef.current = now;
      }

      accumulatorRef.current += Math.min(
        MAX_CATCH_UP_SECONDS,
        Math.max(
          0,
          (now - lastFrameTimeRef.current) / 1000
        )
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
          now - terminalStartedAtRef.current >=
          TERMINAL_FEEDBACK_MS
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
      metricsRef.current = configureLogicalCanvas(
        canvas,
        VIEW.width,
        VIEW.height
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
    if (!active || attemptState.status !== "ready") return;

    stateRef.current = createDinoDashState(
      attemptState.manifest.seed
    );
    runGenerationRef.current += 1;
    loopingRef.current = true;
    terminalSubmittedRef.current = false;
    startFailureReportedRef.current = false;
    terminalStartedAtRef.current = 0;
    lastFrameTimeRef.current = 0;
    accumulatorRef.current = 0;
    failureFlashUntilRef.current = 0;
    lastRecordedTickRef.current = -1;
    pendingActionRef.current = null;

    draw();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      runGenerationRef.current += 1;
      loopingRef.current = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingActionRef.current = null;
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

  const queueOrApplyAction = useCallback(
    (action: DinoDashAction) => {
      const state = stateRef.current;
      if (
        attemptState.status !== "ready" ||
        !loopingRef.current ||
        state.status !== "running"
      ) {
        return false;
      }

      if (action === "JUMP" && !isDinoDashGrounded(state)) {
        return false;
      }

      if (action === "DUCK_DOWN" && state.ducking) {
        return false;
      }

      if (action === "DUCK_UP" && !state.ducking) {
        return false;
      }

      if (state.tick <= lastRecordedTickRef.current) {
        pendingActionRef.current = action;
        return true;
      }

      return recordActionNow(action);
    },
    [attemptState.status, recordActionNow]
  );

  const jump = useCallback(() => {
    if (!queueOrApplyAction("JUMP")) return;
    gameTone("tap");
    haptic(3);
    draw(performance.now());
  }, [draw, queueOrApplyAction]);

  const duckDown = useCallback(() => {
    if (!queueOrApplyAction("DUCK_DOWN")) return;
    haptic(2);
    draw(performance.now());
  }, [draw, queueOrApplyAction]);

  const duckUp = useCallback(() => {
    if (!queueOrApplyAction("DUCK_UP")) return;
    draw(performance.now());
  }, [draw, queueOrApplyAction]);

  return (
    <div className="detGameSurface dinoDashGame">
      <canvas
        ref={canvasRef}
        className="gameCanvas deterministicCanvas"
        aria-label="Dino Dash: toca para saltar"
        role="button"
        tabIndex={0}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          jump();
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onKeyDown={(event) => {
          if (event.repeat) return;

          if (
            event.key === " " ||
            event.key === "Enter" ||
            event.key === "ArrowUp"
          ) {
            event.preventDefault();
            jump();
          }

          if (event.key === "ArrowDown") {
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
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          duckDown();
        }}
        onPointerUp={(event) => {
          event.preventDefault();
          event.stopPropagation();
          duckUp();
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={(event) => {
          event.preventDefault();
          event.stopPropagation();
          duckUp();
        }}
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
