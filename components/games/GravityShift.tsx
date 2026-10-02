"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = { active: boolean; onFinish: (result: GameResult) => void };
type Pos = { r: number; c: number };
type Dir = "U" | "D" | "L" | "R";

type Stage = {
  grid: readonly string[];
  start: Pos;
  goal: Pos;
  par: number;
  label: string;
};

const STAGES: Stage[] = [
  {
    grid: [
      "#######",
      "#....G#",
      "#.#.#.#",
      "#.....#",
      "#.#.#.#",
      "#S....#",
      "#######",
    ],
    start: { r: 5, c: 1 },
    goal: { r: 1, c: 5 },
    par: 2,
    label: "CALIBRACIÓN",
  },
  {
    grid: [
      "#######",
      "#..#G##",
      "#..#..#",
      "#.....#",
      "#.#.#.#",
      "#S#...#",
      "#######",
    ],
    start: { r: 5, c: 1 },
    goal: { r: 1, c: 4 },
    par: 7,
    label: "ENCRUCIJADA",
  },
  {
    grid: [
      "#######",
      "#G....#",
      "###.#.#",
      "#.....#",
      "#.#.#.#",
      "#....S#",
      "#######",
    ],
    start: { r: 5, c: 5 },
    goal: { r: 1, c: 1 },
    par: 4,
    label: "VECTOR FINAL",
  },
];

const DELTA: Record<Dir, [number, number]> = {
  U: [-1, 0],
  D: [1, 0],
  L: [0, -1],
  R: [0, 1],
};

export default function GravityShift({ active, onFinish }: Props) {
  const [stageIndex, setStageIndex] = useState(0);
  const [ball, setBall] = useState<Pos>(STAGES[0].start);
  const [moves, setMoves] = useState(0);
  const [totalMoves, setTotalMoves] = useState(0);
  const [stageScores, setStageScores] = useState<number[]>([]);
  const [running, setRunning] = useState(false);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const startedAt = useRef(0);
  const stageStartedAt = useRef(0);

  const stage = STAGES[stageIndex];
  const cells = useMemo(() => stage.grid.flatMap((row) => [...row]), [stage]);

  useEffect(() => {
    if (!active) return;
    setStageIndex(0);
    setBall(STAGES[0].start);
    setMoves(0);
    setTotalMoves(0);
    setStageScores([]);
    setFlash(null);
    setRunning(true);
    startedAt.current = performance.now();
    stageStartedAt.current = performance.now();
  }, [active]);

  function goToStage(index: number) {
    setStageIndex(index);
    setBall(STAGES[index].start);
    setMoves(0);
    stageStartedAt.current = performance.now();
  }

  function shift(dir: Dir) {
    if (!running) return;
    const [dr, dc] = DELTA[dir];
    let r = ball.r;
    let c = ball.c;

    while (stage.grid[r + dr]?.[c + dc] && stage.grid[r + dr][c + dc] !== "#") {
      r += dr;
      c += dc;
      if (r === stage.goal.r && c === stage.goal.c) break;
    }

    if (r === ball.r && c === ball.c) {
      setFlash("bad");
      gameTone("bad");
      haptic(12);
      window.setTimeout(() => setFlash(null), 150);
      return;
    }

    const nextMoves = moves + 1;
    const nextTotalMoves = totalMoves + 1;
    setMoves(nextMoves);
    setTotalMoves(nextTotalMoves);
    setBall({ r, c });
    gameTone("tap");
    haptic(6);

    if (r !== stage.goal.r || c !== stage.goal.c) return;

    const stageTime = performance.now() - stageStartedAt.current;
    const efficiency = Math.max(0, stage.par - Math.max(0, nextMoves - stage.par));
    const stageScore = Math.max(
      550,
      1800 + efficiency * 120 - Math.max(0, nextMoves - stage.par) * 180 - Math.round(stageTime / 28)
    );
    const nextScores = [...stageScores, stageScore];
    setStageScores(nextScores);
    setFlash("good");
    gameTone("good");
    haptic([15, 22, 20]);

    if (stageIndex < STAGES.length - 1) {
      window.setTimeout(() => {
        setFlash(null);
        goToStage(stageIndex + 1);
      }, 420);
      return;
    }

    setRunning(false);
    const timeMs = Math.round(performance.now() - startedAt.current);
    const score = nextScores.reduce((sum, value) => sum + value, 0);
    window.setTimeout(() => onFinish({ won: true, score, timeMs }), 450);
  }

  const pct = Math.round(((stageIndex + (running ? 0 : 1)) / STAGES.length) * 100);

  return (
    <div className={`miniGame gameStage gravityGame advancedPuzzle ${flash ? `flash-${flash}` : ""}`}>
      <div className="gameTopBar">
        <div><small>FASE</small><strong>{stageIndex + 1}/{STAGES.length}</strong></div>
        <div className="gameProgress"><i style={{ width: `${pct}%` }} /></div>
        <div><small>MOV.</small><strong>{totalMoves}</strong></div>
      </div>

      <div className="miniGameTitle">GRAVITY SHIFT</div>
      <div className="miniGameHint">{stage.label} · desliza la esfera hasta el portal</div>

      <div className="gravityBoard" role="grid" aria-label="Laberinto de gravedad">
        {cells.map((cell, index) => {
          const r = Math.floor(index / 7);
          const c = index % 7;
          const isBall = ball.r === r && ball.c === c;
          return (
            <div
              key={`${stageIndex}-${r}-${c}`}
              className={`gravityCell ${cell === "#" ? "wall" : ""} ${cell === "G" ? "goal" : ""}`}
            >
              {isBall ? <span className="gravityBall">●</span> : cell === "G" ? <span className="gravityPortal">◎</span> : ""}
            </div>
          );
        })}
      </div>

      <div className="gravityControls">
        <button onPointerDown={() => shift("U")}>▲</button>
        <div><button onPointerDown={() => shift("L")}>◀</button><button onPointerDown={() => shift("R")}>▶</button></div>
        <button onPointerDown={() => shift("D")}>▼</button>
      </div>

      <div className="puzzleFooter">
        <span>PAR {stage.par}</span>
        <b>{moves === 0 ? "LEE EL TABLERO" : moves <= stage.par ? "EN PAR" : `+${moves - stage.par} SOBRE PAR`}</b>
      </div>
    </div>
  );
}
