"use client";

import { useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = { active: boolean; onFinish: (result: GameResult) => void };
type Dir = "U" | "D" | "L" | "R";
type Arrow = { id: number; r: number; c: number; dir: Dir };
type Stage = { label: string; arrows: Arrow[] };

const SIZE = 6;
const SYMBOL: Record<Dir, string> = { U: "↑", D: "↓", L: "←", R: "→" };
const DELTA: Record<Dir, [number, number]> = { U: [-1,0], D: [1,0], L: [0,-1], R: [0,1] };

const STAGES: Stage[] = [
  {
    label: "APERTURA",
    arrows: [
      { id: 1, r: 0, c: 2, dir: "U" },
      { id: 2, r: 1, c: 2, dir: "U" },
      { id: 3, r: 2, c: 2, dir: "U" },
      { id: 4, r: 2, c: 0, dir: "R" },
      { id: 5, r: 2, c: 4, dir: "L" },
      { id: 6, r: 4, c: 2, dir: "U" },
      { id: 7, r: 4, c: 0, dir: "R" },
      { id: 8, r: 4, c: 4, dir: "D" },
      { id: 9, r: 5, c: 1, dir: "D" },
      { id: 10, r: 5, c: 3, dir: "D" },
    ],
  },
  {
    label: "DOBLE FRENTE",
    arrows: [
      { id: 21, r: 0, c: 1, dir: "U" },
      { id: 22, r: 1, c: 1, dir: "U" },
      { id: 23, r: 2, c: 1, dir: "U" },
      { id: 24, r: 3, c: 1, dir: "U" },
      { id: 25, r: 3, c: 0, dir: "R" },
      { id: 26, r: 0, c: 4, dir: "U" },
      { id: 27, r: 1, c: 4, dir: "U" },
      { id: 28, r: 2, c: 4, dir: "U" },
      { id: 29, r: 3, c: 4, dir: "U" },
      { id: 30, r: 3, c: 5, dir: "L" },
      { id: 31, r: 5, c: 1, dir: "D" },
      { id: 32, r: 5, c: 4, dir: "D" },
    ],
  },
  {
    label: "CIERRE",
    arrows: [
      { id: 41, r: 0, c: 0, dir: "U" },
      { id: 42, r: 1, c: 0, dir: "U" },
      { id: 43, r: 2, c: 0, dir: "U" },
      { id: 44, r: 2, c: 1, dir: "L" },
      { id: 45, r: 0, c: 5, dir: "U" },
      { id: 46, r: 1, c: 5, dir: "U" },
      { id: 47, r: 2, c: 5, dir: "U" },
      { id: 48, r: 2, c: 4, dir: "R" },
      { id: 49, r: 4, c: 2, dir: "L" },
      { id: 50, r: 4, c: 1, dir: "L" },
      { id: 51, r: 4, c: 3, dir: "R" },
      { id: 52, r: 4, c: 4, dir: "R" },
      { id: 53, r: 5, c: 2, dir: "D" },
      { id: 54, r: 5, c: 3, dir: "D" },
    ],
  },
];

export default function ArrowEscape({ active, onFinish }: Props) {
  const [stageIndex, setStageIndex] = useState(0);
  const [arrows, setArrows] = useState<Arrow[]>(STAGES[0].arrows);
  const [blocked, setBlocked] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(false);
  const [feedback, setFeedback] = useState<"clear" | "blocked" | null>(null);
  const startAt = useRef(0);

  const stage = STAGES[stageIndex];
  const totalArrows = STAGES.reduce((sum, item) => sum + item.arrows.length, 0);
  const removedBefore = STAGES.slice(0, stageIndex).reduce((sum, item) => sum + item.arrows.length, 0);
  const totalRemoved = removedBefore + (stage.arrows.length - arrows.length);

  useEffect(() => {
    if (!active) return;
    setStageIndex(0);
    setArrows(STAGES[0].arrows);
    setBlocked(0);
    setCombo(0);
    setBestCombo(0);
    setScore(0);
    setFeedback(null);
    setRunning(true);
    startAt.current = performance.now();
  }, [active]);

  function loadStage(index: number) {
    setStageIndex(index);
    setArrows(STAGES[index].arrows);
    setCombo(0);
    setFeedback(null);
  }

  function tapArrow(arrow: Arrow) {
    if (!running) return;
    const occupied = new Set(arrows.filter((item) => item.id !== arrow.id).map((item) => `${item.r},${item.c}`));
    const [dr, dc] = DELTA[arrow.dir];
    let r = arrow.r + dr;
    let c = arrow.c + dc;
    let clear = true;

    while (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
      if (occupied.has(`${r},${c}`)) {
        clear = false;
        break;
      }
      r += dr;
      c += dc;
    }

    if (!clear) {
      setBlocked((value) => value + 1);
      setCombo(0);
      setScore((value) => Math.max(0, value - 90));
      setFeedback("blocked");
      gameTone("bad");
      haptic(18);
      window.setTimeout(() => setFeedback(null), 150);
      return;
    }

    const nextCombo = combo + 1;
    const gain = 180 + Math.min(8, nextCombo) * 28;
    const next = arrows.filter((item) => item.id !== arrow.id);
    setCombo(nextCombo);
    setBestCombo((value) => Math.max(value, nextCombo));
    setScore((value) => value + gain);
    setArrows(next);
    setFeedback("clear");
    gameTone(nextCombo >= 5 ? "good" : "tap");
    haptic(nextCombo >= 5 ? 12 : 5);
    window.setTimeout(() => setFeedback(null), 100);

    if (next.length > 0) return;

    gameTone("good");
    haptic([12, 18, 18]);

    if (stageIndex < STAGES.length - 1) {
      window.setTimeout(() => loadStage(stageIndex + 1), 360);
      return;
    }

    setRunning(false);
    const timeMs = Math.round(performance.now() - startAt.current);
    const finalScore = Math.max(1000, score + gain + totalArrows * 280 - blocked * 120 - Math.round(timeMs / 14));
    window.setTimeout(() => onFinish({ won: true, score: finalScore, timeMs }), 420);
  }

  return (
    <div className={`miniGame gameStage arrowGame advancedPuzzle ${feedback ? `flash-${feedback === "clear" ? "good" : "bad"}` : ""}`}>
      <div className="gameTopBar">
        <div><small>FASE</small><strong>{stageIndex + 1}/{STAGES.length}</strong></div>
        <div className="gameProgress"><i style={{ width: `${Math.round((totalRemoved / totalArrows) * 100)}%` }} /></div>
        <div><small>COMBO</small><strong>×{combo}</strong></div>
      </div>

      <div className="miniGameTitle">ARROW ESCAPE</div>
      <div className="miniGameHint">{stage.label} · encuentra las salidas libres sin romper el ritmo</div>

      <div className="arrowBoard">
        {Array.from({ length: SIZE * SIZE }).map((_, index) => {
          const r = Math.floor(index / SIZE);
          const c = index % SIZE;
          const arrow = arrows.find((item) => item.r === r && item.c === c);
          return (
            <button
              key={`${stageIndex}-${index}`}
              className="arrowCell"
              disabled={!arrow || !running}
              onPointerDown={() => arrow && tapArrow(arrow)}
            >
              {arrow ? SYMBOL[arrow.dir] : ""}
            </button>
          );
        })}
      </div>

      <div className="arrowStats">
        <div><small>PUNTOS</small><strong>{score.toLocaleString("es-ES")}</strong></div>
        <div><small>MEJOR COMBO</small><strong>×{bestCombo}</strong></div>
        <div><small>BLOQUEOS</small><strong>{blocked}</strong></div>
      </div>
    </div>
  );
}
