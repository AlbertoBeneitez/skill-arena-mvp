"use client";
import { useMemo } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import { gameTone } from "@/lib/gameFeedback";
import {
  SHOT_GALLERY_CORE,
  GALLERY_COLORS,
  GALLERY_SHAPES,
  type GalleryState,
} from "@/lib/verified/shotGalleryCore.v1";
import { SHOT_GALLERY_SLOTS } from "@/lib/verified/shotGalleryProtocol.v1";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
const colors = ["#84d5fa", "#ffac94", "#bee899", "#c1a9fa"];
function shape(
  ctx: CanvasRenderingContext2D,
  kind: number,
  x: number,
  y: number,
) {
  ctx.beginPath();
  if (kind === 0) ctx.arc(x, y, 26, 0, Math.PI * 2);
  else if (kind === 2) ctx.roundRect(x - 24, y - 24, 48, 48, 6);
  else {
    const count = kind === 1 ? 3 : 6;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / count,
        px = x + Math.cos(angle) * 29,
        py = y + Math.sin(angle) * 29;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  ctx.fill();
}
function renderer() {
  let lastReady = -1,
    lastTick = -1;
  return (ctx: CanvasRenderingContext2D, s: GalleryState) => {
    if (s.tick < lastTick) lastReady = -1;
    lastTick = s.tick;
    if (s.phase === "ready" && lastReady !== s.trial) {
      lastReady = s.trial;
      gameTone("countdown");
    }
    drawSpaceBackdrop(ctx, 390, 620, 0, s.tick);
    const trial = s.trials[Math.min(s.trial, 11)],
      last = s.results.at(-1);
    ctx.textAlign = "center";
    ctx.fillStyle = "#abc9df";
    ctx.font = "bold 11px system-ui";
    ctx.fillText(
      `PRUEBA ${Math.min(12, s.trial + 1)} / 12 · ${["COLORES", "FORMAS", "NÚMEROS", "COMBINACIONES"][Math.min(3, Math.floor(s.trial / 3))]}`,
      195,
      68,
    );
    ctx.fillStyle = "#eddfbb";
    ctx.font = "bold 19px system-ui";
    ctx.fillText(trial.rule, 195, 105);
    const stateLabel =
      s.phase === "waiting"
        ? "ESPERA LA ACTIVACIÓN"
        : s.phase === "ready"
          ? "¡AHORA!"
          : last?.type === "CORRECT"
            ? `+${last.award} · ${Math.round((last.reactionTicks! * 1000) / 120)} ms`
            : last?.type === "FALSE_START"
              ? "MUY PRONTO · ESPERA LA SEÑAL"
              : last?.type === "WRONG"
                ? "OTRA OPCIÓN · MIRA LA REGLA"
                : "TIEMPO AGOTADO";
    ctx.fillStyle =
      s.phase === "ready"
        ? "#9bffe1"
        : s.phase === "feedback" && last?.type !== "CORRECT"
          ? "#ffbea3"
          : "#b9cfde";
    ctx.font = "bold 14px system-ui";
    ctx.fillText(stateLabel, 195, 163);
    ctx.fillStyle = s.phase === "ready" ? "#79e9bc" : "#526878";
    ctx.beginPath();
    ctx.arc(195, 186, s.phase === "ready" ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    trial.cards.forEach((card, i) => {
      const slot = SHOT_GALLERY_SLOTS[i],
        feedback = s.phase === "feedback",
        chosen = feedback && last?.pick === i,
        correct = feedback && i === trial.answer;
      ctx.fillStyle = chosen
        ? last?.type === "CORRECT"
          ? "#173c37"
          : "#422e37"
        : "rgba(9,28,45,.93)";
      ctx.beginPath();
      ctx.roundRect(slot.x, slot.y, slot.width, slot.height, 18);
      ctx.fill();
      ctx.strokeStyle = correct
        ? "#8eebc4"
        : chosen
          ? "#ffac94"
          : s.phase === "ready"
            ? "#719aaa"
            : "#35495e";
      ctx.lineWidth = correct || chosen ? 3 : 1.5;
      ctx.stroke();
      const x = slot.x + slot.width / 2,
        y = slot.y + 44;
      if (s.phase === "waiting") {
        ctx.fillStyle = "#536d82";
        ctx.font = "bold 28px system-ui";
        ctx.fillText("?", x, y + 10);
      } else if (trial.kind === "NUMBER") {
        ctx.fillStyle = "#e5f1fb";
        ctx.font = "bold 38px system-ui";
        ctx.fillText(String(card.number), x, y + 14);
      } else {
        ctx.fillStyle = colors[card.color];
        shape(ctx, card.shape, x, y);
        ctx.font = "bold 10px system-ui";
        ctx.fillStyle = "#b5d0de";
        ctx.fillText(
          trial.kind === "COLOR"
            ? GALLERY_COLORS[card.color]
            : trial.kind === "SHAPE"
              ? GALLERY_SHAPES[card.shape]
              : `${GALLERY_SHAPES[card.shape]} · ${GALLERY_COLORS[card.color]}`,
          x,
          slot.y + 90,
        );
      }
      ctx.fillStyle = s.phase === "waiting" ? "#496379" : "#708c9e";
      ctx.font = "10px system-ui";
      ctx.fillText(String(i + 1), slot.x + 14, slot.y + slot.height - 11);
    });
    ctx.fillStyle = "#adcbdc";
    ctx.font = "bold 12px system-ui";
    ctx.fillText(`${s.correct} ACIERTOS · SUMA ${s.score}`, 195, 522);
    for (let i = 0; i < 12; i++) {
      const r = s.results[i];
      ctx.fillStyle = !r
        ? "#344d61"
        : r.type === "CORRECT"
          ? "#88ddc2"
          : "#c29584";
      ctx.beginPath();
      ctx.arc(107 + i * 16, 549, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = "11px system-ui";
    ctx.fillStyle = "#8caabd";
    ctx.fillText(
      "Cada prueba cuenta. Los errores no terminan la partida.",
      195,
      583,
    );
    ctx.textAlign = "left";
  };
}
function pick(
  point: CorePoint,
  phase: "down" | "move" | "up",
  s: GalleryState,
) {
  if (phase !== "down") return null;
  const index = SHOT_GALLERY_SLOTS.findIndex(
    (p, i) =>
      i < s.trials[Math.min(s.trial, 11)].cards.length &&
      point.x >= p.x &&
      point.x <= p.x + p.width &&
      point.y >= p.y &&
      point.y <= p.y + p.height,
  );
  return index < 0 ? null : `PICK_${index}`;
}
const keys = { "1": "PICK_0", "2": "PICK_1", "3": "PICK_2", "4": "PICK_3" };
export default function ShotGallery(props: GameRuntimeProps) {
  const render = useMemo(renderer, []);
  return (
    <div className="shotGalleryVerified">
      <CoreCanvasGame
        {...props}
        core={SHOT_GALLERY_CORE}
        name="Shot Gallery"
        render={render}
        pointAction={pick}
        keys={keys}
        hideHudLabel
        instruction="Lee la regla. Espera la señal verde y toca la opción correcta."
      />
    </div>
  );
}
