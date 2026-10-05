"use client";

import { useCallback,useEffect,useRef,useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone,haptic } from "@/lib/gameFeedback";

type Props={active:boolean;onFinish:(result:GameResult)=>void};
type Panel={lane:0|1|2;y:number;speed:number;hit:boolean;id:number};

const W=390,H=620,IMPACT_Y=515,LANE_X=[95,195,295] as const;
const LANE_PATTERN:Array<0|1|2>=[1,0,2,1,2,0,0,2,1,1,0,2,2,1,0,1];
const GAP_PATTERN=[92,84,98,80,90,76,86,74,82,72,79,70];

export default function ShatterShot({active,onFinish}:Props){
  const canvasRef=useRef<HTMLCanvasElement|null>(null),rafRef=useRef<number|null>(null),finishRef=useRef(onFinish);
  const state=useRef({panels:[] as Panel[],index:0,ticks:0,nextSpawn:24,running:false,last:0,score:0,combo:0});
  const [hud,setHud]=useState({hits:0,score:0,combo:0});
  useEffect(()=>{finishRef.current=onFinish;},[onFinish]);

  const finish=useCallback(()=>{const s=state.current;if(!s.running)return;s.running=false;if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);const timeMs=Math.round(s.ticks*1000/60);gameTone("bad");haptic([30,25,52]);finishRef.current({won:false,score:s.score,timeMs});},[]);

  const spawn=useCallback(()=>{const s=state.current,i=s.index++;const level=Math.floor(i/8);const speed=Math.min(5.7,2.55+level*.18);s.panels.push({lane:LANE_PATTERN[i%LANE_PATTERN.length],y:82,speed,hit:false,id:i});const gap=Math.max(44,GAP_PATTERN[i%GAP_PATTERN.length]-level*2);s.nextSpawn=s.ticks+gap;},[]);

  const tap=useCallback((clientX:number,clientY:number)=>{const c=canvasRef.current,s=state.current;if(!c||!s.running)return;const r=c.getBoundingClientRect();const x=(clientX-r.left)/r.width*W,y=(clientY-r.top)/r.height*H;
    let best:Panel|null=null,bestD=Infinity;
    for(const p of s.panels){if(p.hit)continue;const px=LANE_X[p.lane],d=Math.hypot(x-px,y-p.y);if(d<bestD){bestD=d;best=p;}}
    if(!best||bestD>42){finish();return;}
    best.hit=true;s.combo++;const urgency=Math.max(0,Math.min(1,best.y/IMPACT_Y));s.score+=380+Math.round(urgency*360)+Math.min(500,s.combo*24);gameTone(s.combo%5===0?"good":"tap");haptic(s.combo%5===0?10:5);setHud({hits:s.index-s.panels.filter(p=>!p.hit).length,score:s.score,combo:s.combo});
  },[finish]);

  const loop=useCallback((now:number)=>{const s=state.current;if(!s.running)return;const dt=s.last?Math.min(.04,(now-s.last)/16.666):1;s.last=now;s.ticks++;
    if(s.ticks>=s.nextSpawn)spawn();
    for(const p of s.panels){if(p.hit)continue;p.y+=p.speed*dt;if(p.y>=IMPACT_Y){finish();return;}}
    s.panels=s.panels.filter(p=>!p.hit&&p.y<H+50);
    setHud(v=>({...v,score:s.score,combo:s.combo}));
    const c=canvasRef.current;if(c){const ctx=c.getContext("2d");if(ctx){const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#07132f");bg.addColorStop(1,"#162b48");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
      ctx.strokeStyle="rgba(104,173,255,.12)";ctx.lineWidth=2;[95,195,295].forEach(x=>{ctx.beginPath();ctx.moveTo(W/2,72);ctx.lineTo(x,H);ctx.stroke();});
      ctx.strokeStyle="#ef5b69";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(38,IMPACT_Y);ctx.lineTo(W-38,IMPACT_Y);ctx.stroke();
      for(const p of s.panels){const x=LANE_X[p.lane],scale=.55+Math.min(1,p.y/IMPACT_Y)*.6;ctx.save();ctx.translate(x,p.y);ctx.scale(scale,scale);ctx.shadowBlur=18;ctx.shadowColor="#6de6ff";ctx.fillStyle="rgba(78,204,235,.75)";ctx.fillRect(-28,-22,56,44);ctx.strokeStyle="#b8f3ff";ctx.lineWidth=3;ctx.strokeRect(-28,-22,56,44);ctx.shadowBlur=0;ctx.fillStyle="#fff";ctx.font="900 16px system-ui";ctx.textAlign="center";ctx.fillText("✦",0,6);ctx.restore();}
      ctx.fillStyle="rgba(7,14,34,.84)";ctx.fillRect(14,14,W-28,52);ctx.font="800 12px system-ui";ctx.fillStyle="#fff";ctx.fillText(`ROMPIDOS ${s.index-s.panels.length}`,26,36);ctx.fillStyle="#ffdc67";ctx.fillText(`COMBO ×${s.combo}`,150,36);ctx.fillStyle="#78e3a5";ctx.fillText(`NIVEL ${1+Math.floor(s.index/8)}`,300,36);
    }}}
    if(s.running)rafRef.current=requestAnimationFrame(loop);
  },[finish,spawn]);

  const start=useCallback(()=>{state.current={panels:[],index:0,ticks:0,nextSpawn:24,running:true,last:0,score:0,combo:0};setHud({hits:0,score:0,combo:0});rafRef.current=requestAnimationFrame(loop);},[loop]);
  useEffect(()=>{if(active)start();return()=>{state.current.running=false;if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);};},[active,start]);

  return <div className="gameStage skillGameStage shatterShotArena">
    <canvas ref={canvasRef} width={W} height={H} className="gameCanvas" onPointerDown={e=>tap(e.clientX,e.clientY)} aria-label="Shatter Shot"/>
    <div className="shatterHud"><span>TOCA LOS PANELES</span><b>{hud.score.toLocaleString("es-ES")} pts</b><span>×{hud.combo}</span></div>
    <div className="gameRule">No dejes que ningún panel alcance la línea roja · aparecen cada vez más rápido</div>
  </div>;
}
