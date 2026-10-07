import {
  beginLogicalCanvasFrame,
  configureLogicalCanvas,
  type CanvasViewportMetrics,
} from "@/lib/gameCanvas";
import type { PrecisionStackState } from "@/lib/verified/precisionStackCore.v1";

export const STACK_VIEW = {
  width: 390,
  height: 620,
  blockHeight: 38,
  baseY: 548,
  dropDistance: 68,
} as const;

export type StackCanvasMetrics = CanvasViewportMetrics;

export type StationModuleOptions = {
  moving?: boolean;
  perfect?: boolean;
  danger?: boolean;
  alpha?: number;
};

type Star = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  depth: number;
};

function hashUnit(index: number, salt: number) {
  let x = (index + 1) * 0x45d9f3b + salt * 0x27d4eb2d;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x ^= x >>> 16;
  return (x >>> 0) / 0xffffffff;
}

const STAR_FIELD: readonly Star[] = Array.from({ length: 76 }, (_, index) => ({
  x: hashUnit(index, 11) * STACK_VIEW.width,
  y: hashUnit(index, 29) * STACK_VIEW.height,
  radius: 0.45 + hashUnit(index, 47) * 1.25,
  alpha: 0.26 + hashUnit(index, 73) * 0.58,
  depth: 0.25 + hashUnit(index, 101) * 0.75,
}));

export function configureStackCanvas(
  canvas: HTMLCanvasElement
): StackCanvasMetrics {
  return configureLogicalCanvas(
    canvas,
    STACK_VIEW.width,
    STACK_VIEW.height
  );
}

export function beginStackFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  metrics: StackCanvasMetrics
) {
  beginLogicalCanvasFrame(ctx, canvas, metrics);
}

export function worldYForStackBlock(index: number) {
  return STACK_VIEW.baseY - index * STACK_VIEW.blockHeight;
}

export function drawOrbitalBackground(
  ctx: CanvasRenderingContext2D,
  state: PrecisionStackState,
  cameraY: number
) {
  const { width: w, height: h } = STACK_VIEW;

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#050916");
  bg.addColorStop(0.52, "#0a1730");
  bg.addColorStop(1, "#11162a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const nebula = ctx.createRadialGradient(
    w * 0.72,
    h * 0.18,
    12,
    w * 0.72,
    h * 0.18,
    190
  );
  nebula.addColorStop(0, "rgba(78,107,196,.24)");
  nebula.addColorStop(0.52, "rgba(89,55,149,.10)");
  nebula.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = nebula;
  ctx.fillRect(0, 0, w, h);

  const travel = state.tick * 0.035 + cameraY * 0.18;
  for (const star of STAR_FIELD) {
    const y =
      ((star.y + travel * star.depth) % (h + 24)) - 12;
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = "#d9eeff";
    ctx.beginPath();
    ctx.arc(star.x, y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Planet limb: intentionally low contrast so the playfield remains primary.
  const planet = ctx.createRadialGradient(
    w * 0.08,
    h * 1.03,
    18,
    w * 0.08,
    h * 1.03,
    205
  );
  planet.addColorStop(0, "#234b6b");
  planet.addColorStop(0.62, "#132d4a");
  planet.addColorStop(0.86, "#0b1b32");
  planet.addColorStop(1, "rgba(5,9,22,0)");
  ctx.fillStyle = planet;
  ctx.fillRect(-120, h - 250, 330, 270);

  ctx.strokeStyle = "rgba(104,206,235,.12)";
  ctx.lineWidth = 1;
  for (let x = -20; x < w + 24; x += 52) {
    ctx.beginPath();
    ctx.moveTo(x, h - 20);
    ctx.lineTo(x + 80, h - 108);
    ctx.stroke();
  }
}

export function drawDockingBase(ctx: CanvasRenderingContext2D) {
  const { width: w, baseY } = STACK_VIEW;

  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = "rgba(70,212,232,.18)";
  ctx.fillStyle = "#1a2a43";
  ctx.fillRect(30, baseY + 5, w - 60, 22);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#2b4263";
  ctx.fillRect(38, baseY + 8, w - 76, 5);
  ctx.fillStyle = "rgba(108,229,242,.26)";
  ctx.fillRect(52, baseY + 15, w - 104, 2);

  for (let x = 55; x <= w - 55; x += 46) {
    ctx.fillStyle = "rgba(116,235,246,.55)";
    ctx.fillRect(x, baseY + 11, 3, 3);
  }
  ctx.restore();
}

const MODULE_PALETTE = [
  { body: "#315887", edge: "#6ed7e9", dark: "#203a5e" },
  { body: "#4a4f8f", edge: "#a6a9ff", dark: "#303461" },
  { body: "#315f72", edge: "#73e6db", dark: "#20404d" },
  { body: "#55457f", edge: "#c7a9ff", dark: "#382d58" },
] as const;

function modulePalette(level: number) {
  return MODULE_PALETTE[
    Math.abs(level) % MODULE_PALETTE.length
  ];
}

export function drawStationModule(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  level: number,
  options: StationModuleOptions = {}
) {
  if (width <= 0) return;

  const h = STACK_VIEW.blockHeight - 4;
  const palette = modulePalette(level);
  const alpha = options.alpha ?? 1;

  ctx.save();
  ctx.globalAlpha = alpha;

  // A small lower extrusion gives enough weight without faking competitive
  // geometry: collision still uses the pure 2D core dimensions.
  ctx.fillStyle = palette.dark;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + h);
  ctx.lineTo(x + width, y + h);
  ctx.lineTo(x + Math.max(0, width - 5), y + h + 5);
  ctx.lineTo(x, y + h + 5);
  ctx.closePath();
  ctx.fill();

  if (options.moving || options.perfect) {
    ctx.shadowBlur = options.perfect ? 18 : 10;
    ctx.shadowColor = options.danger
      ? "rgba(255,96,111,.48)"
      : options.perfect
        ? "rgba(111,239,241,.72)"
        : "rgba(89,192,236,.34)";
  }

  ctx.fillStyle = options.danger ? "#7b4153" : palette.body;
  ctx.fillRect(x, y, width, h);
  ctx.shadowBlur = 0;

  ctx.fillStyle = options.danger
    ? "rgba(255,131,139,.76)"
    : palette.edge;
  ctx.fillRect(x, y + 2, width, 3);

  ctx.fillStyle = "rgba(255,255,255,.12)";
  ctx.fillRect(x + 4, y + 7, Math.max(0, width - 8), 2);

  ctx.fillStyle = "rgba(0,0,0,.16)";
  ctx.fillRect(x, y + h - 7, width, 7);

  const segment = 28;
  for (let sx = x + segment; sx < x + width - 7; sx += segment) {
    ctx.fillStyle = "rgba(5,14,27,.28)";
    ctx.fillRect(sx, y + 7, 1, h - 13);
  }

  const nodeCount = Math.max(1, Math.floor(width / 48));
  for (let index = 0; index < nodeCount; index += 1) {
    const nx = x + ((index + 1) * width) / (nodeCount + 1);
    ctx.fillStyle = options.danger
      ? "rgba(255,154,160,.8)"
      : "rgba(152,242,246,.82)";
    ctx.fillRect(nx - 1.5, y + h - 12, 3, 3);
  }

  if (options.moving) {
    ctx.fillStyle = "rgba(104,226,244,.72)";
    ctx.fillRect(x - 4, y + 10, 4, h - 18);
    ctx.fillRect(x + width, y + 10, 4, h - 18);
  }

  ctx.restore();
}

export function drawDockingPreview(
  ctx: CanvasRenderingContext2D,
  state: PrecisionStackState,
  targetWorldY: number
) {
  const top = state.blocks[state.blocks.length - 1];
  if (!top || state.phase !== "moving" || state.status !== "running") return;

  const movingX = state.movingXMilli;
  const movingW = state.movingWMilli;
  const movingRight = movingX + movingW;
  const topRight = top.xMilli + top.wMilli;
  const overlapLeft = Math.max(movingX, top.xMilli);
  const overlapRight = Math.min(movingRight, topRight);
  const overlap = Math.max(0, overlapRight - overlapLeft);

  const x = movingX / 1000;
  const w = movingW / 1000;
  const y = targetWorldY + 4;

  ctx.save();
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = "rgba(167,206,236,.28)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, STACK_VIEW.blockHeight - 12);
  ctx.setLineDash([]);

  if (overlap > 0) {
    ctx.fillStyle = "rgba(89,224,223,.11)";
    ctx.fillRect(
      overlapLeft / 1000,
      y,
      overlap / 1000,
      STACK_VIEW.blockHeight - 12
    );
  }

  const topCenter = (top.xMilli + top.wMilli / 2) / 1000;
  ctx.strokeStyle = "rgba(121,235,241,.42)";
  ctx.beginPath();
  ctx.moveTo(topCenter, targetWorldY - 5);
  ctx.lineTo(topCenter, targetWorldY + 9);
  ctx.stroke();
  ctx.restore();
}
