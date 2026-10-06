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

type Point = { x: number; y: number };
type Direction = "up" | "down" | "left" | "right";

const COLS = 17;
const ROWS = 21;
const START: Point = { x: 8, y: 17 };
const ENEMY_STARTS: Point[] = [
  { x: 7, y: 9 },
  { x: 8, y: 9 },
  { x: 9, y: 9 },
];

const RAW_MAZE = [
  "#################",
  "#...............#",
  "#.###.#####.###.#",
  "#.#...........#.#",
  "#.#.##.###.##.#.#",
  "#.....#...#.....#",
  "###.#.#.#.#.#.###",
  "#...#.......#...#",
  "#.###.#####.###.#",
  "#...............#",
  "#.##.###.###.##.#",
  "#....#.....#....#",
  "####.#.###.#.####",
  "#...............#",
  "#.###.#...#.###.#",
  "#.#...#####...#.#",
  "#.#...........#.#",
  "#.....##.##.....#",
  "#.###.......###.#",
  "#...............#",
  "#################",
];

function inside(x: number, y: number) {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

function isWall(x: number, y: number) {
  if (!inside(x, y)) return true;
  return RAW_MAZE[y][x] === "#";
}

function nextPoint(point: Point, direction: Direction): Point {
  if (direction === "up") return { x: point.x, y: point.y - 1 };
  if (direction === "down") return { x: point.x, y: point.y + 1 };
  if (direction === "left") return { x: point.x - 1, y: point.y };
  return { x: point.x + 1, y: point.y };
}

function directionsFrom(point: Point) {
  return (["up", "left", "down", "right"] as Direction[]).filter((direction) => {
    const next = nextPoint(point, direction);
    return !isWall(next.x, next.y);
  });
}

function opposite(a: Direction, b: Direction) {
  return (
    (a === "left" && b === "right") ||
    (a === "right" && b === "left") ||
    (a === "up" && b === "down") ||
    (a === "down" && b === "up")
  );
}

function distance(a: Point, b: Point) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function pointKey(point: Point) {
  return `${point.x},${point.y}`;
}

export default function MazeRush({
  active,
  targetScore,
  seed,
  onFinish,
}: Props) {
  const [player, setPlayer] = useState<Point>(START);
  const [direction, setDirection] = useState<Direction>("left");
  const [queued, setQueued] = useState<Direction>("left");
  const [enemies, setEnemies] = useState(
    ENEMY_STARTS.map((point, index) => ({
      point,
      direction: (index % 2 ? "right" : "left") as Direction,
    }))
  );
  const [pellets, setPellets] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const runningRef = useRef(false);
  const startRef = useRef(0);
  const tickRef = useRef(0);
  const swipeRef = useRef<Point | null>(null);
  const rng = useMemo(() => createRng(seed), [seed]);

  useEffect(() => {
    const nextPellets = new Set<string>();
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (!isWall(x, y)) nextPellets.add(`${x},${y}`);
      }
    }
    nextPellets.delete(pointKey(START));
    ENEMY_STARTS.forEach((point) => nextPellets.delete(pointKey(point)));

    setPellets(nextPellets);
    setPlayer(START);
    setDirection("left");
    setQueued("left");
    setEnemies(
      ENEMY_STARTS.map((point, index) => ({
        point,
        direction: (index % 2 ? "right" : "left") as Direction,
      }))
    );
    setScore(0);
    scoreRef.current = 0;
    tickRef.current = 0;
    runningRef.current = active;
    if (active) startRef.current = performance.now();

    return () => {
      runningRef.current = false;
    };
  }, [active, seed]);

  const finish = useCallback((won: boolean) => {
    if (!runningRef.current) return;
    runningRef.current = false;
    gameTone(won ? "win" : "bad");
    haptic(won ? [18, 26, 48] : 28);
    onFinish({
      won,
      score: scoreRef.current,
      timeMs: Math.round(performance.now() - startRef.current),
    });
  }, [onFinish]);

  function addScore(delta: number) {
    const next = scoreRef.current + delta;
    scoreRef.current = next;
    setScore(next);
    if (next >= targetScore) finish(true);
  }

  useEffect(() => {
    if (!active) return;

    const timer = window.setInterval(() => {
      if (!runningRef.current) return;
      tickRef.current += 1;

      setPlayer((current) => {
        let nextDirection = direction;
        const desired = nextPoint(current, queued);
        if (!isWall(desired.x, desired.y)) nextDirection = queued;

        const candidate = nextPoint(current, nextDirection);
        const next = isWall(candidate.x, candidate.y) ? current : candidate;
        setDirection(nextDirection);

        const key = pointKey(next);
        setPellets((currentPellets) => {
          if (!currentPellets.has(key)) return currentPellets;
          const copy = new Set(currentPellets);
          copy.delete(key);
          addScore(100);
          gameTone("tap");
          haptic(2);
          if (copy.size === 0) finish(true);
          return copy;
        });

        return next;
      });

      if (tickRef.current % 2 === 0) {
        setEnemies((currentEnemies) =>
          currentEnemies.map((enemy, index) => {
            const options = directionsFrom(enemy.point);
            const nonReverse = options.filter(
              (option) => !opposite(option, enemy.direction)
            );
            const candidates = nonReverse.length ? nonReverse : options;

            let chosen = candidates[0] ?? enemy.direction;
            const chase = tickRef.current % 10 < 7;

            if (chase) {
              setPlayer((playerPoint) => {
                chosen = [...candidates].sort((a, b) => {
                  const da = distance(nextPoint(enemy.point, a), playerPoint);
                  const db = distance(nextPoint(enemy.point, b), playerPoint);
                  if (da !== db) return da - db;
                  return (
                    ["up", "left", "down", "right"].indexOf(a) -
                    ["up", "left", "down", "right"].indexOf(b)
                  );
                })[0] ?? chosen;
                return playerPoint;
              });
            } else if (candidates.length > 1) {
              chosen = candidates[(rng.nextInt(candidates.length) + index) % candidates.length];
            }

            return {
              point: nextPoint(enemy.point, chosen),
              direction: chosen,
            };
          })
        );
      }
    }, 125);

    return () => window.clearInterval(timer);
  }, [active, direction, finish, queued, rng]);

  useEffect(() => {
    if (!runningRef.current) return;
    if (enemies.some((enemy) => enemy.point.x === player.x && enemy.point.y === player.y)) {
      finish(false);
    }
  }, [enemies, finish, player]);

  function queueDirection(next: Direction) {
    setQueued(next);
    haptic(2);
  }

  function processSwipe(x: number, y: number) {
    const origin = swipeRef.current;
    if (!origin) return;
    const dx = x - origin.x;
    const dy = y - origin.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      queueDirection(dx > 0 ? "right" : "left");
    } else {
      queueDirection(dy > 0 ? "down" : "up");
    }
    swipeRef.current = { x, y };
  }

  return (
    <div className="detGameSurface mazeRushGame">
      <div
        className="mazeRushBoard"
        onPointerDown={(event) => {
          swipeRef.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => processSwipe(event.clientX, event.clientY)}
        onPointerUp={(event) => {
          processSwipe(event.clientX, event.clientY);
          swipeRef.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      >
        {RAW_MAZE.flatMap((row, y) =>
          [...row].map((cell, x) => {
            const key = `${x},${y}`;
            const enemyIndex = enemies.findIndex(
              (enemy) => enemy.point.x === x && enemy.point.y === y
            );
            const hasPlayer = player.x === x && player.y === y;

            return (
              <div
                key={key}
                className={`mazeCell ${cell === "#" ? "wall" : "path"}`}
              >
                {pellets.has(key) && <span className="mazePellet" />}
                {hasPlayer && <span className="mazeRunner">◆</span>}
                {enemyIndex >= 0 && (
                  <span className={`mazeEnemy e${enemyIndex}`}>●</span>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="mazeDpad">
        <button type="button" className="up" onPointerDown={() => queueDirection("up")}>↑</button>
        <button type="button" className="left" onPointerDown={() => queueDirection("left")}>←</button>
        <button type="button" className="right" onPointerDown={() => queueDirection("right")}>→</button>
        <button type="button" className="down" onPointerDown={() => queueDirection("down")}>↓</button>
      </div>
    </div>
  );
}
