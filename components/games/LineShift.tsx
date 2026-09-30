"use client";

import { useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";

type Props = { active: boolean; onFinish: (result: GameResult) => void };
const TARGETS = [2, 1, 3, 0, 2, 3];

export default function LineShift({ active, onFinish }: Props) {
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(false);
  const startAt = useRef(0);
  const scoreRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    setStep(0);
    setScore(0);
    scoreRef.current = 0;
    startAt.current = performance.now();
    setRunning(true);
  }, [active]);

  function choose(index: number) {
    if (!running) return;
    const gain = index === TARGETS[step] ? 150 : 0;
    const nextScore = scoreRef.current + gain;
    scoreRef.current = nextScore;
    setScore(nextScore);
    const nextStep = step + 1;
    if (nextStep >= TARGETS.length) {
      setRunning(false);
      const timeMs = Math.round(performance.now() - startAt.current);
      window.setTimeout(() => onFinish({ won: nextScore >= 750, score: nextScore, timeMs }), 200);
    } else {
      setStep(nextStep);
    }
  }

  return (
    <div className="miniGame gameStage">
      <div className="miniGameTitle">LINE SHIFT</div>
      <div className="miniGameHint">elige la salida correcta · patrón fijo</div>
      <div className="lineBoard">
        <div className="lineNode">{step + 1}</div>
        <div className="lineChoices">
          {[0, 1, 2, 3].map((i) => (
            <button key={i} onPointerDown={() => choose(i)} disabled={!running}>{["A", "B", "C", "D"][i]}</button>
          ))}
        </div>
      </div>
      <div className="miniStats"><span>{Math.min(step + 1, TARGETS.length)}/{TARGETS.length}</span><span>{score} pts</span></div>
    </div>
  );
}
