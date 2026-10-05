"use client";

import { useCallback,useEffect,useRef,useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone,haptic } from "@/lib/gameFeedback";

type Props={active:boolean;onFinish:(result:GameResult)=>void};
type Lane=0|1|2;
type Kind="block"|"jump";
type Obstacle={distance:number;lane:Lane;kind:Kind;passed:boolean};

const W=390,H=620,DT=1/120,PLAYER_Y=500,LANES=[98,195,292] as const;
const LANE_PATTERN:Lane[]=[1,0,2,2,1,0,1,2,0,0,2,1,0,2,1,1,0,2];
const KIND_PATTERN:Kind[]=["block","block","jump","block","jump","block","block","jump","block","jump","block","block","jump","block","jump","block","block","jump"];
const GAP_PATTERN=[248,226,238,214,232,205,220,198,212,192,205,188];

function initialObstacles(){
  const list:Obstacle[]=[];let d=620;
  for(let i=0;i<16;i++){list.push({distance:d,lane:LANE_PATTERN[i%LANE_PATTERN.length],kind:KIND_PATTERN[i%KIND_PATTERN.length],passed:false});d+=GAP_PATTERN[i%GAP_PATTERN.length];}
  return {list,nextDistance:list[list.length-1].distance,nextIndex:16};
}

export default function MetroShift({active,onFinish}:Props){
  const canvasRef=useRef<HTMLCanvasElement|null>(null),rafRef=useRef<number|null>(null),finishRef=useRef(onFinish);
  const swipeRef=useRef<{x:number;y:number}|null>(null);
  const state=useRef({lane:1 as Lane,x:LANES[1] as number,distance:0,obstacles:[] as Obstacle[],nextDistance:0,nextIndex:0,running:false,ticks:0,last:0,acc:0,passed:0,score:0,jumpY:0,jumpVy:0});
  const [hud,setHud]=useState({passed:0,score:0,speed:1});
  useEffect(()=>{finishRef.current=onFinish;},[onFinish]);

  const speedFor=(p:number)=>Math.min(360,190+p*4.2);

  const finish=useCallback(()=>{const s=state.current;if(!s.running)return;s.running=false;if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);const timeMs=Math.round(s.ticks*1000/120);gameTone("bad");haptic([30,25,52]);finishRef.current({won:false,score:s.score,timeMs});},[]);

  const extend=useCallback(()=>{const s=state.current,i=s.nextIndex++;const compression=Math.max(.7,1-Math.floor(s.passed/18)*.035);s.nextDistance+=GAP_PATTERN[i%GAP_PATTERN.length]*compression;s.obstacles.push({distance:s.nextDistance,lane:LANE_PATTERN[i%LANE_PATTERN.length],kind:KIND_PATTERN[i%KIND_PATTERN.length],passed:false});if(s.obstacles.length>24)s.obstacles.shift();},[]);

  const step=useCallback(()=>{const s=state.current;s.ticks++;const speed=speedFor(s.passed);const prev=s.distance;s.distance+=speed*DT;
    s.x+=(LANES[s.lane]-s.x)*.24;
    s.jumpVy+=1200*DT;s.jumpY+=s.jumpVy*DT;if(s.jumpY>0){s.jumpY=0;s.jumpVy=0;}
    for(const o of s.obstacles){if(o.passed)continue;const prevY=o.distance-prev,screenY=o.distance-s.distance;
      if(prevY>PLAYER_Y&&screenY<=PLAYER_Y){
        const sameLane=Math.abs(s.x-LANES[o.lane])<38;
        if(sameLane){
          if(o.kind==="block"){finish();return;}
          if(o.kind==="jump"&&s.jumpY>-34){finish();return;}
        }
        o.passed=true;s.passed++;s.score+=240+Math.min(480,s.passed*14);gameTone(s.passed%5===0?"good":"tap");if(s.passed%5===0)haptic(8);extend();
      }}
    if(s.ticks%5===0)setHud({passed:s.passed,score:s.score,speed:Number((speed/190).toFixed(2))});
  },[extend,finish]);

  const draw=useCallback(()=>{const c=canvasRef.current;if(!c)return;const ctx=c.getContext("2d");if(!ctx)return;const s=state.current;
    const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#7dc8ea");bg.addColorStop(.42,"#d9eef7");bg.addColorStop(.43,"#6d765b");bg.addColorStop(1,"#29312e");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    ctx.beginPath();ctx.moveTo(120,110);ctx.lineTo(270,110);ctx.lineTo(365,H);ctx.lineTo(25,H);ctx.closePath();ctx.fillStyle="#303741";ctx.fill();
    ctx.strokeStyle="rgba(255,255,255,.58)";ctx.lineWidth=3;ctx.setLineDash([18,18]);for(const x of [160,230]){ctx.beginPath();ctx.moveTo(x+(x<195?15:-15),110);ctx.lineTo(x+(x<195?-36:36),H);ctx.stroke();}ctx.setLineDash([]);
    for(const o of s.obstacles){const y=o.distance-s.distance;if(y<75||y>H+50)continue;const depth=Math.max(.3,Math.min(1,(y-90)/450));const spacing=97*depth,center=W/2,xs=[center-spacing,center,center+spacing],x=xs[o.lane],ow=58*depth+14,oh=o.kind==="jump"?28*depth+10:58*depth+14;
      ctx.fillStyle=o.kind==="jump"?"#e6ac3c":"#e4515f";ctx.fillRect(x-ow/2,y-oh/2,ow,oh);ctx.fillStyle="rgba(255,255,255,.3)";ctx.fillRect(x-ow/2+4,y-oh/2+4,ow-8,4);}
    ctx.save();ctx.translate(s.x,PLAYER_Y+s.jumpY);ctx.fillStyle="#ffd34f";ctx.beginPath();ctx.moveTo(0,-27);ctx.lineTo(18,23);ctx.lineTo(0,16);ctx.lineTo(-18,23);ctx.closePath();ctx.fill();ctx.fillStyle="#315fae";ctx.fillRect(-7,-11,14,20);ctx.restore();
    ctx.fillStyle="rgba(23,35,55,.84)";ctx.fillRect(14,14,W-28,52);ctx.font="800 12px system-ui";ctx.fillStyle="#fff";ctx.fillText(`PASADOS ${s.passed}`,26,36);ctx.fillStyle="#ffdd69";ctx.fillText(`${s.score.toLocaleString("es-ES")} PTS`,150,36);ctx.fillStyle="#7fe3aa";ctx.fillText(`×${(speedFor(s.passed)/190).toFixed(2)}`,310,36);
  },[]);

  const loop=useCallback((now:number)=>{const s=state.current;if(!s.running)return;if(!s.last)s.last=now;s.acc+=Math.min(.05,(now-s.last)/1000);s.last=now;while(s.acc>=DT&&s.running){step();s.acc-=DT;}draw();if(s.running)rafRef.current=requestAnimationFrame(loop);},[draw,step]);
  const start=useCallback(()=>{const init=initialObstacles();state.current={lane:1,x:LANES[1],distance:0,obstacles:init.list,nextDistance:init.nextDistance,nextIndex:init.nextIndex,running:true,ticks:0,last:0,acc:0,passed:0,score:0,jumpY:0,jumpVy:0};setHud({passed:0,score:0,speed:1});draw();rafRef.current=requestAnimationFrame(loop);},[draw,loop]);
  useEffect(()=>{if(active)start();return()=>{state.current.running=false;if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);};},[active,start]);

  function move(d:-1|1){const s=state.current;if(!s.running)return;const n=Math.max(0,Math.min(2,s.lane+d)) as Lane;if(n===s.lane)return;s.lane=n;gameTone("tap");haptic(5);}
  function jump(){const s=state.current;if(!s.running||s.jumpY<0)return;s.jumpVy=-430;gameTone("tap");haptic(5);}
  function gesture(dx:number,dy:number){if(Math.abs(dx)>Math.abs(dy)){if(dx>28)move(1);else if(dx<-28)move(-1);}else if(dy<-28)jump();}

  return <div className="gameStage skillGameStage metroShiftArena">
    <canvas ref={canvasRef} width={W} height={H} className="gameCanvas"
      onPointerDown={e=>{swipeRef.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerUp={e=>{if(!swipeRef.current)return;gesture(e.clientX-swipeRef.current.x,e.clientY-swipeRef.current.y);swipeRef.current=null;}}
      onPointerCancel={()=>{swipeRef.current=null;}} aria-label="Metro Shift"/>
    <div className="metroControls"><button onPointerDown={()=>move(-1)}>◀</button><button onPointerDown={jump}>SALTAR</button><button onPointerDown={()=>move(1)}>▶</button></div>
    <div className="gameRule">Rojo: cambia de carril · amarillo bajo: salta · la velocidad sube gradualmente</div>
  </div>;
}
