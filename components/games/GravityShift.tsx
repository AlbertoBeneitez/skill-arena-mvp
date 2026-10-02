"use client";

import { useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";

type Props = { active: boolean; onFinish: (result: GameResult) => void };
type Pos = { r: number; c: number };
type Dir = "U" | "D" | "L" | "R";

const GRID = [
  "#######",
  "#...#G#",
  "#.#...#",
  "#...#.#",
  "#.#...#",
  "#S...##",
  "#######",
] as const;

const START: Pos = { r: 5, c: 1 };
const GOAL: Pos = { r: 1, c: 5 };
const DELTA: Record<Dir, [number, number]> = {
  U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1],
};

export default function GravityShift({ active, onFinish }: Props) {
  const [ball, setBall] = useState<Pos>(START);
  const [moves, setMoves] = useState(0);
  const [running, setRunning] = useState(false);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!active) return;
    setBall(START);
    setMoves(0);
    setRunning(true);
    startedAt.current = performance.now();
  }, [active]);

  function shift(dir: Dir) {
    if (!running) return;
    const [dr, dc] = DELTA[dir];
    let r = ball.r;
    let c = ball.c;
    while (GRID[r + dr]?.[c + dc] && GRID[r + dr][c + dc] !== "#") {
      r += dr;
      c += dc;
      if (r === GOAL.r && c === GOAL.c) break;
    }
    if (r === ball.r && c === ball.c) return;

    const nextMoves = moves + 1;
    setMoves(nextMoves);
    setBall({ r, c });

    if (r === GOAL.r && c === GOAL.c) {
      setRunning(false);
      const timeMs = Math.round(performance.now() - startedAt.current);
      const score = Math.max(1000, 6000 - nextMoves * 450 - Math.round(timeMs / 20));
      window.setTimeout(() => onFinish({ won: true, score, timeMs }), 180);
    } else if (nextMoves >= 10) {
      setRunning(false);
      const timeMs = Math.round(performance.now() - startedAt.current);
      window.setTimeout(() => onFinish({ won: false, score: 0, timeMs }), 180);
    }
  }

  return (
    <div className="miniGame gameStage gravityGame">
      <div className="miniGameTitle">GRAVITY SHIFT</div>
      <div className="miniGameHint">cambia la gravedad · llega al portal en ≤ 10 movimientos</div>
      <div className="gravityBoard" role="grid" aria-label="Laberinto de gravedad">
        {GRID.flatMap((row, r) => [...row].map((cell, c) => {
          const isBall = ball.r === r && ball.c === c;
          return (
            <div key={`${r}-${c}`} className={`gravityCell ${cell === "#" ? "wall" : ""} ${cell === "G" ? "goal" : ""}`}>
              {isBall ? "●" : cell === "G" ? "◎" : ""}
            </div>
          );
        }))}
      </div>
      <div className="gravityControls">
        <button onPointerDown={() => shift("U")}>▲</button>
        <div><button onPointerDown={() => shift("L")}>◀</button><button onPointerDown={() => shift("R")}>▶</button></div>
        <button onPointerDown={() => shift("D")}>▼</button>
      </div>
      <div className="miniStats"><span>{moves}/10 movimientos</span><span>sin azar</span></div>
    </div>
  );
}
