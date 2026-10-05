"use client";

import { useCallback,useEffect,useRef,useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone,haptic } from "@/lib/gameFeedback";

type Props={active:boolean;onFinish:(result:GameResult)=>void};
type Obstacle={x:number;w:number;h:number;passed:boolean};

const W=390,H=620,DT=1/120,FLOOR=520,PLAYER_X=88,PW=28,PH=34;
const GAP_PATTERN=[250,220,270,205,238,198,255,214,232,192,246,208];
const HEIGHT_PATTERN=[34,48,38,56,42,62,36,52,45,58,40,64];

export default function PulseRunner({active,onFinish}:Props){
  const canvasRef=useRef<HTMLCanvasElement|null>(null),rafRef=useRef<number|null>(null),finishRef=useRef(onFinish);
  const jumpHeld=useRef(false);
  const state=useRef({y:FLOOR-PH,vy:0,scroll:0,obstacles:[] as Obstacle[],nextX:520,nextIndex:0,running:false,ticks:0,last:0,acc:0,passed:0,score:0,grounded:true,coyote:0,jumpBuffer:0});
  const [hud,setHud]=useState({passed:0,score:0,speed:1});
  useEffect(()=>{finishRef.current=onFinish;},[onFinish]);

  const speedFor=(p:number)=>Math.min(330,170+p*3.4);

  const finish=useCallback(()=>{const s=state.current;if(!s.running)return;s.running=false;if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);const timeMs=Math.round(s.ticks*1000/120);gameTone("bad");haptic([30,25,52]);finishRef.current({won:false,score:s.score,timeMs});},[]);

  const addObstacle=useCallback(()=>{const s=state.current,i=s.nextIndex++;const compression=Math.max(.72,1-Math.floor(s.passed/18)*.035);s.nextX+=GAP_PATTERN[i%GAP_PATTERN.length]*compression;s.obstacles.push({x:s.nextX,w:34+(i%3)*4,h:HEIGHT_PATTERN[i%HEIGHT_PATTERN.length],passed:false});if(s.obstacles.length>20)s.obstacles.shift();},[]);

  const step=useCallback(()=>{const s=state.current;s.ticks++;const speed=speedFor(s.passed);s.scroll+=speed*DT;
    if(jumpHeld.current)s.jumpBuffer=8;else s.jumpBuffer=Math.max(0,s.jumpBuffer-1);
    if(s.grounded)s.coyote=8;else s.coyote=Math.max(0,s.coyote-1);
    if(s.jumpBuffer>0&&s.coyote>0){s.vy=-505;s.grounded=false;s.coyote=0;s.jumpBuffer=0;gameTone("tap");haptic(4);}
    if(!jumpHeld.current&&s.vy<-180)s.vy+=1450*DT*1.5;
    s.vy+=1450*DT;s.y+=s.vy*DT;
    if(s.y+PH>=FLOOR){s.y=FLOOR-PH;s.vy=0;s.grounded=true;}
    const px1=PLAYER_X,px2=PLAYER_X+PW,py1=s.y,py2=s.y+PH;
    for(const o of s.obstacles){const x=o.x-s.scroll;if(x>W+70||x+o.w<-50)continue;const oy1=FLOOR-o.h;
      if(px2>x&&px1<x+o.w&&py2>oy1&&py1<FLOOR){finish();return;}
      if(!o.passed&&x+o.w<PLAYER_X){o.passed=true;s.passed++;s.score+=300+Math.min(520,s.passed*18);gameTone(s.passed%5===0?"good":"tap");if(s.passed%5===0)haptic(8);addObstacle();}}
    if(s.ticks%5===0)setHud({passed:s.passed,score:s.score,speed:Number((speed/170).toFixed(2))});
  },[addObstacle,finish]);

  const draw=useCallback(()=>{const c=canvasRef.current;if(!c)return;const ctx=c.getContext("2d");if(!ctx)return;const s=state.current;
    const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#132a54");bg.addColorStop(.58,"#244f86");bg.addColorStop(.59,"#1d2741");bg.addColorStop(1,"#0b1227");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    ctx.fillStyle="rgba(108,180,255,.12)";for(let x=-((s.scroll*.25)%55);x<W;x+=55)ctx.fillRect(x,90,2,FLOOR-90);
    ctx.fillStyle="#283a5b";ctx.fillRect(0,FLOOR,W,H-FLOOR);ctx.fillStyle="#57c6e7";ctx.fillRect(0,FLOOR,W,5);
    for(const o of s.obstacles){const x=o.x-s.scroll;if(x<-60||x>W+60)continue;ctx.fillStyle="#ef586a";ctx.fillRect(x,FLOOR-o.h,o.w,o.h);ctx.fillStyle="#ffcc59";ctx.fillRect(x+4,FLOOR-o.h+4,o.w-8,5);}
    ctx.save();ctx.translate(PLAYER_X+PW/2,s.y+PH/2);ctx.rotate(Math.max(-.25,Math.min(.25,s.vy/750)));ctx.shadowBlur=16;ctx.shadowColor="#6de6ff";ctx.fillStyle="#6de6ff";ctx.fillRect(-PW/2,-PH/2,PW,PH);ctx.shadowBlur=0;ctx.fillStyle="#fff";ctx.fillRect(6,-8,5,5);ctx.restore();
    ctx.fillStyle="rgba(7,14,34,.84)";ctx.fillRect(14,14,W-28,52);ctx.font="800 12px system-ui";ctx.fillStyle="#fff";ctx.fillText(`PASADOS ${s.passed}`,26,36);ctx.fillStyle="#ffdc67";ctx.fillText(`${s.score.toLocaleString("es-ES")} PTS`,150,36);ctx.fillStyle="#78e3a5";ctx.fillText(`×${(speedFor(s.passed)/170).toFixed(2)}`,310,36);
  },[]);

  const loop=useCallback((now:number)=>{const s=state.current;if(!s.running)return;if(!s.last)s.last=now;s.acc+=Math.min(.05,(now-s.last)/1000);s.last=now;while(s.acc>=DT&&s.running){step();s.acc-=DT;}draw();if(s.running)rafRef.current=requestAnimationFrame(loop);},[draw,step]);
  const start=useCallback(()=>{const obstacles:Obstacle[]=[];let x=520;for(let i=0;i<9;i++){obstacles.push({x,w:34+(i%3)*4,h:HEIGHT_PATTERN[i%HEIGHT_PATTERN.length],passed:false});x+=GAP_PATTERN[i%GAP_PATTERN.length];}state.current={y:FLOOR-PH,vy:0,scroll:0,obstacles,nextX:x,nextIndex:9,running:true,ticks:0,last:0,acc:0,passed:0,score:0,grounded:true,coyote:8,jumpBuffer:0};jumpHeld.current=false;setHud({passed:0,score:0,speed:1});draw();rafRef.current=requestAnimationFrame(loop);},[draw,loop]);
  useEffect(()=>{if(active)start();return()=>{state.current.running=false;if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);};},[active,start]);

  const down=()=>{jumpHeld.current=true;};const up=()=>{jumpHeld.current=false;};

  return <div className="gameStage skillGameStage pulseRunnerArena">
    <canvas ref={canvasRef} width={W} height={H} className="gameCanvas" onPointerDown={down} onPointerUp={up} onPointerCancel={up} aria-label="Pulse Runner"/>
    <div className="pulseRunnerHud"><div><small>OBSTÁCULOS</small><strong>{hud.passed}</strong></div><button onPointerDown={down} onPointerUp={up} onPointerCancel={up}>SALTAR</button><div><small>VELOCIDAD</small><strong>×{hud.speed}</strong></div></div>
    <div className="gameRule">Mantén un instante para alargar el salto · cada obstáculo acelera</div>
  </div>;
}
