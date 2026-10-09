"use client";
import type { GameRuntimeProps } from "@/lib/games";
import { PIANO_V3_CORE } from "@/lib/verified/pianoRushCore.v3";
import type { RhythmState } from "@/lib/verified/pianoRushCore.v2";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import CoreCanvasGame from "./CoreCanvasGame";
const colors = ["#73cce5", "#8ca8ed", "#b197df", "#79d2bb"];
function render(ctx: CanvasRenderingContext2D, s: RhythmState) {
  drawSpaceBackdrop(ctx, 390, 620, s.tick * 0.018, s.tick);
  for (let lane = 0; lane < 4; lane++) {
    const x = lane * 97.5;
    ctx.fillStyle = "rgba(10,19,36,.7)";
    ctx.fillRect(x + 3, 96, 91.5, 466);
    ctx.strokeStyle = "rgba(126,171,209,.18)";
    ctx.strokeRect(x + 3, 96, 91.5, 466);
    ctx.fillStyle = colors[lane];
    ctx.fillRect(x + 6, 534, 85.5, 3);
    ctx.fillStyle = "#d9e7f5";
    ctx.textAlign = "center";
    ctx.font = "16px system-ui";
    ctx.fillText(String(lane + 1), x + 48.75, 561);
  }
  for (
    let index = Math.min(47, s.nextNoteIndex + 5);
    index >= s.nextNoteIndex;
    index--
  ) {
    const note = s.notes[index],
      progress = (s.tick - (note.targetTick - 270)) / 270;
    if (progress < 0 || s.tick > note.targetTick + note.window) continue;
    const y = -100 + progress * 553,
      x = note.lane * 97.5 + 9;
    ctx.fillStyle = index === s.nextNoteIndex ? "#e9f7ff" : "#8297bf";
    ctx.fillRect(x, y, 79.5, 82);
    ctx.fillStyle = colors[note.lane];
    ctx.fillRect(x + 3, y + 3, 73.5, 5);
    ctx.fillStyle = "#233651";
    ctx.fillRect(x + 8, y + 60, 63.5, 5);
  }
  ctx.textAlign = "center";
  ctx.font = "13px system-ui";
  ctx.fillStyle = "#d4e5f4";
  const age = s.tick - s.lastJudgementTick;
  if (s.lastJudgement && age < 64) {
    ctx.fillStyle =
      s.lastJudgement === "PERFECT" || s.lastJudgement === "GOOD"
        ? "#a8edd9"
        : "#efbcc8";
    ctx.font = "bold 14px system-ui";
    const label = {
      PERFECT: "PERFECTO",
      GOOD: "BIEN",
      EARLY: "ANTICIPADO",
      WRONG: "OTRO CARRIL",
      MISS: "NOTA PERDIDA",
    }[s.lastJudgement];
    ctx.fillText(label, 195, 594);
  }
}
const keys = {
  "1": "LANE_0",
  "2": "LANE_1",
  "3": "LANE_2",
  "4": "LANE_3",
  a: "LANE_0",
  s: "LANE_1",
  d: "LANE_2",
  f: "LANE_3",
} as const;
const controls = [0, 1, 2, 3].map((lane) => ({
  action: `LANE_${lane}`,
  label: `Pulsar carril ${lane + 1}`,
  symbol: String(lane + 1),
}));
const pointAction = (p: { x: number }, phase: "down" | "move" | "up") =>
  phase === "down"
    ? `LANE_${Math.max(0, Math.min(3, Math.floor(p.x / 97.5)))}`
    : null;
const hudLabel = (s: Readonly<RhythmState>) =>
  `${s.nextNoteIndex}/48 · COMBO ${s.combo}`;
export default function PianoRushVerified(props: GameRuntimeProps) {
  return (
    <div className="pianoRushVerified">
      <CoreCanvasGame
        {...props}
        core={PIANO_V3_CORE}
        name="Piano Rush"
        render={render}
        controls={controls}
        keys={keys}
        pointAction={pointAction}
        hudLabel={hudLabel}
        instruction="Toca 1–4 al llegar a la línea · precisión crea combos"
      />
    </div>
  );
}
