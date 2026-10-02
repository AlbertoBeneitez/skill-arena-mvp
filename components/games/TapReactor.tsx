"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = { active: boolean; onFinish: (result: GameResult) => void };
type Target = { x: number; y: number };

const W = 390;
const H = 620;
const TARGETS: Target[] = [
  {x:92,y:180},{x:300,y:155},{x:210,y:292},{x:82,y:388},{x:302,y:410},
  {x:168,y:505},{x:315,y:280},{x:118,y:270},{x:250,y:475},{x:205,y:150},
  {x:70,y:320},{x:330,y:350},{x:150,y:430},{x:275,y:220},{x:205,y:355},
];

export default function TapReactor({ active, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const state = useRef({
    index:0,
    score:0,
    combo:0,
    running:false,
    startedAt:0,
    targetAt:0,
    now:0,
  });
  const [hud,setHud] = useState({index:0,score:0,combo:0,left:1});

  useEffect(()=>{finishRef.current=onFinish;},[onFinish]);

  function radiusFor(index:number) {
    return Math.max(20,34-Math.floor(index/5)*2);
  }
  function windowFor(index:number) {
    return Math.max(430,1050-index*24);
  }

  const finish = useCallback(() => {
    const s=state.current;
    if(!s.running) return;
    s.running=false;
    if(frameRef.current!==null) cancelAnimationFrame(frameRef.current);
    const timeMs=Math.round(performance.now()-s.startedAt);
    gameTone("bad");
    haptic([28,25,52]);
    finishRef.current({won:false,score:s.score,timeMs});
  },[]);

  const draw = useCallback(() => {
    const canvas=canvasRef.current;
    if(!canvas) return;
    const ctx=canvas.getContext("2d");
    if(!ctx) return;
    const s=state.current;
    const target=TARGETS[s.index%TARGETS.length];
    const cycle=Math.floor(s.index/TARGETS.length);
    const mirror=cycle%2===1;
    const tx=mirror?W-target.x:target.x;
    const ty=target.y;
    const radius=radiusFor(s.index);
    const windowMs=windowFor(s.index);
    const elapsed=Math.max(0,s.now-s.targetAt);
    const left=Math.max(0,1-elapsed/windowMs);

    const bg=ctx.createRadialGradient(W/2,H/2,20,W/2,H/2,360);
    bg.addColorStop(0,"#243a72");
    bg.addColorStop(.65,"#111b3d");
    bg.addColorStop(1,"#080e24");
    ctx.fillStyle=bg;
    ctx.fillRect(0,0,W,H);

    ctx.strokeStyle="rgba(111,173,255,.09)";
    ctx.lineWidth=1;
    for(let x=20;x<W;x+=34){ctx.beginPath();ctx.moveTo(x,80);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=90;y<H;y+=34){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

    ctx.beginPath();
    ctx.arc(tx,ty,radius+16,0,Math.PI*2);
    ctx.strokeStyle="rgba(255,221,91,.18)";
    ctx.lineWidth=10;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(tx,ty,radius+10,-Math.PI/2,-Math.PI/2+Math.PI*2*left);
    ctx.strokeStyle=left>.32?"#ffdd69":"#ff6878";
    ctx.lineWidth=6;
    ctx.lineCap="round";
    ctx.stroke();

    ctx.shadowBlur=22;
    ctx.shadowColor="#65dfff";
    ctx.fillStyle="#53cce9";
    ctx.beginPath();
    ctx.arc(tx,ty,radius,0,Math.PI*2);
    ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle="#fff";
    ctx.beginPath();
    ctx.arc(tx-6,ty-7,Math.max(4,radius*.22),0,Math.PI*2);
    ctx.fill();

    ctx.fillStyle="rgba(8,15,36,.85)";
    ctx.fillRect(14,14,W-28,52);
    ctx.fillStyle="#fff";
    ctx.font="800 12px system-ui";
    ctx.fillText(`NÚCLEOS ${s.index}`,26,36);
    ctx.fillStyle="#ffdd69";
    ctx.fillText(`COMBO ×${s.combo}`,150,36);
    ctx.fillStyle="#7fe3aa";
    ctx.fillText(`${s.score.toLocaleString("es-ES")}`,300,36);
  },[]);

  const loop=useCallback((now:number)=>{
    const s=state.current;
    if(!s.running) return;
    s.now=now;
    if(now-s.targetAt>windowFor(s.index)){
      finish();
      return;
    }
    if(s.index%2===0||Math.round(now)%2===0) {
      const left=Math.max(0,1-(now-s.targetAt)/windowFor(s.index));
      setHud({index:s.index,score:s.score,combo:s.combo,left});
    }
    draw();
    frameRef.current=requestAnimationFrame(loop);
  },[draw,finish]);

  const start=useCallback(()=>{
    const now=performance.now();
    state.current={index:0,score:0,combo:0,running:true,startedAt:now,targetAt:now,now};
    setHud({index:0,score:0,combo:0,left:1});
    draw();
    frameRef.current=requestAnimationFrame(loop);
  },[draw,loop]);

  useEffect(()=>{
    if(active) start();
    return()=>{state.current.running=false;if(frameRef.current!==null)cancelAnimationFrame(frameRef.current);};
  },[active,start]);

  function tap(clientX:number,clientY:number){
    const s=state.current;
    if(!s.running) return;
    const canvas=canvasRef.current;
    if(!canvas) return;
    const rect=canvas.getBoundingClientRect();
    const x=((clientX-rect.left)/rect.width)*W;
    const y=((clientY-rect.top)/rect.height)*H;
    const target=TARGETS[s.index%TARGETS.length];
    const cycle=Math.floor(s.index/TARGETS.length);
    const tx=cycle%2===1?W-target.x:target.x;
    const ty=target.y;
    const radius=radiusFor(s.index);
    const dx=x-tx;
    const dy=y-ty;
    const distance=Math.sqrt(dx*dx+dy*dy);
    if(distance>radius){
      finish();
      return;
    }
    const elapsed=performance.now()-s.targetAt;
    const speedScore=Math.max(0,520-Math.round(elapsed*.28));
    const precision=Math.max(0,1-distance/radius);
    s.score+=480+speedScore+Math.round(precision*360)+s.combo*22;
    s.combo+=1;
    s.index+=1;
    s.targetAt=performance.now();
    s.now=s.targetAt;
    setHud({index:s.index,score:s.score,combo:s.combo,left:1});
    gameTone(precision>.72?"good":"tap");
    haptic(precision>.72?10:5);
    draw();
  }

  return (
    <div className="gameStage skillGameStage tapReactorArena">
      <canvas ref={canvasRef} width={W} height={H} className="gameCanvas" onPointerDown={(e)=>tap(e.clientX,e.clientY)} aria-label="Tap Reactor" />
      <div className="tapReactorHud">
        <div><small>ACIERTOS</small><strong>{hud.index}</strong></div>
        <div className="reactorTime"><i style={{width:`${hud.left*100}%`}} /></div>
        <div><small>COMBO</small><strong>×{hud.combo}</strong></div>
      </div>
      <div className="gameRule">Toca el núcleo antes de que cierre el anillo · un fallo termina la partida</div>
    </div>
  );
}
