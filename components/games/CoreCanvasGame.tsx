"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import { configureLogicalCanvas, beginLogicalCanvasFrame, type CanvasViewportMetrics } from "@/lib/gameCanvas";
import { gameTone, haptic } from "@/lib/gameFeedback";
import { useVerifiedAttempt } from "@/lib/verified/useVerifiedAttempt";
import { advanceCoreToTick, applyCoreInput, type CoreState, type GameCore } from "@/lib/verified/coreRuntime.v1";

export type CorePoint = { x: number; y: number };
type Control = { action: string; label: string; symbol: string; releaseAction?: string };
type Props<S extends CoreState> = GameRuntimeProps & {
  core: GameCore<S>;
  name: string;
  instruction: string;
  render(ctx: CanvasRenderingContext2D, state: S): void;
  primaryAction?: string;
  pointAction?(point: CorePoint, phase: "down" | "move" | "up", state: S): string | null;
  gestureAction?(from: CorePoint, to: CorePoint, state: S): string | null;
  keys?: Readonly<Record<string, string>>;
  keyReleases?: Readonly<Record<string, string>>;
  controls?: readonly Control[];
  hideHudLabel?: boolean;
  hideHudScore?: boolean;
  failureFinale?: { durationMs: number; render(ctx: CanvasRenderingContext2D, state: S, elapsedMs: number): void };
};

/** Presentation/input adapter. The core and shared server replay own outcomes. */
export default function CoreCanvasGame<S extends CoreState>(props: Props<S>) {
  const { core, active, stake, targetScore, name, instruction, render } = props;
  const attempt = useVerifiedAttempt({ active, gameId: core.gameId, stakeMinor: Math.round(stake * 100), targetScore });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const metricsRef = useRef<CanvasViewportMetrics | null>(null);
  const [preview] = useState(() => core.create("preview"));
  const stateRef = useRef<S>(preview);
  const rafRef = useRef<number | null>(null);
  const epochRef = useRef(0);
  const runningRef = useRef(false);
  const finishedRef = useRef(false);
  const terminalStartedRef = useRef<number | null>(null);
  const terminalElapsedRef = useRef(0);
  const generationRef = useRef(0);
  const finishRef = useRef(props.onFinish);
  const targetRef = useRef(targetScore);
  const pendingRef = useRef<string[]>([]);
  const lastInputTickRef = useRef(-1);
  const feedbackScoreRef = useRef(0);
  const heldRef = useRef(new Set<string>());
  const pointerRef = useRef<{ id: number; origin: CorePoint } | null>(null);
  const [hud, setHud] = useState({ tick: 0, score: 0, height: undefined as number | undefined, lives: undefined as number | undefined });

  useEffect(() => { finishRef.current = props.onFinish; }, [props.onFinish]);
  useEffect(() => {
    generationRef.current += 1;
    finishedRef.current = false;
    return () => { generationRef.current += 1; };
  }, [active, core, stake, targetScore]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    metricsRef.current ??= configureLogicalCanvas(canvas, core.width, core.height);
    beginLogicalCanvasFrame(ctx, canvas, metricsRef.current);
    render(ctx, stateRef.current);
    if (stateRef.current.status === "failed") props.failureFinale?.render(ctx, stateRef.current, terminalElapsedRef.current);
  }, [core, render, props.failureFinale]);

  const flush = useCallback(() => {
    const state = stateRef.current;
    while (pendingRef.current.length && state.status === "running") {
      const action = pendingRef.current[0];
      if (!core.canApply(state, action)) { pendingRef.current.shift(); continue; }
      if (lastInputTickRef.current === state.tick) return;
      pendingRef.current.shift();
      if (!attempt.recordInput({ tick: state.tick, action })) continue;
      lastInputTickRef.current = state.tick;
      applyCoreInput(core, state, action, targetRef.current);
      if (state.score !== feedbackScoreRef.current) {
        gameTone(state.score > feedbackScoreRef.current ? "good" : "bad");
        haptic(6);
        feedbackScoreRef.current = state.score;
      } else haptic(2);
      return;
    }
  }, [core, attempt.recordInput]);

  const sync = useCallback((now: number) => {
    if (!runningRef.current) return;
    const tick = Math.floor(Math.max(0, now - epochRef.current) * core.tickRate / 1000);
    advanceCoreToTick(core, stateRef.current, tick, targetRef.current, flush);
    flush();
    if (stateRef.current.score !== feedbackScoreRef.current) {
      gameTone(stateRef.current.score > feedbackScoreRef.current ? "good" : "bad");
      feedbackScoreRef.current = stateRef.current.score;
    }
  }, [core, flush]);

  const send = useCallback((action: string) => {
    if (!active || attempt.state.status !== "ready" || !runningRef.current || finishedRef.current || !core.actions.includes(action)) return;
    sync(performance.now());
    if (stateRef.current.status !== "running" || pendingRef.current.length >= 4) return;
    pendingRef.current.push(action);
    flush();
    draw();
  }, [active, attempt.state.status, core, sync, flush, draw]);

  const releaseHeld = useCallback(() => {
    for (const action of heldRef.current) send(action);
    heldRef.current.clear();
    pointerRef.current = null;
  }, [send]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => { metricsRef.current = configureLogicalCanvas(canvas, core.width, core.height); draw(); };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener("orientationchange", resize);
    return () => { observer.disconnect(); window.removeEventListener("orientationchange", resize); };
  }, [core, draw]);

  useEffect(() => {
    const release = releaseHeld;
    const visibility = () => { if (document.hidden) release(); };
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("blur", release); document.removeEventListener("visibilitychange", visibility); };
  }, [releaseHeld]);

  useEffect(() => {
    if (!active || attempt.state.status !== "ready") return;
    const { manifest } = attempt.state;
    if (manifest.game_id !== core.gameId || manifest.game_version !== core.gameVersion) {
      finishedRef.current = true;
      finishRef.current({ won: false, score: 0, timeMs: 0, verified: false, verificationError: "UNSUPPORTED_GAME_VERSION" });
      return;
    }
    stateRef.current = core.create(manifest.seed);
    feedbackScoreRef.current = 0;
    setHud({tick:0,score:stateRef.current.score,height:stateRef.current.height,lives:stateRef.current.lives});
    targetRef.current = manifest.competition.target_score;
    epochRef.current = performance.now();
    pendingRef.current = [];
    lastInputTickRef.current = -1;
    finishedRef.current = false;
    runningRef.current = true;
    terminalStartedRef.current = null;
    terminalElapsedRef.current = 0;
    let lastHudTick = -core.tickRate;
    const frame = (now: number) => {
      if (!runningRef.current) return;
      sync(now);
      if (terminalStartedRef.current !== null) terminalElapsedRef.current = now - terminalStartedRef.current;
      draw();
      const state = stateRef.current;
      if (state.tick !== lastHudTick && (state.tick - lastHudTick >= core.tickRate / 8 || state.status !== "running")) {
        setHud({ tick: state.tick, score: state.score, height: state.height, lives: state.lives });
        lastHudTick = state.tick;
      }
      if (state.status !== "running") {
        if (!finishedRef.current) {
          finishedRef.current = true;
          terminalStartedRef.current = now;
          pendingRef.current = [];
          heldRef.current.clear();
          gameTone(state.status === "won" ? "win" : "bad");
          if (state.status === "failed") haptic([12, 18, 28]);
        }
        // Only presentation time advances: terminal state and replay tick are frozen.
        const duration = state.status === "failed" ? Math.min(3000, Math.max(0, props.failureFinale?.durationMs ?? 0)) : 0;
        if (terminalElapsedRef.current < duration) {
          rafRef.current = requestAnimationFrame(frame);
          return;
        }
        runningRef.current = false;
        const generation = generationRef.current;
        void attempt.verifyAttempt(state.tick).then(result => {
          if (generation !== generationRef.current || result.error === "VERIFICATION_ABORTED") return;
          finishRef.current({
            won: result.verified && result.won === true,
            score: result.verified ? result.score ?? 0 : 0,
            timeMs: result.verified ? result.time_ms ?? 0 : 0,
            verified: result.verified,
            verificationError: result.error,
            failureReason: result.failure ?? null,
          });
        });
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      runningRef.current = false;
      terminalStartedRef.current = null;
      terminalElapsedRef.current = 0;
      pendingRef.current = [];
      heldRef.current.clear();
      const pointer = pointerRef.current;
      if (pointer && canvasRef.current?.hasPointerCapture(pointer.id)) canvasRef.current.releasePointerCapture(pointer.id);
      pointerRef.current = null;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [active, core, attempt.state.status, attempt.manifest?.match_id, attempt.verifyAttempt, sync, draw]);

  useEffect(() => {
    if (active && attempt.state.status === "rejected" && !finishedRef.current) {
      finishedRef.current = true;
      finishRef.current({ won: false, score: 0, timeMs: 0, verified: false, verificationError: attempt.state.reason });
    }
  }, [active, attempt.state]);

  function point(clientX: number, clientY: number): CorePoint {
    const rect = canvasRef.current?.getBoundingClientRect();
    const metrics = metricsRef.current;
    if (!rect || !metrics) return { x: 0, y: 0 };
    return { x: (clientX - rect.left - metrics.offsetX) / metrics.scale, y: (clientY - rect.top - metrics.offsetY) / metrics.scale };
  }

  return <div className="detGameSurface verifiedArena coreGameSurface">
    <canvas ref={canvasRef} className="gameCanvas deterministicCanvas" role="application" aria-label={`${name}. ${instruction}`} tabIndex={0}
      onPointerDown={event => {
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        const p = point(event.clientX, event.clientY);
        pointerRef.current = { id: event.pointerId, origin: p };
        const action = props.pointAction?.(p, "down", stateRef.current) ?? props.primaryAction;
        if (action) send(action);
      }}
      onPointerMove={event => {
        const pointer = pointerRef.current;
        if (!pointer || pointer.id !== event.pointerId) return;
        const p = point(event.clientX, event.clientY);
        const action = props.gestureAction?.(pointer.origin, p, stateRef.current) ?? props.pointAction?.(p, "move", stateRef.current);
        if (action) { send(action); pointer.origin = p; }
      }}
      onPointerUp={event => {
        const action = props.pointAction?.(point(event.clientX, event.clientY), "up", stateRef.current);
        if (action) send(action);
        pointerRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { pointerRef.current = null; }} onLostPointerCapture={() => { pointerRef.current = null; }} onBlur={releaseHeld}
      onKeyDown={event => {
        const action = props.keys?.[event.key];
        if (!action) return;
        event.preventDefault();
        if (event.repeat) return;
        const release = props.keyReleases?.[event.key];
        if (release) heldRef.current.add(release);
        send(action);
      }}
      onKeyUp={event => {
        const action = props.keyReleases?.[event.key];
        if (action) { event.preventDefault(); heldRef.current.delete(action); send(action); }
      }}
    />
    <div className="coreHud" aria-live="off">{!props.hideHudLabel && <span>{hud.height !== undefined ? `ALTURA ${hud.height}` : name}</span>}{!props.hideHudScore && <strong>{hud.score.toLocaleString("es-ES")}</strong>}{hud.lives !== undefined && <span>VIDAS {hud.lives}</span>}</div>
    <div className="coreHint">{instruction}</div>
    {!!props.controls?.length && <div className="coreControls">{props.controls.map(control => <button key={control.action} type="button" aria-label={control.label}
      onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); if (control.releaseAction) heldRef.current.add(control.releaseAction); send(control.action); }}
      onPointerUp={event => { if (control.releaseAction) { heldRef.current.delete(control.releaseAction); send(control.releaseAction); } if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={() => { if (control.releaseAction) { heldRef.current.delete(control.releaseAction); send(control.releaseAction); } }}
      onLostPointerCapture={() => { if (control.releaseAction && heldRef.current.delete(control.releaseAction)) send(control.releaseAction); }}
      onKeyDown={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); if (!event.repeat) { if (control.releaseAction) heldRef.current.add(control.releaseAction); send(control.action); } } }}
      onKeyUp={event => { if ((event.key === " " || event.key === "Enter") && control.releaseAction) { heldRef.current.delete(control.releaseAction); send(control.releaseAction); } }}
      onBlur={releaseHeld}
    >{control.symbol}</button>)}</div>}
    {(attempt.state.status === "starting" || attempt.state.status === "verifying") && <div className="verificationOverlay"><span>{attempt.state.status === "starting" ? "PREPARANDO PARTIDA" : "COMPROBANDO RESULTADO"}</span></div>}
  </div>;
}
