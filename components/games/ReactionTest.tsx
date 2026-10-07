"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { createRng } from "@/lib/deterministic/seeded";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = {
  active: boolean;
  targetScore: number;
  seed: string;
  onFinish: (result: GameResult) => void;
};

type Phase = "waiting" | "ready" | "result";

const ROUNDS = 5;

function buildWaits(seed: string) {
  const rng = createRng(\`\${seed}:reaction-waits\`);
  return Array.from({ length: ROUNDS }, () => 1350 + rng.nextInt(2100));
}

export default function ReactionTest({
  active,
  targetScore,
  seed,
  onFinish,
}: Props) {
  const waits = useMemo(() => buildWaits(seed), [seed]);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [round, setRound] = useState(1);
  const [lastReaction, setLastReaction] = useState<number | null>(null);
  const [falseStart, setFalseStart] = useState(false);

  const runningRef = useRef(false);
  const startRef = useRef(0);
  const readyAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreRef = useRef(0);
  const reactionsRef = useRef<number[]>([]);

  const finish = useCallback(
    (won: boolean) => {
      if (!runningRef.current) return;
      runningRef.current = false;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      const reactions = reactionsRef.current;
      const average =
        reactions.length > 0
          ? reactions.reduce((sum, value) => sum + value, 0) / reactions.length
          : 999;

      const consistency =
        reactions.length > 1
          ? Math.sqrt(
              reactions.reduce(
                (sum, value) => sum + Math.pow(value - average, 2),
                0
              ) / reactions.length
            )
          : 0;

      const finalScore = Math.max(
        scoreRef.current,
        Math.round(6500 - average * 12 - consistency * 3)
      );

      gameTone(won ? "win" : "good");
      haptic(won ? [18, 28, 46] : [6, 14, 6]);

      onFinish({
        won,
        score: finalScore,
        timeMs: Math.round(performance.now() - startRef.current),
      });
    },
    [onFinish]
  );

  const armRound = useCallback(
    (roundIndex: number) => {
      if (!runningRef.current) return;

      setPhase("waiting");
      setFalseStart(false);
      setLastReaction(null);

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        if (!runningRef.current) return;
        readyAtRef.current = performance.now();
        setPhase("ready");
        gameTone("countdown");
        haptic(3);
      }, waits[roundIndex]);
    },
    [waits]
  );

  useEffect(() => {
    if (!active) return;

    runningRef.current = true;
    startRef.current = performance.now();
    scoreRef.current = 0;
    reactionsRef.current = [];
    setRound(1);
    setPhase("waiting");
    setLastReaction(null);
    setFalseStart(false);

    armRound(0);

    return () => {
      runningRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, armRound]);

  function tap() {
    if (!runningRef.current) return;

    if (phase === "waiting") {
      setFalseStart(true);
      scoreRef.current = Math.max(0, scoreRef.current - 650);
      gameTone("bad");
      haptic(18);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        armRound(round - 1);
      }, 650);
      return;
    }

    if (phase !== "ready") return;

    const reaction = Math.max(
      70,
      Math.round(performance.now() - readyAtRef.current)
    );
    reactionsRef.current.push(reaction);
    setLastReaction(reaction);
    setPhase("result");

    const roundScore = Math.max(100, 1700 - reaction * 3);
    scoreRef.current += roundScore;

    gameTone(reaction < 230 ? "good" : "tap");
    haptic(reaction < 230 ? 6 : 3);

    if (scoreRef.current >= targetScore) {
      finish(true);
      return;
    }

    if (round >= ROUNDS) {
      timerRef.current = setTimeout(() => finish(false), 550);
      return;
    }

    timerRef.current = setTimeout(() => {
      setRound((value) => value + 1);
      armRound(round);
    }, 650);
  }

  return (
    <button
      type="button"
      className={\`reactionTestGame phase-\${phase}\`}
      onPointerDown={(event) => {
        event.preventDefault();
        tap();
      }}
      aria-label="Reaction Test"
    >
      <div className="reactionCore">
        {phase === "waiting" && (
          <>
            <strong>{falseStart ? "DEMASIADO PRONTO" : "ESPERA"}</strong>
            <span>{falseStart ? "No anticipes" : \`Ronda \${round}/\${ROUNDS}\`}</span>
          </>
        )}

        {phase === "ready" && (
          <>
            <strong>¡YA!</strong>
            <span>TOCA</span>
          </>
        )}

        {phase === "result" && (
          <>
            <strong>{lastReaction} ms</strong>
            <span>{lastReaction !== null && lastReaction < 230 ? "MUY RÁPIDO" : "SIGUE"}</span>
          </>
        )}
      </div>
    </button>
  );
}
