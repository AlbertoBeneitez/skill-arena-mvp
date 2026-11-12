// What the screen gives Galactic Games (a subset of the app's CoreCanvasGame props). The app draws the scoreboard,
// the countdown, the result and the controls' chrome; your file draws the play area and maps input to actions.
import type { CoreState } from "./core";

export type Point = { x: number; y: number };
/** The logical canvas (core.width × core.height) already scaled to the phone; draw in logical units. */
export type Viewport = { width: number; height: number };
export type ScoreCell = { label: string; value: string | number };

export type GameView<S extends CoreState> = {
  /** Draws one frame. Never changes state: the screen only reads it. */
  render(ctx: CanvasRenderingContext2D, state: Readonly<S>, viewport: Viewport): void;
  /** A touch on the canvas (logical coordinates) → an action, or null. */
  pointAction?(point: Point, phase: "down" | "move" | "up", state: Readonly<S>): string | null;
  /** Keyboard → action, e.g. { " ": "TAP" }. */
  keys?: Readonly<Record<string, string>>;
  /** On-screen buttons under the canvas (the app styles them). */
  controls?: readonly { action: string; label: string; symbol: string }[];
  /** The scoreboard cells (the app draws them with its shared design). */
  scoreCells?(state: Readonly<S>): readonly ScoreCell[];
};
