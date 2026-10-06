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
  TOWER_DROP_V1,
  type TowerDropInput,
  type TowerDropState,
} from "@/lib/verified/towerDropCore.v1";

type Props = {
  active: boolean;
  stake: number;
  ghostEnabled: boolean;
  onFinish: (result: GameResult) => void;
};

type Session = {
  manifest: MatchManifest;
  ticket: AttemptTicket;
};

const W = 390;
const H = 620;
const BLOCK_H = 44;
const CRANE_Y = 118;
const DROP_MS = 230;

export default function TowerDrop({ active, stake, ghostEnabled, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const stateRef = useRef<TowerDropState>(createTowerDropState());
  const sessionRef = useRef<Session | null>(null);
  const inputsRef = useRef<TowerDropInput[]>([]);
  const loopingRef = useRef(false);
  const verifyingRef = useRef(false);
  const generationRef = useRef(0);
  const dropFxRef = useRef<{
    x: number;
    width: number;
    fromY: number;
    toY: number;
    startedAt: number;
    blockIndex: number;
  } | null>(null);

  const [verificationState, setVerificationState] = useState<
    "idle" | "starting" | "playing" | "verifying" | "error"
  >("idle");
  const [verificationMessage, setVerificationMessage] = useState("");

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = stateRef.current;
    const ticks = s.tick;
    const cameraY = Math.max(0, (s.blocks.length - 8) * BLOCK_H);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#6fc7ef");
    bg.addColorStop(0.58, "#d7f0f6");
    bg.addColorStop(1, "#efcf90");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,.55)";
    for (let i = 0; i < 5; i += 1) {
      const x = ((i * 126 - ticks * 0.15) % (W + 150)) - 60;
      const y = 82 + (i % 2) * 58;
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.arc(x + 28, y + 5, 31, 0, Math.PI * 2);
      ctx.fill();
    }

    // Industrial crane: the moving block hangs from the trolley.
    const dropFxForCrane = dropFxRef.current;
    const trolleyX = dropFxForCrane
      ? dropFxForCrane.x + dropFxForCrane.width / 2
      : s.movingXMilli / 1000 + s.movingWMilli / 2000;
    ctx.strokeStyle = "#455a77";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(18, 88);
    ctx.lineTo(W - 18, 88);
    ctx.stroke();

    ctx.fillStyle = "#f0b84a";
    ctx.fillRect(trolleyX - 20, 76, 40, 24);
    ctx.fillStyle = "#3e5069";
    ctx.fillRect(trolleyX - 7, 99, 14, 14);

    ctx.strokeStyle = "#344760";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(trolleyX, 112);
    ctx.lineTo(trolleyX, CRANE_Y + 18);
    ctx.stroke();

    ctx.save();
    ctx.translate(0, cameraY);

    if (ghostEnabled) {
      const ghostWidths = [228, 222, 211, 201, 189, 176, 162, 148];
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = "#6de6ff";
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 2;
      ghostWidths.forEach((width, index) => {
        const x = (W - width) / 2 + (index % 2 === 0 ? -5 : 5);
        const y = H - 92 - index * BLOCK_H;
        ctx.strokeRect(x, y, width, BLOCK_H - 3);
      });
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = "#6de6ff";
      ctx.font = "900 14px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("👻", W / 2, H - 92 - ghostWidths.length * BLOCK_H - 8);
      ctx.restore();
    }

    const palette = [
      "#4c7ed7",
      "#6f63d7",
      "#c764bd",
      "#e8894c",
      "#45b783",
      "#d9ad3f",
    ];

    const fx = dropFxRef.current;
    const now = performance.now();
    let activeFx = fx;
    if (fx && now - fx.startedAt >= DROP_MS) {
      dropFxRef.current = null;
      activeFx = null;
    }

    s.blocks.forEach((block, index) => {
      if (activeFx?.blockIndex === index) return;

      const x = block.xMilli / 1000;
      const width = block.wMilli / 1000;
      const y = H - 92 - index * BLOCK_H;
      ctx.fillStyle = palette[index % palette.length];
      ctx.fillRect(x, y, width, BLOCK_H - 4);
      ctx.fillStyle = "rgba(255,255,255,.32)";
      ctx.fillRect(x + 5, y + 5, Math.max(0, width - 10), 6);
      ctx.fillStyle = "rgba(0,0,0,.10)";
      ctx.fillRect(x, y + BLOCK_H - 9, width, 5);
    });

    if (activeFx) {
      const progress = Math.min(1, (now - activeFx.startedAt) / DROP_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      const y = activeFx.fromY + (activeFx.toY - activeFx.fromY) * eased;
      ctx.shadowBlur = 16;
      ctx.shadowColor = "#315fae";
      ctx.fillStyle = palette[activeFx.blockIndex % palette.length];
      ctx.fillRect(activeFx.x, y, activeFx.width, BLOCK_H - 4);
      ctx.fillStyle = "rgba(255,255,255,.34)";
      ctx.fillRect(activeFx.x + 5, y + 5, Math.max(0, activeFx.width - 10), 6);
      ctx.shadowBlur = 0;
    } else if (s.status === "running") {
      const hangingX = s.movingXMilli / 1000;
      const hangingW = s.movingWMilli / 1000;

      ctx.shadowBlur = 14;
      ctx.shadowColor = "#315fae";
      ctx.fillStyle = "#315fae";
      ctx.fillRect(hangingX, CRANE_Y + 18, hangingW, BLOCK_H - 4);
      ctx.fillStyle = "rgba(255,255,255,.32)";
      ctx.fillRect(hangingX + 5, CRANE_Y + 23, Math.max(0, hangingW - 10), 6);
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    ctx.fillStyle = "rgba(38,58,91,.86)";
    ctx.fillRect(14, 14, W - 28, 54);
    ctx.font = "900 14px system-ui";
    ctx.fillStyle = "#fff";
    ctx.fillText(`ALTURA ${Math.max(0, s.blocks.length - 1)}`, 26, 37);
    ctx.fillStyle = s.combo > 1 ? "#ffdc65" : "#c9d8f3";
    ctx.fillText(`PERFECT ×${s.combo}`, 145, 37);
    if (ghostEnabled) {
      ctx.fillStyle = "#77e5ff";
      ctx.fillText("👻 FANTASMA", 278, 37);
    }

    ctx.fillStyle = "rgba(255,255,255,.46)";
    ctx.font = "900 13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("TOCA PARA SOLTAR", W / 2, H - 28);
    ctx.textAlign = "start";
  }, []);

  const submitReplay = useCallback(async (state: TowerDropState) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    loopingRef.current = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    setVerificationState("verifying");
    setVerificationMessage("Reproduciendo inputs en servidor…");

    const session = sessionRef.current;
    if (!session) {
      setVerificationState("error");
      setVerificationMessage("No existe ticket de intento.");
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

      const data = (await response.json()) as VerifiedAttemptResult;

      if (!response.ok || !data.ok || !data.verified) {
        const error = data.error || "SERVER_REPLAY_REJECTED";
        setVerificationState("error");
        setVerificationMessage(`Intento rechazado: ${error}`);
        finishRef.current({
          won: false,
          score: 0,
          timeMs: Math.round(
            (state.tick * 1000) / TOWER_DROP_V1.tickRate
          ),
          verified: false,
          verificationError: error,
        });
        return;
      }

      setVerificationMessage("Replay verificado.");
      finishRef.current({
        won: false,
        score: data.score ?? 0,
        timeMs: data.time_ms ?? 0,
        verified: true,
        verificationId: data.verification_id,
        replayHash: data.replay_hash,
        failureReason: data.failure ?? null,
      });
    } catch {
      setVerificationState("error");
      setVerificationMessage("No se pudo contactar con el verificador.");
      finishRef.current({
        won: false,
        score: 0,
        timeMs: Math.round(
          (state.tick * 1000) / TOWER_DROP_V1.tickRate
        ),
        verified: false,
        verificationError: "VERIFIER_UNAVAILABLE",
      });
    }
  }, []);

  const step = useCallback(() => {
    const s = stateRef.current;
    if (s.status !== "running") return;

    const stepped: TowerDropState = stepTowerDrop(s);

    if (stepped.status === "failed") {
      void submitReplay(stepped);
      return;
    }

  }, [submitReplay]);

  const loop = useCallback(
    (now: number) => {
      const s = stateRef.current;
      if (!loopingRef.current || s.status !== "running") return;

      const timing = (
        stateRef.current as TowerDropState & { lastFrame?: number; accumulator?: number }
      );
      if (!timing.lastFrame) timing.lastFrame = now;
      timing.accumulator =
        (timing.accumulator ?? 0) +
        Math.min(0.05, (now - timing.lastFrame) / 1000);
      timing.lastFrame = now;

      const dt = 1 / TOWER_DROP_V1.tickRate;
      const dropping = dropFxRef.current !== null;

      if (!dropping) {
        while ((timing.accumulator ?? 0) >= dt && loopingRef.current) {
          step();
          timing.accumulator = (timing.accumulator ?? 0) - dt;
        }
      } else {
        timing.accumulator = 0;
      }

      draw();
      if (loopingRef.current) rafRef.current = requestAnimationFrame(loop);
    },
    [draw, step]
  );

  const beginVerifiedAttempt = useCallback(
    async (generation: number) => {
      setVerificationState("starting");
      setVerificationMessage("Solicitando manifiesto y ticket…");
      verifyingRef.current = false;
      loopingRef.current = false;
      inputsRef.current = [];
      sessionRef.current = null;
      dropFxRef.current = null;
      stateRef.current = createTowerDropState();
      draw();

      try {
        const response = await fetch("/api/verified-match/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stake_minor: Math.round(stake * 100),
          }),
        });
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

        const state = createTowerDropState() as TowerDropState & {
          lastFrame?: number;
          accumulator?: number;
        };
        state.lastFrame = 0;
        state.accumulator = 0;
        stateRef.current = state;

        setVerificationState("playing");
        setVerificationMessage(
          data.ticket.security_mode === "production"
            ? "Servidor autoritativo activo"
            : "Replay server-side activo · firma demo"
        );
        loopingRef.current = true;
        draw();
        rafRef.current = requestAnimationFrame(loop);
      } catch {
        if (generation !== generationRef.current) return;
        setVerificationState("error");
        setVerificationMessage("No se pudo iniciar el intento verificado.");
        finishRef.current({
          won: false,
          score: 0,
          timeMs: 0,
          verified: false,
          verificationError: "MATCH_START_FAILED",
        });
      }
    },
    [active, draw, loop, stake]
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
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, beginVerifiedAttempt]);

  const place = useCallback(() => {
    const s = stateRef.current;
    if (dropFxRef.current) return;

    if (
      verificationState !== "playing" ||
      !loopingRef.current ||
      s.status !== "running"
    ) {
      return;
    }

    const previous = inputsRef.current[inputsRef.current.length - 1];
    if (previous?.tick === s.tick) return;

    inputsRef.current.push({
      seq: inputsRef.current.length,
      tick: s.tick,
      action: "DROP",
    });

    const dropped: TowerDropState = dropTowerBlock(s);

    if (dropped.status === "failed") {
      void submitReplay(dropped);
      return;
    }

    const landedIndex = dropped.blocks.length - 1;
    const landed = dropped.blocks[landedIndex];
    dropFxRef.current = {
      x: landed.xMilli / 1000,
      width: landed.wMilli / 1000,
      fromY: CRANE_Y + 18,
      toY: H - 92 - landedIndex * BLOCK_H,
      startedAt: performance.now(),
      blockIndex: landedIndex,
    };

    gameTone(s.combo > 0 ? "good" : "tap");
    haptic(s.combo > 0 ? 10 : 5);
  }, [submitReplay, verificationState]);

  return (
    <div className="gameStage skillGameStage towerDropArena verifiedArena">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas"
        onPointerDown={place}
        aria-label="Tower Drop verificado"
      />

      {(verificationState === "starting" ||
        verificationState === "verifying") && (
        <div className="verificationOverlay">
          <span>
            {verificationState === "starting"
              ? "PREPARANDO PARTIDA"
              : "VERIFICANDO RESULTADO"}
          </span>
          <b>
            {verificationState === "starting"
              ? "MANIFEST + TICKET"
              : "SERVER REPLAY"}
          </b>
          <small>{verificationMessage}</small>
        </div>
      )}

      <div className="verifiedGameLine compactVerifiedLine">
        <span className={verificationState === "error" ? "bad" : ""}>
          {verificationState === "playing"
            ? "✓ PARTIDA VERIFICABLE"
            : verificationState === "verifying"
              ? "VERIFICANDO…"
              : verificationState === "error"
                ? "NO VERIFICADO"
                : "PREPARANDO…"}
        </span>
        {ghostEnabled && <b>👻 FANTASMA</b>}
      </div>

      <div className="gameRule floatingGameRule towerDropRule">
        Toca cuando el bloque esté justo encima de la torre
      </div>
    </div>
  );
}
