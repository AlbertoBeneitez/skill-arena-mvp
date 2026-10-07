"use client";

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
  createPianoRushState,
  pianoRushActionForLane,
  PIANO_RUSH_V1,
  stepPianoRush,
  tapPianoRush,
  type PianoRushInput,
  type PianoRushState,
} from "@/lib/verified/pianoRushCore.v1";
import {
  drawPianoRushBackground,
  drawPianoRushHitZone,
  drawPianoRushNote,
  noteIsVisible,
  noteTopForTick,
  PIANO_VIEW,
} from "./piano-rush/presentation";

const DT = 1 / PIANO_RUSH_V1.tickRate;
const HIT_FLASH_MS = 180;
const TERMINAL_FEEDBACK_MS = 240;

type HitFlash = {
  lane: number;
  startedAt: number;
  strong: boolean;
};

function pianoStatus(
  state: PianoRushState
): PianoRushState["status"] {
  return state.status;
}

export default function PianoRush({
  active,
  stake,
  targetScore,
  onFinish,
}: GameRuntimeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const metricsRef = useRef<CanvasViewportMetrics | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);

  const stateRef = useRef<PianoRushState>(
    createPianoRushState("preview")
  );
  const loopingRef = useRef(false);
  const terminalSubmittedRef = useRef(false);
  const startFailureReportedRef = useRef(false);
  const terminalStartedAtRef = useRef(0);

  const lastFrameTimeRef = useRef(0);
  const accumulatorRef = useRef(0);
  const hitFlashRef = useRef<HitFlash | null>(null);
  const failureFlashUntilRef = useRef(0);

  const verifiedAttempt = useVerifiedAttempt<PianoRushInput>({
    active,
    gameId: "piano-rush",
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
        PIANO_VIEW.width,
        PIANO_VIEW.height
      );
    metricsRef.current = metrics;
    beginLogicalCanvasFrame(ctx, canvas, metrics);

    const state = stateRef.current;
    const flash = hitFlashRef.current;
    const flashAge = flash ? now - flash.startedAt : HIT_FLASH_MS;
    const flashStrength =
      flash && flashAge < HIT_FLASH_MS
        ? 1 - flashAge / HIT_FLASH_MS
        : 0;

    if (flash && flashStrength <= 0) {
      hitFlashRef.current = null;
    }

    drawPianoRushBackground(
      ctx,
      state,
      flash?.lane ?? -1,
      flashStrength
    );

    const startIndex = state.nextNoteIndex;
    const maxIndex = Math.min(
      state.schedule.length,
      startIndex + 12
    );

    for (let index = maxIndex - 1; index >= startIndex; index -= 1) {
      const note = state.schedule[index];
      if (!noteIsVisible(note, state.tick)) continue;

      drawPianoRushNote(
        ctx,
        note,
        noteTopForTick(note, state.tick),
        index === startIndex
      );
    }

    drawPianoRushHitZone(
      ctx,
      flash?.lane ?? -1,
      flashStrength
    );

    if (now < failureFlashUntilRef.current) {
      const remaining =
        (failureFlashUntilRef.current - now) / TERMINAL_FEEDBACK_MS;
      ctx.fillStyle = `rgba(255,73,91,${0.08 + remaining * 0.14})`;
      ctx.fillRect(
        0,
        0,
        PIANO_VIEW.width,
        PIANO_VIEW.height
      );
    }
  }, []);

  const submitTerminal = useCallback(
    async (state: PianoRushState) => {
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
              PIANO_RUSH_V1.tickRate
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
        haptic([16, 28, 44]);
      } else {
        failureFlashUntilRef.current =
          now + TERMINAL_FEEDBACK_MS;
        gameTone("bad");
        haptic([24, 18, 42]);
      }
    },
    []
  );

  const step = useCallback(() => {
    const state = stateRef.current;
    if (state.status !== "running") return;

    stepPianoRush(state, targetScore);

    if (state.status !== "running") {
      markTerminalFeedback(performance.now());
    }
  }, [markTerminalFeedback, targetScore]);

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
        PIANO_VIEW.width,
        PIANO_VIEW.height
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

    stateRef.current = createPianoRushState(
      attemptState.manifest.seed
    );
    loopingRef.current = true;
    terminalSubmittedRef.current = false;
    startFailureReportedRef.current = false;
    terminalStartedAtRef.current = 0;
    lastFrameTimeRef.current = 0;
    accumulatorRef.current = 0;
    hitFlashRef.current = null;
    failureFlashUntilRef.current = 0;

    draw();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      loopingRef.current = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      hitFlashRef.current = null;
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

  const tapLane = useCallback(
    (lane: number) => {
      const state = stateRef.current;
      if (
        attemptState.status !== "ready" ||
        !loopingRef.current ||
        state.status !== "running"
      ) {
        return;
      }

      const action = pianoRushActionForLane(lane);
      if (!action) return;

      const accepted = recordInput({
        tick: state.tick,
        action,
      });
      if (!accepted) return;

      tapPianoRush(state, action, targetScore);

      const now = performance.now();
      if (pianoStatus(state) === "failed") {
        markTerminalFeedback(now);
        draw(now);
        return;
      }

      const error =
        state.lastHitErrorTicks ??
        PIANO_RUSH_V1.maxTimingErrorTicks;
      const strong =
        error <= PIANO_RUSH_V1.perfectTimingErrorTicks;

      hitFlashRef.current = {
        lane,
        startedAt: now,
        strong,
      };

      gameTone(strong ? "good" : "tap");
      haptic(strong ? [4, 9, 4] : 3);

      if (pianoStatus(state) === "won") {
        markTerminalFeedback(now);
      }

      draw(now);
    },
    [
      attemptState.status,
      draw,
      markTerminalFeedback,
      recordInput,
      targetScore,
    ]
  );

  return (
    <div className="detGameSurface pianoRushGame">
      <canvas
        ref={canvasRef}
        className="gameCanvas deterministicCanvas"
        aria-label="Piano Rush: toca el carril cuando el pulso llegue a la zona inferior"
        role="application"
        tabIndex={0}
        onPointerDown={(event) => {
          event.preventDefault();

          const metrics = metricsRef.current;
          if (!metrics) return;

          const rect =
            event.currentTarget.getBoundingClientRect();
          const localX =
            (event.clientX -
              rect.left -
              metrics.offsetX) /
            metrics.scale;

          if (
            localX < 0 ||
            localX >= PIANO_VIEW.width
          ) {
            return;
          }

          const lane = Math.floor(
            localX /
              (PIANO_VIEW.width /
                PIANO_VIEW.laneCount)
          );
          tapLane(lane);
        }}
        onKeyDown={(event) => {
          const keyToLane: Record<string, number> = {
            "1": 0,
            "2": 1,
            "3": 2,
            "4": 3,
            a: 0,
            s: 1,
            d: 2,
            f: 3,
          };
          const lane = keyToLane[event.key.toLowerCase()];
          if (lane !== undefined) {
            event.preventDefault();
            tapLane(lane);
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
