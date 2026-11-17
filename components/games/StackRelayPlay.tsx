"use client";
/*
 * v211 · One turn of the group relay ("juego grupal") on Stack. The tower of the earlier turns is rebuilt from the
 * server's log (same seed, every drop replayed), then the clock runs on from the tick the last turn closed at. The turn
 * closes by itself as the block after the player's last one appears (or when the tower falls) and only the turn's
 * drops are sent: the server replays the whole run again and decides. Presentation and input only.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { beginLogicalCanvasFrame, configureLogicalCanvas, type CanvasViewportMetrics } from "@/lib/gameCanvas";
import { gameTone, haptic } from "@/lib/gameFeedback";
import { t, useI18n } from "@/lib/i18n";
import { applyCoreInput, stepCore } from "@/lib/verified/coreRuntime.v1";
import type { Stack3DState } from "@/lib/verified/precisionStackCore.v4";
import { STACK_RELAY_CORE, rebuildRelay, type RelayInput } from "@/lib/verified/stackRelay.v1";
import GameScoreboard from "../GameScoreboard";
import { renderStack, stackFinale, stackScoreCells } from "./Stack3D";

export type RelayTurn = {
  relayId: string; turnNo: number; seed: string; blocksPerTurn: number; inputs: RelayInput[]; finalTick: number; height: number;
  startedAt: string; leaseUntil: string;
};
export type RelayTurnOutcome =
  | { kind: "accepted"; placed: number; ended: boolean; height: number }
  | { kind: "refused"; error: string; holder?: string | null }
  | { kind: "left" };

const START_DELAY_MS = 900;
const MAX_STEPS_PER_FRAME = 240;

export default function StackRelayPlay({ turn, onDone }: { turn: RelayTurn; onDone(outcome: RelayTurnOutcome): void }) {
  useI18n();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const metricsRef = useRef<CanvasViewportMetrics | null>(null);
  const stateRef = useRef<Stack3DState | null>(null);
  const inputsRef = useRef<RelayInput[]>([]);
  const epochRef = useRef(0);
  const doneRef = useRef(false);
  const endedAtRef = useRef<number | null>(null);
  const [hud, setHud] = useState({ height: turn.height, left: turn.blocksPerTurn, surface: 0 });
  const [phase, setPhase] = useState<"ready" | "playing" | "sending">("ready");
  const [error, setError] = useState("");
  const doneCb = useRef(onDone);
  useEffect(() => { doneCb.current = onDone; }, [onDone]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext("2d"), s = stateRef.current;
    if (!canvas || !ctx || !s) return;
    metricsRef.current ??= configureLogicalCanvas(canvas, STACK_RELAY_CORE.width, STACK_RELAY_CORE.height, 2, "contain");
    beginLogicalCanvasFrame(ctx, canvas, metricsRef.current);
    renderStack(ctx, s);
    if (s.status === "failed" && endedAtRef.current !== null) stackFinale.render(ctx, s, performance.now() - endedAtRef.current);
  }, []);

  const submit = useCallback(async (s: Stack3DState) => {
    setPhase("sending");
    const body = { action: "submit", relayId: turn.relayId, turnNo: turn.turnNo, inputs: inputsRef.current, finalTick: s.tick };
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch("/api/groups/relay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const d = (await r.json()) as Record<string, unknown>;
        if (r.ok) return doneCb.current({ kind: "accepted", placed: Number(d.placed), ended: d.ended === true, height: Number(d.height) });
        if (r.status < 500) return doneCb.current({ kind: "refused", error: String(d.error ?? r.status), holder: (d.holder as string | null | undefined) ?? null });
      } catch { /* retried below */ }
      await new Promise((ok) => setTimeout(ok, 800 * (attempt + 1)));
    }
    setError(t("relay.sendFailed"));
  }, [turn.relayId, turn.turnNo]);

  // Rebuild the tower once.
  useEffect(() => {
    const rebuilt = rebuildRelay(turn.seed, turn.inputs, turn.finalTick);
    if (!rebuilt.ok) { setError(t("relay.invalid")); return; }
    stateRef.current = rebuilt.state;
    inputsRef.current = [];
    doneRef.current = false;
    endedAtRef.current = null;
    setHud({ height: rebuilt.state.height, left: turn.blocksPerTurn, surface: Math.floor(rebuilt.state.surfaceMilli2 / 1e8) });
    draw();
    const timer = setTimeout(() => { epochRef.current = performance.now(); setPhase("playing"); }, START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [turn, draw]);

  // Real-time loop: the simulation follows the wall clock from the tick the earlier turn closed at.
  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    const startHeight = turn.height, startTick = turn.finalTick;
    const frame = (now: number) => {
      const s = stateRef.current;
      if (!s) return;
      if (!doneRef.current) {
        const target = startTick + Math.floor(((now - epochRef.current) * STACK_RELAY_CORE.tickRate) / 1000);
        let steps = 0;
        while (s.status === "running" && s.tick < target && steps < MAX_STEPS_PER_FRAME) {
          stepCore(STACK_RELAY_CORE, s, Number.MAX_SAFE_INTEGER);
          steps++;
          if (s.height - startHeight >= turn.blocksPerTurn && s.phase === "moving" && s.movingAgeTicks === 0) break;
        }
        const placed = s.height - startHeight;
        if (s.status !== "running" || (placed >= turn.blocksPerTurn && s.phase === "moving" && s.movingAgeTicks === 0)) {
          doneRef.current = true;
          if (s.status !== "running") { endedAtRef.current = now; gameTone("bad"); haptic([12, 18, 28]); } else gameTone("win");
          void submit(s);
        }
        setHud((h) => (h.height === s.height ? h : { height: s.height, left: Math.max(0, turn.blocksPerTurn - (s.height - startHeight)), surface: Math.floor(s.surfaceMilli2 / 1e8) }));
      }
      draw();
      if (!doneRef.current || (endedAtRef.current !== null && now - endedAtRef.current < stackFinale.durationMs)) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, turn, draw, submit]);

  const drop = useCallback(() => {
    const s = stateRef.current;
    if (phase !== "playing" || doneRef.current || !s || s.status !== "running") return;
    const target = turn.finalTick + Math.floor(((performance.now() - epochRef.current) * STACK_RELAY_CORE.tickRate) / 1000);
    while (s.status === "running" && s.tick < target) {
      stepCore(STACK_RELAY_CORE, s, Number.MAX_SAFE_INTEGER);
      if (s.height - turn.height >= turn.blocksPerTurn && s.phase === "moving" && s.movingAgeTicks === 0) return;
    }
    const last = inputsRef.current.at(-1);
    if (last?.tick === s.tick || !STACK_RELAY_CORE.canApply(s, "DROP")) return;
    inputsRef.current.push({ tick: s.tick, action: "DROP" });
    const before = s.score;
    applyCoreInput(STACK_RELAY_CORE, s, "DROP", Number.MAX_SAFE_INTEGER);
    if (s.score > before) { gameTone("good"); haptic(6); }
    draw();
  }, [phase, turn, draw]);

  async function leave() {
    if (phase === "sending") return;
    doneRef.current = true;
    try { await fetch("/api/groups/relay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "release", relayId: turn.relayId }) }); } catch { /* the lease frees it anyway */ }
    doneCb.current({ kind: "left" });
  }

  return (
    <div className="relayPlay" role="dialog" aria-modal="true" aria-label={t("relay.title")}>
      <GameScoreboard cells={[...stackScoreCells({ height: hud.height, surfaceMilli2: hud.surface * 1e8 } as Stack3DState), { label: t("relay.leftLabel"), value: String(hud.left) }]} />
      <canvas ref={canvasRef} className="gameCanvas deterministicCanvas relayCanvas" role="application" aria-label={t("relay.canvas", { n: hud.left })} tabIndex={0}
        onPointerDown={(e) => { e.preventDefault(); drop(); }}
        onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); drop(); } }} />
      <div className="relayBar">
        {phase === "sending" ? <span role="status">{error || t("relay.sending")}</span> : <button type="button" className="relayLeave" onClick={() => void leave()}>{t("relay.leave")}</button>}
        {error && <button type="button" className="relayLeave" onClick={() => doneCb.current({ kind: "refused", error: "NETWORK" })}>{t("relay.back")}</button>}
      </div>
    </div>
  );
}
