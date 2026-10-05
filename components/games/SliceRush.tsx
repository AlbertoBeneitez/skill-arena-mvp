"use client";

import { useCallback,useEffect,useRef,useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone,haptic } from "@/lib/gameFeedback";

type Props={active:boolean;onFinish:(result:GameResult)=>void};
type Target={x:number;y:number;vx:number;vy:number;danger:boolean;alive:boolean;id:number};

const W=390,H=620,DT=1/120;
const X_PATTERN=[70,130,200,275,330,95,245,165,310,55,215,285];
const VX_PATTERN=[95,-118,104,-126,112,-92,132,-108,120,-101,115,-129];
const DANGER_PATTERN=[false,false,false,true,false,false,true,false,false,false,true,false];

export default function SliceRush({active,onFinish}:Props){
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const rafRef=useRef<number|null>(null);
  const finishRef=useRef(onFinish);
  const pointer=useRef<{x:number;y:number;down:boolean}>({x:0,y:0,down:false});
  const state=useRef({targets:[] as Target[],nextSpawn:0,index:0,running:false,ticks:0,last:0,acc:0,score:0,combo:0,spawnEvery:108});
  const [hud,setHud]=useState({score:0,combo:0,speed:1});

  useEffect(()=>{finishRef.current=onFinish;},[onFinish]);

  const finish=useCallback(()=>{
    const s=state.current;if(!s.running)return;s.running=false;
    if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);
    const timeMs=Math.round((s.ticks*1000)/120);gameTone("bad");haptic([30,24,50]);
    finishRef.current({won:false,score:s.score,timeMs});
  },[]);

  const spawn=useCallback(()=>{
    const s=state.current;
    const i=s.index++;
    const cycle=Math.floor(i/X_PATTERN.length);
    const speedScale=1+Math.min(.65,cycle*.055+i*.006);
    const x=X_PATTERN[i%X_PATTERN.length];
    const vx=VX_PATTERN[i%VX_PATTERN.length]*speedScale;
    const danger=DANGER_PATTERN[i%DANGER_PATTERN.length];
    s.targets.push({x,y:H+34,vx,vy:-470*speedScale,danger,alive:true,id:i});
    s.spawnEvery=Math.max(56,108-Math.floor(i/3)*2);
    s.nextSpawn=s.ticks+s.spawnEvery;
  },[]);

  const hitSegmentCircle=(x1:number,y1:number,x2:number,y2:number,cx:number,cy:number,r:number)=>{
    const dx=x2-x1,dy=y2-y1;
    const len2=dx*dx+dy*dy;
    const t=len2===0?0:Math.max(0,Math.min(1,((cx-x1)*dx+(cy-y1)*dy)/len2));
    const px=x1+t*dx,py=y1+t*dy;
    const ox=cx-px,oy=cy-py;
    return ox*ox+oy*oy<=r*r;
  };

  const cut=useCallback((x1:number,y1:number,x2:number,y2:number)=>{
    const s=state.current;if(!s.running)return;
    for(const t of s.targets){
      if(!t.alive)continue;
      if(!hitSegmentCircle(x1,y1,x2,y2,t.x,t.y,25))continue;
      if(t.danger){finish();return;}
      t.alive=false;
      s.combo++;
      s.score+=380+Math.min(600,s.combo*36);
      gameTone(s.combo%5===0?"good":"tap");haptic(s.combo%5===0?10:5);
      setHud({score:s.score,combo:s.combo,speed:Number((1+Math.min(.65,Math.floor(s.index/X_PATTERN.length)*.055+s.index*.006)).toFixed(2))});
    }
  },[finish]);

  const step=useCallback(()=>{
    const s=state.current;s.ticks++;
    if(s.ticks>=s.nextSpawn)spawn();
    for(const t of s.targets){
      if(!t.alive)continue;
      t.vy+=760*DT;t.x+=t.vx*DT;t.y+=t.vy*DT;
      if(t.x<24&&t.vx<0){t.x=24;t.vx*=-1;}
      if(t.x>W-24&&t.vx>0){t.x=W-24;t.vx*=-1;}
      if(!t.danger&&t.y>H+46&&t.vy>0){finish();return;}
      if(t.danger&&t.y>H+60&&t.vy>0)t.alive=false;
    }
    s.targets=s.targets.filter(t=>t.alive||t.y<H+70);
    if(s.ticks%8===0)setHud(v=>({...v,score:s.score,combo:s.combo}));
  },[finish,spawn]);

  const draw=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext("2d");if(!ctx)return;const s=state.current;
    const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#071633");bg.addColorStop(1,"#20103b");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle="rgba(99,150,230,.08)";for(let x=20;x<W;x+=34){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(const t of s.targets){
      if(!t.alive)continue;
      ctx.save();ctx.translate(t.x,t.y);ctx.rotate((s.ticks+t.id*5)*.025);
      ctx.shadowBlur=18;ctx.shadowColor=t.danger?"#ff5b6c":"#65e2ff";
      ctx.fillStyle=t.danger?"#ef5365":"#4fc9e8";
      ctx.beginPath();ctx.moveTo(0,-25);ctx.lineTo(22,-7);ctx.lineTo(14,22);ctx.lineTo(-14,22);ctx.lineTo(-22,-7);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
      ctx.fillStyle="#fff";ctx.font="900 14px system-ui";ctx.textAlign="center";ctx.fillText(t.danger?"×":"✦",0,5);ctx.restore();
    }
    if(pointer.current.down){ctx.strokeStyle="rgba(255,255,255,.65)";ctx.lineWidth=5;ctx.lineCap="round";ctx.beginPath();ctx.arc(pointer.current.x,pointer.current.y,11,0,Math.PI*2);ctx.stroke();}
    ctx.fillStyle="rgba(7,14,34,.84)";ctx.fillRect(14,14,W-28,52);ctx.font="800 12px system-ui";ctx.fillStyle="#fff";ctx.fillText(`${s.score.toLocaleString("es-ES")} PTS`,26,36);ctx.fillStyle="#ffdc67";ctx.fillText(`COMBO ×${s.combo}`,165,36);ctx.fillStyle="#7ce3a7";ctx.fillText(`NIVEL ${1+Math.floor(s.index/12)}`,300,36);
  },[]);

  const loop=useCallback((now:number)=>{const s=state.current;if(!s.running)return;if(!s.last)s.last=now;s.acc+=Math.min(.05,(now-s.last)/1000);s.last=now;while(s.acc>=DT&&s.running){step();s.acc-=DT;}draw();if(s.running)rafRef.current=requestAnimationFrame(loop);},[draw,step]);

  const start=useCallback(()=>{state.current={targets:[],nextSpawn:30,index:0,running:true,ticks:0,last:0,acc:0,score:0,combo:0,spawnEvery:108};pointer.current={x:0,y:0,down:false};setHud({score:0,combo:0,speed:1});draw();rafRef.current=requestAnimationFrame(loop);},[draw,loop]);
  useEffect(()=>{if(active)start();return()=>{state.current.running=false;if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);};},[active,start]);

  function point(e:React.PointerEvent<HTMLCanvasElement>){const r=e.currentTarget.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H};}

  return <div className="gameStage skillGameStage sliceRushArena">
    <canvas ref={canvasRef} width={W} height={H} className="gameCanvas"
      onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);const p=point(e);pointer.current={...p,down:true};}}
      onPointerMove={e=>{if(!pointer.current.down)return;const p=point(e);cut(pointer.current.x,pointer.current.y,p.x,p.y);pointer.current={...p,down:true};}}
      onPointerUp={()=>{pointer.current.down=false;}} onPointerCancel={()=>{pointer.current.down=false;}} aria-label="Slice Rush"/>
    <div className="sliceRushHud"><span>AZUL = CORTA</span><b>{hud.score.toLocaleString("es-ES")}</b><span>ROJO = EVITA</span></div>
    <div className="gameRule">Los objetivos salen siempre en el mismo patrón · cada ciclo acelera</div>
  </div>;
}
