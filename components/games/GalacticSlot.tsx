"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createRng } from "@/lib/deterministic/seeded";
import { gameTone, haptic } from "@/lib/gameFeedback";
import type { GameResult } from "@/lib/types";

type Props = {
  active: boolean;
  targetScore: number;
  seed: string;
  onFinish: (result: GameResult) => void;
};

type SlotSymbol = {
  id: string;
  label: string;
  tint: string;
};

type SlotSession = {
  indexes: [number, number, number];
  steps: [number, number, number];
  balance: number;
  score: number;
  spins: number;
  lastWin: number;
  remainingMs: number;
  message: string;
};

const SYMBOLS: SlotSymbol[] = [
  { id: "lemon", label: "LIMON", tint: "#f5d94b" },
  { id: "orange", label: "NARANJA", tint: "#ff9f3d" },
  { id: "cherry", label: "CEREZA", tint: "#ef476f" },
  { id: "seven", label: "7", tint: "#f5f7ff" },
  { id: "star", label: "ESTRELLA", tint: "#7be3ff" },
  { id: "bell", label: "CAMPANA", tint: "#ffd166" },
  { id: "gem", label: "GEMA", tint: "#9b8cff" },
  { id: "comet", label: "COMETA", tint: "#6ee7b7" },
];

const START_BALANCE = 100;
const SPIN_COST = 5;
const ROUND_MS = 180_000;

function formatTime(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function buildSession(seed: string): SlotSession {
  const rng = createRng(`${seed}:galactic-slot`);
  return {
    indexes: [rng.nextInt(8), rng.nextInt(8), rng.nextInt(8)],
    steps: [1 + rng.nextInt(8), 1 + rng.nextInt(8), 1 + rng.nextInt(8)],
    balance: START_BALANCE,
    score: START_BALANCE * 20,
    spins: 0,
    lastWin: 0,
    remainingMs: ROUND_MS,
    message: "Ajusta los giros y lanza.",
  };
}

function evaluate(symbols: SlotSymbol[]) {
  const [a, b, c] = symbols.map((symbol) => symbol.id);
  const counts = new Map<string, number>();
  for (const id of [a, b, c]) counts.set(id, (counts.get(id) ?? 0) + 1);

  if (a === "seven" && b === "seven" && c === "seven") {
    return { payout: 120, label: "Triple 7 galactico" };
  }

  if (a === b && b === c) {
    return { payout: 45, label: `Triple ${symbols[0].label}` };
  }

  if ([a, b, c].every((id) => ["star", "gem", "comet"].includes(id))) {
    return { payout: 28, label: "Combo cosmico" };
  }

  if ([a, b, c].every((id) => ["lemon", "orange", "cherry"].includes(id))) {
    return { payout: 18, label: "Frutas completas" };
  }

  if ((counts.get("cherry") ?? 0) === 2) {
    return { payout: 15, label: "Doble cereza" };
  }

  if ([...counts.values()].some((count) => count === 2)) {
    return { payout: 8, label: "Pareja" };
  }

  return { payout: 0, label: "Sin premio" };
}

export default function GalacticSlot({
  active,
  targetScore,
  seed,
  onFinish,
}: Props) {
  const initial = useMemo(() => buildSession(seed), [seed]);
  const [session, setSession] = useState(initial);
  const sessionRef = useRef(initial);
  const runningRef = useRef(false);
  const startAtRef = useRef(0);
  const finishRef = useRef(onFinish);

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  const commit = useCallback((next: SlotSession) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const finish = useCallback((won: boolean) => {
    if (!runningRef.current) return;
    runningRef.current = false;

    gameTone(won ? "win" : "good");
    haptic(won ? [18, 28, 45] : [8, 14, 8]);

    finishRef.current({
      won,
      score: sessionRef.current.score,
      timeMs: Math.round(performance.now() - startAtRef.current),
    });
  }, []);

  useEffect(() => {
    if (!active) return;

    const next = buildSession(seed);
    commit(next);
    runningRef.current = true;
    startAtRef.current = performance.now();

    const timer = setInterval(() => {
      if (!runningRef.current) return;

      const remainingMs = ROUND_MS - (performance.now() - startAtRef.current);
      const previous = sessionRef.current;
      const updated = { ...previous, remainingMs };
      commit(updated);

      if (remainingMs <= 0) finish(false);
    }, 250);

    return () => {
      runningRef.current = false;
      clearInterval(timer);
    };
  }, [active, commit, finish, seed]);

  function adjust(reel: 0 | 1 | 2) {
    if (!runningRef.current) return;

    const current = sessionRef.current;
    const steps = [...current.steps] as [number, number, number];
    steps[reel] = (steps[reel] % SYMBOLS.length) + 1;
    commit({ ...current, steps, message: `Ruleta ${reel + 1}: ${steps[reel]} pasos.` });
    gameTone("tap");
    haptic(3);
  }

  function spin() {
    const current = sessionRef.current;
    if (!runningRef.current || current.balance < SPIN_COST) return;

    const indexes = current.indexes.map(
      (value, index) => (value + current.steps[index]) % SYMBOLS.length
    ) as [number, number, number];
    const symbols = indexes.map((index) => SYMBOLS[index]);
    const result = evaluate(symbols);
    const balance = current.balance - SPIN_COST + result.payout;
    const score = Math.max(
      current.score + result.payout * 70 + (result.payout > 0 ? 180 : 24),
      balance * 24 + current.spins * 95
    );

    const next = {
      ...current,
      indexes,
      balance,
      score,
      spins: current.spins + 1,
      lastWin: result.payout,
      message: result.label,
    };
    commit(next);

    if (result.payout > 0) {
      gameTone("good");
      haptic([5, 18, 5]);
    } else {
      gameTone("tap");
      haptic(3);
    }

    if (score >= targetScore) {
      finish(true);
    } else if (balance < SPIN_COST) {
      finish(false);
    }
  }

  const visibleReels = session.indexes.map((centerIndex, reel) => {
    return [-1, 0, 1].map((offset) => {
      const index = (centerIndex + offset + SYMBOLS.length) % SYMBOLS.length;
      return { ...SYMBOLS[index], active: offset === 0, key: `${reel}-${offset}-${index}` };
    });
  });

  return (
    <div className="gameStage skillGameStage galacticSlotGame" aria-label="Galactic Slot">
      <div className="galacticHud">
        <span>{formatTime(session.remainingMs)}</span>
        <strong>{session.balance} EUR</strong>
        <span>{session.spins} tiradas</span>
      </div>

      <div className="slotMachineShell">
        <div className="slotReels" aria-label="Ruletas fijas">
          {visibleReels.map((reel, reelIndex) => (
            <div className="slotReel" key={reelIndex}>
              {reel.map((symbol) => (
                <div
                  className={symbol.active ? "slotSymbol active" : "slotSymbol"}
                  key={symbol.key}
                  style={{ "--symbol-tint": symbol.tint } as CSSProperties}
                >
                  {symbol.label}
                </div>
              ))}
              <button type="button" onPointerDown={(event) => { event.preventDefault(); adjust(reelIndex as 0 | 1 | 2); }}>
                +{session.steps[reelIndex]}
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="slotSpinButton"
          disabled={!runningRef.current || session.balance < SPIN_COST}
          onPointerDown={(event) => {
            event.preventDefault();
            spin();
          }}
        >
          LANZAR -5 EUR
        </button>
      </div>

      <div className="slotPayouts">
        <strong>{session.message}</strong>
        <span>Ultimo premio: {session.lastWin} EUR</span>
        <span>7-7-7 paga 120 EUR · triples 45 · pareja 8</span>
      </div>
    </div>
  );
}
