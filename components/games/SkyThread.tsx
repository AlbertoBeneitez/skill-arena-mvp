"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = { active: boolean; onFinish: (result: GameResult) => void };
type Gate = { x: number; center: number; passed: boolean };

const W = 390;
const H = 620;
const DT = 1 / 120;
const BALL_X = 92;
const BALL_R = 11;
const GRAVITY = 920;
const IMPULSE = -335;
const OPENINGS = [265,330,220,370,285,190,345,245,395,310,215,360,275,205,335,250];
const SPACING = [205,196,188,202,184,194,180,190,178,186,176,182];

function makeGates(): Gate[] {
  const gates: Gate[] = [];
  let x = 520;
  for (let i = 0; i < 10; i++) {
    gates.push({ x, center: OPENINGS[i % OPENINGS.length], passed: false });
    x += SPACING[i % SPACING.length];
  }
  return gates;
}

export default function SkyThread({ active, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const state = useRef({
    y: H / 2,
    vy: 0,
    gates: makeGates(),
    nextIndex: 10,
    scroll: 0,
    running: false,
    ticks: 0,
    last: 0,
    acc: 0,
    passed: 0,
    score: 0,
    centerBonus: 0,
  });
  const [hud, setHud] = useState({ passed: 0, score: 0, speed: 1 });

  useEffect(() => { finishRef.current = onFinish; }, [onFinish]);

  const speedFor = (passed: number) => Math.min(255, 125 + passed * 3.2);
  const gapFor = (passed: number) => Math.max(94, 146 - passed * 1.25);

  const finish = useCallback(() => {
    const s = state.current;
    if (!s.running) return;
    s.running = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const timeMs = Math.round((s.ticks * 1000) / 120);
    const score = Math.max(0, s.score + s.centerBonus + Math.round(timeMs / 42));
    gameTone("bad");
    haptic([32,28,52]);
    finishRef.current({ won: false, score, timeMs });
  }, []);

  const extendGate = useCallback(() => {
    const s = state.current;
    const lastGate = s.gates[s.gates.length - 1];
    const i = s.nextIndex;
    const compression = Math.max(.78, 1 - Math.floor(s.passed / 18) * .035);
    s.gates.push({
      x: lastGate.x + SPACING[i % SPACING.length] * compression,
      center: OPENINGS[i % OPENINGS.length],
      passed: false,
    });
    s.nextIndex += 1;
    if (s.gates.length > 18) s.gates.shift();
  }, []);

  const step = useCallback(() => {
    const s = state.current;
    s.ticks += 1;
    const speed = speedFor(s.passed);
    s.scroll += speed * DT;
    s.vy += GRAVITY * DT;
    s.y += s.vy * DT;

    if (s.y - BALL_R <= 0 || s.y + BALL_R >= H) {
      finish();
      return;
    }

    const gap = gapFor(s.passed);
    for (const gate of s.gates) {
      const gx = gate.x - s.scroll;
      const gateWidth = 30;
      const horizontal = BALL_X + BALL_R > gx && BALL_X - BALL_R < gx + gateWidth;
      if (horizontal) {
        const topEdge = gate.center - gap / 2;
        const bottomEdge = gate.center + gap / 2;
        if (s.y - BALL_R < topEdge || s.y + BALL_R > bottomEdge) {
          finish();
          return;
        }
      }
      if (!gate.passed && gx + gateWidth < BALL_X - BALL_R) {
        gate.passed = true;
        s.passed += 1;
        const offset = Math.abs(s.y - gate.center);
        const precision = Math.max(0, 1 - offset / (gap / 2));
        s.score += 260 + Math.round(precision * 190);
        s.centerBonus += Math.round(precision * 55);
        gameTone(precision > .72 ? "good" : "tap");
        if (precision > .72) haptic(8);
        extendGate();
      }
    }

    if (s.ticks % 5 === 0) {
      setHud({ passed: s.passed, score: s.score, speed: Number((speed / 125).toFixed(2)) });
    }
  }, [extendGate, finish]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = state.current;
    const gap = gapFor(s.passed);

    const sky = ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,"#6fc9f1");
    sky.addColorStop(.62,"#d8f4ff");
    sky.addColorStop(1,"#f6dfaa");
    ctx.fillStyle = sky;
    ctx.fillRect(0,0,W,H);

    ctx.fillStyle = "rgba(255,255,255,.55)";
    for (let i=0;i<5;i++) {
      const x = ((i*128 - s.scroll*.16) % (W+180)) - 70;
      const y = 92 + (i%2)*70;
      ctx.beginPath();
      ctx.arc(x,y,22,0,Math.PI*2);
      ctx.arc(x+28,y+4,31,0,Math.PI*2);
      ctx.arc(x+57,y,19,0,Math.PI*2);
      ctx.fill();
    }

    s.gates.forEach((gate,index) => {
      const x = gate.x - s.scroll;
      if (x < -60 || x > W + 40) return;
      const topEdge = gate.center - gap/2;
      const bottomEdge = gate.center + gap/2;
      const shade = index % 2 ? "#315fae" : "#3d74c6";
      ctx.fillStyle = shade;
      ctx.fillRect(x,0,30,topEdge);
      ctx.fillRect(x,bottomEdge,30,H-bottomEdge);
      ctx.fillStyle = "#f1c64e";
      ctx.fillRect(x-3,topEdge-8,36,8);
      ctx.fillRect(x-3,bottomEdge,36,8);
    });

    ctx.save();
    ctx.translate(BALL_X,s.y);
    ctx.rotate(Math.max(-.45,Math.min(.45,s.vy/500)));
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#fff";
    ctx.fillStyle = "#ffd34f";
    ctx.beginPath();
    ctx.moveTo(14,0); ctx.lineTo(-10,-11); ctx.lineTo(-4,0); ctx.lineTo(-10,11); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#315fae";
    ctx.fillRect(-7,-4,10,8);
    ctx.restore();

    ctx.fillStyle = "rgba(32,54,89,.84)";
    ctx.fillRect(14,14,W-28,52);
    ctx.fillStyle = "#fff";
    ctx.font = "800 12px system-ui";
    ctx.fillText(`PUERTAS ${s.passed}`,26,36);
    ctx.fillStyle = "#ffdd69";
    ctx.fillText(`${s.score.toLocaleString("es-ES")} PTS`,152,36);
    ctx.fillStyle = "#7fe3aa";
    ctx.fillText(`×${(speedFor(s.passed)/125).toFixed(2)}`,310,36);
  }, []);

  const loop = useCallback((now:number) => {
    const s = state.current;
    if (!s.running) return;
    if (!s.last) s.last = now;
    s.acc += Math.min(.05,(now-s.last)/1000);
    s.last = now;
    while (s.acc >= DT && s.running) {
      step();
      s.acc -= DT;
    }
    draw();
    if (s.running) rafRef.current = requestAnimationFrame(loop);
  }, [draw,step]);

  const start = useCallback(() => {
    state.current = {
      y:H/2, vy:0, gates:makeGates(), nextIndex:10, scroll:0, running:true,
      ticks:0,last:0,acc:0,passed:0,score:0,centerBonus:0,
    };
    setHud({passed:0,score:0,speed:1});
    draw();
    rafRef.current = requestAnimationFrame(loop);
  }, [draw,loop]);

  useEffect(() => {
    if (active) start();
    return () => {
      state.current.running = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active,start]);

  function flap() {
    const s = state.current;
    if (!s.running) return;
    s.vy = IMPULSE;
    gameTone("tap");
    haptic(4);
  }

  return (
    <div className="gameStage skillGameStage skyThreadArena" onPointerDown={flap}>
      <canvas ref={canvasRef} width={W} height={H} className="gameCanvas" aria-label="Sky Thread" />
      <div className="skyThreadHud">
        <div><small>PUERTAS</small><strong>{hud.passed}</strong></div>
        <button onPointerDown={(e)=>{e.stopPropagation();flap();}}>IMPULSO</button>
        <div><small>VELOCIDAD</small><strong>×{hud.speed}</strong></div>
      </div>
      <div className="gameRule">Mantén el vuelo · el primer choque termina la partida</div>
    </div>
  );
}
