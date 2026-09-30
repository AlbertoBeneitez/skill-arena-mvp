"use client";

import { useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";

type Props = { active: boolean; onFinish: (result: GameResult) => void };
const PATTERN = [0, 4, 7, 2, 8];

export default function GridRecall({ active, onFinish }: Props) {
  const [phase, setPhase] = useState<"idle" | "show" | "play" | "done">("idle");
  const [picked, setPicked] = useState<number[]>([]);
  const startAt = useRef(0);

  useEffect(() => {
    if (!active) return;
    setPicked([]);
    setPhase("show");
    startAt.current = performance.now();
    const timer = window.setTimeout(() => setPhase("play"), 2200);
    return () => window.clearTimeout(timer);
  }, [active]);

  function choose(index: number) {
    if (phase !== "play" || picked.includes(index)) return;
    const next = [...picked, index];
    setPicked(next);
    if (next.length === PATTERN.length) {
      setPhase("done");
      const correct = next.filter((value, i) => value === PATTERN[i]).length;
      const timeMs = Math.round(performance.now() - startAt.current);
      window.setTimeout(() => onFinish({ won: correct === PATTERN.length, score: correct * 200, timeMs }), 250);
    }
  }

  return (
    <div className="miniGame gameStage">
      <div className="miniGameTitle">GRID RECALL</div>
      <div className="miniGameHint">{phase === "show" ? "memoriza el orden" : phase === "play" ? "repítelo" : "esperando"}</div>
      <div className="recallGrid">
        {Array.from({ length: 9 }).map((_, i) => {
          const show = phase === "show" && PATTERN.includes(i);
          const chosen = picked.includes(i);
          const order = PATTERN.indexOf(i);
          return (
            <button key={i} className={`recallCell ${show ? "show" : ""} ${chosen ? "chosen" : ""}`} onPointerDown={() => choose(i)} disabled={phase !== "play"}>
              {show ? order + 1 : chosen ? picked.indexOf(i) + 1 : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}
