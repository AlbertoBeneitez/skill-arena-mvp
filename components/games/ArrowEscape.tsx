"use client";

import { useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";

type Props = { active: boolean; onFinish: (result: GameResult) => void };
type Dir = "U" | "D" | "L" | "R";
type Arrow = { id: number; r: number; c: number; dir: Dir };

const SIZE = 6;
const INITIAL: Arrow[] = [
  { id: 1, r: 0, c: 2, dir: "U" },
  { id: 2, r: 1, c: 2, dir: "U" },
  { id: 3, r: 2, c: 2, dir: "U" },
  { id: 4, r: 2, c: 0, dir: "R" },
  { id: 5, r: 2, c: 4, dir: "L" },
  { id: 6, r: 4, c: 2, dir: "U" },
  { id: 7, r: 4, c: 0, dir: "R" },
  { id: 8, r: 4, c: 4, dir: "L" },
  { id: 9, r: 5, c: 1, dir: "D" },
  { id: 10, r: 5, c: 3, dir: "D" },
];
const SYMBOL: Record<Dir, string> = { U: "↑", D: "↓", L: "←", R: "→" };
const DELTA: Record<Dir, [number, number]> = { U: [-1,0], D: [1,0], L: [0,-1], R: [0,1] };

export default function ArrowEscape({ active, onFinish }: Props) {
  const [arrows, setArrows] = useState<Arrow[]>(INITIAL);
  const [blocked, setBlocked] = useState(0);
  const [running, setRunning] = useState(false);
  const startAt = useRef(0);

  useEffect(() => {
    if (!active) return;
    setArrows(INITIAL);
    setBlocked(0);
    setRunning(true);
    startAt.current = performance.now();
  }, [active]);

  function tapArrow(arrow: Arrow) {
    if (!running) return;
    const occupied = new Set(arrows.filter((a) => a.id !== arrow.id).map((a) => `${a.r},${a.c}`));
    const [dr, dc] = DELTA[arrow.dir];
    let r = arrow.r + dr;
    let c = arrow.c + dc;
    let clear = true;
    while (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
      if (occupied.has(`${r},${c}`)) { clear = false; break; }
      r += dr; c += dc;
    }
    if (!clear) {
      setBlocked((n) => n + 1);
      return;
    }

    const next = arrows.filter((a) => a.id !== arrow.id);
    setArrows(next);
    if (next.length === 0) {
      setRunning(false);
      const timeMs = Math.round(performance.now() - startAt.current);
      const score = Math.max(1000, 12000 - blocked * 500 - Math.round(timeMs / 10));
      window.setTimeout(() => onFinish({ won: true, score, timeMs }), 180);
    }
  }

  return (
    <div className="miniGame gameStage arrowGame">
      <div className="miniGameTitle">ARROW ESCAPE</div>
      <div className="miniGameHint">saca todas las flechas · una flecha solo sale si su camino está libre</div>
      <div className="arrowBoard">
        {Array.from({ length: SIZE * SIZE }).map((_, index) => {
          const r = Math.floor(index / SIZE);
          const c = index % SIZE;
          const arrow = arrows.find((a) => a.r === r && a.c === c);
          return (
            <button key={index} className="arrowCell" disabled={!arrow || !running} onPointerDown={() => arrow && tapArrow(arrow)}>
              {arrow ? SYMBOL[arrow.dir] : ""}
            </button>
          );
        })}
      </div>
      <div className="miniStats"><span>{INITIAL.length - arrows.length}/{INITIAL.length} fuera</span><span>{blocked} bloqueos</span></div>
    </div>
  );
}
