"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";
import type {
  AttemptTicket,
  MatchManifest,
  VerifiedAttemptResult,
} from "@/lib/verified/contracts";
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

type Session = {
  manifest: MatchManifest;
  ticket: AttemptTicket;
};

const W = 390;
const H = 620;
const BLOCK_H = 44;
const CRANE_PIVOT_Y = 88;
const SWING_BLOCK_Y = 142;
const BASE_Y = H - 92;

const PALETTE = [
  "#4c7ed7",
  "#6f63d7",
  "#c764bd",
  "#e8894c",
  "#45b783",
  "#d9ad3f",
];

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
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const stateRef = useRef<TowerDropState>(createTowerDropState());
  const sessionRef = useRef<Session | null>(null);
  const inputsRef = useRef<TowerDropInput[]>([]);
  const loopingRef = useRef(false);
  const verifyingRef = useRef(false);
  const generationRef = useRef(0);
  const cameraRef = useRef(0);

  const [verificationState, setVerificationState] = useState<
    "idle" | "starting" | "playing" | "verifying" | "error"
  >("idle");

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
      ctx.shadowBlur = 11;
      ctx.shadowColor = "rgba(49,95,174,.28)";
      ctx.fillStyle = PALETTE[Math.abs(paletteIndex) % PALETTE.length];
      ctx.fillRect(x, y, width, BLOCK_H - 4);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,.34)";
      ctx.fillRect(x + 5, y + 5, Math.max(0, width - 10), 6);
      ctx.fillStyle = "rgba(0,0,0,.10)";
      ctx.fillRect(x, y + BLOCK_H - 9, width, 5);
      ctx.restore();
    },
    []
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = stateRef.current;
    const ticks = s.tick;
    const stableBlocks = Math.max(1, s.blocks.length);
    const highestWorldY =
      BASE_Y - (stableBlocks - 1) * BLOCK_H;
    const targetCameraY = Math.max(
      0,
      CRANE_PIVOT_Y + 116 - highestWorldY
    );

    cameraRef.current +=
      (targetCameraY - cameraRef.current) * 0.12;
    if (
      Math.abs(targetCameraY - cameraRef.current) < 0.1
    ) {
      cameraRef.current = targetCameraY;
    }
    const cameraY = cameraRef.current;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#6fc7ef");
    bg.addColorStop(0.58, "#d7f0f6");
    bg.addColorStop(1, "#efcf90");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Slow clouds keep motion visible without adding a HUD.
    ctx.fillStyle = "rgba(255,255,255,.50)";
    for (let i = 0; i < 5; i += 1) {
      const x =
        ((i * 126 - ticks * 0.14) % (W + 150)) - 60;
      const y = 74 + (i % 2) * 58;
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.arc(x + 27, y + 4, 29, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fixed overhead crane. Unlike v1, the load swings from a real pivot.
    ctx.strokeStyle = "#455a77";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(18, 72);
    ctx.lineTo(W - 18, 72);
    ctx.stroke();

    ctx.fillStyle = "#f0b84a";
    ctx.fillRect(W / 2 - 21, 61, 42, 22);
    ctx.fillStyle = "#3e5069";
    ctx.fillRect(W / 2 - 7, 79, 14, 14);

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
      const dx = centerX - W / 2;
      const ropeLength = 132;
      const ropeDrop = Math.sqrt(
        Math.max(12, ropeLength * ropeLength - dx * dx)
      );
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
      const progress =
        s.fallYMilli / TOWER_DROP_V2.dropDistanceMilli;
      const releaseCenterX =
        s.fallXMilli / 1000 + blockWidth / 2;
      const releaseDx = releaseCenterX - W / 2;
      const ropeLength = 132;
      const releaseY =
        CRANE_PIVOT_Y +
        Math.sqrt(
          Math.max(
            12,
            ropeLength * ropeLength -
              releaseDx * releaseDx
          )
        ) +
        5 -
        cameraY;
      const y =
        releaseY +
        (targetY - releaseY) * progress;

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
      if (verifyingRef.current) return;
      verifyingRef.current = true;
      loopingRef.current = false;

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      setVerificationState("verifying");

      const session = sessionRef.current;
      if (!session) {
        setVerificationState("error");
        finishRef.current({
          won: false,
          score: 0,
          timeMs: 0,
          verified: false,
          verificationError: "MISSING_ATTEMPT_TICKET",
        });
        return;
      }

      try {
        const response = await fetch("/api/verified-match/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            manifest: session.manifest,
            ticket: session.ticket,
            inputs: inputsRef.current,
            final_tick: state.tick,
          }),
        });

        const data =
          (await response.json()) as VerifiedAttemptResult;

        if (!response.ok || !data.ok || !data.verified) {
          const error =
            data.error || "SERVER_REPLAY_REJECTED";
          setVerificationState("error");
          finishRef.current({
            won: false,
            score: 0,
            timeMs: Math.round(
              (state.tick * 1000) /
                TOWER_DROP_V2.tickRate
            ),
            verified: false,
            verificationError: error,
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
      } catch {
        setVerificationState("error");
        finishRef.current({
          won: false,
          score: 0,
          timeMs: Math.round(
            (state.tick * 1000) /
              TOWER_DROP_V2.tickRate
          ),
          verified: false,
          verificationError: "VERIFIER_UNAVAILABLE",
        });
      }
    },
    []
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

  const beginVerifiedAttempt = useCallback(
    async (generation: number) => {
      setVerificationState("starting");
      verifyingRef.current = false;
      loopingRef.current = false;
      inputsRef.current = [];
      sessionRef.current = null;
      cameraRef.current = 0;
      stateRef.current = createTowerDropState();
      draw();

      try {
        const response = await fetch(
          "/api/verified-match/start",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              stake_minor: Math.round(stake * 100),
              target_score: targetScore,
            }),
          }
        );
        const data = await response.json();

        if (
          generation !== generationRef.current ||
          !active
        ) {
          return;
        }

        if (
          !response.ok ||
          !data?.ok ||
          !data.manifest ||
          !data.ticket
        ) {
          throw new Error("MATCH_START_REJECTED");
        }

        sessionRef.current = {
          manifest: data.manifest as MatchManifest,
          ticket: data.ticket as AttemptTicket,
        };

        const state =
          createTowerDropState() as TowerDropState & {
            lastFrame?: number;
            accumulator?: number;
          };
        state.lastFrame = 0;
        state.accumulator = 0;
        stateRef.current = state;

        setVerificationState("playing");
        loopingRef.current = true;
        draw();
        rafRef.current = requestAnimationFrame(loop);
      } catch {
        if (generation !== generationRef.current) return;
        setVerificationState("error");
        finishRef.current({
          won: false,
          score: 0,
          timeMs: 0,
          verified: false,
          verificationError: "MATCH_START_FAILED",
        });
      }
    },
    [active, draw, loop, stake, targetScore]
  );

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;

    if (active) {
      void beginVerifiedAttempt(generation);
    }

    return () => {
      generationRef.current += 1;
      loopingRef.current = false;
      stateRef.current.status = "failed";
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [active, beginVerifiedAttempt]);

  const place = useCallback(() => {
    const s = stateRef.current;

    if (
      verificationState !== "playing" ||
      !loopingRef.current ||
      s.status !== "running" ||
      s.phase !== "swing"
    ) {
      return;
    }

    const previous =
      inputsRef.current[inputsRef.current.length - 1];
    if (previous?.tick === s.tick) return;

    inputsRef.current.push({
      seq: inputsRef.current.length,
      tick: s.tick,
      action: "DROP",
    });

    dropTowerBlock(s, targetScore);
    gameTone("tap");
    haptic(4);
  }, [targetScore, verificationState]);

  return (
    <div className="gameStage skillGameStage towerDropArena verifiedArena">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas"
        onPointerDown={place}
        aria-label="Tower Drop"
      />

      {(verificationState === "starting" ||
        verificationState === "verifying") && (
        <div className="verificationOverlay">
          <span>
            {verificationState === "starting"
              ? "PREPARANDO PARTIDA"
              : "COMPROBANDO RESULTADO"}
          </span>
        </div>
      )}
    </div>
  );
}
