"use client";
import { useCallback, useRef } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import { gameTone } from "@/lib/gameFeedback";
import {
  CORNER_SUDOKU_BOXES_V4 as BOXES,
  CORNER_SUDOKU_CELL_POS_V4 as POS,
  CORNER_SUDOKU_CORE_V4 as core,
  CORNER_SUDOKU_PEERS_V4 as PEERS,
  CORNER_SUDOKU_RULES_V4 as R,
  cornerSudokuConflictsV4,
  type CornerSudokuStateV4,
} from "@/lib/verified/cornerSudokuCore.v4";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
import type { ScoreCell } from "../GameScoreboard";

import { t as tx, formatNumber, useI18n } from "@/lib/i18n";

/*
 * Presentation only (Galoku). Two sides of a sudoku meeting at the corner, rotated 45°: the corner box on top in the
 * middle, the top band running down to the right and the left stack down to the left (five boxes). Digits stay
 * upright. The number pad is a 3×3 grid with all nine digits always available, plus an erase key.
 * Selection lives here (never in the core); only PUT_<cell>_<digit> / CLR_<cell> reach the recorder and the replay.
 * Repeated digits among peers are shown in red (a rule check on the board; it never reveals the solution).
 */
const U = 28; // grid unit (cell side) in logical px
const K = U / Math.SQRT2;
const OX = 195, OY = 98; // top vertex of the corner box
const BOX_TONE = ["#f3c55a", "#7fe3ee", "#5fb8ff", "#ff7ab8", "#c58cff"] as const;
/** 3×3 number pad (1 2 3 / 4 5 6 / 7 8 9), every digit always enabled. */
const PAD = Array.from({ length: 9 }, (_, i) => {
  const w = 74, h = 48, gap = 9, x0 = 195 - (3 * w + 2 * gap) / 2;
  return { d: i + 1, x: x0 + (i % 3) * (w + gap), y: 370 + Math.floor(i / 3) * (h + gap), w, h };
});
/** Erase key under the pad, as wide as the pad. */
const ERASE = { x: PAD[0].x, y: PAD[8].y + PAD[8].h + 9, w: PAD[2].x + PAD[2].w - PAD[0].x, h: 44 };
const inside = (k: { x: number; y: number; w: number; h: number }, x: number, y: number) => x >= k.x - 4 && x <= k.x + k.w + 4 && y >= k.y - 4 && y <= k.y + k.h + 4;

const toScreen = (col: number, row: number) => ({ x: OX + (col - row) * K, y: OY + (col + row) * K });
function cellAt(px: number, py: number) {
  const dx = (px - OX) / K, dy = (py - OY) / K;
  const col = Math.floor((dx + dy) / 2), row = Math.floor((dy - dx) / 2);
  return POS.findIndex((p) => p.row === row && p.col === col);
}
function diamond(ctx: CanvasRenderingContext2D, col: number, row: number, w = 1, h = 1) {
  const a = toScreen(col, row), b = toScreen(col + w, row), c = toScreen(col + w, row + h), d = toScreen(col, row + h);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
}
const centre = (cell: number) => toScreen(POS[cell].col + 0.5, POS[cell].row + 0.5);
const BOX_ORIGIN = BOXES.map(([r0, c0]) => [c0, r0] as const);

/** armed: 1–9 = digit ready to stamp on cells, -1 = eraser ready, 0 = nothing. */
type Ui = { selected: number; armed: number };

function scoreCells(s: Readonly<CornerSudokuStateV4>): ScoreCell[] {
  const secs = Math.max(0, Math.ceil((R.maxFinalTick - s.tick) / R.tickRate));
  return [
    { label: tx("hud.points"), value: formatNumber(s.score), main: true },
    { label: tx("hud.board"), value: `${Math.min(R.puzzles, s.solved + (s.status === "running" ? 1 : 0))}/${R.puzzles}` },
    { label: tx("hud.time"), value: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`, alert: secs <= 30 },
  ];
}
function hudLabel(s: Readonly<CornerSudokuStateV4>) {
  return tx("sudoku.progress", { n: Math.min(R.puzzles, s.solved + (s.status === "running" ? 1 : 0)), total: R.puzzles });
}

/**
 * v173 · Digits drawn optically centred (measured glyph box, not the font's em box) in the display face, with a
 * vertical gradient and a soft drop shadow. Presentation only.
 */
const DIGIT_FONT = `"Unbounded", "Chakra Petch", system-ui, sans-serif`;
function drawDigit(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, top: string, bottom: string, shadow = "rgba(0,0,0,.5)") {
  ctx.save();
  ctx.font = `700 ${size}px ${DIGIT_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const m = ctx.measureText(text);
  const asc = m.actualBoundingBoxAscent || size * 0.72, desc = m.actualBoundingBoxDescent || 0;
  const base = y + (asc - desc) / 2;
  ctx.fillStyle = shadow;
  ctx.fillText(text, x, base + Math.max(1, size * 0.06));
  const g = ctx.createLinearGradient(0, base - asc, 0, base + desc);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillText(text, x, base);
  ctx.restore();
}

export default function CornerSudoku(props: GameRuntimeProps) {
  useI18n();
  const ui = useRef<Ui>({ selected: -1, armed: 0 });
  const seen = useRef({ seed: "", puzzle: -1 });

  const render = useCallback((ctx: CanvasRenderingContext2D, s: CornerSudokuStateV4) => {
    if (seen.current.seed !== s.seed || seen.current.puzzle !== s.current) {
      seen.current = { seed: s.seed, puzzle: s.current };
      ui.current = { selected: -1, armed: 0 };
    }
    const sel = ui.current.selected, puzzle = s.puzzles[s.current];
    const focusDigit = sel >= 0 && s.board[sel] ? s.board[sel] : Math.max(0, ui.current.armed);
    const conflicts = cornerSudokuConflictsV4(s.board);
    drawSpaceBackdrop(ctx, 390, 620, 0, s.tick);

    // v154: puzzle count, clock and score live in the shared scoreboard.

    // Board: arrive from above on a new puzzle, glow and lift on clear.
    const age = s.tick - s.phaseTick;
    const enter = s.phase === "play" && s.current > 0 ? Math.min(1, age / 18) : 1;
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.75 * enter;
    ctx.translate(0, (1 - enter) * -24);
    // Box plates.
    BOX_ORIGIN.forEach(([c0, r0]) => {
      diamond(ctx, c0, r0, 3, 3);
      const g = ctx.createLinearGradient(0, OY + (c0 + r0) * K, 0, OY + (c0 + r0 + 6) * K);
      g.addColorStop(0, "rgba(22,42,72,.96)"); g.addColorStop(1, "rgba(8,18,36,.96)");
      ctx.fillStyle = g; ctx.fill();
    });
    // Peers of the selection.
    if (sel >= 0) {
      for (const p of PEERS[sel]) {
        const q = POS[p];
        diamond(ctx, q.col, q.row);
        ctx.fillStyle = "rgba(127,227,238,.10)"; ctx.fill();
      }
    }
    // Cells.
    for (let i = 0; i < POS.length; i++) {
      const p = POS[i], d = s.board[i], given = puzzle.givens[i] !== 0;
      diamond(ctx, p.col, p.row);
      if (i === sel) { ctx.fillStyle = "rgba(243,197,90,.32)"; ctx.fill(); }
      else if (focusDigit && d === focusDigit) { ctx.fillStyle = "rgba(127,227,238,.22)"; ctx.fill(); }
      ctx.strokeStyle = "rgba(170,200,235,.22)"; ctx.lineWidth = 1; ctx.stroke();
      if (d) {
        const c = centre(i), bad = !given && conflicts[i];
        if (bad) { diamond(ctx, p.col, p.row); ctx.fillStyle = "rgba(255,90,106,.22)"; ctx.fill(); }
        if (given) drawDigit(ctx, String(d), c.x, c.y, 17, "#ffffff", "#c9d6ea");
        else if (bad) drawDigit(ctx, String(d), c.x, c.y, 18, "#ffb0b8", "#ff5a6a");
        else drawDigit(ctx, String(d), c.x, c.y, 18, "#e6fbff", "#5fd3e6");
      }
    }
    // Box outlines (thick, tinted).
    BOX_ORIGIN.forEach(([c0, r0], b) => {
      diamond(ctx, c0, r0, 3, 3);
      ctx.strokeStyle = BOX_TONE[b]; ctx.lineWidth = 2.2;
      ctx.shadowColor = BOX_TONE[b]; ctx.shadowBlur = s.phase === "clear" ? 18 : 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
    if (sel >= 0) {
      const q = POS[sel];
      diamond(ctx, q.col, q.row);
      ctx.strokeStyle = "#f3c55a"; ctx.lineWidth = 2.4; ctx.stroke();
    }
    ctx.restore();

    // Feedback: a soft pop on a written digit, a puff on an erase, the points at the time limit.
    const ev = s.lastEvent, since = ev ? s.tick - ev.tick : 999;
    if (ev && since < 24 && ev.cell >= 0 && ev.kind !== "solve") {
      const c = centre(ev.cell), k = since / 24;
      ctx.strokeStyle = ev.kind === "clear" ? `rgba(255,255,255,${0.6 * (1 - k)})` : `rgba(127,227,238,${0.8 * (1 - k)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, 8 + k * 16, 0, Math.PI * 2); ctx.stroke();
    }
    if (ev && ev.kind === "time" && since < 200) {
      ctx.fillStyle = "rgba(6,14,30,.82)"; ctx.strokeStyle = "rgba(243,197,90,.6)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(85, OY + 7 * K - 30, 220, 76, 18); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#f3c55a"; ctx.font = "900 22px system-ui";
      ctx.fillText(tx("sudoku.timeUp"), 195, OY + 7 * K);
      ctx.font = "800 15px system-ui"; ctx.fillStyle = "#f9ecd2";
      ctx.fillText(`+${formatNumber(ev.points)}`, 195, OY + 7 * K + 30);
    }
    if (s.phase === "clear") {
      const grow = Math.min(1, age / 10);
      ctx.fillStyle = "rgba(6,14,30,.82)";
      ctx.strokeStyle = "rgba(92,255,176,.6)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(95, OY + 7 * K - 30, 200, 76, 18); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#5cffb0"; ctx.shadowColor = "#5cffb0"; ctx.shadowBlur = 18;
      ctx.font = `900 ${20 + Math.round(10 * grow)}px system-ui`;
      ctx.fillText(tx("sudoku.solved"), 195, OY + 7 * K);
      ctx.shadowBlur = 0;
      if (ev && ev.kind === "solve") { ctx.font = "800 15px system-ui"; ctx.fillStyle = "#f9ecd2"; ctx.fillText(`+${formatNumber(ev.points)}`, 195, OY + 7 * K + 30); }
    }

    // Number pad: a 3×3 grid; no digit is ever greyed out or removed.
    ctx.fillStyle = "rgba(6,14,30,.6)";
    ctx.beginPath(); ctx.roundRect(PAD[0].x - 10, PAD[0].y - 10, PAD[2].x + PAD[2].w - PAD[0].x + 20, ERASE.y + ERASE.h - PAD[0].y + 20, 20); ctx.fill();
    for (const k of PAD) {
      const full = false, armed = ui.current.armed === k.d;
      // A raised key: a darker lip below, the face with a light from above and a fine highlight along its top.
      ctx.beginPath(); ctx.roundRect(k.x, k.y + 3, k.w, k.h, 14);
      ctx.fillStyle = armed ? "#9a6a12" : "#0a1428"; ctx.fill();
      ctx.beginPath(); ctx.roundRect(k.x, k.y, k.w, k.h, 14);
      const g = ctx.createLinearGradient(0, k.y, 0, k.y + k.h);
      if (armed) { g.addColorStop(0, "#fff0bd"); g.addColorStop(0.5, "#f6cf6a"); g.addColorStop(1, "#e3ad3a"); }
      else { g.addColorStop(0, full ? "rgba(40,52,72,.6)" : "#2b4a78"); g.addColorStop(0.55, "#1b3157"); g.addColorStop(1, full ? "rgba(20,28,44,.6)" : "#132544"); }
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = armed ? "#fff6d6" : full ? "rgba(255,255,255,.08)" : "rgba(127,227,238,.38)";
      ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.roundRect(k.x + 6, k.y + 3, k.w - 12, 2, 1);
      ctx.fillStyle = armed ? "rgba(255,255,255,.75)" : "rgba(190,235,255,.28)"; ctx.fill();
      if (armed) drawDigit(ctx, String(k.d), k.x + k.w / 2, k.y + k.h / 2, 24, "#3b2400", "#1e1200", "rgba(255,255,255,.45)");
      else drawDigit(ctx, String(k.d), k.x + k.w / 2, k.y + k.h / 2, 24, "#ffffff", "#9fdcf0");
    }
    // Erase key.
    {
      const armed = ui.current.armed === -1, canErase = sel >= 0 && puzzle.givens[sel] === 0 && s.board[sel] !== 0;
      ctx.beginPath(); ctx.roundRect(ERASE.x, ERASE.y, ERASE.w, ERASE.h, 14);
      const g = ctx.createLinearGradient(0, ERASE.y, 0, ERASE.y + ERASE.h);
      if (armed) { g.addColorStop(0, "#ffb3bd"); g.addColorStop(1, "#ff5a6a"); }
      else { g.addColorStop(0, "#3a2440"); g.addColorStop(1, "#24142c"); }
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = armed ? "#ffe0e4" : canErase ? "rgba(255,138,150,.8)" : "rgba(255,138,150,.35)"; ctx.lineWidth = 1.5; ctx.stroke();
      const cx = ERASE.x + ERASE.w / 2 - 34, cy = ERASE.y + ERASE.h / 2;
      // Backspace glyph.
      ctx.strokeStyle = armed ? "#3a0610" : "#ffd6db"; ctx.lineWidth = 2; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(cx - 14, cy); ctx.lineTo(cx - 6, cy - 9); ctx.lineTo(cx + 14, cy - 9); ctx.lineTo(cx + 14, cy + 9); ctx.lineTo(cx - 6, cy + 9); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 1, cy - 4); ctx.lineTo(cx + 7, cy + 4); ctx.moveTo(cx + 7, cy - 4); ctx.lineTo(cx - 1, cy + 4); ctx.stroke();
      ctx.fillStyle = armed ? "#3a0610" : "#ffd6db"; ctx.font = "900 17px system-ui"; ctx.textAlign = "left";
      ctx.fillText(tx("sudoku.erase"), cx + 24, cy + 1);
      ctx.textAlign = "center";
    }
  }, []);

  const pick = useCallback((point: CorePoint, phase: "down" | "move" | "up", s: CornerSudokuStateV4) => {
    if (phase !== "down" || s.status !== "running" || s.phase !== "play") return null;
    const givens = s.puzzles[s.current].givens, editable = (c: number) => c >= 0 && givens[c] === 0;
    const sel = ui.current.selected;
    if (inside(ERASE, point.x, point.y)) {
      if (editable(sel) && s.board[sel] !== 0) { gameTone("tap"); return `CLR_${sel}`; }
      ui.current.armed = ui.current.armed === -1 ? 0 : -1;
      ui.current.selected = -1;
      return null;
    }
    const key = PAD.find((k) => inside(k, point.x, point.y));
    if (key) {
      if (editable(sel)) {
        gameTone("tap");
        // The same digit again erases it (toggle); another digit replaces it.
        return s.board[sel] === key.d ? `CLR_${sel}` : `PUT_${sel}_${key.d}`;
      }
      ui.current.armed = ui.current.armed === key.d ? 0 : key.d;
      ui.current.selected = -1;
      return null;
    }
    const cell = cellAt(point.x, point.y);
    if (cell < 0) { ui.current.selected = -1; return null; }
    const armed = ui.current.armed;
    if (armed > 0 && editable(cell)) {
      ui.current.selected = cell;
      if (s.board[cell] === armed) return null;
      gameTone("tap");
      return `PUT_${cell}_${armed}`;
    }
    if (armed === -1 && editable(cell)) {
      ui.current.selected = cell;
      if (s.board[cell] === 0) return null;
      gameTone("tap");
      return `CLR_${cell}`;
    }
    ui.current.selected = ui.current.selected === cell ? -1 : cell;
    return null;
  }, []);

  return (
    <div className="cornerSudokuVerified">
      <CoreCanvasGame {...props} core={core} name={tx("gameMeta.corner-sudoku.name")} instruction="" render={render} pointAction={pick} hideHudScore hideHudLabel hudLabel={hudLabel} scoreCells={scoreCells} />
    </div>
  );
}
