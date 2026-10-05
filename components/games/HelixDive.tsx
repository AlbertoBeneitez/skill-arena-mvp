"use client";

import { useCallback,useEffect,useRef,useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone,haptic } from "@/lib/gameFeedback";

type Props={active:boolean;onFinish:(result:GameResult)=>void};
type Platform={y:number;gap:number;redStart:number;passed:boolean};

const W=390,H=620,DT=1/120,CX=W/2,RADIUS=122,BALL_X=CX,BALL_Y=178;
const GAP_PATTERN=[-1.05,-.42,.35,1.15,.68,-.76,.08,1.42,-1.34,.52,-.18,.92];
const RED_PATTERN=[.15,1.42,-.68,.78,-1.35,.44,1.02,-.08,1.62,-.92,.3,-1.58];

function wrap(a:number){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;}
function angleDiff(a:number,b:number){return Math.abs(wrap(a-b));}

export default function HelixDive({active,onFinish}:Props){
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const rafRef=useRef<number|null>(null);
  const finishRef=useRef(onFinish);
  const dragRef=useRef<{x:number;rotation:number}|null>(null);
  const state=useRef({rotation:0,fall:0,vy:0,score:0,passed:0,running:false,ticks:0,last:0,acc:0,platforms:[] as Platform[],next:0});
  const [hud,setHud]=useState({passed:0,score:0,speed:1});

  useEffect(()=>{finishRef.current=onFinish;},[onFinish]);

  const makePlatform=(i:number,y:number):Platform=>({y,gap:GAP_PATTERN[i%GAP_PATTERN.length],redStart:RED_PATTERN[i%RED_PATTERN.length],passed:false});

  const finish=useCallback(()=>{
    const s=state.current;if(!s.running)return;s.running=false;
    if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);
    const timeMs=Math.round((s.ticks*1000)/120);gameTone("bad");haptic([30,24,50]);
    finishRef.current({won:false,score:s.score,timeMs});
  },[]);

  const step=useCallback(()=>{
    const s=state.current;s.ticks++;
    const gravity=650+Math.min(260,s.passed*7);
    s.vy+=gravity*DT;s.fall+=s.vy*DT;
    const worldBallY=BALL_Y+s.fall;
    const gapHalf=Math.max(.24,.48-s.passed*.0045);
    for(const p of s.platforms){
      const screenY=p.y-s.fall;
      if(screenY<80||screenY>H+60)continue;
      if(!p.passed&&worldBallY>=p.y-5&&worldBallY<=p.y+18&&s.vy>0){
        const gapAngle=wrap(p.gap+s.rotation);
        const redAngle=wrap(p.redStart+s.rotation);
        const atGap=angleDiff(-Math.PI/2,gapAngle)<gapHalf;
        const atRed=angleDiff(-Math.PI/2,redAngle)<.34;
        if(atRed){finish();return;}
        if(atGap){
          p.passed=true;s.passed++;s.score+=420+Math.min(420,s.passed*16);s.vy+=65;
          gameTone(s.passed%5===0?"good":"tap");if(s.passed%5===0)haptic(8);
          const last=s.platforms[s.platforms.length-1];
          s.platforms.push(makePlatform(s.next,last.y+118));s.next++;
          if(s.platforms.length>18)s.platforms.shift();
        }else{
          s.vy=-250;
          s.fall=p.y-BALL_Y-8;
          gameTone("tap");haptic(4);
        }
      }
    }
    if(s.ticks%5===0)setHud({passed:s.passed,score:s.score,speed:Number(((650+Math.min(260,s.passed*7))/650).toFixed(2))});
  },[finish]);

  const draw=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext("2d");if(!ctx)return;const s=state.current;
    const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#17234f");bg.addColorStop(1,"#0a1028");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    ctx.fillStyle="rgba(255,255,255,.04)";for(let y=90;y<H;y+=45)ctx.fillRect(0,y,W,1);
    const gapHalf=Math.max(.24,.48-s.passed*.0045);
    for(const p of s.platforms){
      const y=p.y-s.fall;if(y<70||y>H+70)continue;
      const scale=.62+Math.min(1,Math.max(0,(y-70)/(H-70)))*.38;
      const r=RADIUS*scale;
      ctx.save();ctx.translate(CX,y);ctx.scale(1,.28);
      ctx.lineWidth=26*scale;ctx.lineCap="butt";
      ctx.strokeStyle="rgba(116,156,224,.65)";
      ctx.beginPath();ctx.arc(0,0,r,-Math.PI,Math.PI);ctx.stroke();
      const gap=wrap(p.gap+s.rotation);
      ctx.strokeStyle="#0a1028";ctx.lineWidth=31*scale;ctx.beginPath();ctx.arc(0,0,r,gap-gapHalf,gap+gapHalf);ctx.stroke();
      const red=wrap(p.redStart+s.rotation);
      ctx.strokeStyle="#ef5264";ctx.lineWidth=28*scale;ctx.beginPath();ctx.arc(0,0,r,red-.32,red+.32);ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle="rgba(78,111,173,.45)";ctx.fillRect(CX-8,76,16,H-76);
    ctx.shadowBlur=20;ctx.shadowColor="#ffd45a";ctx.fillStyle="#ffd45a";ctx.beginPath();ctx.arc(BALL_X,BALL_Y,13,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle="rgba(10,18,44,.82)";ctx.fillRect(14,14,W-28,52);ctx.font="800 12px system-ui";ctx.fillStyle="#fff";ctx.fillText(`PISOS ${s.passed}`,26,36);ctx.fillStyle="#ffdc67";ctx.fillText(`${s.score.toLocaleString("es-ES")} PTS`,145,36);ctx.fillStyle="#75e3a3";ctx.fillText(`×${((650+Math.min(260,s.passed*7))/650).toFixed(2)}`,310,36);
  },[]);

  const loop=useCallback((now:number)=>{const s=state.current;if(!s.running)return;if(!s.last)s.last=now;s.acc+=Math.min(.05,(now-s.last)/1000);s.last=now;while(s.acc>=DT&&s.running){step();s.acc-=DT;}draw();if(s.running)rafRef.current=requestAnimationFrame(loop);},[draw,step]);

  const start=useCallback(()=>{const platforms:Array<Platform>=[];for(let i=0;i<10;i++)platforms.push(makePlatform(i,280+i*118));state.current={rotation:0,fall:0,vy:0,score:0,passed:0,running:true,ticks:0,last:0,acc:0,platforms,next:10};setHud({passed:0,score:0,speed:1});draw();rafRef.current=requestAnimationFrame(loop);},[draw,loop]);

  useEffect(()=>{if(active)start();return()=>{state.current.running=false;if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);};},[active,start]);

  function localX(clientX:number){
    const canvas=canvasRef.current;
    if(!canvas)return 0;
    const rect=canvas.getBoundingClientRect();
    return ((clientX-rect.left)/rect.width)*W;
  }
  function down(clientX:number){dragRef.current={x:localX(clientX),rotation:state.current.rotation};}
  function move(clientX:number){if(!dragRef.current)return;const x=localX(clientX);state.current.rotation=dragRef.current.rotation+(x-dragRef.current.x)*.012;}
  function up(){dragRef.current=null;}

  return <div className="gameStage skillGameStage helixDiveArena">
    <canvas ref={canvasRef} width={W} height={H} className="gameCanvas" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);down(e.clientX);}} onPointerMove={e=>move(e.clientX)} onPointerUp={up} onPointerCancel={up} aria-label="Helix Dive"/>
    <div className="helixHint">↔ ARRASTRA PARA GIRAR</div>
    <div className="gameRule">Alinea huecos y evita rojo · la caída se acelera poco a poco</div>
  </div>;
}
