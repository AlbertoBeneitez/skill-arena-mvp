"use client";

/**
 * Jet Stream presentation/input adapter.
 *
 * The competitive core is a deterministic fixed-timestep implementation. The
 * flap/gravity control model is inspired by the MIT-licensed Phaser 3 Flappy
 * Bird example from digitsensitive/phaser3-typescript; no upstream assets or
 * Phaser runtime are shipped.
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
  createJetStreamState,
  flapJetStream,
  JET_STREAM_V1,
  stepJetStream,
  type JetStreamInput,
  type JetStreamState,
} from "@/lib/verified/jetStreamCore.v1";
import {
  drawJetBackground,
  drawJetGate,
  drawJetShip,
  JET_VIEW,
} from "./jet-stream/presentation";

const DT = 1 / JET_STREAM_V1.tickRate;
const IMPULSE_GLOW_MS = 130;
const TERMINAL_FEEDBACK_MS = 260;

export default function JetStream({
  active,
  stake,
  targetScore,
  onFinish,
}: GameRuntimeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const metricsRef = useRef<CanvasViewportMetrics | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);

  const stateRef = useRef<JetStreamState>(
    createJetStreamState("preview")
  );
  const loopingRef = useRef(false);
  const terminalSubmittedRef = useRef(false);
  const startFailureReportedRef = useRef(false);
  const terminalStartedAtRef = useRef(0);

  const lastFrameTimeRef = useRef(0);
  const accumulatorRef = useRef(0);
  const impulseAtRef = useRef(0);
  const failureFlashUntilRef = useRef(0);

  const verifiedAttempt = useVerifiedAttempt<JetStreamInput>({
    active,
    gameId: "jet-stream",
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
        JET_VIEW.width,
        JET_VIEW.height
      );
    metricsRef.current = metrics;
    beginLogicalCanvasFrame(ctx, canvas, metrics);

    const state = stateRef.current;
    drawJetBackground(ctx, state);

    for (const gate of state.gates) {
      const x =
        (gate.worldXMilli - state.scrollMilli) /
        1000;
      if (x < -70 || x > JET_VIEW.width + 60) {
        continue;
      }
      drawJetGate(ctx, gate, state);
    }

    const impulseAge = now - impulseAtRef.current;
    const impulseGlow =
      impulseAge >= 0 &&
      impulseAge < IMPULSE_GLOW_MS
        ? 1 - impulseAge / IMPULSE_GLOW_MS
        : 0;

    drawJetShip(ctx, state, impulseGlow);

    if (now < failureFlashUntilRef.current) {
      const remaining =
        (failureFlashUntilRef.current - now) /
        TERMINAL_FEEDBACK_MS;
      ctx.fillStyle = `rgba(255,76,93,${0.07 + remaining * 0.13})`;
      ctx.fillRect(
        0,
        0,
        JET_VIEW.width,
        JET_VIEW.height
      );
    }
  }, []);

  const submitTerminal = useCallback(
    async (state: JetStreamState) => {
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
              JET_STREAM_V1.tickRate
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

  const markTerminalFeedback = useCallback(
    (now: number) => {
      if (terminalStartedAtRef.current > 0) return;
      terminalStartedAtRef.current = now;

      if (stateRef.current.status === "won") {
        gameTone("win");
        haptic([16, 28, 46]);
      } else {
        failureFlashUntilRef.current =
          now + TERMINAL_FEEDBACK_MS;
        gameTone("bad");
        haptic([28, 20, 48]);
      }
    },
    []
  );

  const step = useCallback(() => {
    const state = stateRef.current;
    if (
      state.status !== "running" ||
      attemptState.status !== "ready"
    ) {
      return;
    }

    const beforePassed = state.passed;

    stepJetStream(
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
        0.05,
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
        JET_VIEW.width,
        JET_VIEW.height
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

    stateRef.current = createJetStreamState(
      attemptState.manifest.seed
    );
    loopingRef.current = true;
    terminalSubmittedRef.current = false;
    startFailureReportedRef.current = false;
    terminalStartedAtRef.current = 0;
    lastFrameTimeRef.current = 0;
    accumulatorRef.current = 0;
    impulseAtRef.current = 0;
    failureFlashUntilRef.current = 0;

    draw();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      loopingRef.current = false;
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

  const flap = useCallback(() => {
    const state = stateRef.current;
    if (
      attemptState.status !== "ready" ||
      !loopingRef.current ||
      state.status !== "running"
    ) {
      return;
    }

    const accepted = recordInput({
      tick: state.tick,
      action: "FLAP",
    });
    if (!accepted) return;

    flapJetStream(state);
    impulseAtRef.current = performance.now();
    gameTone("tap");
    haptic(3);
    draw(impulseAtRef.current);
  }, [attemptState.status, draw, recordInput]);

  return (
    <div className="detGameSurface jetStreamArena">
      <canvas
        ref={canvasRef}
        className="gameCanvas deterministicCanvas"
        aria-label="Jet Stream: toca para impulsar la nave"
        role="button"
        tabIndex={0}
        onPointerDown={(event) => {
          event.preventDefault();
          flap();
        }}
        onKeyDown={(event) => {
          if (
            event.key === " " ||
            event.key === "Enter" ||
            event.key === "ArrowUp"
          ) {
            event.preventDefault();
            flap();
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
