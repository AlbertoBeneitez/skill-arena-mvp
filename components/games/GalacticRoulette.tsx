"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gameTone, haptic } from "@/lib/gameFeedback";
import type { GameResult } from "@/lib/types";

type Props = {
  active: boolean;
  targetScore: number;
  onFinish: (result: GameResult) => void;
};

type BetKind = "RED" | "BLACK" | "EVEN" | "ODD" | "LOW" | "HIGH" | "NUMBER";
type BetState = { kind: BetKind; number: number };
type SpinPhase = "idle" | "spinning";

type RouletteState = {
  balance: number;
  score: number;
  spins: number;
  wheelAngle: number;
  ballAngle: number;
  ballSpeed: number;
  phase: SpinPhase;
  lastPocket: number | null;
  lastPayout: number;
  remainingMs: number;
};

const W = 390;
const H = 620;
const ROUND_MS = 180_000;
const SPIN_COST = 5;
const START_BALANCE = 100;
const TWO_PI = Math.PI * 2;
const POCKETS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const;
const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

function buildState(): RouletteState {
  return {
    balance: START_BALANCE,
    score: START_BALANCE * 20,
    spins: 0,
    wheelAngle: 0,
    ballAngle: 0,
    ballSpeed: 0,
    phase: "idle",
    lastPocket: null,
    lastPayout: 0,
    remainingMs: ROUND_MS,
  };
}

function formatTime(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function normalize(angle: number) {
  return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}

function colorFor(number: number) {
  if (number === 0) return "green";
  return RED_NUMBERS.has(number) ? "red" : "black";
}

function resolvePocket(wheelAngle: number, ballAngle: number) {
  const relative = normalize(ballAngle - wheelAngle);
  const index = Math.floor(relative / (TWO_PI / POCKETS.length)) % POCKETS.length;
  return POCKETS[index];
}

function payoutFor(pocket: number, bet: BetState) {
  if (bet.kind === "NUMBER") return pocket === bet.number ? 180 : 0;
  if (pocket === 0) return 0;
  if (bet.kind === "RED") return colorFor(pocket) === "red" ? 10 : 0;
  if (bet.kind === "BLACK") return colorFor(pocket) === "black" ? 10 : 0;
  if (bet.kind === "EVEN") return pocket % 2 === 0 ? 10 : 0;
  if (bet.kind === "ODD") return pocket % 2 === 1 ? 10 : 0;
  if (bet.kind === "LOW") return pocket >= 1 && pocket <= 18 ? 10 : 0;
  return pocket >= 19 && pocket <= 36 ? 10 : 0;
}

function betLabel(bet: BetState) {
  return bet.kind === "NUMBER" ? `NUM ${bet.number}` : bet.kind;
}

export default function GalacticRoulette({
  active,
  targetScore,
  onFinish,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const startAtRef = useRef(0);
  const finishRef = useRef(onFinish);
  const runningRef = useRef(false);
  const stateRef = useRef(buildState());
  const betRef = useRef<BetState>({ kind: "RED", number: 17 });

  const [hud, setHud] = useState(buildState());
  const [bet, setBet] = useState<BetState>({ kind: "RED", number: 17 });

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  const syncHud = useCallback(() => {
    setHud({ ...stateRef.current });
  }, []);

  const finish = useCallback((won: boolean) => {
    if (!runningRef.current) return;
    runningRef.current = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    gameTone(won ? "win" : "good");
    haptic(won ? [18, 30, 44] : [8, 14, 8]);

    finishRef.current({
      won,
      score: stateRef.current.score,
      timeMs: Math.round(performance.now() - startAtRef.current),
    });
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const state = stateRef.current;
    const cx = W / 2;
    const cy = 270;
    const radius = 146;
    const pocketAngle = TWO_PI / POCKETS.length;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#07111f");
    bg.addColorStop(0.55, "#17233c");
    bg.addColorStop(1, "#070b12");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(97,232,255,.08)";
    for (let y = 54; y < H; y += 54) {
      ctx.fillRect(18, y + ((state.wheelAngle * 18) % 24), W - 36, 1);
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.wheelAngle);

    for (let index = 0; index < POCKETS.length; index += 1) {
      const number = POCKETS[index];
      const start = index * pocketAngle;
      const end = start + pocketAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, end);
      ctx.closePath();
      ctx.fillStyle =
        number === 0 ? "#1f9d55" : RED_NUMBERS.has(number) ? "#c73548" : "#131923";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.20)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.save();
      ctx.rotate(start + pocketAngle / 2);
      ctx.translate(radius - 26, 0);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = "#f7fbff";
      ctx.font = "800 10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(String(number), 0, 3);
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(0, 0, 96, 0, TWO_PI);
    ctx.fillStyle = "#243451";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 58, 0, TWO_PI);
    ctx.fillStyle = "#caa85c";
    ctx.fill();
    ctx.restore();

    const ballRadius = state.phase === "spinning" ? 126 : 112;
    const bx = cx + Math.cos(state.ballAngle) * ballRadius;
    const by = cy + Math.sin(state.ballAngle) * ballRadius;
    ctx.save();
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#f8fbff";
    ctx.fillStyle = "#f8fbff";
    ctx.beginPath();
    ctx.arc(bx, by, 7, 0, TWO_PI);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#f7fbff";
    ctx.textAlign = "center";
    ctx.font = "900 28px system-ui";
    ctx.fillText(state.lastPocket === null ? "RULETA" : String(state.lastPocket), cx, cy + 9);
    ctx.font = "800 12px system-ui";
    ctx.fillStyle = "rgba(247,251,255,.72)";
    ctx.fillText(`Apuesta: ${betLabel(betRef.current)}`, cx, cy + 34);
  }, []);

  const resolveSpin = useCallback(() => {
    const state = stateRef.current;
    const pocket = resolvePocket(state.wheelAngle, state.ballAngle);
    const payout = payoutFor(pocket, betRef.current);
    const balance = state.balance + payout;
    const score = Math.max(
      state.score + payout * 70 + (payout > 0 ? 220 : 35),
      balance * 24 + state.spins * 120
    );

    stateRef.current = {
      ...state,
      phase: "idle",
      ballSpeed: 0,
      lastPocket: pocket,
      lastPayout: payout,
      balance,
      score,
    };
    syncHud();

    if (payout > 0) {
      gameTone("good");
      haptic([6, 16, 6]);
    } else {
      gameTone("bad");
      haptic(12);
    }

    if (score >= targetScore) finish(true);
    else if (balance < SPIN_COST) finish(false);
  }, [finish, syncHud, targetScore]);

  const loop = useCallback((now: number) => {
    if (!runningRef.current) return;

    const state = stateRef.current;
    const dt = Math.min(0.034, lastFrameRef.current ? (now - lastFrameRef.current) / 1000 : 0);
    lastFrameRef.current = now;

    state.wheelAngle = normalize(state.wheelAngle + dt * 0.88);
    state.remainingMs = ROUND_MS - (now - startAtRef.current);

    if (state.phase === "spinning") {
      state.ballAngle = normalize(state.ballAngle - state.ballSpeed * dt);
      state.ballSpeed = Math.max(0, state.ballSpeed - dt * 1.15);
      if (state.ballSpeed <= 0.36) resolveSpin();
    }

    draw();
    if (!runningRef.current) return;

    if (state.remainingMs <= 0) {
      syncHud();
      finish(false);
      return;
    }

    if (Math.floor(now / 250) !== Math.floor((now - dt * 1000) / 250)) syncHud();
    rafRef.current = requestAnimationFrame(loop);
  }, [draw, finish, resolveSpin, syncHud]);

  useEffect(() => {
    if (!active) return;

    stateRef.current = buildState();
    betRef.current = { kind: "RED", number: 17 };
    setBet(betRef.current);
    syncHud();
    runningRef.current = true;
    startAtRef.current = performance.now();
    lastFrameRef.current = 0;
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      runningRef.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, loop, syncHud]);

  function selectBet(kind: BetKind) {
    const next = { ...betRef.current, kind };
    betRef.current = next;
    setBet(next);
    gameTone("tap");
    haptic(3);
  }

  function nextNumber() {
    const next = {
      ...betRef.current,
      kind: "NUMBER" as const,
      number: (betRef.current.number + 1) % 37,
    };
    betRef.current = next;
    setBet(next);
    gameTone("tap");
    haptic(3);
  }

  function launch() {
    const state = stateRef.current;
    if (!runningRef.current || state.phase !== "idle" || state.balance < SPIN_COST) return;

    const elapsed = performance.now() - startAtRef.current;
    const timingPower = (elapsed % 1100) / 1100;
    stateRef.current = {
      ...state,
      balance: state.balance - SPIN_COST,
      spins: state.spins + 1,
      phase: "spinning",
      ballAngle: normalize(state.wheelAngle + Math.PI + timingPower * TWO_PI),
      ballSpeed: 8.6 + timingPower * 3.2,
      lastPayout: 0,
    };
    syncHud();
    gameTone("tap");
    haptic(8);
  }

  return (
    <div className="gameStage skillGameStage galacticRouletteGame">
      <canvas ref={canvasRef} width={W} height={H} className="gameCanvas" aria-label="Galactic Roulette" />

      <div className="rouletteHud">
        <span>{formatTime(hud.remainingMs)}</span>
        <strong>{hud.balance} EUR</strong>
        <span>{hud.lastPocket === null ? "Sin giro" : `Sale ${hud.lastPocket} (+${hud.lastPayout})`}</span>
      </div>

      <div className="rouletteControls" aria-label="Controles de apuesta">
        {(["RED", "BLACK", "EVEN", "ODD", "LOW", "HIGH"] as BetKind[]).map((kind) => (
          <button
            type="button"
            className={bet.kind === kind ? "active" : ""}
            key={kind}
            onPointerDown={(event) => {
              event.preventDefault();
              selectBet(kind);
            }}
          >
            {kind}
          </button>
        ))}
        <button
          type="button"
          className={bet.kind === "NUMBER" ? "active" : ""}
          onPointerDown={(event) => {
            event.preventDefault();
            nextNumber();
          }}
        >
          NUM {bet.number}
        </button>
        <button
          type="button"
          className="launch"
          disabled={hud.phase !== "idle" || hud.balance < SPIN_COST}
          onPointerDown={(event) => {
            event.preventDefault();
            launch();
          }}
        >
          LANZAR -5 EUR
        </button>
      </div>
    </div>
  );
}
