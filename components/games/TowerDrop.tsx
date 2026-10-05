"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props={active:boolean;onFinish:(result:GameResult)=>void};
type Block={x:number;y:number;w:number};

const W=390,H=620,DT=1/120,BLOCK_H=28,START_W=228;

export default function TowerDrop({active,onFinish}:Props){
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const rafRef=useRef<number|null>(null);
  const finishRef=useRef(onFinish);
  const state=useRef({
    blocks:[] as Block[],movingX:8,movingW:START_W,dir:1,speed:132,running:false,
    ticks:0,last:0,acc:0,score:0,combo:0,bounces:0,cameraY:0
  });
  const [hud,setHud]=useState({height:0,combo:0,score:0});

  useEffect(()=>{finishRef.current=onFinish;},[onFinish]);

  const finish=useCallback(()=>{
    const s=state.current;
    if(!s.running)return;
    s.running=false;
    if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);
    const timeMs=Math.round((s.ticks*1000)/120);
    gameTone("bad");haptic([28,24,50]);
    finishRef.current({won:false,score:s.score,timeMs});
  },[]);

  const place=useCallback(()=>{
    const s=state.current;
    if(!s.running)return;
    const top=s.blocks[s.blocks.length-1];
    const y=H-92-s.blocks.length*BLOCK_H;
    const left=Math.max(s.movingX,top.x);
    const right=Math.min(s.movingX+s.movingW,top.x+top.w);
    const overlap=right-left;
    if(overlap<=1){finish();return;}

    const precision=overlap/top.w;
    const perfect=precision>.975;
    s.score+=360+Math.round(precision*420)+(perfect?240:0)+s.combo*28;
    s.combo=perfect?s.combo+1:0;
    s.blocks.push({x:left,y,w:overlap});
    s.movingW=overlap;
    s.dir*=-1;
    s.movingX=s.dir>0?8:W-overlap-8;
    s.speed=Math.min(320,132+(s.blocks.length-1)*6.5);
    s.bounces=0;
    s.cameraY=Math.max(0,(s.blocks.length-12)*BLOCK_H);
    setHud({height:s.blocks.length-1,combo:s.combo,score:s.score});
    gameTone(perfect?"good":"tap");haptic(perfect?12:6);
  },[finish]);

  const step=useCallback(()=>{
    const s=state.current;
    s.ticks++;
    s.movingX+=s.dir*s.speed*DT;
    if(s.movingX<=8){s.movingX=8;s.dir=1;s.bounces++;}
    if(s.movingX+s.movingW>=W-8){s.movingX=W-8-s.movingW;s.dir=-1;s.bounces++;}
    if(s.bounces>=5)finish();
  },[finish]);

  const draw=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");if(!ctx)return;
    const s=state.current;
    const bg=ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,"#6fc7ef");bg.addColorStop(.58,"#d7f0f6");bg.addColorStop(1,"#efcf90");
    ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    ctx.fillStyle="rgba(255,255,255,.55)";
    for(let i=0;i<5;i++){const x=((i*126-s.ticks*.15)%(W+150))-60;const y=82+(i%2)*58;ctx.beginPath();ctx.arc(x,y,22,0,Math.PI*2);ctx.arc(x+28,y+5,31,0,Math.PI*2);ctx.fill();}
    ctx.save();ctx.translate(0,s.cameraY);
    s.blocks.forEach((b,i)=>{
      const palette=["#4c7ed7","#6f63d7","#c764bd","#e8894c","#45b783","#d9ad3f"];
      ctx.fillStyle=palette[i%palette.length];ctx.fillRect(b.x,b.y,b.w,BLOCK_H-3);
      ctx.fillStyle="rgba(255,255,255,.35)";ctx.fillRect(b.x+4,b.y+4,Math.max(0,b.w-8),4);
    });
    const movingY=H-92-s.blocks.length*BLOCK_H;
    ctx.shadowBlur=14;ctx.shadowColor="#315fae";ctx.fillStyle="#315fae";
    ctx.fillRect(s.movingX,movingY,s.movingW,BLOCK_H-3);ctx.shadowBlur=0;ctx.restore();

    ctx.fillStyle="rgba(38,58,91,.86)";ctx.fillRect(14,14,W-28,54);
    ctx.font="800 12px system-ui";ctx.fillStyle="#fff";ctx.fillText(`ALTURA ${Math.max(0,s.blocks.length-1)}`,26,37);
    ctx.fillStyle=s.combo>1?"#ffdc65":"#c9d8f3";ctx.fillText(`PERFECT ×${s.combo}`,145,37);
    ctx.fillStyle="#78e2a4";ctx.fillText(`${s.score.toLocaleString("es-ES")}`,300,37);
  },[]);

  const loop=useCallback((now:number)=>{
    const s=state.current;if(!s.running)return;
    if(!s.last)s.last=now;
    s.acc+=Math.min(.05,(now-s.last)/1000);s.last=now;
    while(s.acc>=DT&&s.running){step();s.acc-=DT;}
    draw();if(s.running)rafRef.current=requestAnimationFrame(loop);
  },[draw,step]);

  const start=useCallback(()=>{
    const base={x:(W-START_W)/2,y:H-92,w:START_W};
    state.current={blocks:[base],movingX:8,movingW:START_W,dir:1,speed:132,running:true,ticks:0,last:0,acc:0,score:0,combo:0,bounces:0,cameraY:0};
    setHud({height:0,combo:0,score:0});draw();rafRef.current=requestAnimationFrame(loop);
  },[draw,loop]);

  useEffect(()=>{if(active)start();return()=>{state.current.running=false;if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);};},[active,start]);

  return <div className="gameStage skillGameStage towerDropArena">
    <canvas ref={canvasRef} width={W} height={H} className="gameCanvas" onPointerDown={place} aria-label="Tower Drop"/>
    <div className="towerDropHud"><div><small>ALTURA</small><strong>{hud.height}</strong></div><button onPointerDown={place}>SOLTAR</button><div><small>COMBO</small><strong>×{hud.combo}</strong></div></div>
    <div className="gameRule">Cada bloque acelera ligeramente · sin solape, termina</div>
  </div>;
}
