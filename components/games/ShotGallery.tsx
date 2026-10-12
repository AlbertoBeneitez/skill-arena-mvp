"use client";
import { useCallback, useRef } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import { gameTone } from "@/lib/gameFeedback";
import {
  SHOT_GALLERY_CORE_V2 as core,
  type GalleryStateV2,
} from "@/lib/verified/shotGalleryCore.v2";
import { gallerySlots } from "@/lib/galleryPresentation";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
const colors = ["#84d5fa", "#ffac94", "#bee899", "#c1a9fa"];
function shape(
  ctx: CanvasRenderingContext2D,
  kind: number,
  x: number,
  y: number,
  size = 30,
) {
  ctx.beginPath();
  if (kind === 0) ctx.arc(x, y, size, 0, Math.PI * 2);
  else if (kind === 2) ctx.roundRect(x - size, y - size, size * 2, size * 2, 7);
  else {
    const count = kind === 1 ? 3 : 6;
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / count,
        px = x + Math.cos(a) * size,
        py = y + Math.sin(a) * size;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  }
  ctx.fill();
}
const hudLabel = (s: Readonly<GalleryStateV2>) =>
  `${s.correct} ACIERTOS · ${Math.min(12, s.trial + 1)}/12`;
const feedbackScore = (s: Readonly<GalleryStateV2>) => s.total;
export default function ShotGallery(props: GameRuntimeProps) {
  const width = useRef(390),
    lastResult = useRef(-1),
    lastTick = useRef(-1);
  const render = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      s: GalleryStateV2,
      viewport: { width: number; height: number },
    ) => {
      width.current = viewport.width;
      if (s.tick < lastTick.current) lastResult.current = -1;
      lastTick.current = s.tick;
      if (s.results.length > lastResult.current && s.results.length > 0) {
        gameTone("tap");
        lastResult.current = s.results.length;
      }
      const w = viewport.width,
        slots = gallerySlots(w),
        trial = s.trials[Math.min(s.trial, 11)],
        last = s.results.at(-1),
        fieldHeight = w >= 650 ? 144 : 274;
      drawSpaceBackdrop(ctx, w, 520, 0, s.tick);
      ctx.fillStyle = "rgba(10,24,38,.94)";
      ctx.strokeStyle = "#496a7b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(12, 188, w - 24, fieldHeight, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#bfd4df";
      ctx.font = "bold 16px system-ui";
      ctx.textAlign = "center";
      // Essential target cue, not a tutorial. Colors/forms use a pictogram; numbers retain the rule.
      if (trial.kind === "NUMBER") ctx.fillText(trial.rule, w / 2, 120);
      else {
        const target = trial.cards[trial.answer];
        ctx.fillStyle =
          trial.kind === "SHAPE" ? "#e3e7f0" : colors[target.color];
        shape(ctx, trial.kind === "COLOR" ? 0 : target.shape, w / 2, 119, 24);
      }
      ctx.fillStyle = s.phase === "ready" ? "#79e9bc" : "#526878";
      ctx.beginPath();
      ctx.arc(w / 2, 165, s.phase === "ready" ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
      if (s.phase === "waiting") {
        ctx.fillStyle = "#243e51";
        ctx.fillRect(18, 195, w - 36, fieldHeight - 14);
        ctx.strokeStyle = "#446576";
        ctx.lineWidth = 1;
        for (let y = 200; y < 188 + fieldHeight - 8; y += 16) {
          ctx.beginPath();
          ctx.moveTo(20, y);
          ctx.lineTo(w - 20, y);
          ctx.stroke();
        }
      } else
        trial.cards.forEach((card, i) => {
          const slot = slots[i],
            x = slot.x + slot.width / 2,
            y = slot.y + slot.height / 2,
            chosen = s.phase === "feedback" && last?.pick === i;
          ctx.save();
          if (chosen) ctx.globalAlpha = Math.max(0.2, 1 - s.phaseTicks / 84);
          ctx.fillStyle =
            trial.kind === "NUMBER" ? "#e5f1fb" : colors[card.color];
          if (trial.kind === "NUMBER") {
            ctx.font = "bold 48px system-ui";
            ctx.fillText(String(card.number), x, y + 15);
          } else shape(ctx, card.shape, x, y, w >= 650 ? 36 : 29);
          ctx.restore();
          if (chosen && s.phaseTicks < 48) {
            const p = s.phaseTicks / 48;
            ctx.save();
            ctx.globalAlpha = 1 - p;
            ctx.strokeStyle = last?.type === "CORRECT" ? "#f9ecd2" : "#e8a7a0";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 8 + 18 * p, 0, Math.PI * 2);
            ctx.stroke();
            for (let k = 0; k < 8; k++) {
              const a = (k * Math.PI) / 4,
                r = 12 + 36 * p;
              ctx.beginPath();
              ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
              ctx.lineTo(x + Math.cos(a) * (r + 9), y + Math.sin(a) * (r + 9));
              ctx.stroke();
            }
            ctx.restore();
          }
        });
    },
    [],
  );
  const pick = useCallback(
    (point: CorePoint, phase: "down" | "move" | "up") => {
      if (phase !== "down") return null;
      const i = gallerySlots(width.current).findIndex(
        (p) =>
          point.x >= p.x &&
          point.x <= p.x + p.width &&
          point.y >= p.y &&
          point.y <= p.y + p.height,
      );
      return i < 0 ? null : `PICK_${i}`;
    },
    [],
  );
  return (
    <div className="shotGalleryVerified">
      <CoreCanvasGame
        {...props}
        core={core}
        name="Shot Gallery"
        instruction=""
        render={render}
        expandHorizontalViewport
        pointAction={pick}
        hideHudScore
        hudLabel={hudLabel}
        feedbackScore={feedbackScore}
        keys={{
          "1": "PICK_0",
          "2": "PICK_1",
          "3": "PICK_2",
          "4": "PICK_3",
          "5": "PICK_4",
          "6": "PICK_5",
        }}
      />
    </div>
  );
}
