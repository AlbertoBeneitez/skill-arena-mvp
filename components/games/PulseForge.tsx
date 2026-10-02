"use client";

import { useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = { active: boolean; onFinish: (result: GameResult) => void };

const TARGETS = [50, 28, 72, 38, 62, 20, 80, 46, 68, 34, 57, 24, 76, 42];
const SPEEDS = [58, 64, 70, 76, 82, 88, 94, 102, 110, 118, 126, 134];

export default function PulseForge({ active, onFinish }: Props) {
  const [marker, setMarker] = useState(0);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [running, setRunning] = useState(false);
  const frameRef = useRef<number | null>(null);
  const state = useRef({ marker: 0, direction: 1, last: 0, ticks: 0, score: 0, combo: 0, running: false });
  const finishRef = useRef(onFinish);

  useEffect(() => { finishRef.current = onFinish; }, [onFinish]);

  function targetFor(index: number) {
    const center = TARGETS[index % TARGETS.length];
    const cycle = Math.floor(index / TARGETS.length);
    const width = Math.max(7, 18 - cycle * 1.6 - Math.floor(index / 4) * .35);
    return { center, width };
  }

  function speedFor(index: number) {
    return SPEEDS[Math.min(SPEEDS.length - 1, index)] + Math.floor(index / SPEEDS.length) * 8;
  }

  function finish() {
    const s = state.current;
    if (!s.running) return;
    s.running = false;
    setRunning(false);
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    const timeMs = Math.round((s.ticks * 1000) / 60);
    gameTone("bad");
    haptic([30, 28, 48]);
    finishRef.current({ won: false, score: s.score, timeMs });
  }

  function hit() {
    const s = state.current;
    if (!s.running) return;
    const target = targetFor(round);
    const distance = Math.abs(s.marker - target.center);
    if (distance > target.width / 2) {
      finish();
      return;
    }

    const precision = Math.max(0, 1 - distance / (target.width / 2));
    const perfect = precision > .72;
    const gain = 520 + Math.round(precision * 420) + s.combo * 24;
    s.score += gain;
    s.combo += 1;
    setScore(s.score);
    setCombo(s.combo);
    setRound((value) => value + 1);
    gameTone(perfect ? "good" : "tap");
    haptic(perfect ? 12 : 6);
  }

  useEffect(() => {
    if (!active) return;
    state.current = { marker: 0, direction: 1, last: performance.now(), ticks: 0, score: 0, combo: 0, running: true };
    setMarker(0);
    setRound(0);
    setScore(0);
    setCombo(0);
    setRunning(true);

    const loop = (now: number) => {
      const s = state.current;
      if (!s.running) return;
      const dt = Math.min(.04, (now - s.last) / 1000);
      s.last = now;
      s.ticks += 1;
      let next = s.marker + s.direction * dt * speedFor(round);
      if (next >= 100) { next = 100; s.direction = -1; }
      if (next <= 0) { next = 0; s.direction = 1; }
      s.marker = next;
      setMarker(next);
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => {
      state.current.running = false;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [active, round]);

  const target = targetFor(round);
  const left = target.center - target.width / 2;

  return (
    <div className="gameStage pulseForgeArena">
      <div className="pulseForgeHeader">
        <div><small>RACHA</small><strong>×{combo}</strong></div>
        <div><small>PUNTOS</small><strong>{score.toLocaleString("es-ES")}</strong></div>
        <div><small>VELOCIDAD</small><strong>{speedFor(round)}</strong></div>
      </div>
      <div className="pulseForgeCore">
        <div className="pulseForgeTitle">PULSE FORGE</div>
        <div className="pulseForgeSub">Toca dentro de la zona. Cada acierto aprieta el margen.</div>
        <div className="pulseForgeTrack" onPointerDown={hit}>
          <div className="pulseForgeTarget" style={{ left: `${left}%`, width: `${target.width}%` }} />
          <div className="pulseForgePerfect" style={{ left: `${target.center - target.width * .18}%`, width: `${target.width * .36}%` }} />
          <div className="pulseForgeMarker" style={{ left: `calc(${marker}% - 4px)` }} />
        </div>
        <div className="pulseForgeRound">PULSO {round + 1}</div>
        <button className="pulseForgeButton" onPointerDown={hit} disabled={!running}>GOLPEAR</button>
      </div>
      <div className="gameRule">Acierta para continuar · un solo fallo termina la partida</div>
    </div>
  );
}
