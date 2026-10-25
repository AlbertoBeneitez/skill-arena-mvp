"use client";
import { useCallback, useRef } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import { gameTone } from "@/lib/gameFeedback";
import {
  CORNER_SUDOKU_BOXES as BOXES,
  CORNER_SUDOKU_CELL_POS as POS,
  CORNER_SUDOKU_CORE_V1 as core,
  CORNER_SUDOKU_PEERS as PEERS,
  CORNER_SUDOKU_RULES_V1 as R,
  type CornerSudokuStateV1,
} from "@/lib/verified/cornerSudokuCore.v1";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
import { t as tx, formatNumber, useI18n } from "@/lib/i18n";

/*
 * Presentation only. Two sides of a sudoku meeting at a corner, rotated 45°: the corner box on top in the middle,
 * the top band running down to the right and the left stack running down to the left. Digits stay upright.
 * Selection lives here (never in the core); only PUT_<cell>_<digit> reaches the recorder and the server replay.
 */
const U = 29; // grid unit (cell side) in logical px
const K = U / Math.SQRT2;
const OX = 195, OY = 118; // top vertex of the corner box
const BOX_TONE = ["#f3c55a", "#7fe3ee", "#5fb8ff", "#ff7ab8", "#c58cff"] as const;
const PAD = Array.from({ length: 9 }, (_, i) => {
  const d = i + 1, row = i < 5 ? 0 : 1, n = row ? 4 : 5, k = row ? i - 5 : i;
  const w = 62, gap = 10, x0 = 195 - (n * w + (n - 1) * gap) / 2;
  return { d, x: x0 + k * (w + gap), y: 430 + row * 64, w, h: 54 };
});

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

type Ui = { selected: number; armed: number };

function hudLabel(s: Readonly<CornerSudokuStateV1>) {
  return `${tx("sudoku.progress", { n: Math.min(R.puzzles, s.solved + (s.status === "running" ? 1 : 0)), total: R.puzzles })} · ${tx("sudoku.mistakes", { n: s.mistakes, max: R.maxMistakes })}`;
}

export default function CornerSudoku(props: GameRuntimeProps) {
  useI18n();
  const ui = useRef<Ui>({ selected: -1, armed: 0 });
  const seen = useRef({ seed: "", puzzle: -1 });

  const render = useCallback((ctx: CanvasRenderingContext2D, s: CornerSudokuStateV1) => {
    if (seen.current.seed !== s.seed || seen.current.puzzle !== s.current) {
      seen.current = { seed: s.seed, puzzle: s.current };
      ui.current = { selected: -1, armed: 0 };
    }
    const sel = ui.current.selected, puzzle = s.puzzles[s.current];
    const focusDigit = sel >= 0 && s.board[sel] ? s.board[sel] : ui.current.armed;
    drawSpaceBackdrop(ctx, 390, 620, 0, s.tick);

    // HUD: one lamp per puzzle, mistakes, clock.
    for (let i = 0; i < R.puzzles; i++) {
      const x = 195 + (i - 2) * 30, done = i < s.solved, now = i === s.current && s.status === "running";
      ctx.fillStyle = done ? "#5cffb0" : now ? "#f3c55a" : "rgba(255,255,255,.14)";
      if (done || now) { ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12; }
      ctx.beginPath(); ctx.roundRect(x - 11, 22, 22, 22, 5); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = done || now ? "#0b1626" : "rgba(255,255,255,.45)";
      ctx.font = "900 12px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), x, 33.5);
    }
    for (let i = 0; i < R.maxMistakes; i++) {
      ctx.fillStyle = i < s.mistakes ? "#ff5a6a" : "rgba(255,255,255,.16)";
      ctx.beginPath(); ctx.arc(34 + i * 13, 33, 4.5, 0, Math.PI * 2); ctx.fill();
    }
    const secs = Math.max(0, Math.ceil((R.maxFinalTick - s.tick) / R.tickRate));
    ctx.fillStyle = secs <= 30 && Math.floor(s.tick / 30) % 2 === 0 ? "#ff5a6a" : "#dbe8ff";
    ctx.font = "800 14px ui-monospace, Menlo, monospace"; ctx.textAlign = "right";
    ctx.fillText(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`, 360, 33);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f9ecd2"; ctx.font = "900 22px system-ui";
    ctx.fillText(formatNumber(s.score), 195, 72);

    // Board: arrive from above on a new puzzle, glow and lift on clear.
    const age = s.tick - s.phaseTick;
    const enter = s.phase === "play" && s.current > 0 ? Math.min(1, age / 18) : 1;
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.75 * enter;
    ctx.translate(0, (1 - enter) * -24);
    // Box plates.
    BOX_ORIGIN.forEach(([c0, r0], b) => {
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
        const c = centre(i);
        ctx.font = `${given ? 800 : 900} 16px system-ui`;
        ctx.fillStyle = given ? "#eef4ff" : "#7fe3ee";
        ctx.fillText(String(d), c.x, c.y + 1);
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

    // Feedback: points pop, wrong-digit shake and cross.
    const ev = s.lastEvent, since = ev ? s.tick - ev.tick : 999;
    if (ev && since < 50) {
      const c = centre(ev!.cell);
      if (ev!.ok) {
        ctx.globalAlpha = Math.max(0, 1 - since / 50);
        ctx.fillStyle = "#5cffb0"; ctx.font = "900 14px system-ui";
        ctx.fillText(`+${ev!.points}`, c.x + 20, c.y - 14 - since * 0.4);
        ctx.globalAlpha = 1;
      } else {
        const shake = Math.sin(since * 1.6) * Math.max(0, 8 - since * 0.3);
        ctx.globalAlpha = Math.max(0, 1 - since / 50);
        ctx.fillStyle = "#ff5a6a"; ctx.font = "900 16px system-ui";
        ctx.fillText(String(ev!.digit), c.x + shake, c.y + 1);
        ctx.strokeStyle = "#ff5a6a"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(c.x - 7, c.y - 7); ctx.lineTo(c.x + 7, c.y + 7); ctx.moveTo(c.x + 7, c.y - 7); ctx.lineTo(c.x - 7, c.y + 7); ctx.stroke();
        ctx.font = "900 13px system-ui";
        ctx.fillText(String(ev!.points || -R.wrongPenalty), c.x + 22, c.y - 14 - since * 0.3);
        ctx.globalAlpha = 1;
      }
    }
    if (s.phase === "clear") {
      const grow = Math.min(1, age / 10);
      ctx.fillStyle = "rgba(6,14,30,.82)";
      ctx.strokeStyle = "rgba(92,255,176,.6)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(95, OY + 8 * K - 30, 200, 76, 18); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#5cffb0"; ctx.shadowColor = "#5cffb0"; ctx.shadowBlur = 18;
      ctx.font = `900 ${20 + Math.round(10 * grow)}px system-ui`;
      ctx.fillText(tx("sudoku.solved"), 195, OY + 8 * K);
      ctx.shadowBlur = 0;
      if (ev) { ctx.font = "800 15px system-ui"; ctx.fillStyle = "#f9ecd2"; ctx.fillText(`+${formatNumber(ev.points)}`, 195, OY + 8 * K + 30); }
    }

    // Number pad.
    const counts = new Array(10).fill(0);
    s.board.forEach((d) => { if (d) counts[d]++; });
    for (const k of PAD) {
      const full = counts[k.d] >= BOXES.length, armed = ui.current.armed === k.d;
      ctx.beginPath(); ctx.roundRect(k.x, k.y, k.w, k.h, 14);
      const g = ctx.createLinearGradient(0, k.y, 0, k.y + k.h);
      if (armed) { g.addColorStop(0, "#ffe9a6"); g.addColorStop(1, "#f3c55a"); }
      else { g.addColorStop(0, full ? "rgba(40,52,72,.6)" : "#243c62"); g.addColorStop(1, full ? "rgba(20,28,44,.6)" : "#132544"); }
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = armed ? "#fff3c4" : full ? "rgba(255,255,255,.08)" : "rgba(127,227,238,.35)";
      ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = armed ? "#2a1700" : full ? "rgba(255,255,255,.25)" : "#eef4ff";
      ctx.font = "900 24px system-ui";
      ctx.fillText(String(k.d), k.x + k.w / 2, k.y + k.h / 2 + 1);
    }
  }, []);

  const pick = useCallback((point: CorePoint, phase: "down" | "move" | "up", s: CornerSudokuStateV1) => {
    if (phase !== "down" || s.status !== "running" || s.phase !== "play") return null;
    const key = PAD.find((k) => point.x >= k.x - 4 && point.x <= k.x + k.w + 4 && point.y >= k.y - 4 && point.y <= k.y + k.h + 4);
    if (key) {
      const sel = ui.current.selected;
      if (sel >= 0 && s.board[sel] === 0) { gameTone("tap"); return `PUT_${sel}_${key.d}`; }
      ui.current.armed = ui.current.armed === key.d ? 0 : key.d;
      ui.current.selected = -1;
      return null;
    }
    const cell = cellAt(point.x, point.y);
    if (cell < 0) { ui.current.selected = -1; return null; }
    if (ui.current.armed && s.board[cell] === 0) { gameTone("tap"); ui.current.selected = cell; return `PUT_${cell}_${ui.current.armed}`; }
    ui.current.selected = ui.current.selected === cell ? -1 : cell;
    return null;
  }, []);

  return (
    <div className="cornerSudokuVerified">
      <CoreCanvasGame {...props} core={core} name={tx("gameMeta.corner-sudoku.name")} instruction="" render={render} pointAction={pick} hideHudScore hideHudLabel hudLabel={hudLabel} />
    </div>
  );
}
