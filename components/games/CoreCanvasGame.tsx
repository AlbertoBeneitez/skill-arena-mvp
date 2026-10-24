"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import GameActionButton from "../GameActionButton";
import DirectionalJoystick from "./DirectionalJoystick";
import type { GameRuntimeProps } from "@/lib/games";
import { configureLogicalCanvas, beginLogicalCanvasFrame, type CanvasViewportMetrics, type LogicalCanvasViewport } from "@/lib/gameCanvas";
import { gameTone, haptic } from "@/lib/gameFeedback";
import { useVerifiedAttempt } from "@/lib/verified/useVerifiedAttempt";
import { advanceCoreToTick, applyCoreInput, type CoreState, type GameCore } from "@/lib/verified/coreRuntime.v1";

export type CorePoint = { x: number; y: number };
type Control = { action: string; label: string; symbol: string; releaseAction?: string; style?: CSSProperties };
type Props<S extends CoreState> = GameRuntimeProps & {
  core: GameCore<S>;
  name: string;
  instruction: string;
  render(ctx: CanvasRenderingContext2D, state: S, viewport: LogicalCanvasViewport): void;
  /** Visual space only; opt in when input coordinates are independent of width. */
  expandHorizontalViewport?: boolean;
  expandVerticalViewport?: boolean;
  primaryAction?: string;
  /** Held canvas gestures release through the same blur/cancel lifecycle as keys/buttons. */
  pointerReleaseAction?: string;
  /** Presentation-only reward signal; HUD/replay keep the complete authoritative score. */
  feedbackScore?(state: S): number;
  inputTones?: Readonly<Partial<Record<string, Parameters<typeof gameTone>[0]>>>;
  /** Single-axis destination survives the core cooldown; ordered gestures keep their normal queue. */
  coalescePointActions?: boolean;
  pointAction?(point: CorePoint, phase: "down" | "move" | "up", state: S): string | readonly string[] | null;
  gestureAction?(from: CorePoint, to: CorePoint, state: S): string | null;
  keys?: Readonly<Record<string, string>>;
  keyReleases?: Readonly<Record<string, string>>;
  controls?: readonly Control[];
  /** A native choice emits actions through the same input queue and recorder. */
  choiceControl?: Readonly<{ label: string; options: readonly { action: string; label: string; tone?: string; placement?: {row:number;column:number;rowSpan?:number;columnSpan?:number} }[]; presentation?: "grid" | "table"; columns?: number; value(state: S): string; /** Per-action counters (chips on a cloth cell); presentation only. */ badges?(state: S): Readonly<Record<string, number>>; disabled?(state: S): boolean }>;
  /** Actions still pass through the shared recorder and server replay. */
  directionalJoystick?: boolean;
  hideHudLabel?: boolean;
  /** Presentation text refreshed with the common HUD cadence, never authoritative state. */
  hudLabel?(state: Readonly<S>): string;
  hideHudScore?: boolean;
  failureFinale?: { durationMs: number; render(ctx: CanvasRenderingContext2D, state: S, elapsedMs: number): void };
};

/** Presentation/input adapter. The core and shared server replay own outcomes. */
export default function CoreCanvasGame<S extends CoreState>(props: Props<S>) {
  const { core, active, stake, targetScore, name, instruction, render } = props;
  const viewportPolicy = props.expandVerticalViewport ? "expand-vertical" : props.expandHorizontalViewport ? "expand-horizontal" : "contain";
  const attempt = useVerifiedAttempt({ active, gameId: core.gameId, stakeMinor: Math.round(stake * 100), targetScore });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const choiceRef = useRef<HTMLSelectElement>(null);
  const choicePanelRef = useRef<HTMLDivElement>(null);
  const choiceSummaryRef = useRef<HTMLSpanElement>(null);
  const choiceStateRef = useRef("");
  const [choiceOpen, setChoiceOpen] = useState(false);
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
  const stickPendingRef = useRef<string | null>(null);
  const lastInputTickRef = useRef(-1);
  const feedbackScoreRef = useRef(0);
  const heldRef = useRef(new Set<string>());
  const pointerRef = useRef<{ id: number; origin: CorePoint } | null>(null);
  const [presentingFinale, setPresentingFinale] = useState(false);
  const [hud, setHud] = useState({ tick: 0, score: 0, height: undefined as number | undefined, lives: undefined as number | undefined, label: undefined as string | undefined });
  // Player-experience overlay: a floating "+N" and sparks whenever the score rises (presentation only).
  const prevScoreRef = useRef(0);
  const [pop, setPop] = useState<{ id: number; gain: number } | null>(null);
  useEffect(() => {
    const gain = hud.score - prevScoreRef.current;
    prevScoreRef.current = hud.score;
    if (props.hideHudScore || gain <= 0 || hud.tick === 0) return;
    setPop({ id: hud.tick, gain });
    const timer = window.setTimeout(() => setPop(null), 900);
    return () => window.clearTimeout(timer);
  }, [hud.score, hud.tick, props.hideHudScore]);
  const attemptMatchId = "manifest" in attempt.state ? attempt.state.manifest?.match_id : undefined;
  const attemptId = "ticket" in attempt.state ? attempt.state.ticket?.attempt_id : undefined;

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
    metricsRef.current ??= configureLogicalCanvas(canvas, core.width, core.height, 2, viewportPolicy);
    beginLogicalCanvasFrame(ctx, canvas, metricsRef.current);
    render(ctx, stateRef.current, {
      width: metricsRef.current.logicalWidth,
      height: metricsRef.current.logicalHeight,
    });
    if (choiceRef.current && props.choiceControl) {
      choiceRef.current.value = props.choiceControl.value(stateRef.current);
      choiceRef.current.disabled = !runningRef.current || (props.choiceControl.disabled?.(stateRef.current) ?? false);
    }
    if (choicePanelRef.current && props.choiceControl) {
      const value = props.choiceControl.value(stateRef.current), disabled = !runningRef.current || (props.choiceControl.disabled?.(stateRef.current) ?? false);
      const badges = props.choiceControl.badges?.(stateRef.current);
      const signature = `${value}:${disabled}:${badges ? JSON.stringify(badges) : ""}`;
      if (signature !== choiceStateRef.current) {
        choiceStateRef.current = signature;
        for (const button of choicePanelRef.current.querySelectorAll<HTMLButtonElement>("button[data-choice]")) {
          button.disabled = disabled;
          const count = badges ? (badges[button.dataset.choice ?? ""] ?? 0) : 0;
          if (count > 0) button.dataset.chips = String(count);
          else delete button.dataset.chips;
          // Optional chip denomination (badge key "~<choice>") so the badge keeps the chip colour.
          const tone = badges ? badges[`~${button.dataset.choice ?? ""}`] : undefined;
          if (count > 0 && tone) button.dataset.chipTone = String(tone);
          else delete button.dataset.chipTone;
          button.setAttribute("aria-pressed", String(badges ? count > 0 : button.dataset.choice === value));
        }
        if (choiceSummaryRef.current) choiceSummaryRef.current.textContent = props.choiceControl.options.find(option => option.action === value)?.label ?? "";
        const trigger=choicePanelRef.current.querySelector<HTMLButtonElement>(".coreChoiceTrigger");
        if(trigger)trigger.disabled=disabled;
        if (disabled) setChoiceOpen(false);
      }
    }
    if (stateRef.current.status === "failed") props.failureFinale?.render(ctx, stateRef.current, terminalElapsedRef.current);
  }, [core, render, props.failureFinale, props.choiceControl, viewportPolicy]);

  const flush = useCallback(() => {
    const state = stateRef.current;
    // Coalesce finger motion until the existing core's input cooldown permits it.
    // In particular a fast cancel must retain STOP rather than discard it as invalid.
    if (stickPendingRef.current && core.canApply(state, stickPendingRef.current) && pendingRef.current.length < 4) {
      pendingRef.current.push(stickPendingRef.current);
      stickPendingRef.current = null;
    }
    while (pendingRef.current.length && state.status === "running") {
      const action = pendingRef.current[0];
      if (!core.canApply(state, action)) { pendingRef.current.shift(); continue; }
      if (lastInputTickRef.current === state.tick) return;
      pendingRef.current.shift();
      if (!attempt.recordInput({ tick: state.tick, action }, attemptId)) continue;
      lastInputTickRef.current = state.tick;
      applyCoreInput(core, state, action, targetRef.current);
      attempt.recordCheckpoint(state.tick, state.status, attemptId);
      const tone = props.inputTones?.[action];
      if (tone) gameTone(tone);
      const feedbackScore = props.feedbackScore?.(state) ?? state.score;
      if (feedbackScore !== feedbackScoreRef.current) {
        gameTone(feedbackScore > feedbackScoreRef.current ? "good" : "bad");
        haptic(6);
        feedbackScoreRef.current = feedbackScore;
      } else haptic(2);
      return;
    }
  }, [core, attemptId, attempt.recordInput, attempt.recordCheckpoint, props.inputTones, props.feedbackScore]);

  const sync = useCallback((now: number) => {
    if (!runningRef.current) return;
    const tick = Math.floor(Math.max(0, now - epochRef.current) * core.tickRate / 1000);
    advanceCoreToTick(core, stateRef.current, tick, targetRef.current, flush);
    flush();
    attempt.recordCheckpoint(stateRef.current.tick, stateRef.current.status, attemptId);
    const feedbackScore = props.feedbackScore?.(stateRef.current) ?? stateRef.current.score;
    if (feedbackScore !== feedbackScoreRef.current) {
      gameTone(feedbackScore > feedbackScoreRef.current ? "good" : "bad");
      feedbackScoreRef.current = feedbackScore;
    }
  }, [core, flush, attemptId, attempt.recordCheckpoint, props.feedbackScore]);

  const send = useCallback((action: string) => {
    if (!active || attempt.state.status !== "ready" || !runningRef.current || finishedRef.current || !core.actions.includes(action)) return;
    sync(performance.now());
    if (stateRef.current.status !== "running" || pendingRef.current.length >= 4) return;
    pendingRef.current.push(action);
    flush();
    draw();
  }, [active, attempt.state.status, core, sync, flush, draw]);

  const sendStick = useCallback((action: string) => {
    if (!active || attempt.state.status !== "ready" || !runningRef.current || finishedRef.current || !core.actions.includes(action)) return;
    sync(performance.now());
    if (stateRef.current.status !== "running") return;
    stickPendingRef.current = action;
    flush();
    draw();
  }, [active, attempt.state.status, core, sync, flush, draw]);

  // Some touch gestures update two quantized axes; each remains a distinct recorded tick.
  function sendPointActions(actions: string | readonly string[]) {
    if (props.coalescePointActions && typeof actions === "string") sendStick(actions);
    else for (const action of typeof actions === "string" ? [actions] : actions) send(action);
  }

  const releaseHeld = useCallback(() => {
    for (const action of heldRef.current) send(action);
    heldRef.current.clear();
    pointerRef.current = null;
  }, [send]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      metricsRef.current = configureLogicalCanvas(canvas, core.width, core.height, 2, viewportPolicy);
      const panel=choicePanelRef.current, grid=panel?.querySelector<HTMLElement>(".coreChoiceGrid");
      if(grid&&props.choiceControl?.presentation!=="table")grid.style.maxHeight=`${Math.max(88,(panel?.parentElement?.clientHeight ?? 300)-64)}px`;
      draw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener("orientationchange", resize);
    return () => { observer.disconnect(); window.removeEventListener("orientationchange", resize); };
  }, [core, draw, viewportPolicy]);

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
    targetRef.current = manifest.competition.target_score;
    epochRef.current = performance.now();
    pendingRef.current = [];
    stickPendingRef.current = null;
    lastInputTickRef.current = -1;
    finishedRef.current = false;
    runningRef.current = true;
    attempt.recordCheckpoint(stateRef.current.tick, stateRef.current.status, attemptId);
    setHud({tick:0,score:stateRef.current.score,height:stateRef.current.height,lives:stateRef.current.lives,label:props.hudLabel?.(stateRef.current)});
    terminalStartedRef.current = null;
    terminalElapsedRef.current = 0;
    setPresentingFinale(false);
    let terminalVerification: ReturnType<typeof attempt.verifyAttempt> | null = null;
    let lastHudTick = -core.tickRate;
    const frame = (now: number) => {
      if (!runningRef.current) return;
      sync(now);
      const state = stateRef.current;
      if (state.status !== "running" && !finishedRef.current) {
        finishedRef.current = true;
        terminalStartedRef.current = now;
        pendingRef.current = [];
        heldRef.current.clear();
        // Commit the frozen replay before rendering, feedback or any
        // presentation delay. A presentation failure cannot discard the
        // record, and leaving this view only invalidates its result callback.
        terminalVerification = attempt.verifyAttempt(state.tick);
        setPresentingFinale(state.status === "failed" && (props.failureFinale?.durationMs ?? 0) > 0);
        gameTone(state.status === "won" ? "win" : "bad");
        if (state.status === "failed") haptic([12, 18, 28]);
      }
      if (terminalStartedRef.current !== null) terminalElapsedRef.current = now - terminalStartedRef.current;
      draw();
      if (state.tick !== lastHudTick && (state.tick - lastHudTick >= core.tickRate / 8 || state.status !== "running")) {
        setHud({ tick: state.tick, score: state.score, height: state.height, lives: state.lives, label: props.hudLabel?.(state) });
        lastHudTick = state.tick;
      }
      if (state.status !== "running") {
        // Only presentation time advances: terminal state and replay tick are frozen.
        const duration = state.status === "failed" ? Math.min(3000, Math.max(0, props.failureFinale?.durationMs ?? 0)) : 0;
        if (terminalElapsedRef.current < duration) {
          rafRef.current = requestAnimationFrame(frame);
          return;
        }
        runningRef.current = false;
        setPresentingFinale(false);
        const generation = generationRef.current;
        void terminalVerification?.then(result => {
          if (generation !== generationRef.current || result.error === "VERIFICATION_ABORTED") return;
          finishRef.current({
            won: result.verified && result.won === true,
            score: result.verified ? result.score ?? 0 : 0,
            height: result.verified ? result.height : undefined,
            timeMs: result.verified ? result.time_ms ?? 0 : 0,
            verified: result.verified,
            serverMatch: result.match,
            forfeited: result.forfeited,
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
      stickPendingRef.current = null;
      heldRef.current.clear();
      const pointer = pointerRef.current;
      if (pointer && canvasRef.current?.hasPointerCapture(pointer.id)) canvasRef.current.releasePointerCapture(pointer.id);
      pointerRef.current = null;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [active, core, attemptId, attemptMatchId, attempt.verifyAttempt, sync, draw, props.hudLabel]);

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
        if (pointerRef.current !== null) return;
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        const p = point(event.clientX, event.clientY);
        pointerRef.current = { id: event.pointerId, origin: p };
        if (props.pointerReleaseAction) heldRef.current.add(props.pointerReleaseAction);
        const action = props.pointAction?.(p, "down", stateRef.current) ?? props.primaryAction;
        if (action) sendPointActions(action);
      }}
      onPointerMove={event => {
        const pointer = pointerRef.current;
        if (!pointer || pointer.id !== event.pointerId) return;
        const p = point(event.clientX, event.clientY);
        const action = props.gestureAction?.(pointer.origin, p, stateRef.current) ?? props.pointAction?.(p, "move", stateRef.current);
        if (action) { sendPointActions(action); pointer.origin = p; }
      }}
      onPointerUp={event => {
        if (pointerRef.current?.id !== event.pointerId) return;
        if (props.pointerReleaseAction && heldRef.current.delete(props.pointerReleaseAction)) send(props.pointerReleaseAction);
        const action = props.pointAction?.(point(event.clientX, event.clientY), "up", stateRef.current);
        if (action) sendPointActions(action);
        pointerRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={event => { if (pointerRef.current?.id === event.pointerId) { pointerRef.current = null; if (props.pointerReleaseAction && heldRef.current.delete(props.pointerReleaseAction)) send(props.pointerReleaseAction); } }} onLostPointerCapture={event => { if (pointerRef.current?.id === event.pointerId) { pointerRef.current = null; if (props.pointerReleaseAction && heldRef.current.delete(props.pointerReleaseAction)) send(props.pointerReleaseAction); } }} onBlur={releaseHeld}
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
    {pop && <div className="scorePop" key={pop.id} aria-hidden="true"><b>+{pop.gain.toLocaleString("es-ES")}</b>{[0, 1, 2, 3, 4, 5].map((i) => <i key={i} style={{ ["--a" as string]: `${i * 60 + 20}deg` }} />)}</div>}
    <div className="coreHud" aria-live="off">{!props.hideHudLabel && (hud.label || hud.height !== undefined) && <span>{hud.label ?? `ALTURA ${hud.height}`}</span>}{!props.hideHudScore && <strong key={hud.score} className="hudPop">{hud.score.toLocaleString("es-ES")}</strong>}{hud.lives !== undefined && <span>VIDAS {hud.lives}</span>}</div>
    {props.directionalJoystick && <DirectionalJoystick enabled={active && attempt.state.status === "ready" && !presentingFinale} send={sendStick} />}
    {props.choiceControl && (props.choiceControl.presentation === "table" ? <div ref={choicePanelRef} className="coreChoice coreChoicePanel coreChoiceTable">
      {/* Always visible: one tap places the chip, no panel to open or close. */}
      <div className="coreChoiceGrid" role="group" aria-label={props.choiceControl.label} style={{gridTemplateColumns:`repeat(${props.choiceControl.columns ?? 3},minmax(0,1fr))`}}>
        {props.choiceControl.options.map(option => <GameActionButton key={option.action} data-choice={option.action} aria-pressed={option.action === props.choiceControl!.value(preview)} style={{background:option.tone,gridRow:option.placement ? `${option.placement.row} / span ${option.placement.rowSpan ?? 1}` : undefined,gridColumn:option.placement ? `${option.placement.column} / span ${option.placement.columnSpan ?? 1}` : undefined}} onActivate={()=>send(option.action)}>{option.label}</GameActionButton>)}
      </div>
    </div> : props.choiceControl.presentation === "grid" ? <div ref={choicePanelRef} className="coreChoice coreChoicePanel">
      <GameActionButton className="coreChoiceTrigger" aria-label={props.choiceControl.label} aria-expanded={choiceOpen} onActivate={()=>{
        const panel=choicePanelRef.current, grid=panel?.querySelector<HTMLElement>(".coreChoiceGrid");
        if(!runningRef.current || props.choiceControl?.disabled?.(stateRef.current))return;
        if(grid)grid.style.maxHeight=`${Math.max(88,(panel?.parentElement?.clientHeight ?? 300)-64)}px`;
        setChoiceOpen(open=>!open);
      }}><span ref={choiceSummaryRef}>{props.choiceControl.options.find(option => option.action === props.choiceControl!.value(preview))?.label}</span><span aria-hidden="true">⌄</span></GameActionButton>
      <div hidden={!choiceOpen} className="coreChoiceGrid" role="group" aria-label={props.choiceControl.label} style={{gridTemplateColumns:`repeat(${props.choiceControl.columns ?? 3},minmax(0,1fr))`}}>
        {props.choiceControl.options.map(option => <GameActionButton key={option.action} data-choice={option.action} aria-pressed={option.action === props.choiceControl!.value(preview)} style={{background:option.tone,gridRow:option.placement ? `${option.placement.row} / span ${option.placement.rowSpan ?? 1}` : undefined,gridColumn:option.placement ? `${option.placement.column} / span ${option.placement.columnSpan ?? 1}` : undefined}} onActivate={()=>{send(option.action);setChoiceOpen(false);}}>{option.label}</GameActionButton>)}
      </div>
    </div> : <label className="coreChoice"><span>{props.choiceControl.label}</span><select ref={choiceRef} aria-label={props.choiceControl.label} defaultValue={props.choiceControl.value(preview)} onChange={event => send(event.currentTarget.value)}>{props.choiceControl.options.map(option => <option key={option.action} value={option.action}>{option.label}</option>)}</select></label>)}
    {!!props.controls?.length && <div className="coreControls">{props.controls.map(control => <button key={control.action} type="button" aria-label={control.label} style={control.style}
      onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); if (control.releaseAction) heldRef.current.add(control.releaseAction); send(control.action); }}
      onPointerUp={event => { if (control.releaseAction) { heldRef.current.delete(control.releaseAction); send(control.releaseAction); } if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={() => { if (control.releaseAction) { heldRef.current.delete(control.releaseAction); send(control.releaseAction); } }}
      onLostPointerCapture={() => { if (control.releaseAction && heldRef.current.delete(control.releaseAction)) send(control.releaseAction); }}
      onKeyDown={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); if (!event.repeat) { if (control.releaseAction) heldRef.current.add(control.releaseAction); send(control.action); } } }}
      onKeyUp={event => { if ((event.key === " " || event.key === "Enter") && control.releaseAction) { heldRef.current.delete(control.releaseAction); send(control.releaseAction); } }}
      onBlur={releaseHeld}
    >{control.symbol}</button>)}</div>}
    {(attempt.state.status === "starting" || (attempt.state.status === "verifying" && !presentingFinale)) && <div className="verificationOverlay"><span>{attempt.state.status === "starting" ? "PREPARANDO PARTIDA" : "COMPROBANDO RESULTADO"}</span></div>}
  </div>;
}
