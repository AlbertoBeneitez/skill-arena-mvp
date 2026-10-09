import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import {
  JET_STREAM_V1,
  jetStreamGapMilliForPassed,
  type JetStreamGate,
  type JetStreamState,
} from "@/lib/verified/jetStreamCore.v1";

export const JET_VIEW = {
  width: JET_STREAM_V1.coordinateWidth,
  height: JET_STREAM_V1.coordinateHeight,
  playerX: JET_STREAM_V1.playerX / 1000,
  playerRadius: JET_STREAM_V1.playerRadius / 1000,
} as const;

export function drawJetBackground(
  ctx: CanvasRenderingContext2D,
  state: JetStreamState
) {
  const { width: w, height: h } = JET_VIEW;

  const scroll = state.scrollMilli / 1000;
  drawSpaceBackdrop(ctx, w, h, scroll, state.tick);

  // Deterministic motion streaks communicate speed without introducing
  // gameplay noise or allocations tied to random state.
  const streakPhase = (scroll * 0.9) % 74;
  ctx.strokeStyle = "rgba(111,220,244,.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i += 1) {
    const y = 58 + i * 69;
    const x = ((i * 83 - streakPhase) % (w + 90)) - 45;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 34, y);
    ctx.stroke();
  }

  // Subtle corridor rails make velocity legible without becoming obstacles.
  ctx.strokeStyle = "rgba(84,183,227,.09)";
  ctx.lineWidth = 1;
  const railOffset = (scroll * 0.55) % 52;
  for (let x = -52 - railOffset; x < w + 60; x += 52) {
    ctx.beginPath();
    ctx.moveTo(x, 86);
    ctx.lineTo(x + 30, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, h - 86);
    ctx.lineTo(x + 30, h);
    ctx.stroke();
  }
}

export function drawJetGate(
  ctx: CanvasRenderingContext2D,
  gate: JetStreamGate,
  state: JetStreamState
) {
  const x =
    (gate.worldXMilli - state.scrollMilli) / 1000;
  const width = JET_STREAM_V1.gateWidth / 1000;
  const center = gate.centerYMilli / 1000;
  const gap =
    jetStreamGapMilliForPassed(state.passed) / 1000;
  const top = center - gap / 2;
  const bottom = center + gap / 2;

  const active =
    x < JET_VIEW.playerX + 110 &&
    x + width > JET_VIEW.playerX - 35;

  ctx.save();
  if (active) {
    ctx.shadowBlur = 14;
    ctx.shadowColor = "rgba(89,222,237,.38)";
  }

  const pylon = ctx.createLinearGradient(
    x,
    0,
    x + width,
    0
  );
  pylon.addColorStop(0, "#263858");
  pylon.addColorStop(0.45, "#3b5d83");
  pylon.addColorStop(1, "#1b2b47");
  ctx.fillStyle = pylon;
  ctx.fillRect(x, 0, width, top);
  ctx.fillRect(x, bottom, width, JET_VIEW.height - bottom);
  ctx.shadowBlur = 0;

  ctx.fillStyle = active ? "#79edf0" : "#4fb6d1";
  ctx.fillRect(x - 3, top - 6, width + 6, 6);
  ctx.fillRect(x - 3, bottom, width + 6, 6);

  ctx.fillStyle = "rgba(234,249,255,.28)";
  ctx.fillRect(x + 5, 0, 3, Math.max(0, top - 11));
  ctx.fillRect(
    x + 5,
    bottom + 11,
    3,
    Math.max(0, JET_VIEW.height - bottom - 11)
  );

  // Centre reference rewards precise flight but does not reveal a hidden
  // collision tolerance: the full opening remains the legal corridor.
  ctx.strokeStyle = active
    ? "rgba(125,245,241,.46)"
    : "rgba(125,245,241,.18)";
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(x - 16, center);
  ctx.lineTo(x + width + 16, center);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
}

export function drawJetShip(
  ctx: CanvasRenderingContext2D,
  state: JetStreamState,
  impulseGlow: number
) {
  const x = JET_VIEW.playerX;
  const y = state.yMilli / 1000;
  const rotation = Math.max(
    -0.42,
    Math.min(
      0.55,
      state.vyMilliPerSecond / 420_000
    )
  );

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  const glow = 10 + impulseGlow * 12;
  ctx.shadowBlur = glow;
  ctx.shadowColor = "rgba(97,227,242,.7)";

  ctx.fillStyle = "#e8f5ff";
  ctx.beginPath();
  ctx.moveTo(19, 0);
  ctx.lineTo(-8, -11);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-8, 11);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#386ea5";
  ctx.fillRect(-6, -5, 11, 10);

  ctx.fillStyle = "#7de9ef";
  ctx.fillRect(2, -3, 7, 6);

  const exhaustLength =
    11 + impulseGlow * 13;

  if (impulseGlow > 0) {
    ctx.globalAlpha = 0.24 * impulseGlow;
    ctx.strokeStyle = "#8ff5ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(
      -9,
      0,
      12 + impulseGlow * 8,
      8 + impulseGlow * 4,
      0,
      0,
      Math.PI * 2
    );
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = impulseGlow > 0.2
    ? "#ffd06f"
    : "#6bc5e7";
  ctx.beginPath();
  ctx.moveTo(-8, -4);
  ctx.lineTo(-8 - exhaustLength, 0);
  ctx.lineTo(-8, 4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
