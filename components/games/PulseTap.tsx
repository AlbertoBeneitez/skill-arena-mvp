"use client";

import { useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";

type Props = { active: boolean; onFinish: (result: GameResult) => void };

export default function PulseTap({ active, onFinish }: Props) {
  const [running, setRunning] = useState(false);
  const [round, setRound] = useState(0);
  const [marker, setMarker] = useState(0);
  const [score, setScore] = useState(0);
  const frame = useRef<number | null>(null);
  const startAt = useRef(0);
  const last = useRef(0);
  const direction = useRef(1);
  const markerRef = useRef(0);
  const scoreRef = useRef(0);
  const roundRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    setRunning(true);
    setRound(0);
    setMarker(0);
    setScore(0);
    markerRef.current = 0;
    scoreRef.current = 0;
    roundRef.current = 0;
    direction.current = 1;
    startAt.current = performance.now();
    last.current = startAt.current;

    const loop = (now: number) => {
      const dt = Math.min(0.04, (now - last.current) / 1000);
      last.current = now;
      let next = markerRef.current + direction.current * dt * 92;
      if (next >= 100) { next = 100; direction.current = -1; }
      if (next <= 0) { next = 0; direction.current = 1; }
      markerRef.current = next;
      setMarker(next);
      frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
    return () => { if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [active]);

  function tap() {
    if (!running) return;
    const accuracy = Math.max(0, 100 - Math.abs(markerRef.current - 50) * 4);
    const newScore = scoreRef.current + Math.round(accuracy);
    scoreRef.current = newScore;
    setScore(newScore);
    const nextRound = roundRef.current + 1;
    roundRef.current = nextRound;
    setRound(nextRound);
    if (nextRound >= 5) {
      setRunning(false);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      const timeMs = Math.round(performance.now() - startAt.current);
      onFinish({ won: newScore >= 360, score: newScore, timeMs });
    }
  }

  return (
    <div className="miniGame gameStage">
      <div className="miniGameTitle">PULSE TAP</div>
      <div className="miniGameHint">5 intentos · toca cuando la línea esté en el centro</div>
      <div className="pulseTrack" onPointerDown={tap}>
        <div className="pulseTarget" />
        <div className="pulseMarker" style={{ left: `calc(${marker}% - 3px)` }} />
      </div>
      <div className="miniStats"><span>{round}/5</span><span>{score} pts</span></div>
      <button className="jumpButton" onPointerDown={tap} disabled={!running}>TOCAR</button>
    </div>
  );
}
