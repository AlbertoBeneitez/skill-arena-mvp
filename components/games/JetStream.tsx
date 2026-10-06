"use client";

import { useCallback,useEffect,useRef } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone,haptic } from "@/lib/gameFeedback";

type Props={active:boolean;onFinish:(result:GameResult)=>void};
type Gate={x:number;center:number;passed:boolean};

const W=390,H=620,DT=1/120,PLAYER_X=92,R=12;
const CENTERS=[250,355,205,395,285,180,345,230,380,300,210,365,260,195,330,245];
const SPACING=[210,198,205,188,202,184,196,180,191,177,186,175];

function makeGates(){const a:Gate[]=[];let x=520;for(let i=0;i<10;i++){a.push({x,center:CENTERS[i%CENTERS.length],passed:false});x+=SPACING[i%SPACING.length];}return a;}

export default function JetStream({active,onFinish}:Props){
  const canvasRef=useRef<HTMLCanvasElement|null>(null),rafRef=useRef<number|null>(null),finishRef=useRef(onFinish);
  const thrust=useRef(false);
  const state=useRef({y:H/2,vy:0,scroll:0,gates:makeGates(),next:10,running:false,ticks:0,last:0,acc:0,passed:0,score:0});
  useEffect(()=>{finishRef.current=onFinish;},[onFinish]);

  const speedFor=(p:number)=>Math.min(270,128+p*3);
  const gapFor=(p:number)=>Math.max(92,150-p*1.15);

  const finish=useCallback(()=>{const s=state.current;if(!s.running)return;s.running=false;if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);const timeMs=Math.round(s.ticks*1000/120);gameTone("bad");haptic([30,24,52]);finishRef.current({won:false,score:s.score,timeMs});},[]);

  const extend=useCallback(()=>{const s=state.current,last=s.gates[s.gates.length-1],i=s.next;const c=Math.max(.78,1-Math.floor(s.passed/18)*.035);s.gates.push({x:last.x+SPACING[i%SPACING.length]*c,center:CENTERS[i%CENTERS.length],passed:false});s.next++;if(s.gates.length>18)s.gates.shift();},[]);

  const step=useCallback(()=>{const s=state.current;s.ticks++;const speed=speedFor(s.passed);s.scroll+=speed*DT;
    const accel=thrust.current?-720:700;s.vy+=accel*DT;s.vy=Math.max(-270,Math.min(300,s.vy));s.y+=s.vy*DT;
    if(s.y-R<=0||s.y+R>=H){finish();return;}
    const gap=gapFor(s.passed);
    for(const g of s.gates){const gx=g.x-s.scroll;if(gx<PLAYER_X+R&&gx+30>PLAYER_X-R){if(s.y-R<g.center-gap/2||s.y+R>g.center+gap/2){finish();return;}}
      if(!g.passed&&gx+30<PLAYER_X-R){g.passed=true;s.passed++;const precision=Math.max(0,1-Math.abs(s.y-g.center)/(gap/2));s.score+=280+Math.round(precision*200);gameTone(precision>.72?"good":"tap");if(precision>.72)haptic(7);extend();}}
  },[extend,finish]);

  const draw=useCallback(()=>{const c=canvasRef.current;if(!c)return;const ctx=c.getContext("2d");if(!ctx)return;const s=state.current,gap=gapFor(s.passed);
    const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#6cc7f0");bg.addColorStop(.65,"#dff6ff");bg.addColorStop(1,"#d8d6a5");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    ctx.fillStyle="rgba(255,255,255,.5)";for(let i=0;i<5;i++){const x=((i*130-s.scroll*.18)%(W+180))-70,y=80+(i%2)*75;ctx.beginPath();ctx.arc(x,y,20,0,Math.PI*2);ctx.arc(x+27,y+3,29,0,Math.PI*2);ctx.fill();}
    for(const g of s.gates){const x=g.x-s.scroll;if(x<-50||x>W+40)continue;const top=g.center-gap/2,bottom=g.center+gap/2;ctx.fillStyle="#2f5da8";ctx.fillRect(x,0,30,top);ctx.fillRect(x,bottom,30,H-bottom);ctx.fillStyle="#efc64d";ctx.fillRect(x-3,top-7,36,7);ctx.fillRect(x-3,bottom,36,7);}
    ctx.save();ctx.translate(PLAYER_X,s.y);ctx.rotate(Math.max(-.35,Math.min(.35,s.vy/500)));ctx.shadowBlur=18;ctx.shadowColor="#ffd34f";ctx.fillStyle="#ffd34f";ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(-10,-11);ctx.lineTo(-3,0);ctx.lineTo(-10,11);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.fillStyle="#315fae";ctx.fillRect(-7,-4,10,8);ctx.fillStyle=thrust.current?"#ff8e43":"#8cb7d0";ctx.fillRect(-16,-3,8,6);ctx.restore();
    const speed=speedFor(s.passed);
    ctx.save();
    ctx.fillStyle="rgba(20,43,78,.90)";
    ctx.fillRect(12,12,W-24,66);
    ctx.fillStyle="rgba(255,255,255,.08)";
    ctx.fillRect(134,20,1,50);
    ctx.fillRect(255,20,1,50);

    ctx.textAlign="center";
    ctx.font="800 8px system-ui";
    ctx.fillStyle="#9cc7e8";
    ctx.fillText("PUERTAS",73,31);
    ctx.fillText("PUNTOS",195,31);
    ctx.fillText("RITMO",316,31);

    ctx.font="950 20px system-ui";
    ctx.fillStyle="#fff";
    ctx.fillText(String(s.passed),73,57);
    ctx.fillStyle="#ffd35c";
    ctx.fillText(String(s.score),195,57);
    ctx.fillStyle="#79e4f2";
    ctx.fillText(String(Math.round(speed)),316,57);

    const precisionGate=s.gates.find(g=>!g.passed&&g.x-s.scroll>PLAYER_X);
    if(precisionGate){
      const distance=Math.max(0,Math.min(1,(precisionGate.x-s.scroll-PLAYER_X)/230));
      ctx.fillStyle="rgba(255,255,255,.12)";
      ctx.fillRect(24,68,W-48,4);
      ctx.fillStyle="#66d8ef";
      ctx.fillRect(24,68,(W-48)*(1-distance),4);
    }
    ctx.restore();
    if(s.passed<3){ctx.textAlign="center";ctx.fillStyle="rgba(255,255,255,.62)";ctx.font="900 13px system-ui";ctx.fillText("PULSA PARA SUBIR · SUELTA PARA CAER",W/2,H-26);ctx.textAlign="start";}
  },[]);

  const loop=useCallback((now:number)=>{const s=state.current;if(!s.running)return;if(!s.last)s.last=now;s.acc+=Math.min(.05,(now-s.last)/1000);s.last=now;while(s.acc>=DT&&s.running){step();s.acc-=DT;}draw();if(s.running)rafRef.current=requestAnimationFrame(loop);},[draw,step]);
  const start=useCallback(()=>{state.current={y:H/2,vy:0,scroll:0,gates:makeGates(),next:10,running:true,ticks:0,last:0,acc:0,passed:0,score:0};thrust.current=false;draw();rafRef.current=requestAnimationFrame(loop);},[draw,loop]);
  useEffect(()=>{if(active)start();return()=>{state.current.running=false;if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);};},[active,start]);

  return <div className="gameStage skillGameStage jetStreamArena">
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className="gameCanvas"
      onPointerDown={(event)=>{
        event.currentTarget.setPointerCapture(event.pointerId);
        thrust.current=true;
        gameTone("tap");
        haptic(4);
      }}
      onPointerUp={(event)=>{
        thrust.current=false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={()=>{thrust.current=false;}}
      onPointerLeave={()=>{thrust.current=false;}}
      aria-label="Jet Stream"
    />
  </div>;
}
