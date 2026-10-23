"use client";
/** Original GALACTIC GAMES presentation; MIT mechanic lineage is documented in THIRD_PARTY_NOTICES. */
import type { GameRuntimeProps } from "@/lib/games";
import { hopPlatformX, SKY_HOP_RULES } from "@/lib/verified/skyHopCore.v1";
import {
  SKY_HOP_ENEMY_RULES,
  hopEnemyX,
  hopEnemyVisible,
  hopEnemyActive,
  type SkyHopV3State,
} from "@/lib/verified/skyHopCore.v3";
import { SKY_HOP_CORE_V4 } from "@/lib/verified/skyHopCore.v4";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import CoreCanvasGame from "./CoreCanvasGame";

function drawMartian(
  ctx: CanvasRenderingContext2D,
  armed: boolean,
  warning: number | null,
) {
  const halfWidth = SKY_HOP_ENEMY_RULES.halfWidth / 1000,
    halfHeight = SKY_HOP_ENEMY_RULES.halfHeight / 1000;
  ctx.save();
  ctx.globalAlpha = armed ? 1 : warning === null ? 0.3 : 0.75;
  ctx.fillStyle = "#f3b5c5";
  ctx.beginPath();
  ctx.roundRect(-halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2, 4);
  ctx.fill();
  ctx.strokeStyle = armed ? "#ff719b" : "#ffd186";
  ctx.lineWidth = 1.5;
  ctx.setLineDash(armed ? [] : [3, 4]);
  // A visible body outline covers the actual AABB, including its corners.
  ctx.strokeRect(-halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2);
  ctx.setLineDash([]);
  // Thin antenna lights are separate from the solid collision body.
  ctx.beginPath();
  ctx.moveTo(-5, -halfHeight + 1);
  ctx.lineTo(-7, -halfHeight - 3);
  ctx.moveTo(5, -halfHeight + 1);
  ctx.lineTo(7, -halfHeight - 3);
  ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.fillStyle = armed ? "#ffc497" : "#ffe2a5";
    ctx.beginPath();
    ctx.arc(side * 7, -halfHeight - 3, 1.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#281b30";
    ctx.beginPath();
    ctx.ellipse(side * 4.5, -1, 3.1, 4.8, side * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe4a5";
    ctx.fillRect(side * 4.5 - 0.7, -1.5, 1.4, 2.2);
  }
  ctx.strokeStyle = "#553049";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-3, 7);
  ctx.lineTo(3, 7);
  ctx.stroke();
  if (warning !== null) {
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = "#ffd186";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
      0,
      0,
      halfHeight + 5,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * warning,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawEnemyBurst(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  age: number,
  hit: boolean,
) {
  if (age < 0 || age >= 48) return;
  const progress = age / 48;
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  ctx.strokeStyle = hit ? "#ffb099" : "#b7ffe0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 8 + progress * 23, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = hit ? "#ffb8a4" : "#c7ffe8";
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4,
      spread = 9 + progress * 31;
    ctx.fillRect(
      x + Math.cos(angle) * spread - 1.5,
      y + Math.sin(angle) * spread - 1.5,
      3,
      3,
    );
  }
  ctx.restore();
}

function drawSkyEnemies(
  ctx: CanvasRenderingContext2D,
  state: Readonly<SkyHopV3State>,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 390, 620);
  ctx.clip();
  for (let index = 0; index < state.enemies.length; index++) {
    const enemy = state.enemies[index],
      y = (enemy.y - state.camera) / 1000;
    // Includes antenna/telegraph/particle extents; offscreen actors stay cheap.
    if (y < -48 || y > 668) continue;
    const defeatedAt = state.enemyDefeatedAt[index];
    if (defeatedAt >= 0) {
      drawEnemyBurst(
        ctx,
        hopEnemyX(state, enemy, defeatedAt) / 1000,
        y,
        state.tick - defeatedAt,
        false,
      );
      continue;
    }
    const x = hopEnemyX(state, enemy) / 1000,
      armed = hopEnemyActive(state, index),
      deadline = state.enemyArmedAt[index],
      inWindow = hopEnemyVisible(state, enemy),
      warning =
        deadline >= 0 &&
        state.tick < deadline &&
        state.tick >= state.respawnUntil &&
        inWindow
          ? Math.max(
              0,
              1 - (deadline - state.tick) / SKY_HOP_ENEMY_RULES.warningTicks,
            )
          : null;
    if (armed) {
      ctx.save();
      ctx.strokeStyle = "rgba(243,181,197,.25)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(
        hopEnemyX(state, enemy, Math.max(0, state.tick - 18)) / 1000,
        y,
      );
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(x, y);
    drawMartian(ctx, armed, warning);
    ctx.restore();
  }
  const hitAge = state.tick - state.lastEnemyHitTick,
    hitEnemy = state.enemies[state.lastEnemyHitIndex];
  const hitY = hitEnemy ? (hitEnemy.y - state.camera) / 1000 : -1000;
  if (
    hitEnemy &&
    !(state.status === "failed" && state.failure === "ALIEN_CONTACT") &&
    hitAge >= 0 &&
    hitAge < 48 &&
    hitY >= -48 &&
    hitY <= 668
  ) {
    // Contact is anchored to the real enemy, never the already-respawned ship.
    drawEnemyBurst(
      ctx,
      hopEnemyX(state, hitEnemy, state.lastEnemyHitTick) / 1000,
      hitY,
      hitAge,
      true,
    );
  }
  ctx.restore();
}

function render(ctx: CanvasRenderingContext2D, s: SkyHopV3State) {
  drawSpaceBackdrop(ctx, 390, 620, -s.camera / 1800, s.tick);
  // Distant orbital structures stay quiet behind the high-contrast landing surfaces.
  ctx.strokeStyle = "rgba(116,174,207,.11)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = ((((i * 177 - s.camera / 5000) % 760) + 760) % 760) - 70;
    ctx.strokeRect(12 + (i % 2) * 318, y, 48, 116);
    ctx.beginPath();
    ctx.moveTo(12 + (i % 2) * 318, y + 36);
    ctx.lineTo(60 + (i % 2) * 318, y + 80);
    ctx.stroke();
  }
  for (let i = 0; i < s.platforms.length; i++) {
    const p = s.platforms[i],
      y = (p.y - s.camera) / 1000;
    if (y < -60 || y > 660) continue;
    if (s.brokenAt[i] >= 0 && s.tick >= s.brokenAt[i]) {
      // Disintegration is visual only: support disappears at the original core tick.
      const age = s.tick - s.brokenAt[i];
      if (age < 48) {
        const x = hopPlatformX(p, s.brokenAt[i]) / 1000;
        ctx.save();
        ctx.globalAlpha = (1 - age / 48) * .65;
        ctx.fillStyle = "#ef94aa";
        for (let k = 0; k < 6; k++) {
          const spread = (k - 2.5) * age * .12;
          ctx.fillRect(x + (k + .5) * p.width / 6000 + spread, y + age * age * .018, 6, 3);
        }
        ctx.restore();
      }
      continue;
    }
    const x = hopPlatformX(p, s.tick) / 1000,
      w = p.width / 1000;
    const color =
      p.kind === "boost"
          ? "#a999fa"
          : p.kind === "moving"
            ? "#f4c272"
            : p.kind === "crumble"
              ? "#ef94aa"
              : p.kind === "checkpoint"
                ? "#87e8c4"
                : "#7fcde5";
    ctx.save();
    if (s.brokenAt[i] >= 0)
      ctx.globalAlpha = Math.max(0.25, (s.brokenAt[i] - s.tick) / 72);
    ctx.fillStyle = "#1a3044";
    ctx.fillRect(x, y, w, 13);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, 4);
    ctx.strokeStyle = color;
    ctx.globalAlpha *= 0.5;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 12);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.fillRect(x + 5, y + 9, w - 10, 4);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    if (p.kind === "crumble") {
      for (let k = 18; k < w; k += 24) {
        ctx.beginPath();
        ctx.moveTo(x + k, y + 3);
        ctx.lineTo(x + k + 4, y + 7);
        ctx.lineTo(x + k + 1, y + 12);
        ctx.stroke();
      }
    }
    if (p.kind === "crumble" && s.brokenAt[i] > s.tick) {
      // A shrinking solid edge shows the remaining lifetime after a landing.
      const remaining = Math.min(1, (s.brokenAt[i] - s.tick) / 72);
      ctx.fillStyle = "#ffe7ed";
      ctx.fillRect(x, y, w * remaining, 2);
    }
    if (p.kind === "moving") {
      ctx.font = "bold 13px system-ui";
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.fillText("↔", x + w / 2, y + 22);
    }
    if (p.kind === "boost") {
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.moveTo(x + w / 2 - 7, y + 11 - k * 6);
        ctx.lineTo(x + w / 2, y + 6 - k * 6);
        ctx.lineTo(x + w / 2 + 7, y + 11 - k * 6);
        ctx.stroke();
      }
    }
    if (p.kind === "checkpoint") {
      ctx.fillStyle = color;
      ctx.font = "bold 10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(i === 0 ? "DESPEGUE" : `BALIZA ${i}`, x + w / 2, y + 26);
    }
    if (p.pickup && !s.collected[i]) {
      ctx.fillStyle = "#b4f2d2";
      ctx.beginPath();
      ctx.arc(x + w / 2, y - 23, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#183d39";
      ctx.fillRect(x + w / 2 - 1, y - 28, 2, 10);
      ctx.fillRect(x + w / 2 - 5, y - 24, 10, 2);
      ctx.strokeStyle = "rgba(180,242,210,.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x + w / 2, y - 23, 11 + Math.sin(s.tick / 18) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    const age = s.tick - s.lastLandingTick;
    if (i === s.lastLandingIndex && age >= 0 && age < 24) {
      ctx.strokeStyle = `rgba(221,249,255,${1 - age / 24})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(
        x - age * 0.35,
        y - age * 0.12,
        w + age * 0.7,
        14 + age * 0.24,
      );
    }
    ctx.restore();
  }
  drawSkyEnemies(ctx, s);
  const py = (s.y - s.camera) / 1000;
  ctx.save();
  ctx.translate(s.x / 1000, py);
  ctx.rotate(s.vx / 10000);
  if (s.tick < s.respawnUntil && s.tick % 12 < 6) ctx.globalAlpha = 0.5;
  if (s.vy < 0) {
    ctx.fillStyle = "rgba(115,201,248,.3)";
    ctx.beginPath();
    ctx.moveTo(-7, 13);
    ctx.lineTo(0, 31 + (s.tick % 7));
    ctx.lineTo(7, 13);
    ctx.fill();
  }
  ctx.fillStyle = "#edf4fd";
  ctx.beginPath();
  ctx.moveTo(0, -19);
  ctx.lineTo(16, 12);
  ctx.lineTo(8, 16);
  ctx.lineTo(-8, 16);
  ctx.lineTo(-16, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#62bdd7";
  ctx.beginPath();
  ctx.ellipse(0, -1, 6, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#223951";
  ctx.fillRect(-8, 11, 16, 4);
  ctx.restore();
  ctx.textAlign = "center";
  ctx.font = "12px system-ui";
  ctx.fillStyle = "#dceaf7";
  const hit = s.tick - s.lastDamageTick;
  if (hit >= 0 && hit < 60) {
    ctx.fillStyle = `rgba(219,88,119,${0.15 * (1 - hit / 60)})`;
    ctx.fillRect(0, 0, 390, 620);
  }
}
const hudLabel = (s: Readonly<SkyHopV3State>) =>
  `ALTURA ${s.highest}`;
// Presentation-only signal: life loss wins over concurrent ascent or stomps.
// It never becomes score, progress, replay input or an authoritative result.
const feedbackScore = (s: Readonly<SkyHopV3State>) =>
  s.highest * 1000 + s.stomps * 20 + (s.lives - SKY_HOP_RULES.lives) * 100000;
const failureFinale = {
  durationMs: 300,
  render(
    ctx: CanvasRenderingContext2D,
    s: Readonly<SkyHopV3State>,
    elapsedMs: number,
  ) {
    if (s.failure === "FALLEN") {
      // Falling previously cut directly to the result. Anchor the effect at the
      // lower visible edge while keeping the terminal simulation frozen.
      const progress = Math.min(1, Math.max(0, elapsedMs) / 300);
      const x = s.x / 1000;
      ctx.save();
      ctx.globalAlpha = 1 - progress;
      ctx.strokeStyle = "#9edbfa";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, 608, 14 + progress * 30, 4 + progress * 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (s.failure !== "ALIEN_CONTACT") return;
    const enemy = s.enemies[s.lastEnemyHitIndex];
    if (!enemy) return;
    // Only the shared presentation clock advances; terminal replay stays frozen.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 390, 620);
    ctx.clip();
    drawEnemyBurst(
      ctx,
      hopEnemyX(s, enemy, s.lastEnemyHitTick) / 1000,
      (enemy.y - s.camera) / 1000,
      (Math.max(0, elapsedMs) * 48) / 300,
      true,
    );
    ctx.restore();
  },
};
const keys = {
  ArrowLeft: "LEFT_DOWN",
  ArrowRight: "RIGHT_DOWN",
  a: "LEFT_DOWN",
  d: "RIGHT_DOWN",
} as const;
const keyUp = {
  ArrowLeft: "LEFT_UP",
  ArrowRight: "RIGHT_UP",
  a: "LEFT_UP",
  d: "RIGHT_UP",
} as const;
const controls = [
  {
    action: "LEFT_DOWN",
    releaseAction: "LEFT_UP",
    label: "Dirigir izquierda",
    symbol: "←",
  },
  {
    action: "RIGHT_DOWN",
    releaseAction: "RIGHT_UP",
    label: "Dirigir derecha",
    symbol: "→",
  },
] as const;
export default function SkyHopVerified(props: GameRuntimeProps) {
  return (
    <div className="skyHopVerified">
      <CoreCanvasGame
        {...props}
        core={SKY_HOP_CORE_V4}
        name="Sky Hop"
        render={render}
        hudLabel={hudLabel}
        hideHudScore
        feedbackScore={feedbackScore}
        failureFinale={failureFinale}
        keys={keys}
        keyReleases={keyUp}
        controls={controls}
        instruction=""
      />
    </div>
  );
}
