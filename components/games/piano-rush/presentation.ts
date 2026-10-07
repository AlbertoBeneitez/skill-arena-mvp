import {
  PIANO_RUSH_V1,
  pianoRushTravelTicksFor,
  type PianoRushNote,
  type PianoRushState,
} from "@/lib/verified/pianoRushCore.v1";

export const PIANO_VIEW = {
  width: PIANO_RUSH_V1.coordinateWidth,
  height: PIANO_RUSH_V1.coordinateHeight,
  hitY: 538,
  noteHeight: 112,
  laneCount: PIANO_RUSH_V1.lanes,
} as const;

const LANE_COLORS = [
  "#69d8ef",
  "#8ba7ff",
  "#b98bf0",
  "#6ce0bf",
] as const;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function noteTopForTick(
  note: PianoRushNote,
  currentTick: number
) {
  const travelTicks = pianoRushTravelTicksFor(note.index);
  const spawnTick = note.targetTick - travelTicks;
  const progress = clamp01(
    (currentTick - spawnTick) / travelTicks
  );

  return (
    -PIANO_VIEW.noteHeight +
    progress * PIANO_VIEW.hitY
  );
}

export function noteIsVisible(
  note: PianoRushNote,
  currentTick: number
) {
  const travelTicks = pianoRushTravelTicksFor(note.index);
  return (
    currentTick >= note.targetTick - travelTicks &&
    currentTick <=
      note.targetTick + PIANO_RUSH_V1.maxTimingErrorTicks + 30
  );
}

export function drawPianoRushBackground(
  ctx: CanvasRenderingContext2D,
  state: PianoRushState,
  flashLane: number,
  flashStrength: number
) {
  const { width: w, height: h, laneCount } = PIANO_VIEW;
  const laneWidth = w / laneCount;

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#050713");
  bg.addColorStop(0.54, "#101a35");
  bg.addColorStop(1, "#070b17");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const reactor = ctx.createRadialGradient(
    w / 2,
    h * 0.08,
    10,
    w / 2,
    h * 0.08,
    230
  );
  reactor.addColorStop(0, "rgba(95,123,240,.20)");
  reactor.addColorStop(0.62, "rgba(74,47,145,.07)");
  reactor.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = reactor;
  ctx.fillRect(0, 0, w, h * 0.58);

  for (let lane = 0; lane < laneCount; lane += 1) {
    const x = lane * laneWidth;
    const lanePulse =
      0.028 +
      0.018 *
        (0.5 +
          0.5 * Math.sin(state.tick * 0.018 + lane * 0.9));

    ctx.fillStyle =
      lane === flashLane && flashStrength > 0
        ? `rgba(111,239,225,${0.07 + flashStrength * 0.15})`
        : `rgba(255,255,255,${lanePulse})`;
    ctx.fillRect(x, 0, laneWidth, h);

    if (lane > 0) {
      ctx.strokeStyle = "rgba(159,190,235,.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    const color = LANE_COLORS[lane];
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = color;
    ctx.fillRect(x + 5, 0, 2, h);
    ctx.globalAlpha = 1;
  }

  // Perspective guide lines make the vertical motion easier to parse.
  ctx.strokeStyle = "rgba(139,185,230,.07)";
  for (let y = 70; y < PIANO_VIEW.hitY - 30; y += 72) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

export function drawPianoRushHitZone(
  ctx: CanvasRenderingContext2D,
  flashLane: number,
  flashStrength: number
) {
  const { width: w, hitY, laneCount } = PIANO_VIEW;
  const laneWidth = w / laneCount;

  ctx.save();
  ctx.shadowBlur = 12;
  ctx.shadowColor = "rgba(110,226,240,.35)";
  ctx.fillStyle = "rgba(105,223,236,.16)";
  ctx.fillRect(0, hitY - 6, w, 12);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.fillRect(0, hitY - 1, w, 2);

  for (let lane = 0; lane < laneCount; lane += 1) {
    const x = lane * laneWidth;

    ctx.strokeStyle = "rgba(255,255,255,.13)";
    ctx.strokeRect(
      x + 5,
      hitY + 12,
      laneWidth - 10,
      54
    );

    if (lane === flashLane && flashStrength > 0) {
      ctx.globalAlpha = flashStrength;
      ctx.fillStyle = LANE_COLORS[lane];
      ctx.fillRect(
        x + 5,
        hitY + 12,
        laneWidth - 10,
        54
      );
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = "rgba(220,234,255,.52)";
    ctx.font =
      "700 10px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      String(lane + 1),
      x + laneWidth / 2,
      hitY + 46
    );
  }

  ctx.restore();
}

export function drawPianoRushNote(
  ctx: CanvasRenderingContext2D,
  note: PianoRushNote,
  y: number,
  isNext: boolean
) {
  const laneWidth =
    PIANO_VIEW.width / PIANO_VIEW.laneCount;
  const x = note.lane * laneWidth + 7;
  const width = laneWidth - 14;
  const height = PIANO_VIEW.noteHeight - 8;
  const color = LANE_COLORS[note.lane];

  ctx.save();

  if (isNext) {
    ctx.shadowBlur = 16;
    ctx.shadowColor = color;
  } else {
    ctx.shadowBlur = 7;
    ctx.shadowColor = "rgba(90,120,210,.18)";
  }

  ctx.fillStyle = isNext ? "#e9f7ff" : "#cfd9e8";
  ctx.fillRect(x, y, width, height);
  ctx.shadowBlur = 0;

  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, 5);

  ctx.fillStyle = "#10182b";
  ctx.fillRect(x + 8, y + height - 27, width - 16, 9);

  ctx.fillStyle = "rgba(255,255,255,.28)";
  ctx.fillRect(x + 8, y + 11, width - 16, 2);

  ctx.fillStyle = "rgba(17,31,52,.42)";
  const centerX = x + width / 2;
  ctx.fillRect(centerX - 1, y + 18, 2, height - 54);

  if (isNext) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.78;
    ctx.fillRect(
      x + width - 8,
      y + 12,
      3,
      height - 24
    );
  }

  ctx.restore();
}
