"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import {
  MINE_CHALLENGES,
  mineChallengeFor,
  type MineChallenge,
} from "@/lib/deterministic/challengeSets";
import { gameTone, haptic } from "@/lib/gameFeedback";

import { t as tx, formatNumber, useI18n } from "@/lib/i18n";
import SegmentDigits, { SegmentGlowFilter } from "../SegmentDigits";
type Props = {
  active: boolean;
  targetScore: number;
  seed: string;
  onFinish: (result: GameResult) => void;
};

const MINES = 24;

function neighbors(index: number, cols: number, rows: number) {
  const row = Math.floor(index / cols);
  const col = index % cols;
  const cells: number[] = [];

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (!dx && !dy) continue;

      const rr = row + dy;
      const cc = col + dx;

      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) {
        cells.push(rr * cols + cc);
      }
    }
  }

  return cells;
}

function boardFromMines(
  mineIndexes: readonly number[],
  cols: number,
  rows: number
) {
  const mineSet = new Set(mineIndexes);
  const values = Array(cols * rows).fill(0);

  for (const mine of mineSet) values[mine] = -1;

  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === -1) continue;

    values[index] = neighbors(index, cols, rows).filter((cell) =>
      mineSet.has(cell)
    ).length;
  }

  return values;
}

function revealFlood(
  values: number[],
  revealed: Set<number>,
  start: number,
  cols: number,
  rows: number
) {
  const queue = [start];

  while (queue.length) {
    const current = queue.shift()!;

    if (
      revealed.has(current) ||
      values[current] === -1
    ) {
      continue;
    }

    revealed.add(current);

    if (values[current] === 0) {
      for (const cell of neighbors(current, cols, rows)) {
        if (
          !revealed.has(cell) &&
          values[cell] !== -1
        ) {
          queue.push(cell);
        }
      }
    }
  }
}

export default function MineGrid({
  active,
  targetScore,
  seed,
  onFinish,
}: Props) {
  useI18n();
  // Training only (client-result): every attempt draws one of the validated,
  // guess-free boards. Competition will use a server-held board instead.
  const [challenge, setChallenge] = useState<MineChallenge>(() =>
    mineChallengeFor(seed)
  );
  const lastBoardRef = useRef(challenge.id);

  const board = useMemo(
    () =>
      boardFromMines(
        challenge.mineIndexes,
        challenge.cols,
        challenge.rows
      ),
    [challenge]
  );

  const [revealed, setRevealed] = useState<Set<number>>(
    new Set()
  );
  const [flagged, setFlagged] = useState<Set<number>>(
    new Set()
  );
  const [started, setStarted] = useState(false);
  const [flagMode, setFlagMode] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  // After a mine the board stays exactly as it was so the player can study it.
  const [ended, setEnded] = useState<
    null | { won: boolean; solved: boolean; score: number; timeMs: number; hit: number | null }
  >(null);
  const [pressing, setPressing] = useState<number | null>(null);
  const holdRef = useRef<{ timer: number; index: number; fired: boolean } | null>(null);

  const runningRef = useRef(false);
  const startRef = useRef(0);

  useEffect(() => {
    if (active) {
      const pool = MINE_CHALLENGES.filter(
        (item) => item.id !== lastBoardRef.current
      );
      const pick = new Uint32Array(1);
      if (typeof crypto !== "undefined") crypto.getRandomValues(pick);
      else pick[0] = Math.floor(Math.random() * 2 ** 32);
      const next = pool[pick[0] % pool.length];
      lastBoardRef.current = next.id;
      setChallenge(next);
    }
    setRevealed(new Set());
    setFlagged(new Set());
    setStarted(false);
    setFlagMode(false);
    setElapsedMs(0);
    setEnded(null);
    setPressing(null);

    runningRef.current = active;

    if (active) {
      startRef.current = performance.now();
    }

    const timer = window.setInterval(() => {
      if (runningRef.current) {
        setElapsedMs(
          Math.round(performance.now() - startRef.current)
        );
      }
    }, 200);

    return () => {
      window.clearInterval(timer);
      runningRef.current = false;
    };
  }, [active, seed]);

  // Correct assignments: safe cells opened plus flags that sit on real mines.
  function correctCells(nextRevealed: Set<number>, nextFlagged: Set<number>) {
    let count = 0;
    for (const index of nextRevealed) if (board[index] !== -1) count += 1;
    for (const index of nextFlagged) if (board[index] === -1) count += 1;
    return count;
  }

  function finish(
    won: boolean,
    nextRevealed: Set<number>,
    hit: number | null = null
  ) {
    if (!runningRef.current) return;

    runningRef.current = false;

    const timeMs = Math.round(performance.now() - startRef.current);
    // Unsolved: correctly assigned cells. Solved: the faster, the higher.
    const score = won
      ? Math.max(1000, 12000 - Math.floor(timeMs / 10))
      : correctCells(nextRevealed, flagged);

    gameTone(won ? "win" : "bad");
    haptic(won ? [18, 25, 45] : 28);

    const result = { won: won && score >= targetScore, solved: won, score, timeMs, hit };
    setElapsedMs(timeMs);
    setEnded(result);
    // A win goes straight on; a mine waits for the player to look at the board.
    if (won) window.setTimeout(() => onFinish({ won: result.won, score, timeMs }), 900);
  }

  function reveal(index: number) {
    if (
      !runningRef.current ||
      revealed.has(index) ||
      flagged.has(index)
    ) {
      return;
    }

    // Both competitors must start from the same validated opening.
    if (
      !started &&
      index !== challenge.startIndex
    ) {
      haptic(4);
      return;
    }

    const next = new Set(revealed);

    if (!started) setStarted(true);

    if (board[index] === -1) {
      next.add(index);
      setRevealed(next);
      finish(false, next, index);
      return;
    }

    revealFlood(
      board,
      next,
      index,
      challenge.cols,
      challenge.rows
    );

    setRevealed(next);

    const safeCount = [...next].filter(
      (cell) => board[cell] !== -1
    ).length;

    if (safeCount === challenge.cols * challenge.rows - MINES) {
      finish(true, next);
      return;
    }

    gameTone("tap");
    haptic(3);
  }

  function toggleFlag(index: number) {
    if (
      !runningRef.current ||
      !started ||
      revealed.has(index)
    ) {
      return;
    }

    const next = new Set(flagged);

    if (next.has(index)) {
      next.delete(index);
    } else if (next.size < MINES) {
      next.add(index);
    }

    setFlagged(next);
    haptic(3);
  }

  function holdStart(index: number) {
    if (!runningRef.current || !started || revealed.has(index)) return;
    holdEnd(false);
    setPressing(index);
    const hold = {
      index,
      fired: false,
      timer: window.setTimeout(() => {
        hold.fired = true;
        setPressing(null);
        toggleFlag(index);
        haptic([6, 20, 6]);
      }, 380),
    };
    holdRef.current = hold;
  }

  function holdEnd(keepFired: boolean) {
    const hold = holdRef.current;
    if (!hold) return;
    window.clearTimeout(hold.timer);
    setPressing(null);
    if (!keepFired) holdRef.current = null;
  }

  function interact(index: number) {
    // A press that already marked the cell must not also open/toggle it.
    if (holdRef.current?.fired && holdRef.current.index === index) {
      holdRef.current = null;
      return;
    }
    if (
      !started &&
      index === challenge.startIndex
    ) {
      reveal(index);
      return;
    }

    if (flagMode) {
      toggleFlag(index);
    } else {
      reveal(index);
    }
  }

  const hudCorrect = correctCells(revealed, flagged);

  return (
    <div
      className="detGameSurface mineGridGame mineGridAdvanced mineGridDigital"
      aria-label="Mine Grid"
    >
      {(() => {
        const mm = String(Math.floor(elapsedMs / 60000)).padStart(2, "0"), ss = String(Math.floor(elapsedMs / 1000) % 60).padStart(2, "0");
        const level = challenge.deductionRounds <= 9 ? tx("mine.easy") : challenge.deductionRounds <= 12 ? tx("mine.medium") : tx("mine.hard");
        const left = Math.max(0, MINES - flagged.size), fieldNo = challenge.id.replace(/\D+/g, "") || "0";
        return (
          <div className="mineConsole" aria-hidden="false">
            <div className="mineConsoleCell">
              <small className="dotMatrix">{tx("mine.fieldLabel")}</small>
              <SegmentDigits value={fieldNo.padStart(2, "0")} label={challenge.id} />
              <small className="dotMatrix mineLevel">{level}</small>
            </div>
            <div className="mineConsoleCell mineConsoleTime">
              <small className="dotMatrix">{tx("mine.timeLabel")}</small>
              <SegmentDigits value={`${mm}:${ss}`} label={`${mm}:${ss}`} />
            </div>
            <div className="mineConsoleCell mineConsoleMines">
              <small className="dotMatrix">{tx("mine.minesLabel")}</small>
              <SegmentDigits value={String(left).padStart(2, "0")} label={tx("mine.minesLeft", { n: left })} />
            </div>
          </div>
        );
      })()}
      <svg className="mineSegDefs" width="0" height="0" aria-hidden="true" focusable="false"><defs><SegmentGlowFilter id="mineSegGlow" /></defs></svg>
      <div
        className="mineGridBoard"
        style={{
          gridTemplateColumns: `repeat(${challenge.cols}, 1fr)`,
        }}
      >
        {board.map((value, index) => {
          const open = revealed.has(index);
          const isFlagged = flagged.has(index);
          const isHit = ended?.hit === index;
          const isStart =
            !started &&
            index === challenge.startIndex;

          return (
            <button
              key={index}
              type="button"
              className={`mineCell ${open ? "open" : ""} ${open && value === -1 ? "mine" : ""} ${isHit ? "hit" : ""} ${isStart ? "startCell" : ""} ${isFlagged ? "flagged" : ""} ${pressing === index ? "pressing" : ""}`}
              onClick={() => (ended ? undefined : interact(index))}
              onPointerDown={() => holdStart(index)}
              onPointerUp={() => holdEnd(true)}
              onPointerLeave={() => holdEnd(false)}
              onPointerCancel={() => holdEnd(false)}
              onContextMenu={(event) => event.preventDefault()}
              aria-label={
                isStart
                  ? tx("mine.start")
                  : open
                    ? value === -1
                      ? tx("mine.mine")
                      : tx("mine.cell", { v: value })
                    : isFlagged
                      ? tx("mine.flagged")
                      : tx("mine.hidden")
              }
            >
              {isFlagged
                ? <svg className="mineFlagIcon" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 17V3" /><path d="M6.5 3.5h8.5l-2.4 3.2 2.4 3.3H6.5z" /></svg>
                : open
                  ? value === -1
                    ? <svg className="mineBombIcon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="4.6" /><path d="M10 1.8v3M10 15.2v3M1.8 10h3M15.2 10h3M4.2 4.2l2.1 2.1M13.7 13.7l2.1 2.1M4.2 15.8l2.1-2.1M13.7 6.3l2.1-2.1" /></svg>
                    : value ? <SegmentDigits value={String(value)} filterId="mineSegGlow" ghost={false} className={`mineN mineN${value}`} /> : ""
                  : isStart
                    ? <i className="mineStartDot" aria-hidden="true" />
                    : ""}
            </button>
          );
        })}
      </div>

      <div className="mineModeControl">
        {ended && !ended.solved ? (
          <>
            <span className="mineStartHint">
              <b className="dotMatrix mineMarquee mineAlarm">{ended.score === 1 ? tx("mine.endOne", { n: ended.score }) : tx("mine.endMany", { n: ended.score })}</b>
            </span>
            <button type="button" className="active" onClick={() => onFinish({ won: false, score: ended.score, timeMs: ended.timeMs })}>
              {tx("mine.seeResult")}
            </button>
          </>
        ) : !started ? (
          <span className="mineStartHint"><b className="dotMatrix mineMarquee">{tx("mine.startHint")}</b></span>
        ) : (
          <>
            <span className="mineStartHint mineOkCounter"><SegmentDigits value={String(hudCorrect).padStart(3, "0")} label={tx("mine.ok", { n: hudCorrect })} /><small className="dotMatrix">OK</small></span>
            <button
              type="button"
              className={!flagMode ? "active" : ""}
              aria-pressed={!flagMode}
              onClick={() => setFlagMode(false)}
            >
              <i className="mineLed" aria-hidden="true" />{tx("mine.open")}
            </button>
            <button
              type="button"
              className={flagMode ? "active" : ""}
              aria-pressed={flagMode}
              onClick={() => setFlagMode(true)}
            >
              <i className="mineLed" aria-hidden="true" />{tx("mine.flag")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
