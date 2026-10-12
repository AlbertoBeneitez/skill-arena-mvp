"use client";

/**
 * Pulse Runner presentation/input adapter.
 *
 * Competitive rules live in pulseRunnerCore.v1.ts. This component owns mobile
 * rendering, touch/keyboard input, feedback and server-replay submission.
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
  applyPulseRunnerInput,
  createPulseRunnerState,
  isPulseRunnerGrounded,
  PULSE_RUNNER_V1,
  stepPulseRunner,
  type PulseRunnerInput,
  type PulseRunnerObstacle,
  type PulseRunnerState,
} from "@/lib/verified/pulseRunnerCore.v1";

const VIEW = {
  width: PULSE_RUNNER_V1.coordinateWidth,
  height: PULSE_RUNNER_V1.coordinateHeight,
} as const;
const DT = 1 / PULSE_RUNNER_V1.tickRate;
const TERMINAL_FEEDBACK_MS = 280;
const MAX_CATCH_UP_SECONDS =
  PULSE_RUNNER_V1.maxFinalTick / PULSE_RUNNER_V1.tickRate + 1;

function px(milli: number) {
  return milli / 1000;
}

function drawObstacle(
  ctx: CanvasRenderingContext2D,
  obstacle: PulseRunnerObstacle,
  x: number
) {
  const floor = px(PULSE_RUNNER_V1.floorYMilli);
  const width = px(obstacle.wMilli);
  const height = px(obstacle.hMilli);

  if (obstacle.kind === "spike") {
    const gradient = ctx.createLinearGradient(x, floor - height, x, floor);
    gradient.addColorStop(0, "#ffda5f");
    gradient.addColorStop(1, "#ef5d73");
    ctx.fillStyle = gradient;
    ctx.shadowBlur = 9;
    ctx.shadowColor = "rgba(239,93,115,.55)";
    ctx.beginPath();
    ctx.moveTo(x, floor);
    ctx.lineTo(x + width / 2, floor - height);
    ctx.lineTo(x + width, floor);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    return;
  }

  ctx.fillStyle =
    obstacle.kind === "pillar" ? "#8a5bd1" : "#3c78d3";
  ctx.shadowBlur = 9;
  ctx.shadowColor = "rgba(91,142,225,.45)";
  ctx.fillRect(x, floor - height, width, height);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,.22)";
  ctx.fillRect(x + 4, floor - height + 5, Math.max(4, width - 8), 5);
  ctx.fillStyle = "#f3c955";
  ctx.fillRect(x + 4, floor - 9, Math.max(4, width - 8), 4);
}

export default function PulseRunner({
  active,
  stake,
  targetScore,
  onFinish,
}: GameRuntimeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const metricsRef = useRef<CanvasViewportMetrics | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);

  const stateRef = useRef<PulseRunnerState>(
    createPulseRunnerState("preview")
  );
  const loopingRef = useRef(false);
  const terminalSubmittedRef = useRef(false);
  const startFailureReportedRef = useRef(false);
  const terminalStartedAtRef = useRef(0);
  const runGenerationRef = useRef(0);

  const lastFrameTimeRef = useRef(0);
  const accumulatorRef = useRef(0);
  const failureFlashUntilRef = useRef(0);
  const successFlashUntilRef = useRef(0);
  const lastRecordedTickRef = useRef(-1);
  const pendingJumpRef = useRef(false);

  const verifiedAttempt = useVerifiedAttempt<PulseRunnerInput>({
    active,
    gameId: "pulse-runner",
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
    const floor = px(PULSE_RUNNER_V1.floorYMilli);
    const sector = Math.min(5, 1 + Math.floor(state.passed / 8));

    const bg = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    bg.addColorStop(0, "#111b45");
    bg.addColorStop(0.58, "#1a315d");
    bg.addColorStop(0.581, "#111a35");
    bg.addColorStop(1, "#070d1f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    ctx.strokeStyle = "rgba(87,205,238,.10)";
    ctx.lineWidth = 1;
    const farOffset = (px(state.scrollMilli) * 0.18) % 56;
    for (let x = -farOffset; x < VIEW.width + 56; x += 56) {
      ctx.beginPath();
      ctx.moveTo(x, 92);
      ctx.lineTo(x, floor);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(103,226,247,.14)";
    const nearOffset = (px(state.scrollMilli) * 0.5) % 72;
    for (let x = -nearOffset; x < VIEW.width + 72; x += 72) {
      ctx.beginPath();
      ctx.moveTo(x, floor - 112);
      ctx.lineTo(x + 34, floor - 112);
      ctx.stroke();
    }

    ctx.fillStyle = "#1d2b4b";
    ctx.fillRect(0, floor, VIEW.width, VIEW.height - floor);
    ctx.fillStyle = "#63d9ed";
    ctx.fillRect(0, floor, VIEW.width, 5);

    ctx.fillStyle = "rgba(255,218,88,.6)";
    for (
      let x = -((px(state.scrollMilli) * 0.85) % 44);
      x < VIEW.width + 44;
      x += 44
    ) {
      ctx.fillRect(x, floor + 22, 22, 3);
    }

    for (const obstacle of state.obstacles) {
      const x = px(obstacle.worldXMilli - state.scrollMilli);
      if (x < -80 || x > VIEW.width + 80) continue;
      drawObstacle(ctx, obstacle, x);
    }

    const playerSize = px(PULSE_RUNNER_V1.playerSizeMilli);
    const playerX = px(PULSE_RUNNER_V1.playerXMilli);
    const playerY = px(state.yMilli);
    const grounded = isPulseRunnerGrounded(state);

    ctx.save();
    ctx.globalAlpha = grounded ? 0.38 : 0.18;
    ctx.fillStyle = "#02050c";
    ctx.beginPath();
    ctx.ellipse(
      playerX + playerSize / 2,
      floor + 8,
      grounded ? 21 : 14,
      6,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(playerX + playerSize / 2, playerY + playerSize / 2);
    ctx.rotate(state.angleQuarterTurns * (Math.PI / 2));
    const pulse =
      now < successFlashUntilRef.current
        ? (successFlashUntilRef.current - now) / 180
        : 0;
    ctx.shadowBlur = 18 + pulse * 18;
    ctx.shadowColor = pulse > 0 ? "#ffdc68" : "#63e6f5";
    ctx.fillStyle = "#61dceb";
    ctx.fillRect(-playerSize / 2, -playerSize / 2, playerSize, playerSize);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#183d72";
    ctx.fillRect(
      -playerSize / 2 + 5,
      -playerSize / 2 + 5,
      playerSize - 10,
      playerSize - 10
    );
    ctx.fillStyle = "#fff4bc";
    ctx.fillRect(5, -7, 5, 5);
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,.82)";
    ctx.font = "700 11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "start";
    ctx.fillText(`ZONE ${sector}`, 16, 34);
    ctx.textAlign = "end";
    ctx.fillText(`${state.score}`, VIEW.width - 16, 34);

    if (now < failureFlashUntilRef.current) {
      const remaining =
        (failureFlashUntilRef.current - now) /
        TERMINAL_FEEDBACK_MS;
      ctx.fillStyle = `rgba(255,76,93,${0.06 + remaining * 0.14})`;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
  }, []);

  const submitTerminal = useCallback(
    async (state: PulseRunnerState) => {
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
              PULSE_RUNNER_V1.tickRate
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

  const recordJumpNow = useCallback(() => {
    const state = stateRef.current;
    const accepted = recordInput({
      tick: state.tick,
      action: "JUMP",
    });
    if (!accepted) return false;

    lastRecordedTickRef.current = state.tick;
    applyPulseRunnerInput(state, "JUMP");
    return true;
  }, [recordInput]);

  const flushPendingJump = useCallback(() => {
    const state = stateRef.current;
    if (
      !pendingJumpRef.current ||
      attemptState.status !== "ready" ||
      state.tick <= lastRecordedTickRef.current
    ) {
      return;
    }

    if (recordJumpNow()) {
      pendingJumpRef.current = false;
    }
  }, [attemptState.status, recordJumpNow]);

  const step = useCallback(() => {
    const state = stateRef.current;
    if (
      state.status !== "running" ||
      attemptState.status !== "ready"
    ) {
      return;
    }

    flushPendingJump();
    const beforePassed = state.passed;

    stepPulseRunner(
      state,
      attemptState.manifest.seed,
      targetScore
    );

    if (state.passed > beforePassed) {
      successFlashUntilRef.current = performance.now() + 180;
      gameTone(state.passed % 4 === 0 ? "good" : "tap");
      haptic(state.passed % 4 === 0 ? 7 : 3);
    }

    if (state.status !== "running") {
      markTerminalFeedback(performance.now());
    }
  }, [
    attemptState,
    flushPendingJump,
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

    stateRef.current = createPulseRunnerState(
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
    successFlashUntilRef.current = 0;
    lastRecordedTickRef.current = -1;
    pendingJumpRef.current = false;

    draw();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      runGenerationRef.current += 1;
      loopingRef.current = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingJumpRef.current = false;
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
      state.status !== "running"
    ) {
      return;
    }

    if (state.tick <= lastRecordedTickRef.current) {
      pendingJumpRef.current = true;
      return;
    }

    if (!recordJumpNow()) return;
    gameTone("tap");
    haptic(3);
    draw(performance.now());
  }, [attemptState.status, draw, recordJumpNow]);

  return (
    <div className="detGameSurface pulseRunnerGame">
      <canvas
        ref={canvasRef}
        className="gameCanvas deterministicCanvas"
        aria-label="Pulse Runner: toca para saltar"
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
        onPointerCancel={(event) => {
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
