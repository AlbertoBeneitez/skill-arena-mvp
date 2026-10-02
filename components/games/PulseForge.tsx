"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = { active: boolean; onFinish: (result: GameResult) => void };

const TARGETS = [50,28,72,38,62,20,80,46,68,34,57,24,76,42];
const SPEEDS = [58,64,70,76,82,88,94,102,110,118,126,134];

function targetFor(index:number){
  const center=TARGETS[index%TARGETS.length];
  const cycle=Math.floor(index/TARGETS.length);
  const width=Math.max(7,18-cycle*1.6-Math.floor(index/4)*.35);
  return {center,width};
}
function speedFor(index:number){
  return SPEEDS[Math.min(SPEEDS.length-1,index)]+Math.floor(index/SPEEDS.length)*8;
}

export default function PulseForge({active,onFinish}:Props){
  const frameRef=useRef<number|null>(null);
  const finishRef=useRef(onFinish);
  const state=useRef({marker:0,direction:1,last:0,ticks:0,score:0,combo:0,round:0,running:false});
  const [view,setView]=useState({marker:0,score:0,combo:0,round:0});

  useEffect(()=>{finishRef.current=onFinish;},[onFinish]);

  const finish=useCallback(()=>{
    const s=state.current;
    if(!s.running)return;
    s.running=false;
    if(frameRef.current!==null)cancelAnimationFrame(frameRef.current);
    const timeMs=Math.round((s.ticks*1000)/60);
    gameTone("bad");
    haptic([30,28,48]);
    finishRef.current({won:false,score:s.score,timeMs});
  },[]);

  const hit=useCallback(()=>{
    const s=state.current;
    if(!s.running)return;
    const target=targetFor(s.round);
    const distance=Math.abs(s.marker-target.center);
    if(distance>target.width/2){
      finish();
      return;
    }
    const precision=Math.max(0,1-distance/(target.width/2));
    const perfect=precision>.72;
    s.score+=520+Math.round(precision*420)+s.combo*24;
    s.combo+=1;
    s.round+=1;
    const nextTarget=targetFor(s.round);
    s.marker=nextTarget.center>=50?0:100;
    s.direction=nextTarget.center>=50?1:-1;
    setView({marker:s.marker,score:s.score,combo:s.combo,round:s.round});
    gameTone(perfect?"good":"tap");
    haptic(perfect?12:6);
  },[finish]);

  useEffect(()=>{
    if(!active)return;
    state.current={marker:0,direction:1,last:performance.now(),ticks:0,score:0,combo:0,round:0,running:true};
    setView({marker:0,score:0,combo:0,round:0});

    const loop=(now:number)=>{
      const s=state.current;
      if(!s.running)return;
      const dt=Math.min(.04,(now-s.last)/1000);
      s.last=now;
      s.ticks+=1;
      const previous=s.marker;
      let next=s.marker+s.direction*dt*speedFor(s.round);
      const target=targetFor(s.round);
      const lower=target.center-target.width/2;
      const upper=target.center+target.width/2;
      const missed=s.direction>0
        ? previous<=upper&&next>upper
        : previous>=lower&&next<lower;
      if(missed){finish();return;}
      s.marker=Math.max(0,Math.min(100,next));
      setView({marker:s.marker,score:s.score,combo:s.combo,round:s.round});
      frameRef.current=requestAnimationFrame(loop);
    };
    frameRef.current=requestAnimationFrame(loop);
    return()=>{state.current.running=false;if(frameRef.current!==null)cancelAnimationFrame(frameRef.current);};
  },[active,finish]);

  const target=targetFor(view.round);
  const left=target.center-target.width/2;

  return(
    <div className="gameStage pulseForgeArena">
      <div className="pulseForgeHeader">
        <div><small>RACHA</small><strong>×{view.combo}</strong></div>
        <div><small>PUNTOS</small><strong>{view.score.toLocaleString("es-ES")}</strong></div>
        <div><small>VELOCIDAD</small><strong>{speedFor(view.round)}</strong></div>
      </div>
      <div className="pulseForgeCore">
        <div className="pulseForgeTitle">PULSE FORGE</div>
        <div className="pulseForgeSub">Cada acierto aumenta velocidad y reduce la ventana.</div>
        <div className="pulseForgeTrack" onPointerDown={hit}>
          <div className="pulseForgeTarget" style={{left:`${left}%`,width:`${target.width}%`}}/>
          <div className="pulseForgePerfect" style={{left:`${target.center-target.width*.18}%`,width:`${target.width*.36}%`}}/>
          <div className="pulseForgeMarker" style={{left:`calc(${view.marker}% - 4px)`}}/>
        </div>
        <div className="pulseForgeRound">PULSO {view.round+1}</div>
        <button className="pulseForgeButton" onPointerDown={hit}>GOLPEAR</button>
      </div>
      <div className="gameRule">Acierta para continuar · un toque fuera termina la partida</div>
    </div>
  );
}
